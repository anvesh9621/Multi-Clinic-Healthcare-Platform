"use client";

import React, { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  format?: (value: number) => string;
}

export function AnimatedNumber({
  value,
  className,
  format = (val) => Math.round(val).toLocaleString("en-IN"),
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const shouldReduceMotion = useReducedMotion();
  
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });

  useEffect(() => {
    if (shouldReduceMotion) {
      motionValue.set(value);
    } else if (inView) {
      motionValue.set(value);
    }
  }, [value, inView, shouldReduceMotion, motionValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = format(latest);
      }
    });
  }, [springValue, format]);

  return <span ref={ref} className={className} />;
}
