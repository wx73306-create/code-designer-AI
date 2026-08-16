'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileCode, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface CodeEditorPanelProps {
  files: [string, string][];
  activeFile: string | null;
  activeCode: string;
  onFileSelect: (filename: string) => void;
}

export default function CodeEditorPanel({ files, activeFile, activeCode, onFileSelect }: CodeEditorPanelProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine language from file extension
  const language = activeFile?.endsWith('.tsx') || activeFile?.endsWith('.ts')
    ? 'typescript'
    : activeFile?.endsWith('.css')
    ? 'css'
    : activeFile?.endsWith('.json')
    ? 'json'
    : 'javascript';

  return (
    <>
      {/* File tree header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="font-medium">Files</span>
          <span className="text-white/20">({files.length})</span>
        </button>
        <button onClick={handleCopy} className="p-1 rounded text-white/25 hover:text-white/50 transition-colors" title="Copy code">
          {copied ? <Check className="w-3 h-3 text-[#34C759]" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* File list */}
      {expanded && (
        <div className="border-b border-white/[0.06] max-h-[180px] overflow-y-auto">
          {files.map(([filename]) => (
            <button
              key={filename}
              onClick={() => onFileSelect(filename)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                activeFile === filename
                  ? 'bg-[#0071E3]/20 text-[#0071E3]'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              <FileCode className="w-3 h-3 shrink-0" />
              <span className="truncate">{filename}</span>
            </button>
          ))}
        </div>
      )}

      {/* Active file tab */}
      {activeFile && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.03]">
          <FileCode className="w-3 h-3 text-[#0071E3]/60" />
          <span className="text-[11px] text-white/50 font-mono">{activeFile}</span>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={activeCode}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 8 },
            renderLineHighlight: 'line',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
          }}
        />
      </div>
    </>
  );
}
