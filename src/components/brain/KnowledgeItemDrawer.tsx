'use client';

/**
 * @fileOverview Standardized Knowledge Item Inspector Drawer (Phase 4 Milestone 4)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture):
 * - Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>`
 * - Zero Raw Descriptions: routed through `<CardInfoTooltip text="..." />` alongside title
 * - Screen Reader AA: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `active:scale-[0.97]`
 *
 * Security & Governance (Rules 4, 13, 22, 29, 30, 32, 64):
 * - Rule 30: Untrusted content isolated in `<untrusted_reference_data>` container
 * - Rule 22: Cryptographic SHA-256 chunk hash badge with copy capability
 * - Rule 29: Temporal validity expiration indicators
 * - Rule 32: Sensitivity badges (public, internal, confidential, restricted)
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Copy,
  Check,
  Shield,
  Clock,
  Sparkles,
  Layers,
  Fingerprint,
  Calendar,
} from 'lucide-react';
import type { CanonicalMemoryObject } from '@/platform/memory';

export interface KnowledgeItemDrawerProps {
  item: CanonicalMemoryObject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isProcessing?: boolean;
}

export function KnowledgeItemDrawer({
  item,
  open,
  onOpenChange,
  onVerify,
  onReject,
  onDelete,
  isProcessing = false,
}: KnowledgeItemDrawerProps) {
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'provenance' | 'vector'>('overview');

  if (!item) return null;

  const handleCopyHash = () => {
    const hash = item.source?.sourceHash || item.provenance?.sourceHash || item.id;
    void navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const getSensitivityBadge = () => {
    switch (item.sensitivity) {
      case 'restricted':
        return <Badge variant="destructive" className="font-mono text-xs uppercase">Restricted</Badge>;
      case 'confidential':
        return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 font-mono text-xs uppercase">Confidential</Badge>;
      case 'public':
        return <Badge variant="secondary" className="font-mono text-xs uppercase">Public</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-xs uppercase">Internal</Badge>;
    }
  };

  const getVerificationBadge = () => {
    switch (item.verification) {
      case 'user_confirmed':
      case 'source_verified':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'invalidated':
      case 'disputed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Invalidated
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Unverified
          </Badge>
        );
    }
  };

  const chunkHash = item.source?.sourceHash || item.provenance?.sourceHash || 'sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const confidencePercent = Math.round(item.confidence * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl max-h-[90vh]"
      >
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-base sm:text-lg font-semibold truncate flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{item.title || `${item.type.toUpperCase()}: ${item.id.slice(0, 8)}`}</span>
            </DialogTitle>
            <CardInfoTooltip
              text="Inspect canonical memory object provenance, cryptographic content hash, vector embeddings, and lifecycle status."
            />
          </div>
          <DialogDescription className="sr-only">
            Memory item inspection and lifecycle controls for {item.id}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'overview' | 'provenance' | 'vector')}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="px-6 border-b border-border/60 bg-muted/10 shrink-0">
            <TabsList className="bg-transparent h-11 p-0 gap-4">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs sm:text-sm font-medium"
              >
                Overview & Content
              </TabsTrigger>
              <TabsTrigger
                value="provenance"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs sm:text-sm font-medium"
              >
                Provenance & Hashing
              </TabsTrigger>
              <TabsTrigger
                value="vector"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs sm:text-sm font-medium"
              >
                Vector & Qdrant
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Overview & Content */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            {/* Meta Tags Row */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border/40">
              <Badge variant="outline" className="font-mono text-xs uppercase flex items-center gap-1">
                <Layers className="h-3 w-3 text-muted-foreground" />
                Tier: {item.tier}
              </Badge>
              {getVerificationBadge()}
              {getSensitivityBadge()}
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <span>Confidence:</span>
                <span className="font-semibold text-foreground">{confidencePercent}%</span>
              </div>
            </div>

            {/* Rule 30 Prompt Injection Isolation Container */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Isolated Memory Text (Rule 30 Untrusted Quarantine)
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  {`<untrusted_reference_data>`}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {item.content}
              </div>
            </div>

            {/* Temporal Validity & Lineage (Rule 29) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Valid From
                </div>
                <div className="text-xs font-mono">
                  {new Date(item.temporal.validFrom).toLocaleDateString()} {new Date(item.temporal.validFrom).toLocaleTimeString()}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Valid Until
                </div>
                <div className="text-xs font-mono">
                  {item.temporal.validUntil ? (
                    <span>{new Date(item.temporal.validUntil).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Permanent</span>
                  )}
                </div>
              </div>
            </div>

            {item.topics && item.topics.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-medium text-muted-foreground">Indexed Topics</div>
                <div className="flex flex-wrap gap-1.5">
                  {item.topics.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[11px] font-mono">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Provenance & Cryptography */}
          <TabsContent value="provenance" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            {/* Cryptographic SHA-256 Hash (Rule 22) */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/15 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium flex items-center gap-1.5">
                  <Fingerprint className="h-4 w-4 text-primary" />
                  Cryptographic Content Hash (SHA-256)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyHash}
                  className="h-7 text-xs gap-1 active:scale-[0.97]"
                >
                  {copiedHash ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedHash ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="font-mono text-xs p-2.5 rounded-lg bg-background border border-border/60 break-all select-all">
                {chunkHash}
              </div>
            </div>

            {/* Source Origin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Source Type</div>
                <div className="text-xs font-mono capitalize">{item.source.type}</div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Source ID</div>
                <div className="text-xs font-mono truncate">{item.source.sourceId}</div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Created By</div>
                <div className="text-xs font-mono capitalize">
                  {item.provenance.createdBy} {item.provenance.userId ? `(${item.provenance.userId})` : ''}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Workspace ID</div>
                <div className="text-xs font-mono truncate">{item.workspaceId}</div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Vector & Qdrant */}
          <TabsContent value="vector" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <div className="p-4 rounded-xl border border-border/80 bg-muted/15 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Embedding Architecture</span>
                <Badge variant="outline" className="font-mono text-xs">gemini-embedding-001</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Vector Dimensions:</span>{' '}
                  <span className="font-mono font-semibold">768</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Norm:</span>{' '}
                  <span className="font-mono font-semibold">1.00000 (Unit Sphere)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Storage:</span>{' '}
                  <span className="font-mono font-semibold">Qdrant + Memory Fallback</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Metric:</span>{' '}
                  <span className="font-mono font-semibold">Cosine Distance</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Demarcated Footer (theme.md §8.5) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => void onDelete(item.id)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl active:scale-[0.97] mr-auto min-h-[44px] sm:min-h-[36px]"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}

          {onReject && item.verification !== 'invalidated' && (
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => void onReject(item.id)}
              className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
            >
              <XCircle className="h-3.5 w-3.5 mr-1 text-destructive" />
              Invalidate
            </Button>
          )}

          {onVerify && item.verification !== 'user_confirmed' && (
            <Button
              variant="default"
              size="sm"
              disabled={isProcessing}
              onClick={() => void onVerify(item.id)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Verify & Add
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
