import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWhatsAppNumber } from "@/hooks/use-app-settings";
import { toast } from "sonner";

interface Props {
  message?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function WhatsAppButton({ message, label = "Hubungi via WhatsApp", variant = "outline", size = "sm", className }: Props) {
  const number = useWhatsAppNumber();

  const handleClick = () => {
    if (!number) {
      toast.error("Nomor WhatsApp admin belum diatur");
      return;
    }
    const url = `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!number) return null;

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleClick}>
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}