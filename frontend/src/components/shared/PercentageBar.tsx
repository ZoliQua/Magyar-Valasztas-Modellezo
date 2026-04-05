interface PercentageBarProps {
  value: number;
  color: string;
  label?: string;
  maxValue?: number;
}

export default function PercentageBar({ value, color, label, maxValue = 100 }: PercentageBarProps) {
  const width = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-gray-400 w-16">{label}</span>}
      <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-data text-xs text-gray-300 w-12 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}
