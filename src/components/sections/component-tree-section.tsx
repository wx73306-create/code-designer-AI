"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  Image,
  Film,
  FileType,
  FileJson,
  ChevronRight,
  Layers,
  GitBranch,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { mockProjectStructure, mockComponentTree } from "@/lib/mock-data";
import { useAgentStore } from "@/store/agent-store";
import type { FileNode, ComponentNode } from "@/types/agent";

// =============================================================================
// File icon resolver
// =============================================================================

function getFileIcon(name: string, language?: string) {
  if (language === "image") return <Image className="w-4 h-4 text-emerald-400" />;
  if (language === "video") return <Film className="w-4 h-4 text-purple-600" />;
  if (language === "font") return <FileType className="w-4 h-4 text-orange-400" />;
  if (language === "json") return <FileJson className="w-4 h-4 text-yellow-600" />;
  if (language === "css") return <FileCode2 className="w-4 h-4 text-sky-400" />;
  if (language === "markdown") return <FileText className="w-4 h-4 text-blue-300" />;
  if (name.endsWith(".ts") || name.endsWith(".tsx"))
    return <FileCode2 className="w-4 h-4 text-blue-400" />;
  if (name.endsWith(".css"))
    return <FileCode2 className="w-4 h-4 text-sky-400" />;
  if (name.endsWith(".json"))
    return <FileJson className="w-4 h-4 text-yellow-600" />;
  return <FileText className="w-4 h-4 text-black/40" />;
}

// =============================================================================
// File Tree Node (recursive, collapsible)
// =============================================================================

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  defaultOpen?: boolean;
}

function FileTreeNode({ node, depth, defaultOpen = false }: FileTreeNodeProps) {
  const [open, setOpen] = useState(depth < 2 || defaultOpen);
  const isDir = node.type === "directory";

  return (
    <div>
      <button
        onClick={() => isDir && setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 w-full py-[3px] pr-2 rounded-md text-left transition-colors duration-150",
          "hover:bg-black/[0.04]",
          isDir ? "cursor-pointer" : "cursor-default",
          !isDir && depth % 2 !== 0 && "bg-black/[0.02]"
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {isDir && (
          <ChevronRight
            className={cn(
              "w-3 h-3 text-black/30 transition-transform duration-200 shrink-0",
              open && "rotate-90"
            )}
          />
        )}
        {!isDir && <span className="w-3 shrink-0" />}

        {isDir ? (
          open ? (
            <FolderOpen className="w-[18px] h-[18px] text-yellow-600 shrink-0" />
          ) : (
            <Folder className="w-[18px] h-[18px] text-yellow-600/80 shrink-0" />
          )
        ) : (
          getFileIcon(node.name, node.language)
        )}

        <span
          className={cn(
            "text-[13px] truncate font-mono",
            isDir ? "text-black/80 font-medium" : "text-black/50"
          )}
        >
          {node.name}
        </span>
      </button>

      {isDir && open && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.name}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Component Tree Node (visual hierarchy with connecting lines)
// =============================================================================

interface ComponentTreeNodeProps {
  node: ComponentNode;
  depth: number;
  isLast: boolean;
}

const typeColors: Record<string, string> = {
  page: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  component: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  element: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  text: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  container: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

function ComponentTreeNode({ node, depth, isLast }: ComponentTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const badgeColor = typeColors[node.type] || typeColors.element;

  return (
    <div className="relative">
      {/* Connecting vertical line */}
      {depth > 0 && (
        <div
          className="absolute top-0 w-px bg-black/[0.1]"
          style={{
            left: `${depth * 20 + 8}px`,
            height: "14px",
          }}
        />
      )}

      {/* Connecting horizontal line */}
      {depth > 0 && (
        <div
          className="absolute w-px bg-black/[0.1]"
          style={{
            left: `${depth * 20 + 8}px`,
            top: "14px",
            width: "12px",
            height: "1px",
          }}
        />
      )}

      <div style={{ paddingLeft: `${depth * 20}px` }} className="py-[2px]">
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200",
            "hover:bg-black/[0.06] group",
            hasChildren && "cursor-pointer",
            !hasChildren && "cursor-default"
          )}
        >
          {hasChildren && (
            <ChevronRight
              className={cn(
                "w-3 h-3 text-black/30 transition-transform duration-200",
                expanded && "rotate-90"
              )}
            />
          )}
          {!hasChildren && <span className="w-3" />}

          <span className="text-[13px] text-black/80 font-medium">
            {node.name}
          </span>

          <span
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full border font-medium",
              badgeColor
            )}
          >
            {node.type}
          </span>

          {node.props && Object.keys(node.props).length > 0 && (
            <span className="text-[10px] text-black/25 font-mono">
              {Object.keys(node.props).length}p
            </span>
          )}
        </button>
      </div>

      {expanded && hasChildren && (
        <div className="relative">
          {/* Vertical line for children */}
          <div
            className="absolute w-px bg-black/[0.1]"
            style={{
              left: `${(depth + 1) * 20 + 8}px`,
              top: 0,
              bottom: "8px",
            }}
          />
          {node.children.map((child, idx) => (
            <ComponentTreeNode
              key={`${child.name}-${idx}`}
              node={child}
              depth={depth + 1}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tech Stack Badge
// =============================================================================

const techStack = [
  { name: "Next.js", color: "text-[#1d1d1f]" },
  { name: "React", color: "text-cyan-600" },
  { name: "TypeScript", color: "text-blue-600" },
  { name: "Tailwind CSS", color: "text-teal-600" },
  { name: "Framer Motion", color: "text-pink-600" },
  { name: "shadcn/ui", color: "text-black/70" },
];

// =============================================================================
// Component Tree Section (main export)
// =============================================================================

export function ComponentTreeSection() {
  const totalFiles = countFiles(mockProjectStructure);

  return (
    <motion.section
      id="components"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full py-24 px-4"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF9500]/10 border border-[#FF9500]/20 mb-4">
            <GitBranch className="w-3.5 h-3.5 text-[#FF9500]" />
            <span className="text-xs font-medium text-[#FF9500]">
              Planning Agent
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-[#1d1d1f] to-black/70 bg-clip-text text-transparent">
            {"生成的项目结构"}
          </h2>
          <p className="mt-3 text-base text-black/50 max-w-xl mx-auto">
            {"AI 分析后自动生成的组件层级与文件结构，完整还原原始网站的架构"}
          </p>
        </motion.div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: File Tree */}
          <GlassCard className="p-5" animate delay={0.2}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-yellow-600" />
                <h3 className="text-sm font-medium text-black/80">
                  {"项目文件结构"}
                </h3>
              </div>
              <span className="text-[11px] text-black/30 font-mono">
                {totalFiles} files
              </span>
            </div>
            <div className="max-h-[520px] overflow-y-auto hide-scrollbar py-1">
              {mockProjectStructure.map((node) => (
                <FileTreeNode key={node.name} node={node} depth={0} />
              ))}
            </div>
          </GlassCard>

          {/* Right: Component Tree */}
          <GlassCard className="p-5" animate delay={0.3}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-medium text-black/80">
                  {"React 组件层级"}
                </h3>
              </div>
              <span className="text-[11px] text-black/30 font-mono">
                {countComponents(mockComponentTree)} components
              </span>
            </div>
            <div className="max-h-[520px] overflow-y-auto hide-scrollbar py-1 relative">
              <ComponentTreeNode
                node={mockComponentTree}
                depth={0}
                isLast={true}
              />
            </div>
          </GlassCard>
        </div>

        {/* Tech stack badges */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <span className="text-xs text-black/30 mr-1">{"技术栈:"}</span>
          {techStack.map((tech) => (
            <span
              key={tech.name}
              className={cn(
                "inline-flex items-center px-4 py-2 rounded-full",
                "bg-black/[0.04] border border-black/[0.08]",
                "text-xs font-medium transition-all duration-200",
                "hover:bg-black/[0.08] hover:border-black/[0.15]",
                tech.color
              )}
            >
              {tech.name}
            </span>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function countFiles(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "file") count++;
    if (node.children) count += countFiles(node.children);
  }
  return count;
}

function countComponents(node: ComponentNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countComponents(child);
    }
  }
  return count;
}

// Content version for workspace tab — reads from store, falls back to mock
export function ComponentTreeContent() {
  const projectStructure = useAgentStore((s) => s.task.projectStructure) ?? mockProjectStructure;
  const componentTree = useAgentStore((s) => s.task.componentTree) ?? mockComponentTree;

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-black/[0.06] bg-white/75 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-yellow-600" />
              <h3 className="text-sm font-medium text-black/80">项目文件结构</h3>
            </div>
            <span className="text-[11px] text-black/30 font-mono">{countFiles(projectStructure)} files</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto hide-scrollbar py-1">
            {projectStructure.map((node) => <FileTreeNode key={node.name} node={node} depth={0} />)}
          </div>
        </div>
        <div className="rounded-xl border border-black/[0.06] bg-white/75 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-medium text-black/80">React 组件层级</h3>
            </div>
            <span className="text-[11px] text-black/30 font-mono">{countComponents(componentTree)} components</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto hide-scrollbar py-1">
            <ComponentTreeNode node={componentTree} depth={0} isLast={true} />
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-black/30">技术栈:</span>
        {techStack.map((tech) => (
          <span key={tech.name} className={cn('inline-flex items-center px-3 py-1.5 rounded-full bg-black/[0.04] border border-black/[0.08] text-xs font-medium hover:bg-black/[0.08] transition-all', tech.color)}>
            {tech.name}
          </span>
        ))}
      </div>
    </div>
  );
}
