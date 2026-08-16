"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// =====================================================================
// StatusBadge — Compact pill badge for agent status with animations
// =====================================================================

type AgentStatus = "idle" | "running" | "completed" | "error";

interface StatusBadgeProps {
  /** The current status to display */
  status: AgentStatus;
  /** The label text shown in the badge */
  label: string;
  /** Additional CSS classes */
  className?: string;
}

const statusConfig: Record<
  AgentStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    dotClass: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    iconClass: string;
  }
> = {
  idle: {
    icon: Minus,
    dotClass: "bg-[#c7c7cc]",
    bgClass: "bg-black/[0.03]",
    textClass: "text-[#86868b]",
    borderClass: "border-black/[0.06]",
    iconClass: "text-[#c7c7cc]",
  },
  running: {
    icon: Loader2,
    dotClass: "bg-[#0071E3]",
    bgClass: "bg-[#0071E3]/[0.08]",
    textClass: "text-[#0071E3]",
    borderClass: "border-[#0071E3]/20",
    iconClass: "text-[#0071E3]",
  },
  completed: {
    icon: CheckCircle2,
    dotClass: "bg-[#34C759]",
    bgClass: "bg-[#34C759]/[0.08]",
    textClass: "text-[#248a3d]",
    borderClass: "border-[#34C759]/20",
    iconClass: "text-[#34C759]",
  },
  error: {
    icon: AlertCircle,
    dotClass: "bg-[#FF3B30]",
    bgClass: "bg-[#FF3B30]/[0.08]",
    textClass: "text-[#d70015]",
    borderClass: "border-[#FF3B30]/20",
    iconClass: "text-[#FF3B30]",
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "border text-xs font-medium transition-colors duration-300",
        config.bgClass,
        config.textClass,
        config.borderClass,
        status === "running" && "badge-running-pulse",
        className
      )}
    >
      {/* Animated dot indicator */}
      <span className="relative flex items-center justify-center">
        <span
          className={cn(
            "block w-2 h-2 rounded-full transition-colors duration-300",
            config.dotClass
          )}
        />

        {/* Pulse ring for running state */}
        {status === "running" && (
          <motion.span
            className={cn(
              "absolute inset-0 rounded-full",
              config.dotClass
            )}
            animate={{
              scale: [1, 2.2, 2.2],
              opacity: [0.5, 0, 0],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        )}
      </span>

      {/* Status icon */}
      <Icon
        className={cn(
          "w-3 h-3 shrink-0",
          config.iconClass,
          status === "running" && "animate-spin"
        )}
      />

      {/* Label */}
      <span className="leading-none">{label}</span>
    </motion.div>
  );
}
