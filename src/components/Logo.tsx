/** OverlookAI mark: an open ring with a lookout notch — the score ring is the brand. */
export default function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="52 17" transform="rotate(-70 16 16)" />
      <circle cx="16" cy="16" r="3.2" fill="var(--brand)" />
    </svg>
  );
}
