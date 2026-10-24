// Small inline icons. All decorative: callers supply the accessible text.

interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
});

export function MenuIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CopyIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ExternalIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </svg>
  );
}

export function WarningIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3.5L21.5 20h-19L12 3.5z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function SparkleIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 0.5l1.7 5.8 5.8 1.7-5.8 1.7L8 15.5l-1.7-5.8L0.5 8l5.8-1.7z" fill="currentColor" />
    </svg>
  );
}

export function ChevronIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function RefreshIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
    </svg>
  );
}

export function LockIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function ScaleIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0L5 8zM19 8l-2.5 6a3 3 0 0 0 5 0L19 8z" />
    </svg>
  );
}

export function NoKeyIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H20M17 12v3M3.5 3.5l17 17" />
    </svg>
  );
}

export function CapIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 18h16M6 18V10M18 18V10M4 10h16M12 3l8 4H4l8-4z" />
    </svg>
  );
}

export function RepeatIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" />
    </svg>
  );
}

export function PotIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function ShieldIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3.5l7 2.8v5.4c0 4.1-2.9 7.6-7 8.8-4.1-1.2-7-4.7-7-8.8V6.3l7-2.8z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </svg>
  );
}

export function GroupsIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="4.5" r="1.6" />
      <circle cx="18.5" cy="15.8" r="1.6" />
      <circle cx="5.5" cy="15.8" r="1.6" />
    </svg>
  );
}

export function PercentIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M19 5L5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </svg>
  );
}
