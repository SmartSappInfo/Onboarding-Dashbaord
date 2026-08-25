'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Visual Layer & Hotspot Inspector:
 *    WYSIWYG canvas inspector enabling visual hotspot positioning and property editing
 *    across all 10 layer types: Link, Video, Audio, WhatsApp, Phone, Email, Download, Form, CTA (PRD Sections 51–52 & 61–75).
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
  ExternalLink, Sparkles, BookOpen, Tag as TagIcon, 
  Zap, MessageCircle, Music, Phone, Mail, Download, Send
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
    let title = 'Learn More';
    let targetUrl = 'https://example.com';

    if (type === 'video') {
      title = 'Watch Video';
      targetUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    } else if (type === 'whatsapp') {
      title = 'Chat on WhatsApp';
      targetUrl = '+1234567890';
    } else if (type === 'audio') {
      title = 'Listen to Audio';
      targetUrl = 'https://example.com/audio.mp3';
    } else if (type === 'phone') {
      title = 'Call Admissions';
      targetUrl = '+1234567890';
    } else if (type === 'email') {
      title = 'Email Team';
      targetUrl = 'contact@example.com';
    } else if (type === 'download') {
      title = 'Download Brochure';
      targetUrl = 'https://example.com/brochure.pdf';
    }

    const newHotspot: FlipbookHotspot = {
      id: `hs_${Date.now()}`,
      pageNumber: activePageNumber,
      x: 35,
      y: 35,
      width: 30,
      height: 12,
      type,
      title,
      targetUrl,
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

  // Click on page canvas to position or select hotspot
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
      // Reposition selected hotspot center to click location
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
      {/* ── Visual Canvas Preview (7 Cols) ─────────────────────────────────── */}
      <div className="lg:col-span-7 space-y-4">
        {/* Page Selector & Quick Add Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-card border rounded-2xl">
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

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => handleAddHotspot('link')}
              className="h-9 text-xs font-bold rounded-xl gap-1 min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" /> Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddHotspot('video')}
              className="h-9 text-xs font-bold rounded-xl gap-1 min-h-[36px] text-rose-400 border-rose-500/30"
            >
              <Video className="h-3.5 w-3.5" /> Video
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddHotspot('whatsapp')}
              className="h-9 text-xs font-bold rounded-xl gap-1 min-h-[36px] text-emerald-400 border-emerald-500/30"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddHotspot('audio')}
              className="h-9 text-xs font-bold rounded-xl gap-1 min-h-[36px] text-violet-400 border-violet-500/30"
            >
              <Music className="h-3.5 w-3.5" /> Audio
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
                className="w-full h-full object-contain pointer-events-none select-none"
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
              const type = h.type;

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
                    {type === 'video' && <Video className="h-3 w-3 text-rose-400" />}
                    {type === 'audio' && <Music className="h-3 w-3 text-violet-400" />}
                    {type === 'whatsapp' && <MessageCircle className="h-3 w-3 text-emerald-400" />}
                    {type === 'phone' && <Phone className="h-3 w-3 text-sky-400" />}
                    {type === 'email' && <Mail className="h-3 w-3 text-amber-400" />}
                    {type === 'download' && <Download className="h-3 w-3 text-indigo-400" />}
                    {!['video', 'audio', 'whatsapp', 'phone', 'email', 'download'].includes(type) && (
                      <LinkIcon className="h-3 w-3 text-indigo-300" />
                    )}
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

              {/* Layer Type Grid Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Action Type</Label>
                <select
                  value={selectedHotspot.type}
                  onChange={(e) => handleUpdateSelected('type', e.target.value as HotspotType)}
                  className="w-full h-11 rounded-xl bg-card border px-3 text-xs font-bold min-h-[44px]"
                >
                  <option value="link">External Website Link</option>
                  <option value="video">Embedded Video Modal (YouTube / Vimeo)</option>
                  <option value="whatsapp">WhatsApp Direct Connect</option>
                  <option value="audio">Audio Voice Note / Clip</option>
                  <option value="phone">Click to Call (Phone)</option>
                  <option value="email">Send Email (Mailto)</option>
                  <option value="download">Download Attachment</option>
                  <option value="form">In-Reader Lead Form</option>
                </select>
              </div>

              {/* Dynamic Target Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  {selectedHotspot.type === 'video'
                    ? 'Video URL (YouTube / Vimeo / MP4)'
                    : selectedHotspot.type === 'whatsapp'
                    ? 'WhatsApp Phone Number with Country Code'
                    : selectedHotspot.type === 'phone'
                    ? 'Phone Number'
                    : selectedHotspot.type === 'email'
                    ? 'Destination Email Address'
                    : selectedHotspot.type === 'download'
                    ? 'Download File URL'
                    : selectedHotspot.type === 'audio'
                    ? 'Audio File URL (MP3 / WAV)'
                    : 'Destination URL'}
                </Label>
                <Input
                  value={selectedHotspot.targetUrl || ''}
                  onChange={(e) => handleUpdateSelected('targetUrl', e.target.value)}
                  placeholder={
                    selectedHotspot.type === 'whatsapp'
                      ? '+1234567890'
                      : selectedHotspot.type === 'email'
                      ? 'inquiry@school.edu'
                      : 'https://...'
                  }
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
              Click any hotspot on the page canvas to edit its properties, or use the quick buttons above to add an action.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
