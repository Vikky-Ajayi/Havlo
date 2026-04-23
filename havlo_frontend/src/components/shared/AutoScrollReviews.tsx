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
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    let animId: number;
    let paused = false;
    const speed = 0.5;
    let isMouseDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;

    const step = () => {
      if (!paused && !isMouseDragging) {
        const maxScroll = track.scrollWidth / 2;
        container.scrollLeft += speed;
        if (container.scrollLeft >= maxScroll) {
          container.scrollLeft = 0;
        }
      }
      animId = requestAnimationFrame(step);
    };

    const onMouseDown = (e: MouseEvent) => {
      isMouseDragging = true;
      paused = true;
      dragStartX = e.clientX;
      dragStartScroll = container.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDragging) return;
      const delta = e.clientX - dragStartX;
      container.scrollLeft = dragStartScroll - delta;
    };

    const onMouseUp = () => {
      isMouseDragging = false;
      paused = false;
    };

    animId = requestAnimationFrame(step);

    const pause = () => { paused = true; };
    const resume = () => { if (!isMouseDragging) paused = false; };
    container.addEventListener('mouseenter', pause);
    container.addEventListener('mouseleave', resume);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mouseenter', pause);
      container.removeEventListener('mouseleave', resume);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden py-[30px] no-scrollbar cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'pan-y' }}
    >
      <div ref={trackRef} className="flex items-stretch gap-4" style={{ width: 'max-content' }}>
        {renderReviewSet('first')}
        {renderReviewSet('second')}
      </div>
    </div>
  );
};
