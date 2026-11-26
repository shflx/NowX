import { cn } from "@/lib/utils";

type ColorSwatchesProps = {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
};

/** 颜色单选：一排圆形色块 */
export function ColorSwatches({ colors, value, onChange }: ColorSwatchesProps) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="颜色">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            "size-6.5 rounded-full ring-offset-2 ring-offset-card transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
            color === value && "ring-2 ring-foreground",
          )}
          style={{ background: color }}
        />
      ))}
    </div>
  );
}
