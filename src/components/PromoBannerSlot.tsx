import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useRef } from "react";
import { cn } from "@/lib/utils";

type Placement = "home_hero" | "products_top" | "product_detail" | "cart_checkout";

type Banner = {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  product_id: string | null;
};

const ASPECT: Record<Placement, string> = {
  home_hero: "aspect-[16/6] md:aspect-[21/7]",
  products_top: "aspect-[16/5] md:aspect-[21/6]",
  product_detail: "aspect-[16/5]",
  cart_checkout: "aspect-[16/5]",
};

export function PromoBannerSlot({
  placement,
  className,
}: {
  placement: Placement;
  className?: string;
}) {
  const autoplay = useRef(Autoplay({ delay: 5000, stopOnInteraction: false }));

  const { data: banners } = useQuery({
    queryKey: ["promo-banners", placement],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("promo_banners")
        .select("id, image_url, title, subtitle, product_id, starts_at, ends_at, is_active")
        .eq("placement", placement)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []).filter((b: any) => {
        if (b.starts_at && b.starts_at > nowIso) return false;
        if (b.ends_at && b.ends_at < nowIso) return false;
        return true;
      }) as Banner[];
    },
    staleTime: 60_000,
  });

  if (!banners || banners.length === 0) return null;

  const renderBanner = (b: Banner) => {
    const content = (
      <div className={cn("relative w-full overflow-hidden rounded-2xl bg-muted", ASPECT[placement])}>
        <img
          src={b.image_url}
          alt={b.title || "Promo"}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          loading="lazy"
        />
        {(b.title || b.subtitle) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 text-white">
            {b.title && <p className="font-bold drop-shadow md:text-lg">{b.title}</p>}
            {b.subtitle && <p className="text-xs opacity-90 md:text-sm">{b.subtitle}</p>}
          </div>
        )}
      </div>
    );
    return b.product_id ? (
      <Link to={`/products/${b.product_id}`} aria-label={b.title || "Promo"}>
        {content}
      </Link>
    ) : (
      content
    );
  };

  if (banners.length === 1) {
    return <div className={cn("w-full", className)}>{renderBanner(banners[0])}</div>;
  }

  return (
    <div className={cn("w-full", className)}>
      <Carousel
        plugins={[autoplay.current]}
        opts={{ loop: true, align: "start" }}
        className="w-full"
      >
        <CarouselContent>
          {banners.map((b) => (
            <CarouselItem key={b.id}>{renderBanner(b)}</CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
