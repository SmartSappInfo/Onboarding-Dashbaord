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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <DialogContent className="max-w-4xl bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
              <Eye className="w-5 h-5 text-emerald-400" /> Multi-Device Viewport Simulation
            </DialogTitle>

            {/* Viewport Controls Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                <Button
                  onClick={() => setDeviceMode('mobile')}
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-7 px-2.5 text-xs font-bold rounded-lg',
                    deviceMode === 'mobile' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400'
                  )}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1" /> Mobile Feed
                </Button>
                <Button
                  onClick={() => setDeviceMode('desktop')}
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-7 px-2.5 text-xs font-bold rounded-lg',
                    deviceMode === 'desktop' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400'
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
                className="h-9 px-3 border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 rounded-xl"
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
                  'h-9 px-3 border-slate-800 text-xs font-bold rounded-xl',
                  showSafeZone ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-slate-900 text-slate-400'
                )}
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Safe Zone
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Simulation Canvas Container */}
        <div
          className={cn(
            'p-8 rounded-2xl flex flex-col items-center justify-center min-h-[360px] transition-colors border',
            themeMode === 'dark' ? 'bg-[#0f0f0f] border-slate-850' : 'bg-[#f8f9fa] border-slate-300'
          )}
        >
          {deviceMode === 'mobile' ? (
            /* Mobile Card Simulation (Compact Width) */
            <div className="w-[320px] bg-slate-900/40 rounded-2xl p-2.5 space-y-2.5 shadow-2xl border border-slate-800/80">
              <div className="aspect-video w-full rounded-xl overflow-hidden relative shadow-lg bg-slate-950">
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
                <div className="text-[10px] text-slate-500 font-medium">SmartSapp CRM • 14K views • 2 hours ago</div>
              </div>
            </div>
          ) : (
            /* Desktop Feed Card Simulation */
            <div className="w-full max-w-xl bg-slate-900/40 rounded-2xl p-3 space-y-3 shadow-2xl border border-slate-800/80">
              <div className="aspect-video w-full rounded-xl overflow-hidden relative shadow-lg bg-slate-950">
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
                <div className="text-xs text-slate-500 font-medium">SmartSapp Media • 48K views • 1 day ago</div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
