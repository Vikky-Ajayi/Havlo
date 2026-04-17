import React from 'react';
import { Button } from '../ui/Button';

interface HeroSectionProps {
  overline?: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  buttonText?: string;
  onButtonClick?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
  titleStyle?: React.CSSProperties;
  subtitleStyle?: React.CSSProperties;
  overlineStyle?: React.CSSProperties;
  imageStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  overline,
  title,
  subtitle,
  imageSrc,
  buttonText = "Get Started",
  onButtonClick,
  secondaryButtonText,
  onSecondaryButtonClick,
  titleStyle,
  subtitleStyle,
  overlineStyle,
  imageStyle,
  containerStyle,
}) => {
  return (
    <section 
      className="relative w-full bg-white overflow-hidden h-[812px] lg:h-[856px]"
    >
      <div className="relative w-full h-full">
        {/* 1. Gradient Ellipse — outer, NOT clipped */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[-50px] w-full lg:w-[120%] h-[180px] lg:h-[280px] opacity-40 blur-[100px] lg:blur-[120px] z-0"
          style={{
            background: 'linear-gradient(90deg, #E6ECA2 0%, #9BC3F0 25%, #FFB0E6 50%, #F2D0B2 75%, #D2F4B9 100%)',
          }}
        />

        {/* 2. Inner clipping div — overflow:hidden, clips image only */}
        <div
          className="absolute top-0 left-0 w-full h-full overflow-hidden z-1"
        >
          {/* 2a. House Image */}
          <img
            src={imageSrc}
            alt="Hero House"
            className="absolute left-1/2 -translate-x-1/2 top-[340px] lg:top-[300px] w-full h-auto object-cover z-[5]"
            style={imageStyle}
            referrerPolicy="no-referrer"
          />


        </div>

        {/* 3. Text Block — outer, NOT clipped */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[120px] lg:top-[110px] w-full px-4 lg:px-0 text-center z-10 flex flex-col items-center gap-6 lg:gap-6"
          style={containerStyle}
        >
          {overline && (
            <span 
              className="font-body text-lg font-medium uppercase tracking-wider text-black/60"
              style={overlineStyle}
            >
              {overline}
            </span>
          )}
          <h1 
            className="font-display font-black text-[40px] lg:text-[80px] leading-[1.05] text-[#111] max-w-[900px] tracking-[-0.04em]"
            style={titleStyle}
          >
            {title}
          </h1>
          <p
            className="font-body text-lg lg:text-[18px] text-black lg:text-[#111] leading-[1.6] max-w-[343px] lg:max-w-[680px] mx-auto font-medium tracking-tight lg:tracking-normal"
            style={subtitleStyle}
          >
            {subtitle}
          </p>
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6 mt-6 lg:mt-8 w-full lg:w-auto">
            <button
              onClick={onButtonClick}
              className="w-full lg:w-auto transition-all duration-200 hover:bg-black/90 active:scale-95 bg-black text-white px-10 lg:px-14 py-4 lg:py-5 rounded-full text-lg font-bold border-none cursor-pointer h-14 lg:h-auto"
            >
              {buttonText}
            </button>
            {secondaryButtonText && (
              <button
                onClick={onSecondaryButtonClick}
                className="w-full lg:w-auto transition-all duration-200 hover:bg-black/5 active:scale-95 bg-transparent text-black px-5 lg:px-10 py-3 lg:py-4 rounded-full text-lg font-semibold border border-black cursor-pointer h-14 lg:h-auto"
              >
                {secondaryButtonText}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
