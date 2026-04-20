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
        <div className="shrink-0 w-[180px] lg:w-[220px] flex flex-col gap-3 px-4 lg:px-8 items-start">
          {header}
        </div>
      )}
      {reviews.map((r, i) => (
        <div
          key={`${setKey}-${i}`}
          className="shrink-0 w-[300px] lg:w-[340px] rounded-xl p-5"
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
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;

    const step = () => {
      if (!paused && !isDragging) {
        const maxScroll = track.scrollWidth / 2;
        container.scrollLeft += speed;
        if (container.scrollLeft >= maxScroll) {
          container.scrollLeft = 0;
        }
      }
      animId = requestAnimationFrame(step);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      paused = true;
      dragStartX = e.clientX;
      dragStartScroll = container.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - dragStartX;
      container.scrollLeft = dragStartScroll - delta;
    };

    const onMouseUp = () => {
      isDragging = false;
      paused = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      isDragging = true;
      paused = true;
      dragStartX = e.touches[0].clientX;
      dragStartScroll = container.scrollLeft;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const delta = e.touches[0].clientX - dragStartX;
      container.scrollLeft = dragStartScroll - delta;
    };

    const onTouchEnd = () => {
      isDragging = false;
      paused = false;
    };

    animId = requestAnimationFrame(step);

    const pause = () => { paused = true; };
    const resume = () => { if (!isDragging) paused = false; };
    container.addEventListener('mouseenter', pause);
    container.addEventListener('mouseleave', resume);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mouseenter', pause);
      container.removeEventListener('mouseleave', resume);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto overflow-y-hidden py-10 no-scrollbar cursor-grab active:cursor-grabbing">
      <div ref={trackRef} className="flex items-center gap-4" style={{ width: 'max-content' }}>
        {renderReviewSet('first')}
        {renderReviewSet('second')}
      </div>
    </div>
  );
};
