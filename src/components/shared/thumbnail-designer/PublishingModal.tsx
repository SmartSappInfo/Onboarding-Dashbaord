'use client';

/**
 * ARCHITECTURE:
 * Multi-Platform Publishing & Distribution Modal (Phase 8)
 * 
 * Provides destination channel selection, pre-flight validation checklist,
 * target identifier extraction, and direct vs. scheduled publication execution.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition, useMemo } from 'react';
import type {
  CreativeProject,
  CreativeDocument,
  PublishingChannel,
} from '@/lib/creative/creative-types';
import {
  CHANNEL_SPECS,
  validatePreFlightPublishing,
} from '@/lib/creative/creative-publishing-engine';
import {
  publishCreativeToChannelAction,
  scheduleCreativePublicationAction,
} from '@/app/actions/creative-publishing-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Calendar,
  ExternalLink,
  Youtube,
  Facebook,
  Instagram,
  Linkedin,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CHANNEL_ICONS: Record<PublishingChannel, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  crm_asset: Zap,
};

interface PublishingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: CreativeProject;
  document: CreativeDocument;
}

export function PublishingModal({
  open,
  onOpenChange,
  project,
  document,
}: PublishingModalProps) {
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<PublishingChannel>('youtube');
  const [targetId, setTargetId] = useState('');
  const [publishMode, setPublishMode] = useState<'instant' | 'schedule'>('instant');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeSpec = CHANNEL_SPECS[selectedChannel];

  // Dynamic Pre-flight checklist
  const preFlightChecks = useMemo(() => {
    return validatePreFlightPublishing(project, document, selectedChannel, false);
  }, [project, document, selectedChannel]);

  const hasBlockingError = preFlightChecks.some((c) => !c.passed && c.severity === 'error');

  const handleExecutePublish = () => {
    if (!targetId.trim()) {
      toast({ title: 'Missing Identifier', description: 'Please enter target ID or URL.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      if (publishMode === 'instant') {
        const res = await publishCreativeToChannelAction(
          project.id,
          document.id,
          project.workspaceId,
          selectedChannel,
          targetId,
          'Creative Lead'
        );

        if (res.success && res.data) {
          setPublishedUrl(res.data.platformPostUrl || null);
          toast({
            title: 'Published Successfully',
            description: `Visual dispatched to ${activeSpec.name}.`,
          });
        } else {
          toast({
            title: 'Publish Failed',
            description: res.error || 'Could not publish.',
            variant: 'destructive',
          });
        }
      } else {
        const res = await scheduleCreativePublicationAction(
          project.id,
          document.id,
          project.workspaceId,
          selectedChannel,
          targetId,
          scheduleDateTime,
          'Creative Lead'
        );

        if (res.success) {
          toast({
            title: 'Scheduled',
            description: `Queued for ${new Date(scheduleDateTime).toLocaleString()}.`,
          });
          onOpenChange(false);
        } else {
          toast({
            title: 'Scheduling Failed',
            description: res.error || 'Could not schedule.',
            variant: 'destructive',
          });
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <Globe className="w-5 h-5 text-blue-400" /> Multi-Platform Publishing
          </DialogTitle>
        </DialogHeader>

        {publishedUrl ? (
          /* Success Platform View */
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Published Successfully</h3>
              <p className="text-xs text-slate-400">
                Visual has been synchronized to {activeSpec.name}.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white hover:bg-slate-850 active:scale-[0.97]"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View on {activeSpec.name}
              </a>
              <Button
                onClick={() => {
                  setPublishedUrl(null);
                  onOpenChange(false);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-slate-950 h-9 px-5 rounded-xl active:scale-[0.97]"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Channel Selection Grid */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Destination Channel
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {(['youtube', 'facebook', 'instagram', 'linkedin', 'crm_asset'] as const).map((ch) => {
                  const spec = CHANNEL_SPECS[ch];
                  const Icon = CHANNEL_ICONS[ch];
                  const isSelected = selectedChannel === ch;

                  return (
                    <button
                      key={ch}
                      onClick={() => setSelectedChannel(ch)}
                      className={cn(
                        'p-2.5 rounded-2xl border text-xs flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.96]',
                        isSelected
                          ? 'bg-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/10 text-white'
                          : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-800'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-bold truncate w-full text-center">{spec.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Identifier Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">
                {activeSpec.name} Target
              </Label>
              <Input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder={activeSpec.targetPlaceholder}
                className="h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
              />
            </div>

            {/* Pre-Flight Checklist */}
            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Pre-Flight Confidence Checklist
              </div>
              <div className="space-y-1.5">
                {preFlightChecks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    {check.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : check.severity === 'error' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <span className={cn('text-[11px]', check.passed ? 'text-slate-300' : check.severity === 'error' ? 'text-rose-300' : 'text-amber-300')}>
                      {check.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Publishing Mode: Instant vs Scheduled */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPublishMode('instant')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border transition-all',
                    publishMode === 'instant'
                      ? 'bg-blue-600/15 border-blue-500/40 text-blue-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  )}
                >
                  <Send className="w-3.5 h-3.5 mx-auto mb-1" /> Publish Immediately
                </button>
                <button
                  onClick={() => setPublishMode('schedule')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border transition-all',
                    publishMode === 'schedule'
                      ? 'bg-blue-600/15 border-blue-500/40 text-blue-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  )}
                >
                  <Calendar className="w-3.5 h-3.5 mx-auto mb-1" /> Schedule Distribution
                </button>
              </div>

              {publishMode === 'schedule' && (
                <div className="pt-2">
                  <Input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="h-10 bg-slate-900 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-850">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="h-10 text-xs font-bold border-slate-800 bg-slate-900 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecutePublish}
                disabled={isPending || hasBlockingError || !targetId.trim() || (publishMode === 'schedule' && !scheduleDateTime)}
                className="h-10 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg active:scale-[0.97]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Distributing...
                  </>
                ) : publishMode === 'instant' ? (
                  <>
                    <Globe className="w-3.5 h-3.5 mr-1.5" /> Publish to {activeSpec.name}
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5 mr-1.5" /> Queue Publication
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
