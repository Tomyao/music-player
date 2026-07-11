import { useEffect, useRef, useState } from 'react';

interface MarqueeProps {
  text: string;
  className?: string;
}

/** Renders `text` truncated normally; if it overflows its container, scrolls it right-to-left in a seamless loop instead. */
export function Marquee({ text, className = '' }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => setOverflowing(measure.scrollWidth > container.clientWidth);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <span ref={measureRef} className="invisible absolute whitespace-nowrap" aria-hidden="true">
        {text}
      </span>
      {overflowing ? (
        <div className="flex w-max animate-marquee whitespace-nowrap">
          <span className="pr-10">{text}</span>
          <span className="pr-10" aria-hidden="true">
            {text}
          </span>
        </div>
      ) : (
        <span className="block truncate">{text}</span>
      )}
    </div>
  );
}
