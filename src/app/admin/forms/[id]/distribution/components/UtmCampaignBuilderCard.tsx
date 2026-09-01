'use client';

/**
 * SmartSapp Forms 2.0: UTM Campaign Asset Builder & Tracking Hub
 * 
 * Generates custom UTM-tagged URLs for ads, emails, and social channels,
 * and maintains a persistent directory of saved distribution links.
 */

import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Link2, 
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  createDistributionLinkAction, 
  getFormDistributionsAction, 
  deleteDistributionLinkAction 
} from '@/lib/forms/form-distribution-actions';
import { buildDistributionUrl } from '@/lib/forms/form-utils';
import type { Form } from '@/lib/types';
import type { FormDistributionLink, DistributionChannel } from '@/lib/forms/form-distribution-types';

interface UtmCampaignBuilderCardProps {
  form: Form;
}

export default function UtmCampaignBuilderCard({ form }: UtmCampaignBuilderCardProps) {
  const { toast } = useToast();
  const [links, setLinks] = useState<FormDistributionLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [hasCopiedCurrent, setHasCopiedCurrent] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<DistributionChannel>('email_campaign');
  const [utmSource, setUtmSource] = useState('newsletter');
  const [utmMedium, setUtmMedium] = useState('email');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const slug = form.slug || form.id;

  const currentGeneratedUrl = buildDistributionUrl(origin, slug, {
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign,
    term: utmTerm,
    content: utmContent,
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoadingLinks(true);
      try {
        const res = await getFormDistributionsAction(form.id);
        if (isMounted && res.success) {
          setLinks(res.links);
        }
      } catch (err) {
        console.error('Error fetching distributions:', err);
      } finally {
        if (isMounted) setIsLoadingLinks(false);
      }
    })();
    return () => { isMounted = false; };
  }, [form.id]);

  const handleCopyGenerated = async () => {
    try {
      await navigator.clipboard.writeText(currentGeneratedUrl);
      setHasCopiedCurrent(true);
      toast({ title: 'Campaign Link Copied', description: 'URL copied with all tracking parameters.' });
      setTimeout(() => setHasCopiedCurrent(false), 2500);
    } catch {
      toast({ title: 'Copy Failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const handleSaveDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSavingLink) return;

    setIsSavingLink(true);
    try {
      const res = await createDistributionLinkAction({
        formId: form.id,
        workspaceId: form.workspaceId,
        name: name.trim(),
        channel,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
      });

      if (res.success && res.link) {
        setLinks(prev => [res.link!, ...prev]);
        setName('');
        setUtmCampaign('');
        setUtmTerm('');
        setUtmContent('');
        toast({ title: 'Campaign Link Saved', description: 'Trackable distribution asset created.' });
      } else {
        toast({ title: 'Failed to Save Link', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
    const res = await deleteDistributionLinkAction(id);
    if (res.success) {
      toast({ title: 'Link Removed', description: 'Distribution asset deleted.' });
    } else {
      toast({ title: 'Delete Failed', description: res.error, variant: 'destructive' });
    }
  };

  const channelColors: Record<DistributionChannel, string> = {
    hosted_link: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    iframe_inline: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    popup_widget: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    slideover_widget: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    qr_code: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    email_campaign: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    sms_campaign: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    whatsapp_campaign: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
    api: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  };

  return (
    <Card className="rounded-3xl border-border/60 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              UTM Campaign Link Builder
            </CardTitle>
            <CardDescription className="text-xs">
              Generate and track distinct campaign links for newsletters, social ads, SMS, or partnerships.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Creator Form */}
        <form onSubmit={handleSaveDistribution} className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground">Asset / Campaign Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 Admissions Newsletter"
                className="h-9 text-xs rounded-xl bg-background"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground">Distribution Channel</Label>
              <Select value={channel} onValueChange={(val) => setChannel(val as DistributionChannel)}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_campaign">Email Campaign</SelectItem>
                  <SelectItem value="whatsapp_campaign">WhatsApp Broadcast</SelectItem>
                  <SelectItem value="sms_campaign">SMS Blast</SelectItem>
                  <SelectItem value="qr_code">QR Code Flyer</SelectItem>
                  <SelectItem value="hosted_link">Social Media Post</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground">UTM Source</Label>
              <Input
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="newsletter, google, facebook"
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground">UTM Medium</Label>
              <Input
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="email, cpc, social, banner"
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground">UTM Campaign</Label>
              <Input
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="fall_intake_2026"
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground">UTM Content / Variant (Optional)</Label>
              <Input
                value={utmContent}
                onChange={(e) => setUtmContent(e.target.value)}
                placeholder="header_cta_btn"
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>
          </div>

          {/* Real-time Generated Preview & Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/30">
            <div className="flex-1 px-3 py-1.5 font-mono text-xs text-foreground bg-background/80 rounded-xl border border-border/40 truncate select-all">
              {currentGeneratedUrl}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyGenerated}
                className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
              >
                {hasCopiedCurrent ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy URL
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || isSavingLink}
                className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
              >
                {isSavingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Save Asset
              </Button>
            </div>
          </div>
        </form>

        {/* Saved Distribution Links Directory */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Saved Distribution Assets ({links.length})
            </span>
          </div>

          {isLoadingLinks ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Loading campaign assets...</div>
          ) : links.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center space-y-2 bg-muted/5">
              <Link2 className="h-5 w-5 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">No saved campaign links created yet.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="text-[11px] font-bold uppercase">
                    <TableHead>Asset Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>UTM Source / Medium</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/30">
                  {links.map((link) => (
                    <TableRow key={link.id} className="hover:bg-muted/20 text-xs">
                      <TableCell className="font-bold text-foreground py-3">
                        {link.name}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={`text-[10px] font-bold ${channelColors[link.channel] || ''}`}>
                          {link.channel.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground py-3">
                        {link.utmSource || '—'} / {link.utmMedium || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground py-3">
                        {link.utmCampaign || '—'}
                      </TableCell>
                      <TableCell className="text-right py-3 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await navigator.clipboard.writeText(link.generatedUrl);
                              toast({ title: 'URL Copied', description: link.generatedUrl });
                            }}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteLink(link.id)}
                            className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
