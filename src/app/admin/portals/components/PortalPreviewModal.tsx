'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PortalLivePreviewCanvas, type PortalLivePreviewCanvasProps } from './PortalLivePreviewCanvas';
import Link from 'next/link';

export interface PortalPreviewModalProps extends PortalLivePreviewCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  publishedUrl?: string;
}

export function PortalPreviewModal({
  isOpen,
  onClose,
  publishedUrl,
  ...canvasProps
}: PortalPreviewModalProps) {
  // Mount state for SSR portal safety
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Toolbar */}
      <div className="h-14 min-h-[56px] border-b border-border bg-card/50 px-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-full hover:bg-muted active:scale-[0.97] transition-all"
            aria-label="Close Preview"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 font-medium bg-primary/10 text-primary hover:bg-primary/15 border-transparent">
              <Sparkles className="w-3.5 h-3.5" />
              Live Portal Simulator
            </Badge>
            <span className="text-sm font-semibold text-foreground ml-2">
              {canvasProps.portalName || 'Untitled Portal'}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Draft Preview
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {publishedUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-10 min-h-[44px] rounded-xl font-medium text-xs bg-transparent border-border hover:bg-muted gap-1.5 active:scale-[0.97] transition-all"
            >
              <Link href={publishedUrl} target="_blank" rel="noopener noreferrer">
                <span>Open Live URL</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="h-10 min-h-[44px] px-5 rounded-xl font-bold text-xs gap-1.5 shadow-sm active:scale-[0.97] transition-all"
          >
            <Check className="w-4 h-4" />
            Done Previewing
          </Button>
        </div>
      </div>

      {/* Surface: Simulator Canvas */}
      <div className="flex-1 overflow-hidden bg-muted/30">
        <PortalLivePreviewCanvas {...canvasProps} />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
