import { cn } from "@/lib/utils";

interface SealedValueProps {
  value?: string | number;
  isSealed?: boolean;
  className?: string;
}

export function SealedValue({ value, isSealed = true, className }: SealedValueProps) {
  if (isSealed || value === undefined) {
    return (
      <span className={cn("font-mono text-[#E41E26] uppercase animate-pulse drop-shadow-[1px_1px_0px_rgba(0,0,0,0.1)]", className)}>
        [sealed]
      </span>
    );
  }

  return (
    <span className={cn("font-mono text-black font-bold", className)}>
      {value}
    </span>
  );
}
