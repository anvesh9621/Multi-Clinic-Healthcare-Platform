"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

export type MotionListItemProps = HTMLMotionProps<"li">;

export function MotionListItem({ children, className, ...props }: MotionListItemProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.li>
  );
}

export type MotionDivItemProps = HTMLMotionProps<"div">;

export function MotionDivItem({ children, className, ...props }: MotionDivItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export type MotionTrItemProps = HTMLMotionProps<"tr">;

export function MotionTrItem({ children, className, ...props }: MotionTrItemProps) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.tr>
  );
}
