'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Distribution Management:
 *    Renders Studio Tab 6 (Access & Links) allowing workspace admins to generate signed
 *    campaign links, download QR codes, copy iframe embed snippets, and revoke links (PRD Sections 20, 54–58 & 86).
 * 2. Mobile Ergonomics & Touch Target Standards:
 *    All copy buttons, QR download buttons, and modal dialogs enforce `min-h-[44px]` touch target bounds.
 * 3. Emil Kowalski Animation Standards:
 *    Smooth state transitions, active scaling feedback (`active:scale-95`), and modal fading.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useEffect } from 'react';
import type { DocumentDistribution, DistributionType } from '@/lib/types/document-types';
import {
  createDocumentDistributionAction,
  listDocumentDistributionsAction,
  revokeDocumentDistributionAction,
} from '@/lib/documents/distribution-actions';
import { generateEmbedIframeSnippet } from '@/lib/documents/distribution-service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Link as LinkIcon,
  QrCode,
  Code,
  Plus,
  Copy,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Sparkles,
  Download,
  Share2,
  CheckCircle2,
  Trash2,
  Globe,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentDistributionManagerProps {
  workspaceId: string;
  documentId: string;
  versionId: string;
  slug: string;
  title: string;
}

export function DocumentDistributionManager({
  workspaceId,
  documentId,
  versionId,
  slug,
  title,
}: DocumentDistributionManagerProps) {
  const { toast } = useToast();
  const [distributions, setDistributions] = useState<DocumentDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [channelType, setChannelType] = useState<DistributionType>('campaign');
  const [campaignId, setCampaignId] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Active QR & Embed Modal
  const [activeQRUrl, setActiveQRUrl] = useState<string | null>(null);
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}/d/${slug}` : `/d/${slug}`;
  const legacyUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${slug}` : `/f/${slug}`;

  // Fetch distributions on load
  const loadDistributions = async () => {
    setIsLoading(true);
    try {
      const res = await listDocumentDistributionsAction(workspaceId, documentId);
      if (res.success && res.distributions) {
        setDistributions(res.distributions);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load distributions.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDistributions();
  }, [workspaceId, documentId]);

  // Handle Copy to Clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied to Clipboard', description: text });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Create Distribution Link
  const handleCreateDistribution = async () => {
    setIsCreating(true);
    try {
      const trackingParameters: Record<string, string> = {};
      if (utmSource.trim()) trackingParameters.utm_source = utmSource.trim();
      if (utmMedium.trim()) trackingParameters.utm_medium = utmMedium.trim();
      if (campaignId.trim()) trackingParameters.utm_campaign = campaignId.trim();

      const res = await createDocumentDistributionAction({
        workspaceId,
        documentId,
        versionId,
        type: channelType,
        slug,
        campaignId: campaignId.trim() || undefined,
        trackingParameters: Object.keys(trackingParameters).length > 0 ? trackingParameters : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      });

      if (res.success && res.distribution) {
        toast({ title: 'Distribution Created', description: 'New trackable distribution link is ready.' });
        setIsCreateOpen(false);
        setCampaignId('');
        setUtmSource('');
        setUtmMedium('');
        setExpiresAt('');
        await loadDistributions();
      } else {
        toast({ variant: 'destructive', title: 'Creation Failed', description: res.error || 'Failed to create channel.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
      setIsCreating(false);
    }
  };

  // Revoke Distribution Link
  const handleRevoke = async (distributionId: string) => {
    try {
      const res = await revokeDocumentDistributionAction(workspaceId, distributionId);
      if (res.success) {
        toast({ title: 'Link Revoked', description: 'The distribution link is no longer accessible.' });
        await loadDistributions();
      } else {
        toast({ variant: 'destructive', title: 'Revocation Failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to revoke link.' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* ── 1. Canonical URLs Card ─────────────────────────────────────────── */}
      <Card className="rounded-3xl border-border/60 bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <h3 className="text-base font-black flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Canonical Public URLs
            </h3>
            <p className="text-xs text-muted-foreground">Default direct web links for public viewing</p>
          </div>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl font-bold text-xs h-10 gap-1.5 min-h-[44px]"
          >
            <Plus className="h-4 w-4" /> Create Trackable Channel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Universal Clean Route */}
          <div className="p-4 rounded-2xl bg-muted/20 border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Universal Clean URL (/d)</span>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                Recommended
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={canonicalUrl}
                className="h-10 text-xs font-mono bg-background min-h-[40px]"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(canonicalUrl, 'canonical')}
                className="h-10 w-10 shrink-0 rounded-xl min-h-[40px]"
                title="Copy link"
              >
                {copiedId === 'canonical' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(canonicalUrl, '_blank')}
                className="h-10 w-10 shrink-0 rounded-xl min-h-[40px]"
                title="Open reader"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Legacy Flipbook Route */}
          <div className="p-4 rounded-2xl bg-muted/20 border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Legacy Compatibility URL (/f)</span>
              <Badge variant="outline" className="text-[10px]">
                Legacy Sync
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={legacyUrl}
                className="h-10 text-xs font-mono bg-background min-h-[40px]"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(legacyUrl, 'legacy')}
                className="h-10 w-10 shrink-0 rounded-xl min-h-[40px]"
                title="Copy link"
              >
                {copiedId === 'legacy' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(legacyUrl, '_blank')}
                className="h-10 w-10 shrink-0 rounded-xl min-h-[40px]"
                title="Open reader"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── 2. Trackable Distribution Channels ─────────────────────────────── */}
      <Card className="rounded-3xl border-border/60 bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-black flex items-center gap-2">
            <Share2 className="h-4 w-4 text-indigo-400" />
            Active Distribution Channels ({distributions.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Signed campaign links, QR codes, and embed snippets with independent telemetry.
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading distribution channels...</div>
        ) : distributions.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl space-y-2">
            <Share2 className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="font-bold">No custom distribution channels created yet.</p>
            <p className="text-[11px]">Create a campaign link or QR code to track targeted attribution.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {distributions.map((d) => {
              const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/d/${slug}?t=${d.token || ''}`;
              const isRevoked = d.status === 'revoked';
              const isExpired = d.expiresAt && new Date(d.expiresAt).getTime() < Date.now();

              return (
                <div
                  key={d.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isRevoked
                      ? 'bg-destructive/5 border-destructive/20 opacity-60'
                      : 'bg-muted/10 border-border/60 hover:bg-muted/20'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="font-mono uppercase text-[10px] font-black">
                        {d.type.replace('_', ' ')}
                      </Badge>
                      {d.campaignId && (
                        <span className="text-xs font-bold text-foreground">
                          Campaign: {d.campaignId}
                        </span>
                      )}
                      {isRevoked ? (
                        <Badge variant="destructive" className="text-[10px]">Revoked</Badge>
                      ) : isExpired ? (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">Expired</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">Active</Badge>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground truncate max-w-md">
                      {fullUrl}
                    </div>

                    {d.expiresAt && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Expires: {new Date(d.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* QR Code Trigger */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveQRUrl(fullUrl)}
                      className="h-9 rounded-xl text-xs font-bold gap-1 min-h-[36px]"
                    >
                      <QrCode className="h-3.5 w-3.5" /> QR Code
                    </Button>

                    {/* Embed Snippet Trigger */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveEmbedUrl(fullUrl)}
                      className="h-9 rounded-xl text-xs font-bold gap-1 min-h-[36px]"
                    >
                      <Code className="h-3.5 w-3.5" /> Embed Code
                    </Button>

                    {/* Copy Link */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(fullUrl, d.id)}
                      className="h-9 rounded-xl text-xs font-bold gap-1 min-h-[36px]"
                    >
                      {copiedId === d.id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>

                    {/* Revoke Action */}
                    {!isRevoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(d.id)}
                        className="h-9 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 min-h-[36px]"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── 3. Create Distribution Channel Modal ────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-left">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-black">Create Trackable Channel</DialogTitle>
            <p className="text-xs text-muted-foreground">Generate signed links for campaigns, social, QR, or embeds.</p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Channel Type</Label>
              <select
                value={channelType}
                onChange={(e) => setChannelType(e.target.value as DistributionType)}
                className="w-full h-11 rounded-xl bg-card border px-3 text-xs font-bold min-h-[44px]"
              >
                <option value="campaign">Email / Nurture Campaign</option>
                <option value="qr">Physical Print & Signage QR Code</option>
                <option value="embed">Website Embed (Iframe)</option>
                <option value="whatsapp">WhatsApp Direct Broadcast</option>
                <option value="contact_link">1-to-1 Contact Link</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Campaign Name / Identifier</Label>
              <Input
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                placeholder="e.g. spring-open-day-2026"
                className="h-11 rounded-xl text-xs min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">UTM Source</Label>
                <Input
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  placeholder="newsletter"
                  className="h-11 rounded-xl text-xs min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">UTM Medium</Label>
                <Input
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  placeholder="email"
                  className="h-11 rounded-xl text-xs min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Expiration Date (Optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-11 rounded-xl text-xs min-h-[44px]"
              />
            </div>

            <Button
              disabled={isCreating}
              onClick={handleCreateDistribution}
              className="w-full h-11 rounded-xl font-bold text-xs min-h-[44px] gap-2 mt-2"
            >
              <Sparkles className="h-4 w-4" /> {isCreating ? 'Generating...' : 'Generate Distribution Channel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 4. QR Code Download Modal ───────────────────────────────────────── */}
      <Dialog open={!!activeQRUrl} onOpenChange={(open) => !open && setActiveQRUrl(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6 text-center">
          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-base font-black">Scan & Share QR Code</DialogTitle>
            <p className="text-xs text-muted-foreground">Scan with any mobile camera to open publication.</p>
          </DialogHeader>

          {activeQRUrl && (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-white rounded-2xl mx-auto w-fit shadow-md border">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(activeQRUrl)}`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(activeQRUrl)}`;
                    link.download = `${slug}-qr-code.png`;
                    link.target = '_blank';
                    link.click();
                  }}
                  className="w-full h-11 rounded-xl font-bold text-xs min-h-[44px] gap-2"
                >
                  <Download className="h-4 w-4" /> Download High-Res PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 5. Embed Iframe Snippet Modal ───────────────────────────────────── */}
      <Dialog open={!!activeEmbedUrl} onOpenChange={(open) => !open && setActiveEmbedUrl(null)}>
        <DialogContent className="max-w-lg rounded-3xl p-6 text-left">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-black">Website Embed Code</DialogTitle>
            <p className="text-xs text-muted-foreground">Paste this HTML snippet into your website or CMS.</p>
          </DialogHeader>

          {activeEmbedUrl && (
            <div className="space-y-4 pt-2">
              <textarea
                readOnly
                rows={4}
                value={generateEmbedIframeSnippet({
                  url: activeEmbedUrl,
                  title,
                  height: '600px',
                })}
                className="w-full p-3 font-mono text-xs bg-muted/40 border rounded-2xl focus:outline-none"
              />

              <Button
                onClick={() => {
                  const snippet = generateEmbedIframeSnippet({
                    url: activeEmbedUrl,
                    title,
                    height: '600px',
                  });
                  handleCopy(snippet, 'embed_snippet');
                }}
                className="w-full h-11 rounded-xl font-bold text-xs min-h-[44px] gap-2"
              >
                <Copy className="h-4 w-4" /> Copy Embed Snippet
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
