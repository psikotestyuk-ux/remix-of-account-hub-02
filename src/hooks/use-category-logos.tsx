import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategoryLogos() {
  const { data } = useQuery({
    queryKey: ["category-logos-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("category_settings")
        .select("slug, logo_url")
        .eq("is_active", true);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      (data || []).forEach((c: any) => { map[c.slug] = c.logo_url; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data || {};
}
