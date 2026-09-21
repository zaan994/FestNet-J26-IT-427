import { useId } from "react";

interface Props {
  /** Icon size in px. */
  size?: number;
  /** Show the "FestNet" wordmark next to the icon. */
  wordmark?: boolean;
  subtitle?: string;
}

/** FestNet mark: gradient wristband tile with a pulse line. Same artwork as public/favicon.svg. */
export function Logo({ size = 36, wordmark = true, subtitle }: Props) {
  const gradientId = useId();
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0 drop-shadow-sm">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7C3AED" />
            <stop offset="1" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${gradientId})`} />
        <path
          d="M12 34h10l5-12 8 22 6-14h11"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {wordmark && (
        <div className="leading-tight">
          <p className="text-lg font-extrabold tracking-tight">
            Fest<span className="gradient-text">Net</span>
          </p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
