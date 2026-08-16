"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

// =====================================================================
// CodeBlock — Dark-themed code display with file tab and copy button
// =====================================================================

interface CodeBlockProps {
  /** The source code string to display */
  code: string;
  /** Language label shown in the tab (e.g. "tsx", "css") */
  language?: string;
  /** Filename shown in the tab header */
  filename?: string;
  /** Whether this block is the currently active/focused one */
  isActive?: boolean;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function CodeBlock({
  code,
  language = "tsx",
  filename,
  isActive = false,
  showLineNumbers = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const lines = code.split("\n");

  return (
    <div
      className={cn(
        "relative rounded-xl border overflow-hidden transition-all duration-300",
        isActive
          ? "border-black/[0.08] bg-[#f5f5f7]"
          : "border-black/[0.06] bg-[#fafafa]",
        className
      )}
    >
      {/* File tab header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] bg-black/[0.03]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Window dots */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc28]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>

          {/* Filename */}
          {filename && (
            <div className="flex items-center gap-1.5 ml-2 min-w-0">
              <FileCode2 className="w-3.5 h-3.5 text-black/60 shrink-0" />
              <span className="text-xs text-black/60 truncate font-mono">
                {filename}
              </span>
            </div>
          )}

          {/* Language badge */}
          <span className="text-[10px] font-mono text-black/40 uppercase tracking-wider ml-auto shrink-0">
            {language}
          </span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={cn(
            "relative flex items-center justify-center w-7 h-7 rounded-md",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-black/[0.04] transition-all duration-200",
            "shrink-0"
          )}
          aria-label="Copy code"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="w-3.5 h-3.5 text-[#34C759]" />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Copy className="w-3.5 h-3.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto hide-scrollbar">
        <pre className="code-block p-4 min-w-0">
          <code className="block">
            {lines.map((line, i) => (
              <div key={i} className="flex">
                {showLineNumbers && (
                  <span className="line-number">{i + 1}</span>
                )}
                <span className="flex-1 text-black/80 whitespace-pre">
                  {line || " "}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Active indicator glow */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-[#0071E3]/30" />
      )}
    </div>
  );
}
