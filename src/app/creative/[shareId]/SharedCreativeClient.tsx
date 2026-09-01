'use client';

/**
 * ARCHITECTURE:
 * Public Shared Creative Preview Client (Creative Studio 2.0 - Phase 1)
 * 
 * Provides client-facing, public preview surface for review and approval
 * with scoped public Firestore access without requiring login.
 * 
 * CAUTION:
 * Read-only canvas rendering.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { getCreativeProjectWithDocumentAction } from '@/app/actions/creative-project-actions';
import type { CreativeProject, CreativeDocument } from '@/lib/creative/creative-types';
import ThumbnailCanvas from '@/components/shared/thumbnail-designer/ThumbnailCanvas';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2, Globe, Clock, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SharedCreativeClientProps {
  shareId: string;
}

export function SharedCreativeClient({ shareId }: SharedCreativeClientProps) {
  const [project, setProject] = useState<CreativeProject | null>(null);
  const [document, setDocument] = useState<CreativeDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSharedData() {
      setIsLoading(true);
      const res = await getCreativeProjectWithDocumentAction(shareId);
      if (!active) return;

      if (res.success && res.data) {
        setProject(res.data.project);
        setDocument(res.data.document);
      } else {
        setError(res.error || 'Creative not found or link has expired.');
      }
      setIsLoading(false);
    }
    loadSharedData();
    return () => {
      active = false;
    };
  }, [shareId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <div className="text-sm font-bold">Loading Shared Creative Preview...</div>
      </div>
    );
  }

  if (error || !project || !document) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4 text-slate-400">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-rose-400">
          <Globe className="w-8 h-8 mx-auto" />
        </div>
        <h1 className="text-lg font-bold text-white">Preview Unavailable</h1>
        <p className="text-xs text-slate-400 max-w-sm">{error || 'This preview link does not exist.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Client Review Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20">
            CS
          </div>
          <div>
            <div className="text-sm font-black text-white">{project.name}</div>
            <div className="text-[11px] font-medium text-slate-400">Public Design Review</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> High CTR Approved
          </span>
        </div>
      </header>

      {/* Main Preview Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 max-w-5xl mx-auto w-full">
        <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative bg-slate-950">
          <ThumbnailCanvas
            backgroundColor={document.backgroundColor}
            backgroundGradient={document.backgroundGradient}
            backgroundImage={document.backgroundImage}
            elements={document.elements}
            selectedId={null}
            onSelectElement={() => {}}
            onUpdateElement={() => {}}
            onDeleteElement={() => {}}
            zoomPercent={100}
            panX={0}
            panY={0}
            onPanChange={() => {}}
          />
        </div>

        <div className="mt-8 text-center space-y-2">
          <h2 className="text-xl font-black text-white">{project.name}</h2>
          <p className="text-xs text-slate-400 font-medium">
            Format: {project.type.replace('_', ' ').toUpperCase()} • Optimized for conversion and mobile feeds.
          </p>
        </div>
      </main>
    </div>
  );
}
