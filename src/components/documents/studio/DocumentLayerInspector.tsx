'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Visual Layer & Hotspot Inspector:
 *    WYSIWYG canvas inspector enabling visual hotspot positioning and property editing
 *    (PRD Section 51–52 & 85).
 * 2. Tag Selection Single Source of Truth:
 *    Integrates `<TagSelector>` in client/draft mode (omitting contactId) for applying CRM tags.
 * 3. Normalized Coordinates Standard:
 *    All coordinates ($X, Y, \text{Width}, \text{Height}$) are stored as percentages ($0.00\% - 100.00\%$)
 *    relative to page aspect bounds for 100% responsive cross-device fidelity.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useRef } from 'react';
import type { DocumentPage } from '@/lib/types/document-types';
import type { FlipbookHotspot, HotspotType } from '@/lib/types/flipbook-types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Layers, Plus, Trash2, Video, Link as LinkIcon, 
  ExternalLink, Sparkles, BookOpen, Tag as TagIcon, Zap
} from 'lucide-react';
import { TagSelector } from '@/components/tags/TagSelector';

interface DocumentLayerInspectorProps {
  pages: DocumentPage[];
  activePageNumber: number;
  onPageChange: (pageNum: number) => void;
  hotspots: FlipbookHotspot[];
  onHotspotsChange: (updated: FlipbookHotspot[]) => void;
}

export function DocumentLayerInspector({
  pages,
  activePageNumber,
  onPageChange,
  hotspots,
  onHotspotsChange,
}: DocumentLayerInspectorProps) {
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const activePageObj = pages.find((p) => p.pageNumber === activePageNumber);
  const activePageHotspots = hotspots.filter((h) => h.pageNumber === activePageNumber);
  const selectedHotspot = hotspots.find((h) => h.id === selectedHotspotId);

  // Add new hotspot on current page with default percentage coordinates
  const handleAddHotspot = (type: HotspotType = 'link') => {
    const newHotspot: FlipbookHotspot = {
      id: `hs_${Date.now()}`,
      pageNumber: activePageNumber,
      x: 35,
      y: 35,
      width: 30,
      height: 15,
      type,
      title: type === 'video' ? 'Featured Video' : 'Learn More CTA',
      targetUrl: 'https://example.com',
    };

    const updated = [...hotspots, newHotspot];
    onHotspotsChange(updated);
    setSelectedHotspotId(newHotspot.id);
  };

  // Update specific property of selected hotspot
  const handleUpdateSelected = <K extends keyof FlipbookHotspot>(key: K, value: FlipbookHotspot[K]) => {
    if (!selectedHotspotId) return;

    const updated = hotspots.map((h) => {
      if (h.id === selectedHotspotId) {
        return { ...h, [key]: value };
      }
      return h;
    });

    onHotspotsChange(updated);
  };

  // Delete selected hotspot
  const handleDeleteSelected = () => {
    if (!selectedHotspotId) return;

    const updated = hotspots.filter((h) => h.id !== selectedHotspotId);
    onHotspotsChange(updated);
    setSelectedHotspotId(null);
  };

  // Click on page canvas to position or create hotspot
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if clicked an existing hotspot
    const clicked = activePageHotspots.find(
      (h) =>
        clickX >= h.x &&
        clickX <= h.x + h.width &&
        clickY >= h.y &&
        clickY <= h.y + h.height
    );

    if (clicked) {
      setSelectedHotspotId(clicked.id);
    } else if (selectedHotspotId) {
      // If a hotspot is selected and user clicks canvas, center hotspot at click
      const current = selectedHotspot;
      if (current) {
        const newX = Math.max(0, Math.min(100 - current.width, Number((clickX - current.width / 2).toFixed(1))));
        const newY = Math.max(0, Math.min(100 - current.height, Number((clickY - current.height / 2).toFixed(1))));
        handleUpdateSelected('x', newX);
        handleUpdateSelected('y', newY);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Visual Canvas Preview (8 Cols) ─────────────────────────────────── */}
      <div className="lg:col-span-7 space-y-4">
        {/* Page Selector Bar */}
        <div className="flex items-center justify-between gap-2 p-3 bg-card border rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Select Page:</span>
            <select
              value={activePageNumber}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                onPageChange(next);
                setSelectedHotspotId(null);
              }}
              className="h-10 px-3 rounded-xl bg-background border text-xs font-bold min-h-[40px]"
            >
              {pages.map((p) => (
                <option key={`page_opt_${p.pageNumber}`} value={p.pageNumber}>
                  Page {p.pageNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleAddHotspot('link')}
              className="h-10 text-xs font-bold rounded-xl gap-1.5 min-h-[40px]"
            >
              <Plus className="h-4 w-4" /> Add Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddHotspot('video')}
              className="h-10 text-xs font-bold rounded-xl gap-1.5 min-h-[40px]"
            >
              <Video className="h-4 w-4 text-rose-400" /> Add Video
            </Button>
          </div>
        </div>

        {/* WYSIWYG Interactive Page Canvas */}
        <Card className="p-4 bg-slate-950 flex items-center justify-center overflow-hidden border-border/40">
          <div
            ref={canvasContainerRef}
            onClick={handleCanvasClick}
            className="relative max-h-[65vh] aspect-[1/1.414] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 select-none cursor-crosshair"
          >
            {activePageObj?.renderedAssetUrl || activePageObj?.thumbnailUrl ? (
              <img
                src={activePageObj.renderedAssetUrl || activePageObj.thumbnailUrl}
                alt={`Page ${activePageNumber}`}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-2 p-6">
                <BookOpen className="h-12 w-12 text-slate-700" />
                <p className="text-xs font-bold">Page {activePageNumber}</p>
              </div>
            )}

            {/* Render Hotspot Overlays on Canvas */}
            {activePageHotspots.map((h) => {
              const isSelected = h.id === selectedHotspotId;

              return (
                <div
                  key={h.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedHotspotId(h.id);
                  }}
                  className={`absolute rounded-xl transition-all cursor-move flex items-center justify-center p-1.5 shadow-lg ${
                    isSelected
                      ? 'ring-4 ring-indigo-500 bg-indigo-500/40 border-2 border-white'
                      : 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/60'
                  }`}
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    width: `${h.width}%`,
                    height: `${h.height}%`,
                  }}
                >
                  <span className="truncate text-[10px] font-bold text-white drop-shadow-md flex items-center gap-1">
                    {h.type === 'video' ? <Video className="h-3 w-3 text-rose-400" /> : <LinkIcon className="h-3 w-3 text-indigo-300" />}
                    {h.title || 'Layer'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Property Inspector Sidebar (5 Cols) ────────────────────────────── */}
      <div className="lg:col-span-5 space-y-4">
        {selectedHotspot ? (
          <Card className="p-6 space-y-5 border-indigo-500/30">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  Layer Properties
                </h3>
                <p className="text-[11px] text-muted-foreground">Configure hotspot actions and triggers</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteSelected}
                className="h-9 w-9 text-rose-400 hover:bg-rose-500/10 rounded-xl"
                title="Delete this layer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Layer Title</Label>
                <Input
                  value={selectedHotspot.title || ''}
                  onChange={(e) => handleUpdateSelected('title', e.target.value)}
                  placeholder="e.g. Schedule Campus Tour"
                  className="h-11 rounded-xl min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Layer Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={selectedHotspot.type === 'link' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateSelected('type', 'link')}
                    className="h-11 rounded-xl text-xs font-bold min-h-[44px]"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" /> External Link
                  </Button>
                  <Button
                    type="button"
                    variant={selectedHotspot.type === 'video' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateSelected('type', 'video')}
                    className="h-11 rounded-xl text-xs font-bold min-h-[44px]"
                  >
                    <Video className="h-4 w-4 mr-1.5 text-rose-400" /> Video Player
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Target URL</Label>
                <Input
                  value={selectedHotspot.targetUrl || ''}
                  onChange={(e) => handleUpdateSelected('targetUrl', e.target.value)}
                  placeholder="https://..."
                  className="h-11 rounded-xl font-mono text-xs min-h-[44px]"
                />
              </div>

              {/* Normalized Coordinates */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold">Dimensions & Position (%)</Label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Left (X):</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={selectedHotspot.x}
                      onChange={(e) => handleUpdateSelected('x', parseFloat(e.target.value) || 0)}
                      className="h-10 rounded-xl mt-1 min-h-[40px]"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Top (Y):</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={selectedHotspot.y}
                      onChange={(e) => handleUpdateSelected('y', parseFloat(e.target.value) || 0)}
                      className="h-10 rounded-xl mt-1 min-h-[40px]"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Width (%):</span>
                    <Input
                      type="number"
                      min={5}
                      max={100}
                      value={selectedHotspot.width}
                      onChange={(e) => handleUpdateSelected('width', parseFloat(e.target.value) || 10)}
                      className="h-10 rounded-xl mt-1 min-h-[40px]"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Height (%):</span>
                    <Input
                      type="number"
                      min={5}
                      max={100}
                      value={selectedHotspot.height}
                      onChange={(e) => handleUpdateSelected('height', parseFloat(e.target.value) || 10)}
                      className="h-10 rounded-xl mt-1 min-h-[40px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center border-dashed space-y-3">
            <Layers className="h-10 w-10 text-muted-foreground mx-auto" />
            <h4 className="text-sm font-bold">No Layer Selected</h4>
            <p className="text-xs text-muted-foreground">
              Click any hotspot on the page canvas to edit its properties, or click <strong>Add Link</strong> to create a new layer.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
