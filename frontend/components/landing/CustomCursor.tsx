'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function CustomCursor() {
  const dotRef   = useRef<HTMLDivElement>(null);
  const ringRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot  = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = 0, mouseY = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      gsap.to(dot,  { x: mouseX, y: mouseY, duration: 0.1, ease: 'none' });
      gsap.to(ring, { x: mouseX, y: mouseY, duration: 0.35, ease: 'power2.out' });
    };

    const onEnter = () => {
      gsap.to(ring, { scale: 2.2, opacity: 0.5, duration: 0.3 });
      gsap.to(dot,  { scale: 0,   duration: 0.3 });
    };

    const onLeave = () => {
      gsap.to(ring, { scale: 1, opacity: 1, duration: 0.3 });
      gsap.to(dot,  { scale: 1, duration: 0.3 });
    };

    window.addEventListener('mousemove', onMove);
    document.querySelectorAll('a, button, [data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });

    return () => {
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '6px', height: '6px',
          background: '#7c3aed',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 99999,
          transform: 'translate(-50%, -50%)',
          mixBlendMode: 'difference',
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '32px', height: '32px',
          border: '1.5px solid rgba(124,58,237,0.7)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 99998,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </>
  );
}
