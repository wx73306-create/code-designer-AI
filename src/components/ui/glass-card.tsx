"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// =====================================================================
// GlassCard — Glass morphism card with optional hover animation
// =====================================================================

interface GlassCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Enable hover lift animation */
  hover?: boolean;
  /** Animation delay in seconds (for staggered entrance) */
  delay?: number;
  /** Render as a motion.div with entrance animation */
  animate?: boolean;
  /** Optional accent color for hover glow effect (CSS color value) */
  accentColor?: string;
}

export function GlassCard({
  children,
  className,
  style,
  hover = false,
  delay = 0,
  animate = false,
  accentColor,
}: GlassCardProps) {
  const baseClasses = cn(
    "relative rounded-xl overflow-hidden",
    "bg-white/80 backdrop-blur-[24px] -webkit-backdrop-blur-[24px]",
    "border border-black/[0.08] border-t-black/[0.06]",
    "transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
    hover && [
      "hover:bg-white/90",
      "hover:border-black/[0.12]",
      "hover:-translate-y-1",
      "hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
    ],
    className
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        whileHover={accentColor ? { boxShadow: `0 0 30px ${accentColor}26` } : undefined}
        className={baseClasses}
        style={style}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={accentColor ? { boxShadow: `0 0 30px ${accentColor}26` } : undefined}
      className={baseClasses}
      style={style}
    >
      {children}
    </motion.div>
  );
}
