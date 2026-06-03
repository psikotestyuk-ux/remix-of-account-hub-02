import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}

export function StarRating({ value, onChange, size = 20, readOnly }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={cn("transition-transform", !readOnly && "hover:scale-110")}
          aria-label={`${n} bintang`}
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}