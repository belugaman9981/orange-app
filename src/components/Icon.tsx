type IconName = "arrow" | "message" | "lock" | "check" | "sliders";

const paths: Record<IconName, string> = {
  arrow: "M4 12h15m-6-6 6 6-6 6",
  message: "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Zm2 5h10M7 13h6",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 5v2",
  check: "m5 12 4 4L19 6",
  sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6",
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
