import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key, value");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r) => { map[r.key] = r.value || ""; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWhatsAppNumber() {
  const { data } = useAppSettings();
  return data?.whatsapp_admin_number || "";
}