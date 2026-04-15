type ProgressRingProps = {
  percentage: number;
  size?: number;
};

export function ProgressRing({ percentage, size = 28 }: ProgressRingProps) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const displayValue = Math.round(percentage);

  return (
    <div
      className="relative flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="relative text-[8px] font-bold text-white">
        {displayValue}
      </span>
    </div>
  );
}
