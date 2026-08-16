'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Tablet, Smartphone, ExternalLink, RefreshCw } from 'lucide-react';

type ViewDevice = 'desktop' | 'tablet' | 'mobile';

interface LivePreviewProps {
  html: string | null;
  device: ViewDevice;
  deviceWidth: number;
}

export default function LivePreview({ html, device, deviceWidth }: LivePreviewProps) {
  const blobUrl = useMemo(() => {
    if (!html) return null;
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [html]);

  const containerMaxWidth = deviceWidth > 0 ? deviceWidth : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Preview header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-black/[0.06] bg-white/50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-black/40">Live Preview</span>
          {html && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] font-medium">Live</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {blobUrl && (
            <button
              onClick={() => window.open(blobUrl, '_blank')}
              className="p-1.5 rounded-md text-black/25 hover:text-black/45 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-stretch justify-center p-4 bg-[#f5f5f7]/80 overflow-auto">
        {html ? (
          <motion.div
            key={device}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative w-full h-full rounded-xl overflow-hidden border border-black/[0.08] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300"
            style={{ maxWidth: containerMaxWidth }}
          >
            <iframe
              src={blobUrl || undefined}
              srcDoc={!blobUrl ? html : undefined}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0"
              title="Website Preview"
            />
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center text-black/20 gap-3">
            <Monitor className="w-10 h-10" />
            <span className="text-[13px]">等待代码生成...</span>
          </div>
        )}
      </div>
    </div>
  );
}
