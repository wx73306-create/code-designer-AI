"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// =====================================================================
// ProgressBar — Apple-style thin animated progress indicator
// =====================================================================

interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Color variant */
  color?: "blue" | "green" | "purple" | "orange";
  /** Optional label displayed above the bar */
  label?: string;
  /** Whether to show the percentage number */
  showPercentage?: boolean;
  /** Additional CSS classes for the outer container */
  className?: string;
}

const colorMap: Record<string, { fill: string; glow: string; text: string }> = {
  blue: {
    fill: "bg-gradient-to-r from-[#0071E3] to-[#0077ED]",
    glow: "shadow-[0_0_16px_rgba(0,113,227,0.6)]",
    text: "text-[#0071E3]",
  },
  green: {
    fill: "bg-gradient-to-r from-[#34C759] to-[#30D158]",
    glow: "shadow-[0_0_16px_rgba(52,199,89,0.6)]",
    text: "text-[#34C759]",
  },
  purple: {
    fill: "bg-gradient-to-r from-[#AF52DE] to-[#DA8FFF]",
    glow: "shadow-[0_0_16px_rgba(175,82,222,0.6)]",
    text: "text-[#AF52DE]",
  },
  orange: {
    fill: "bg-gradient-to-r from-[#FF9500] to-[#FFB340]",
    glow: "shadow-[0_0_16px_rgba(255,149,0,0.6)]",
    text: "text-[#FF9500]",
  },
};

export function ProgressBar({
  value,
  color = "blue",
  label,
  showPercentage = false,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const isComplete = clamped >= 100;
  const colors = colorMap[color];

  return (
    <div className={cn("w-full", className)}>
      {/* Header row */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-xs font-medium text-muted-foreground truncate">
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              className={cn(
                "text-xs font-mono tabular-nums transition-colors duration-300",
                isComplete ? colors.text : "text-muted-foreground"
              )}
            >
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div className="relative h-1 rounded-full bg-black/[0.06] overflow-hidden shadow-[inset_0_0_4px_rgba(0,0,0,0.03)]">
        {/* Fill */}
        <motion.div
          className={cn(
            "h-full rounded-full origin-left",
            colors.fill,
            isComplete && colors.glow
          )}
          initial={{ width: "0%" }}
          animate={{ width: `${clamped}%` }}
          transition={{
            width: {
              type: "spring",
              stiffness: 120,
              damping: 30,
              mass: 0.8,
            },
          }}
        />

        {/* Shimmer overlay while in progress */}
        {!isComplete && clamped > 0 && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div
              className={cn(
                "absolute top-0 left-0 h-full w-1/2 rounded-full",
                "bg-gradient-to-r from-transparent via-white/[0.12] to-transparent",
                "animate-[progress-shimmer_2s_ease-in-out_infinite]"
              )}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
