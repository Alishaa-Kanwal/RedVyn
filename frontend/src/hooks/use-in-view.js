"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Attaches an IntersectionObserver to the returned ref and flips `inView`
 * to true the first time the element crosses the given threshold. Used to
 * kick off the sequential step-card glow and other scroll-triggered reveals.
 */
export function useInView({ threshold = 0.25, once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.unobserve(node);
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once]);

  return [ref, inView];
}