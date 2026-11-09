"use client";

import { useEffect, useRef } from "react";

import { cn } from "@ui/lib/utils";

/**
 * Fades its content up when it scrolls into view. Only elements that start below the fold are hidden first,
 * so nothing on screen flickers and everything shows without JavaScript. The CSS is a no-op under reduced motion.
 */
export default function Reveal({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("reveal-armed");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.classList.add("reveal-shown");
        el.classList.remove("reveal-armed");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} id={id} className={cn(className)}>
      {children}
    </div>
  );
}
