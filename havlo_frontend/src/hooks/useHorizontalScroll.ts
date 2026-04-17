import React, { useCallback, useRef } from 'react';

/**
 * Hook that turns a scrollable container into a swipeable / draggable
 * horizontal carousel. Native touch swipe + mouse drag + page-by-page
 * scroll via prev/next buttons.
 *
 * Usage:
 *   const { containerRef, scrollPrev, scrollNext, dragHandlers } =
 *     useHorizontalScroll();
 *   <div ref={containerRef} {...dragHandlers} className="overflow-x-auto snap-x snap-mandatory">
 *     {items}
 *   </div>
 */
export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);

  // Drag state (mouse). Touch is handled natively by overflow-x-auto.
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    startScrollLeft.current = el.scrollLeft;
  }, []);

  const stopDragging = useCallback(() => {
    isDragging.current = false;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = x - startX.current;
    el.scrollLeft = startScrollLeft.current - walk;
  }, []);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const el = containerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9 * direction;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  const scrollPrev = useCallback(() => scrollByPage(-1), [scrollByPage]);
  const scrollNext = useCallback(() => scrollByPage(1), [scrollByPage]);

  return {
    containerRef,
    scrollPrev,
    scrollNext,
    dragHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp: stopDragging,
      onMouseLeave: stopDragging,
    },
  };
}
