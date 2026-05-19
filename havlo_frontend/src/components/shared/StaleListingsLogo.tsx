import type { CSSProperties } from 'react';

interface StaleListingsLogoProps {
  className?: string;
  style?: CSSProperties;
}

const HAVLO_LOGO_SRC = '/Havlo%20Black%20Transparent.png';

export function StaleListingsLogo({ className, style }: StaleListingsLogoProps) {
  return (
    <svg
      className={className}
      width="248"
      height="65"
      viewBox="0 0 248 65"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-label="Stale Listings by Havlo"
      role="img"
    >
      <text
        x="0.5"
        y="33.5"
        fill="#222222"
        fontFamily="'Plus Jakarta Sans', 'Inter', Arial, sans-serif"
        fontSize="35"
        fontWeight="800"
        letterSpacing="-2.1"
      >
        StaleListings
      </text>
      <text
        x="78"
        y="51"
        fill="#222222"
        fontFamily="'Inter', Arial, sans-serif"
        fontSize="11"
        fontWeight="700"
        letterSpacing="-0.3"
      >
        By
      </text>
      <image
        href={HAVLO_LOGO_SRC}
        xlinkHref={HAVLO_LOGO_SRC}
        x="95"
        y="41"
        width="56"
        height="12"
        preserveAspectRatio="xMinYMid meet"
      />
    </svg>
  );
}
