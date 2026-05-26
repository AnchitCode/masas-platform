/**
 * MasasLogo — Location pin + medical cross brand logo.
 * Matches the exact brand image: green (#0f9b58) filled arc, navy (#1b2e4b) pin body,
 * white circle center with green medical cross.
 *
 * @param {{ size?: number, className?: string, variant?: 'default'|'white', showTagline?: boolean, style?: object }} props
 */
export default function MasasLogo({ size = 24, className = '', variant = 'default', showTagline = false, style = {} }) {
  const green = variant === 'white' ? '#ffffff' : '#0f9b58';
  const navy = variant === 'white' ? '#ffffff' : '#1b2e4b';
  const taglineColor = variant === 'white' ? 'rgba(255,255,255,0.8)' : green;
  const textColor = variant === 'white' ? '#ffffff' : navy;

  // With tagline, the viewBox is taller to include text
  const viewBox = showTagline ? '0 0 200 280' : '0 0 200 200';
  const height = showTagline ? size * 1.4 : size;

  return (
    <svg
      width={size}
      height={height}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Green filled arc — top of location pin */}
      <path
        d="M100 12C60.235 12 28 44.235 28 84c0 10.5 2.25 20.4 6.3 29.2L100 190l65.7-76.8C169.75 104.4 172 94.5 172 84c0-39.765-32.235-72-72-72z"
        fill={green}
      />
      {/* Navy lower pin body — overlapping the bottom */}
      <path
        d="M34.3 113.2L100 190l65.7-76.8c-4.2 8.8-10.5 16.8-18.2 23.2L100 190l-47.5-53.6c-7.7-6.4-14-14.4-18.2-23.2z"
        fill={navy}
      />
      {/* Navy V-shape at the bottom of pin */}
      <path
        d="M52.5 136.4L100 190l47.5-53.6C137 143.6 120 150 100 150s-37-6.4-47.5-13.6z"
        fill={navy}
      />
      {/* Pin shadow */}
      <ellipse cx="100" cy="198" rx="30" ry="6" fill="#e5e7eb" />
      
      {/* White circle center */}
      <circle cx="100" cy="84" r="44" fill="white" />
      {/* Green medical cross — vertical bar */}
      <rect x="89" y="62" width="22" height="44" rx="3" fill={green} />
      {/* Green medical cross — horizontal bar */}
      <rect x="78" y="73" width="44" height="22" rx="3" fill={green} />

      {showTagline && (
        <>
          {/* MASAS text */}
          <text
            x="100"
            y="245"
            textAnchor="middle"
            fill={textColor}
            fontSize="48"
            fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
            fontWeight="800"
            letterSpacing="0.08em"
          >
            MASAS
          </text>
          {/* Tagline text */}
          <text
            x="100"
            y="265"
            textAnchor="middle"
            fill={taglineColor}
            fontSize="13"
            fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
            fontWeight="600"
          >
            Connecting Pharmacies &amp; Patients
          </text>
          {/* Small accent line below tagline */}
          <line x1="85" y1="274" x2="115" y2="274" stroke={green} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
