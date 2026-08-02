'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Tablet, Smartphone, ExternalLink, X, Lock } from 'lucide-react';
import type { CampaignPage } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PagePreviewModalProps {
  page: CampaignPage | null;
  onClose: () => void;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: 'w-full max-w-full',
  tablet: 'w-[768px] max-w-full',
  mobile: 'w-[375px] max-w-full',
};

/**
 * PURPOSE: Render a high-end, read-only preview modal for campaign pages with responsive device viewport switchers.
 * CAUTION: Places a click-shield overlay over interactive elements so users can scroll and view page structure without triggering links, actions, or form submissions.
 * TESTABILITY: Trigger preview modal from Campaign Hub; switch viewports (Desktop/Tablet/Mobile); confirm clicks are disabled while scroll works smoothly.
 */
export function PagePreviewModal({ page, onClose }: PagePreviewModalProps) {
  const [deviceMode, setDeviceMode] = React.useState<DeviceMode>('desktop');

  if (!page) return null;

  const isPublished = page.status === 'published';
  const previewUrl = page.slug
    ? `/p/${page.slug}?preview=true`
    : `/admin/pages/${page.id}/builder?preview=true`;
  const liveUrl = `/p/${page.slug}`;

  return (
    <Dialog open={!!page} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 border-0 rounded-3xl overflow-hidden shadow-2xl bg-slate-950 text-white flex flex-col">
        {/* Header Bar */}
        <DialogHeader className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex flex-row items-center justify-between shrink-0 space-y-0">
          <div className="flex items-center gap-3 min-w-0">
            <DialogTitle className="text-base font-bold text-white truncate max-w-sm sm:max-w-md">
              {page.name}
            </DialogTitle>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5',
                isPublished
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              )}
            >
              {isPublished ? 'Published' : 'Draft Preview'}
            </Badge>
            <Badge variant="secondary" className="hidden md:flex text-[9px] font-semibold gap-1 bg-slate-800 text-slate-300">
              <Lock className="h-2.5 w-2.5" /> Read-Only Mode
            </Badge>
          </div>

          {/* Viewport Switcher Controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeviceMode('desktop')}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all',
                deviceMode === 'desktop'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desktop</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeviceMode('tablet')}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all',
                deviceMode === 'tablet'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              )}
            >
              <Tablet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tablet</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeviceMode('mobile')}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all',
                deviceMode === 'mobile'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mobile</span>
            </Button>
          </div>

          {/* Action Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-9 px-3 rounded-xl border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-xs font-semibold gap-1.5"
            >
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Live Page</span>
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Viewport Frame Container */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-6 overflow-y-auto flex justify-center items-start">
          <div
            className={cn(
              'relative bg-background rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transition-all duration-300 min-h-[600px] h-full',
              DEVICE_WIDTHS[deviceMode]
            )}
          >
            {/* Embedded Iframe */}
            <iframe
              src={previewUrl}
              title={`Read-Only Preview - ${page.name}`}
              className="w-full h-full min-h-[75vh] border-0"
            />

            {/* Read-Only Click-Shield Overlay — allows scrolling while disabling clicks & form submissions */}
            <div
              className="absolute inset-0 z-10 pointer-events-auto bg-transparent cursor-default"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
