'use client';

import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PhoneCall, Phone, Play, FileText, Eye, Edit3, Download, Trash2 } from 'lucide-react';
import { extractPreviewText, stripScriptHtml } from '@/lib/call-centre-graph';
import { cn } from '@/lib/utils';
import type { CallCampaign, CallScript } from '@/lib/types';

/**
 * Props for ScriptThumbnailCard in 'selector' mode (used in CallNowModal when picking a campaign).
 */
export interface ScriptSelectorProps {
  mode: 'selector';
  campaign: CallCampaign;
  onSelect: (campaign: CallCampaign) => void;
  isSelected?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Props for ScriptThumbnailCard in 'library' mode (used in CallCentreClient script library tab).
 */
export interface ScriptLibraryProps {
  mode: 'library';
  script: CallScript;
  onPreview?: (script: CallScript) => void;
  onUse?: (script: CallScript) => void;
  onEdit?: (script: CallScript) => void;
  onExport?: (script: CallScript) => void;
  onDelete?: (scriptId: string) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

export type ScriptThumbnailCardProps = ScriptSelectorProps | ScriptLibraryProps;

/**
 * Standardized Script Thumbnail & Dialogue Simulator Card.
 * Serves as the Single Source of Truth for script cards in both the Call Centre Library
 * and the Call Now Campaign/Script selector modal.
 */
export function ScriptThumbnailCard(props: ScriptThumbnailCardProps) {
  const isSelector = props.mode === 'selector';

  // ─── Extract preview dialogue text from script content or serialized snapshot ───
  const { previewText, stepCount, estimatedDuration } = useMemo(() => {
    const rawContent = isSelector ? props.campaign.scriptSnapshot : props.script.content;
    let snippet = '';
    let steps = 0;

    if (rawContent) {
      try {
        snippet = extractPreviewText(rawContent);
        if (rawContent.trim().startsWith('{')) {
          const parsed = JSON.parse(rawContent) as { nodes?: Array<{ type?: string }> };
          if (Array.isArray(parsed.nodes)) {
            steps = parsed.nodes.length;
          }
        }
      } catch {
        snippet = stripScriptHtml(rawContent);
      }
    }

    if (!snippet) {
      snippet = isSelector
        ? (props.campaign.description || 'Outbound call campaign prompter.')
        : (props.script.description || 'Call outreach script template.');
    }

    // Dynamic duration estimation: roughly 130 words per minute
    const wordCount = snippet.trim().split(/\s+/).filter(Boolean).length;
    const estMinutes = Math.max(1, Math.round(wordCount / 130));
    const durationStr = `Est. ~${estMinutes}m`;

    return {
      previewText: snippet,
      stepCount: steps,
      estimatedDuration: durationStr,
    };
  }, [isSelector, props]);

  if (isSelector) {
    const { campaign, onSelect, isSelected, disabled, className } = props;

    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onSelect(campaign)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect(campaign);
          }
        }}
        className={cn(
          'group relative border border-border/80 transition-all duration-300 rounded-2xl overflow-hidden bg-card text-left flex flex-col h-[340px] sm:h-[360px] cursor-pointer shadow-sm hover:shadow-xl hover:border-primary/50 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]',
          isSelected && 'ring-2 ring-primary border-primary bg-primary/[0.02]',
          disabled && 'opacity-60 pointer-events-none cursor-not-allowed',
          className
        )}
      >
        {/* Top Header Strip */}
        <div className="h-10 shrink-0 border-b border-border/70 flex items-center justify-between px-3.5 bg-muted/20">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1 rounded-md border border-primary/20 bg-primary/10 text-primary">
              <Phone className="h-3 w-3" />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Outbound Script
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {stepCount > 0 && (
              <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0 rounded bg-muted/50 border-border text-muted-foreground">
                {stepCount} {stepCount === 1 ? 'step' : 'steps'}
              </Badge>
            )}
            <span className={cn(
              'w-2 h-2 rounded-full',
              campaign.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
            )} title={`Campaign status: ${campaign.status}`} />
          </div>
        </div>

        {/* Middle: Spoken Dialogue Simulator Panel */}
        <div className="flex-1 overflow-hidden relative bg-muted/10 flex flex-col items-center justify-center p-3 sm:p-4">
          <div className="w-full h-full bg-card rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 relative overflow-hidden group-hover:scale-[1.01] transition-transform duration-300 border border-border/80 shadow-inner">
            {/* Phone Silhouette Watermark */}
            <div className="absolute -right-4 -top-4 opacity-[0.04] rotate-12 text-primary pointer-events-none">
              <PhoneCall size={110} />
            </div>

            {/* Quoted Dialogue Excerpt */}
            <div className="p-3 bg-muted/30 border border-border/60 rounded-xl shadow-xs backdrop-blur-xs flex-1 overflow-y-auto max-h-[140px] custom-scrollbar">
              <p className="text-[10px] sm:text-[11px] font-medium text-foreground/80 leading-relaxed italic font-serif">
                &ldquo;{previewText}&rdquo;
              </p>
            </div>

            {/* Panel Footer */}
            <div className="flex items-center justify-between opacity-60 border-t border-border/60 pt-2 shrink-0">
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-primary" />
                <span className="text-[8px] font-semibold text-foreground/80">Spoken Opener</span>
              </div>
              <span className="text-[8px] font-semibold text-muted-foreground">{estimatedDuration}</span>
            </div>
          </div>
        </div>

        {/* Bottom: Campaign Info & Quick Action Button */}
        <div className="p-3.5 sm:p-4 shrink-0 bg-card border-t border-border/70 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold truncate text-card-foreground group-hover:text-primary transition-colors leading-tight">
              {campaign.name}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {campaign.description || 'Call outreach campaign.'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-1 bg-primary text-primary-foreground font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs group-hover:bg-primary/90 group-hover:shadow-md transition-all active:scale-[0.97]">
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="hidden sm:inline">Start</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Library Mode (for CallCentreClient.tsx) ───
  const {
    script,
    onPreview,
    onUse,
    onEdit,
    onExport,
    onDelete,
    canCreate = true,
    canEdit = true,
    canDelete = true,
    className,
  } = props;

  return (
    <Card className={cn(
      'group relative border border-border transition-all duration-300 rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-xl flex flex-col h-[420px]',
      className
    )}>
      {/* Top Bar: Actions */}
      <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 bg-muted/30 transition-colors duration-300">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <FileText className="h-3 w-3" />
          </div>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Outbound Call Script</span>
          {script.source === 'imported' ? (
            <Badge
              variant="outline"
              className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0 rounded border-amber-500/30 bg-amber-500/10 text-amber-500"
              title={script.importMeta?.importedAt ? `Imported ${new Date(script.importMeta.importedAt).toLocaleDateString()}` : 'Imported script'}
            >
              Imported
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {onPreview && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => onPreview(script)}
              title="Preview Script"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {canCreate && onUse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              onClick={() => onUse(script)}
              title="Use Script to Create Campaign"
            >
              <Play className="h-4 w-4 fill-current" />
            </Button>
          )}
          {canEdit && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => onEdit(script)}
              title="Edit Script"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          {onExport && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => onExport(script)}
              title="Export Script (.cflow)"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
              onClick={() => onDelete(script.id)}
              title="Delete Script"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Middle: Dialogue Simulator Panel */}
      <div className="flex-1 overflow-hidden relative bg-muted/20 flex flex-col items-center justify-center p-4">
        <div className="w-full h-full bg-muted/40 rounded-xl p-4 flex flex-col justify-between gap-4 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-300 border border-border shadow-inner">
          <div className="absolute -right-4 -top-4 opacity-5 rotate-12 text-primary pointer-events-none">
            <PhoneCall size={120} />
          </div>
          <div className="p-4 bg-background border border-border rounded-2xl shadow-sm backdrop-blur-sm flex-1 overflow-y-auto max-h-[160px] custom-scrollbar">
            <p className="text-[9px] font-bold text-foreground/80 leading-relaxed italic font-serif">
              &ldquo;{previewText}&rdquo;
            </p>
          </div>
          <div className="flex items-center justify-between opacity-40 border-t border-border pt-2 shrink-0">
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-primary" />
              <span className="text-[7px] font-semibold text-foreground/70">Outbound Dial Preview</span>
            </div>
            <span className="text-[7px] font-semibold text-muted-foreground">{estimatedDuration}</span>
          </div>
        </div>
      </div>

      {/* Bottom: Info Card */}
      <CardHeader className="p-5 shrink-0 bg-card border-t border-border">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold truncate text-card-foreground group-hover:text-primary transition-colors leading-tight tracking-tight">
            {script.name}
          </CardTitle>
          <p className="text-[9px] font-medium text-muted-foreground truncate mt-1">
            {script.description || 'Call outreach script template.'}
          </p>
          <div className="flex flex-wrap gap-1 mt-3 max-h-[48px] overflow-hidden">
            {script.variables && script.variables.length > 0 ? (
              script.variables.map((v) => (
                <Badge key={v} variant="outline" className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted border-border text-muted-foreground">
                  {v}
                </Badge>
              ))
            ) : (
              <span className="text-[8px] text-muted-foreground/60 italic">No variables required</span>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
