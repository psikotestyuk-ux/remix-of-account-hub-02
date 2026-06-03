
-- ============ WISHLIST ============
CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_wishlists_user ON public.wishlists(user_id);
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own wishlist" ON public.wishlists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own wishlist" ON public.wishlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own wishlist" ON public.wishlists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ REVIEWS ============
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  order_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_reviews_product ON public.product_reviews(product_id);
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read reviews" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "users insert own review" ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.user_id = auth.uid()
        AND o.product_id = product_reviews.product_id
        AND o.order_status = 'completed'
    )
  );
CREATE POLICY "users update own review" ON public.product_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own review" ON public.product_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage reviews" ON public.product_reviews FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.recompute_product_rating(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_avg numeric;
BEGIN
  SELECT COALESCE(AVG(rating), 4.8) INTO v_avg
  FROM public.product_reviews WHERE product_id = _product_id;
  UPDATE public.products SET rating = ROUND(v_avg, 1), updated_at = now() WHERE id = _product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_product_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_product_rating(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_product_rating(NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_reviews_rating_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_product_rating();

-- ============ LIVE CHAT ============
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  last_message_at timestamptz,
  last_message_preview text,
  unread_user int NOT NULL DEFAULT 0,
  unread_admin int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own conv" ON public.chat_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own conv" ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own conv" ON public.chat_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins all conv" ON public.chat_conversations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read msgs in own conv" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "users insert msgs in own conv" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND sender_role = 'user' AND
    EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "users update msgs in own conv" ON public.chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "admins all msgs" ON public.chat_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;

-- RPC: send chat message (auto-create conversation, update counters)
CREATE OR REPLACE FUNCTION public.send_chat_message(_content text)
RETURNS TABLE(success boolean, conversation_id uuid, message_id uuid, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_conv uuid;
  v_msg uuid;
  v_preview text;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Tidak login'::text; RETURN;
  END IF;
  IF _content IS NULL OR length(trim(_content)) = 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Pesan kosong'::text; RETURN;
  END IF;
  IF length(_content) > 2000 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Pesan terlalu panjang'::text; RETURN;
  END IF;

  SELECT id INTO v_conv FROM public.chat_conversations WHERE user_id = v_user;
  IF v_conv IS NULL THEN
    INSERT INTO public.chat_conversations (user_id) VALUES (v_user) RETURNING id INTO v_conv;
  END IF;

  v_preview := left(_content, 100);

  INSERT INTO public.chat_messages (conversation_id, sender_id, sender_role, content)
  VALUES (v_conv, v_user, 'user', _content) RETURNING id INTO v_msg;

  UPDATE public.chat_conversations
  SET last_message_at = now(),
      last_message_preview = v_preview,
      unread_admin = unread_admin + 1,
      updated_at = now()
  WHERE id = v_conv;

  RETURN QUERY SELECT true, v_conv, v_msg, 'OK'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_send_chat_message(_conversation_id uuid, _content text)
RETURNS TABLE(success boolean, message_id uuid, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Tidak diizinkan'::text; RETURN;
  END IF;
  IF _content IS NULL OR length(trim(_content)) = 0 OR length(_content) > 2000 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Pesan tidak valid'::text; RETURN;
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender_id, sender_role, content)
  VALUES (_conversation_id, auth.uid(), 'admin', _content) RETURNING id INTO v_msg;

  UPDATE public.chat_conversations
  SET last_message_at = now(),
      last_message_preview = left(_content, 100),
      unread_user = unread_user + 1,
      updated_at = now()
  WHERE id = _conversation_id;

  RETURN QUERY SELECT true, v_msg, 'OK'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_chat_read(_conversation_id uuid, _as_admin boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _as_admin THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN; END IF;
    UPDATE public.chat_conversations SET unread_admin = 0, updated_at = now() WHERE id = _conversation_id;
    UPDATE public.chat_messages SET read_at = now()
      WHERE conversation_id = _conversation_id AND sender_role = 'user' AND read_at IS NULL;
  ELSE
    UPDATE public.chat_conversations SET unread_user = 0, updated_at = now()
      WHERE id = _conversation_id AND user_id = auth.uid();
    UPDATE public.chat_messages SET read_at = now()
      WHERE conversation_id = _conversation_id AND sender_role = 'admin' AND read_at IS NULL
        AND EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = _conversation_id AND c.user_id = auth.uid());
  END IF;
END;
$$;

-- ============ SALES REPORT ============
CREATE OR REPLACE FUNCTION public.get_sales_report(_start_date date, _end_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  WITH paid AS (
    SELECT o.*, p.name AS product_name, p.category::text AS product_category
    FROM public.orders o
    LEFT JOIN public.products p ON p.id = o.product_id
    WHERE o.payment_status = 'paid'
      AND o.created_at::date BETWEEN _start_date AND _end_date
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(total_price),0)::bigint AS revenue,
      COUNT(*)::int AS order_count,
      COALESCE(AVG(total_price),0)::bigint AS aov,
      COUNT(DISTINCT user_id)::int AS customers
    FROM paid
  ),
  daily AS (
    SELECT created_at::date AS day,
      COALESCE(SUM(total_price),0)::bigint AS revenue,
      COUNT(*)::int AS orders
    FROM paid GROUP BY 1 ORDER BY 1
  ),
  top_products AS (
    SELECT product_id, product_name,
      SUM(quantity)::int AS qty,
      SUM(total_price)::bigint AS revenue
    FROM paid GROUP BY product_id, product_name
    ORDER BY revenue DESC LIMIT 10
  ),
  top_cats AS (
    SELECT product_category AS category,
      SUM(total_price)::bigint AS revenue,
      COUNT(*)::int AS orders
    FROM paid GROUP BY product_category ORDER BY revenue DESC
  ),
  payments AS (
    SELECT COALESCE(payment_method,'unknown') AS method,
      SUM(total_price)::bigint AS revenue,
      COUNT(*)::int AS orders
    FROM paid GROUP BY 1
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT to_jsonb(k) FROM kpis k),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d), '[]'::jsonb),
    'top_products', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM top_products t), '[]'::jsonb),
    'top_categories', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM top_cats c), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM payments p), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
