import React, { useRef, useEffect } from 'react';
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
}

export const AutoScrollReviews: React.FC<AutoScrollReviewsProps> = ({
  reviews,
  bgColor = '#F5F5F3',
  header,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const doubled = [...reviews, ...reviews];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let animId: number;
    let pos = 0;
    const speed = 0.5;

    const step = () => {
      pos += speed;
      const half = track.scrollWidth / 2;
      if (pos >= half) pos = 0;
      track.style.transform = `translateX(-${pos}px)`;
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);

    const pause = () => cancelAnimationFrame(animId);
    const resume = () => { animId = requestAnimationFrame(step); };
    track.addEventListener('mouseenter', pause);
    track.addEventListener('mouseleave', resume);
    track.addEventListener('touchstart', pause, { passive: true });
    track.addEventListener('touchend', resume);

    return () => {
      cancelAnimationFrame(animId);
      track.removeEventListener('mouseenter', pause);
      track.removeEventListener('mouseleave', resume);
      track.removeEventListener('touchstart', pause);
      track.removeEventListener('touchend', resume);
    };
  }, []);

  return (
    <div className="w-full flex flex-row items-center overflow-hidden py-10">
      {header && (
        <div className="shrink-0 w-[180px] lg:w-[220px] flex flex-col gap-3 px-4 lg:px-8 items-start">
          {header}
        </div>
      )}
      <div className={header ? 'flex-1 overflow-hidden' : 'w-full overflow-hidden'}>
        <div ref={trackRef} className="flex gap-4 will-change-transform" style={{ width: 'max-content' }}>
          {doubled.map((r, i) => (
            <div
              key={i}
              className="shrink-0 w-[300px] lg:w-[340px] rounded-xl p-5"
              style={{ backgroundColor: bgColor }}
            >
              <ReviewCard title={r.title} content={r.content} author={r.author} time="" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
