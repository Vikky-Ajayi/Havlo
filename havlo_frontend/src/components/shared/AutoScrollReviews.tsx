import React, { useRef, useState } from 'react';
import { ReviewCard } from './ReviewCard';

interface Review {
  title: string;
  content: string;
  author: string;
}

interface AutoScrollReviewsProps {
  reviews: Review[];
  bgColor?: string;
  header?: React.ReactNode;
  speedSeconds?: number;
}

export const AutoScrollReviews: React.FC<AutoScrollReviewsProps> = ({
  reviews,
  bgColor = '#F5F5F3',
  header,
  speedSeconds = 80,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const renderReviewSet = (setKey: string) => (
    <>
      {header && (
        <div
          className="shrink-0 w-[260px] lg:w-[300px] flex flex-col gap-3 px-4 lg:px-6 items-start justify-center self-stretch"
          aria-hidden={setKey === 'second'}
        >
          {header}
        </div>
      )}
      {reviews.map((r, i) => (
        <div
          key={`${setKey}-${i}`}
          className="shrink-0 w-[300px] lg:w-[340px] min-h-[260px] lg:min-h-[280px] rounded-xl p-5 flex flex-col self-stretch"
          style={{ backgroundColor: bgColor }}
        >
          <ReviewCard title={r.title} content={r.content} author={r.author} time="" />
        </div>
      ))}
    </>
  );

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)',
        maskImage:
          'linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Inline keyframes — works on every modern mobile browser without
          relying on programmatic scrollLeft (which is unreliable on iOS Safari
          for elements that need overflow:hidden). */}
      <style>{`
        @keyframes havlo-marquee {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
      <div className="w-full py-[30px] pt-[10px]">
        <div
          ref={trackRef}
          className="flex items-stretch gap-4"
          style={{
            width: 'max-content',
            animation: `havlo-marquee ${speedSeconds}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
            willChange: 'transform',
          }}
        >
          {renderReviewSet('first')}
          {renderReviewSet('second')}
        </div>
      </div>
    </div>
  );
};
