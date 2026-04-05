interface PartyBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

export default function PartyBadge({ name, color, size = 'md' }: PartyBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center rounded font-medium text-white ${sizeClasses}`}
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}
