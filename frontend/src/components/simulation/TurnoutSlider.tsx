interface TurnoutSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function TurnoutSlider({ value, onChange }: TurnoutSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Részvételi arány
        </h4>
        <span className="font-data text-sm text-white">{value.toFixed(1)}%</span>
      </div>
      <input
        type="range"
        min="40"
        max="90"
        step="0.5"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-700"
      />
      <div className="flex justify-between text-xs text-gray-600">
        <span>40%</span>
        <span>65%</span>
        <span>90%</span>
      </div>
    </div>
  );
}
