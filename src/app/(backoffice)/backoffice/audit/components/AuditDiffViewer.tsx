import * as React from 'react';

interface AuditDiffViewerProps {
  before: any;
  after: any;
}

export default function AuditDiffViewer({ before, after }: AuditDiffViewerProps) {
  // Simple textual JSON formatting for display
  const beforeStr = before ? JSON.stringify(before, null, 2) : 'null';
  const afterStr = after ? JSON.stringify(after, null, 2) : 'null';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 bg-background border border-border rounded-lg overflow-hidden shrink-0 mt-4 h-[400px]">
       <div className="flex flex-col border-r border-border">
          <div className="bg-background/80 p-2 border-b border-border/80 shrink-0">
             <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest px-2">Before Map</span>
          </div>
          <div className="flex-1 overflow-auto p-4 cursor-text">
             <pre className="text-xs text-muted-foreground font-mono leading-relaxed" style={{ contentVisibility: 'auto' }}>
                {beforeStr}
             </pre>
          </div>
       </div>
       <div className="flex flex-col">
          <div className="bg-background/80 p-2 border-b border-border/80 shrink-0">
             <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest px-2">After Map</span>
          </div>
          <div className="flex-1 overflow-auto p-4 cursor-text">
             <pre className="text-xs text-emerald-400/80 font-mono leading-relaxed" style={{ contentVisibility: 'auto' }}>
                {afterStr}
             </pre>
          </div>
       </div>
    </div>
  );
}
