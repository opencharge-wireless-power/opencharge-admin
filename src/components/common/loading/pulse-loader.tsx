

type PulseLoaderProps = {
  size?: number; // size in Tailwind units (1 unit = 0.25rem)
  color?: string; // Tailwind background color for pulses
  innerColor?: string; // Tailwind background color for inner circle
  pulseCount?: number; // number of overlapping pulses
  speed?: number; // duration of one pulse in seconds
};

export function PulseLoader({
  size = 6,
  color = "bg-neutral-400",
  innerColor = "bg-neutral-950",
  pulseCount = 3,
  speed = 1.5,
}: PulseLoaderProps) {
  const pulses = Array.from({ length: pulseCount });

  return (
    <span
      className="relative flex"
      style={{ height: `${size * 0.25}rem`, width: `${size * 0.25}rem` }}
    >
      {pulses.map((_, i) => {
        const delay = (i * speed) / pulseCount;
        return (
          <span
            key={i}
            className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}
            style={{
              animation: `pulse ${speed}s ease-out infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}

      {/* Inner static circle */}
      <span
        className={`relative inline-flex rounded-full ${innerColor}`}
        style={{ height: `${size * 0.25}rem`, width: `${size * 0.25}rem` }}
      />

      {/* Tailwind doesn't include custom keyframes by default, so add inline */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.75; }
            50% { transform: scale(2); opacity: 0; }
            100% { transform: scale(1); opacity: 0; }
          }
        `}
      </style>
    </span>
  );
}
