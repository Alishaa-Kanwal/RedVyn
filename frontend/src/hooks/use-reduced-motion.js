"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the user's OS/browser is set to reduce motion.
 * Every animation-heavy component in this project checks this before
 * running continuous/looping effects (floating dots, glow sequences, etc).
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    function handleChange(event) {
      setReduced(event.matches);
    }

    query.addEventListener("change", handleChange);

    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  return reduced;
}