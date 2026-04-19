/**
 * Inline SVG sprite for the dense dashboard. Mounted once at the top of the
 * authenticated shell so every <DenseIcon id="..."/> can `<use href="#..."/>`
 * into it. Lifted verbatim from the design's source HTML.
 */
export function IconSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <symbol id="i-search" viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="m11 11 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </symbol>
        <symbol id="i-bell" viewBox="0 0 16 16">
          <path
            d="M8 2c-2.2 0-4 1.8-4 4v2.5L2.5 11h11L12 8.5V6c0-2.2-1.8-4-4-4Zm-1.5 11a1.5 1.5 0 0 0 3 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 16 16">
          <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </symbol>
        <symbol id="i-chev" viewBox="0 0 16 16">
          <path
            d="m4 6 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="i-chev-r" viewBox="0 0 16 16">
          <path
            d="m6 4 4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="i-dash" viewBox="0 0 16 16">
          <path
            d="M3 8.5 8 4l5 4.5V13H9.5v-3.5h-3V13H3V8.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="i-sprint" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 3v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </symbol>
        <symbol id="i-check-sq" viewBox="0 0 16 16">
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="m5.5 8.5 2 2 3.5-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="i-inbox" viewBox="0 0 16 16">
          <path
            d="M2.5 9.5 4 3.5h8l1.5 6m-11 0V13h11V9.5m-11 0h3l1 1.5h3l1-1.5h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="i-team" viewBox="0 0 16 16">
          <circle cx="6" cy="6" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="11.5" cy="7" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M2 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5m.5-.5c.5-1.5 1.7-2.3 3-2.3 1.5 0 2.5.8 2.5 2.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="i-x" viewBox="0 0 16 16">
          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </symbol>
        <symbol id="i-tune" viewBox="0 0 16 16">
          <path
            d="M3 4h6M11 4h2M3 8h2M7 8h6M3 12h6M11 12h2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="10" cy="4" r="1.4" fill="currentColor" />
          <circle cx="6" cy="8" r="1.4" fill="currentColor" />
          <circle cx="10" cy="12" r="1.4" fill="currentColor" />
        </symbol>
        <symbol id="i-cmd" viewBox="0 0 16 16">
          <path
            d="M5 5h6v6H5V5Zm0 0a1.5 1.5 0 1 1-1.5 1.5H5m0 0V5m6 0a1.5 1.5 0 1 0 1.5 1.5H11m0 0V5M5 11a1.5 1.5 0 1 1-1.5-1.5H5m0 0v2m6-2a1.5 1.5 0 1 0 1.5-1.5H11m0 0v2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="i-log" viewBox="0 0 16 16">
          <path
            d="M4 2v12M4 4h8m-8 4h6m-6 4h4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </symbol>
      </defs>
    </svg>
  );
}

interface DenseIconProps {
  id: string;
  size?: number;
  className?: string;
}

export function DenseIcon({ id, size = 14, className }: DenseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <use href={`#${id}`} />
    </svg>
  );
}
