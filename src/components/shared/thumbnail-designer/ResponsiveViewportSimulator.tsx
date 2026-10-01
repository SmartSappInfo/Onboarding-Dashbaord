'use client';

/**
 * ARCHITECTURE:
 * Multi-Device Responsive Viewport Simulator (Phase 2 - Professional Canvas Editor)
 * 
 * Simulates real-world rendering across Mobile feed cards (120px scale), Desktop cards,
 * Light/Dark themes, and YouTube duration badge safe-zone overlays.
 * 
 * CAUTION:
 * Renders read-only preview frames.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState } from 'react';
import type { CreativeDocument } from '@/lib/creative/creative-types';
import ThumbnailCanvas from './ThumbnailCanvas';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor, Sun, Moon, ShieldAlert, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponsiveViewportSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: CreativeDocument;
}

export function ResponsiveViewportSimulator({
  open,
  onOpenChange,
  document,
}: ResponsiveViewportSimulatorProps) {
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>('mobile');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [showSafeZone, setShowSafeZone] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base sm:text-lg font-bold">Multi-Device Viewport Simulation</DialogTitle>
              <CardInfoTooltip text="Preview real-world visual rendering across mobile feed and desktop formats with safe zones." />
            </div>

            {/* Viewport Controls Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/80">
                <Button
                  onClick={() => setDeviceMode('mobile')}
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-7 px-2.5 text-xs font-bold rounded-lg active:scale-[0.97]',
                    deviceMode === 'mobile' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1" /> Mobile Feed
                </Button>
                <Button
                  onClick={() => setDeviceMode('desktop')}
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-7 px-2.5 text-xs font-bold rounded-lg active:scale-[0.97]',
                    deviceMode === 'desktop' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Monitor className="w-3.5 h-3.5 mr-1" /> Desktop
                </Button>
              </div>

              {/* Theme Toggle */}
              <Button
                onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                size="sm"
                variant="outline"
                className="h-9 px-3 border-border/80 bg-background text-xs font-bold rounded-xl active:scale-[0.97]"
              >
                {themeMode === 'dark' ? <Moon className="w-3.5 h-3.5 mr-1 text-cyan-400" /> : <Sun className="w-3.5 h-3.5 mr-1 text-amber-400" />}
                {themeMode === 'dark' ? 'Dark' : 'Light'}
              </Button>

              {/* Safe Zone Toggle */}
              <Button
                onClick={() => setShowSafeZone(!showSafeZone)}
                size="sm"
                variant="outline"
                className={cn(
                  'h-9 px-3 text-xs font-bold rounded-xl border transition-all active:scale-[0.97]',
                  showSafeZone ? 'bg-destructive/10 text-destructive border-destructive/30' : 'border-border/80 text-muted-foreground'
                )}
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Safe Zone
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Preview thumbnail across mobile feed and desktop browse layouts with duration badge overlays.
          </DialogDescription>
        </DialogHeader>

        {/* Simulation Canvas Container */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div
            className={cn(
              'p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center min-h-[360px] transition-colors border',
              themeMode === 'dark' ? 'bg-black/90 border-border/80' : 'bg-muted/20 border-border/80'
            )}
          >
            {deviceMode === 'mobile' ? (
              /* Mobile Card Simulation (Compact Width) */
              <div className="w-[320px] bg-card rounded-2xl p-2.5 space-y-2.5 shadow-xl border border-border/80">
                <div className="aspect-video w-full rounded-xl overflow-hidden relative shadow-lg bg-black">
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

                  {/* Safe-Zone Overlay Duration Badge */}
                  {showSafeZone && (
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-bold text-white font-mono z-30 pointer-events-none">
                      12:45
                    </div>
                  )}
                </div>

                {/* Feed Card Mock Details */}
                <div className="space-y-1 px-1">
                  <div className={cn('text-xs font-bold line-clamp-2', themeMode === 'dark' ? 'text-white' : 'text-slate-900')}>
                    {document.name || 'Sample Video Title in Mobile Feed'}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">SmartSapp CRM • 14K views • 2 hours ago</div>
                </div>
              </div>
            ) : (
              /* Desktop Feed Card Simulation */
              <div className="w-full max-w-xl bg-card rounded-2xl p-3 space-y-3 shadow-xl border border-border/80">
                <div className="aspect-video w-full rounded-xl overflow-hidden relative shadow-lg bg-black">
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

                  {showSafeZone && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/85 text-[10px] font-bold text-white font-mono z-30 pointer-events-none">
                      12:45
                    </div>
                  )}
                </div>

                <div className="space-y-1 px-1">
                  <div className={cn('text-sm font-bold', themeMode === 'dark' ? 'text-white' : 'text-slate-900')}>
                    {document.name || 'Sample Video Title in Desktop Browse Feed'}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">SmartSapp Media • 48K views • 1 day ago</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Demarcated Footer */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="h-10 text-xs font-bold rounded-xl active:scale-[0.97]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
