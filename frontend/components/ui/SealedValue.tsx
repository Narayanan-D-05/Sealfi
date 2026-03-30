interface SealedValueProps {
  value: number | undefined;
  label?: string;
}

export function SealedValue({ value, label }: SealedValueProps) {
  if (value === undefined || value === 0) {
    return <span className="font-mono text-yellow">[sealed]</span>;
  }
  return (
    <span className="font-mono text-white">
      {value.toLocaleString()}
    </span>
  );
}
