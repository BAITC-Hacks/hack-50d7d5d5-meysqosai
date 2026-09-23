export type IconName =
  | "transport"
  | "environment"
  | "social"
  | "safety"
  | "services"
  | "city"
  | "district"
  | "budget"
  | "effect"
  | "risk"
  | "clock"
  | "map"
  | "check"
  | "plus"
  | "remove"
  | "reset"
  | "copy"
  | "info";

const paths: Record<IconName, React.ReactNode> = {
  transport: <><path d="M5 17h14M7 17V8.5A2.5 2.5 0 0 1 9.5 6h5A2.5 2.5 0 0 1 17 8.5V17M7 11h10M9 20v-3m6 3v-3" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /></>,
  environment: <><path d="M19 4c-7 .2-12 3.3-12 8.2 0 2.7 2 4.8 4.8 4.8C16.7 17 19 11 19 4Z" /><path d="M5 20c1.7-4.8 5.3-8 10-10" /></>,
  social: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 9.5c2 .2 3 1.5 3.3 3.5M16 16h4" /></>,
  safety: <><path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  services: <><path d="M4 7h16M7 3v4m10-4v4M6 11h4v4H6zM14 11h4v4h-4zM6 18h4M14 18h4" /></>,
  city: <><path d="M3 20h18M5 20V9l5-3v14M10 20V4l9 4v12M7 12h1m-1 3h1m5-6h2m-2 4h2m-2 4h2" /></>,
  district: <><path d="M12 21s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></>,
  budget: <><path d="M4 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" /></>,
  effect: <><path d="M4 18 10 12l4 3 6-8" /><path d="M15 7h5v5" /></>,
  risk: <><path d="m12 4 9 16H3L12 4Z" /><path d="M12 9v5m0 3h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  remove: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7" /><path d="M10 11v5m4-5v5" /></>,
  reset: <><path d="M4 10a8 8 0 1 1 2 7" /><path d="M4 4v6h6" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
};

export default function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
