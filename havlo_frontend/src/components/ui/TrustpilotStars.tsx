import React from 'react';
import { cn } from '../../lib/utils';

interface TrustpilotStarsProps {
  className?: string;
}

export const TrustpilotStars: React.FC<TrustpilotStarsProps> = ({ className }) => {
  return (
    <div className={cn('inline-flex items-center', className)}>
      <svg
        width="136"
        height="26"
        viewBox="0 0 136 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        <g clipPath="url(#clip0_trustpilot)">
          <path d="M25.5 0H0V25.5H25.5V0Z" fill="#00B67A" />
          <path d="M53.125 0H27.625V25.5H53.125V0Z" fill="#00B67A" />
          <path d="M80.75 0H55.25V25.5H80.75V0Z" fill="#00B67A" />
          <path d="M108.375 0H82.875V25.5H108.375V0Z" fill="#00B67A" />
          <path d="M136 0H110.5V25.5H136V0Z" fill="#00B67A" />
          <path
            d="M12.75 17.1855L16.6281 16.2027L18.2484 21.1965L12.75 17.1855ZM21.675 10.7309H14.8484L12.75 4.30273L10.6515 10.7309H3.82497L9.34997 14.7152L7.25153 21.1434L12.7765 17.159L16.1765 14.7152L21.675 10.7309Z"
            fill="white"
          />
          <path
            d="M40.375 17.1855L44.2531 16.2027L45.8734 21.1965L40.375 17.1855ZM49.3 10.7309H42.4734L40.375 4.30273L38.2765 10.7309H31.45L36.975 14.7152L34.8765 21.1434L40.4015 17.159L43.8015 14.7152L49.3 10.7309Z"
            fill="white"
          />
          <path
            d="M68 17.1855L71.8781 16.2027L73.4984 21.1965L68 17.1855ZM76.925 10.7309H70.0984L68 4.30273L65.9015 10.7309H59.075L64.6 14.7152L62.5015 21.1434L68.0265 17.159L71.4265 14.7152L76.925 10.7309Z"
            fill="white"
          />
          <path
            d="M95.625 17.1855L99.5031 16.2027L101.123 21.1965L95.625 17.1855ZM104.55 10.7309H97.7234L95.625 4.30273L93.5265 10.7309H86.7L92.225 14.7152L90.1265 21.1434L95.6515 17.159L99.0515 14.7152L104.55 10.7309Z"
            fill="white"
          />
          <path
            d="M123.25 17.1855L127.128 16.2027L128.748 21.1965L123.25 17.1855ZM132.175 10.7309H125.348L123.25 4.30273L121.152 10.7309H114.325L119.85 14.7152L117.752 21.1434L123.277 17.159L126.677 14.7152L132.175 10.7309Z"
            fill="white"
          />
        </g>
        <defs>
          <clipPath id="clip0_trustpilot">
            <rect width="136" height="25.5" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
};
