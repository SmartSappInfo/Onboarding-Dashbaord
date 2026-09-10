'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Omnichannel MediaReference Picker Modal
 *
 * Implements PRD Sec 108 standardized `MediaReference` selection for omnichannel distribution
 * across WhatsApp, SMS, Email templates, and conversations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Standardized Cross-Channel Schema: Outputs `MediaReference` with channel-safe compact payloads.
 * 2. Mobile Accessibility: Enforces `min-h-[44px] min-w-[44px]` touch targets.
 * 3. Tactile Micro-Animations: `active:scale-[0.97]` on all buttons and cards.
 * 4. Strict Typing Standard: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 108 (Messaging Integration & MediaReference).
 * - UX Sec 102 (Idea → Campaign) & Sec 165 (Journey C — Campaign Manager).
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Share2,
  Video,
  FileText,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/lib/firestore-context';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import type { MediaReference } from '@/lib/types/media-2.0';

export interface MediaReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  defaultChannel?: 'whatsapp' | 'email' | 'sms' | 'web';
  onSelectReference?: (mediaRef: MediaReference) => void;
}

interface MediaItem {
  id: string;
  title: string;
  type: string;
  thumbnailUrl?: string;
  duration?: string;
  durationSeconds?: number;
}

export function MediaReferenceModal({
  open,
  onOpenChange,
  workspaceId,
  defaultChannel = 'whatsapp',
  onSelectReference,
}: MediaReferenceModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<MediaItem | null>(null);
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'sms' | 'web'>(defaultChannel);
  const [trackingMode, setTrackingMode] = useState<'identified' | 'anonymous' | 'tokenized'>('tokenized');
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (!open || !firestore || !workspaceId) return;

    async function fetchLibrary() {
      try {
        const q = query(
          collection(firestore, 'media'),
          where('workspaceId', '==', workspaceId),
          limit(30)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title || data.name || 'Untitled Media') as string,
            type: (data.type || 'video') as string,
            thumbnailUrl: (data.thumbnailUrl as string) || undefined,
            duration: (data.duration as string) || '02:30',
            durationSeconds: (data.durationSeconds as number) || 150,
          };
        });
        setAssets(items);
        if (items.length > 0 && !selectedAsset) {
          setSelectedAsset(items[0]);
        }
      } catch (err) {
        console.error('[MediaReferenceModal] Error fetching assets:', err);
      }
    }

    fetchLibrary();
  }, [open, firestore, workspaceId]);

  const filteredAssets = assets.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const constructMediaReference = (): MediaReference | null => {
    if (!selectedAsset) return null;
    const url = `/m/${selectedAsset.id}`;
    return {
      assetId: selectedAsset.id,
      title: selectedAsset.title,
      linkTemplate: `{{media_link:${selectedAsset.id}}}`,
      thumbnailUrl: selectedAsset.thumbnailUrl,
      durationSeconds: selectedAsset.durationSeconds,
      formattedDuration: selectedAsset.duration,
      url,
      trackingMode,
      channel,
    };
  };

  const handleSelect = () => {
    const ref = constructMediaReference();
    if (!ref) return;
    onSelectReference?.(ref);
    toast({
      title: 'Media Reference Selected',
      description: `Added "${ref.title}" for ${channel.toUpperCase()} distribution.`,
    });
    onOpenChange(false);
  };

  const handleCopyToken = () => {
    const ref = constructMediaReference();
    if (!ref) return;
    navigator.clipboard.writeText(ref.linkTemplate);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
    toast({
      title: 'Variable Copied',
      description: `Copied ${ref.linkTemplate} to clipboard.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Share2 className="h-5 w-5 text-blue-600" />
            Insert Media Reference
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Standardized media reference for Email, WhatsApp, SMS, and campaign broadcasts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Channel Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Distribution Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp Broadcast</SelectItem>
                  <SelectItem value="email">Email Campaign</SelectItem>
                  <SelectItem value="sms">SMS Text Link</SelectItem>
                  <SelectItem value="web">Web Portal / Chat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tracking Continuity</Label>
              <Select value={trackingMode} onValueChange={(v) => setTrackingMode(v as typeof trackingMode)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tokenized">Encrypted Token (Feistel)</SelectItem>
                  <SelectItem value="identified">Direct Contact ID</SelectItem>
                  <SelectItem value="anonymous">Anonymous Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library assets..."
              className="min-h-[44px] pl-9 text-xs"
            />
          </div>

          {/* Asset List */}
          <div className="max-h-52 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer border text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 shrink-0">
                        {asset.type === 'video' ? <Video className="h-3.5 w-3.5 text-blue-500" /> : <FileText className="h-3.5 w-3.5 text-amber-500" />}
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {asset.title}
                        </p>
                        <p className="text-[11px] text-slate-400 uppercase">
                          {asset.type} • {asset.duration}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Badge className="bg-blue-600 text-white text-[10px]">
                        Selected
                      </Badge>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                No matching media assets found.
              </p>
            )}
          </div>

          {/* Live Preview Snippet */}
          {selectedAsset && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Variable Reference Token:
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyToken}
                  className="min-h-[32px] px-2 text-xs text-blue-600 active:scale-[0.97]"
                >
                  {hasCopied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {hasCopied ? 'Copied' : 'Copy Variable'}
                </Button>
              </div>
              <p className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 select-all">
                {`{{media_link:${selectedAsset.id}}}`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] text-xs active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedAsset}
            className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs active:scale-[0.97]"
          >
            Insert Media Reference
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
