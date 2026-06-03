// Pacwin / Polira mark — a bold pink geometric "V".
// Swap this SVG for the official asset any time (or drop one at public/logo.svg).

type Props = { size?: number; className?: string }

export function Logo({ size = 40, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Polira"
    >
      <defs>
        <linearGradient id="polira-pink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="55%" stopColor="#f24bb0" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <g
        fill="url(#polira-pink)"
        stroke="url(#polira-pink)"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* left blade */}
        <path d="M24 22 L46 22 L72 98 L50 98 Z" />
        {/* top bar */}
        <path d="M52 18 L96 18 L84 44 L64 44 Z" />
        {/* right blade */}
        <path d="M84 50 L106 50 L78 98 L64 74 Z" />
      </g>
    </svg>
  )
}
