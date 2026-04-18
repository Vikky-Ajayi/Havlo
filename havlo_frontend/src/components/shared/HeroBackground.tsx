import React from 'react';
import { cn } from '../../lib/utils';

interface HeroBackgroundProps {
  className?: string;
  imageSrc?: string;
  showTop?: boolean;
  showBottom?: boolean;
}

export const HeroBackground: React.FC<HeroBackgroundProps> = ({
  className,
  imageSrc,
  showTop = true,
  showBottom = true,
}) => {
  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      {/* Background Image with Overlay */}
      {imageSrc && (
        <div className="absolute inset-0 z-0">
          <img
            src={imageSrc}
            alt="Hero background"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Decorative SVG Shapes (Torn Edge Effect) */}
      <div className="relative z-10 h-full w-full">
        {showTop && (
          <svg
            className="absolute top-0 left-1/2 w-[2100px] -translate-x-1/2 fill-white"
            viewBox="0 0 2100 805"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 804.75H2100V39.75L1974.22 27L1960 20.625L1892.19 25.125L1826.02 31.5L1804.69 37.875L1743.44 23.25L1697.5 25.125L1573.91 9.75L1518.67 26.625L1482.58 20.25L1440.47 25.5L1375.39 20.25H1312.5L1247.15 25.6875L1216.8 37.875L1200.94 43.125L1172.5 47.25L1112.34 48.375L1048.91 39.375L917.793 38.25L852.578 32.625L822.5 44.25L783.125 38.25L655.703 44.25L599.375 42L574.766 33.75L585.703 13.125L535.938 13.5L505.586 9.1875L462.656 10.125L430.391 4.125H404.141L382.266 6.375L353.281 12.75H343.438L322.656 0L306.25 6.375L275.078 2.25L263.047 7.125L248.828 2.25L227.5 12.75L206.309 9.28125L189.219 10.125L171.172 18.75L143.828 22.875L72.7344 30L38.2812 27L0 30.375V804.75Z"
              fill="white"
            />
          </svg>
        )}

        {showBottom && (
          <svg
            className="absolute bottom-0 left-1/2 w-[2100px] -translate-x-1/2 fill-white"
            viewBox="0 0 2100 805"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2100 0H0V765L125.781 777.75L140 784.125L207.812 779.625L273.984 773.25L295.312 766.875L356.562 781.5L402.5 779.625L526.094 795L581.328 778.125L617.422 784.5L659.531 779.25L724.609 784.5H787.5L852.852 779.062L883.203 766.875L899.062 761.625L927.5 757.5L987.656 756.375L1051.09 765.375L1182.21 766.5L1247.42 772.125L1277.5 760.5L1316.88 766.5L1444.3 760.5L1500.62 762.75L1525.23 771L1514.3 791.625L1564.06 791.25L1594.41 795.562L1637.34 794.625L1669.61 800.625H1695.86L1717.73 798.375L1746.72 792H1756.56L1777.34 804.75L1793.75 798.375L1824.92 802.5L1836.95 797.625L1851.17 802.5L1872.5 792L1893.69 795.469L1910.78 794.625L1928.83 786L1956.17 781.875L2027.27 774.75L2061.72 777.75L2100 774.375V0Z"
              fill="white"
            />
          </svg>
        )}
      </div>
    </div>
  );
};
