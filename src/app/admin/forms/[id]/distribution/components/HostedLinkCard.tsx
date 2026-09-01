'use client';

/**
 * SmartSapp Forms 2.0: Hosted Direct URL & Social Distribution Card
 * 
 * Manages canonical public hosted link, custom URL slug updates, 1-click
 * clipboard copy, and direct social share intents (WhatsApp, LinkedIn, X, Email).
 */

import React, { useState } from 'react';
import { 
  Globe, 
  Copy, 
  Check, 
  ExternalLink, 
  Share2, 
  Edit3, 
  Save, 
  Loader2,
  Mail
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateFormSlugAction } from '@/lib/forms/form-distribution-actions';
import type { Form } from '@/lib/types';

interface HostedLinkCardProps {
  form: Form;
  onSlugUpdated?: (newSlug: string) => void;
}

export default function HostedLinkCard({ form, onSlugUpdated }: HostedLinkCardProps) {
  const { toast } = useToast();
  const [currentSlug, setCurrentSlug] = useState(form.slug || form.id);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState(form.slug || form.id);
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const hostedUrl = `${origin}/p/f/${currentSlug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(hostedUrl);
      setHasCopied(true);
      toast({ title: 'Link Copied', description: 'Public form link copied to clipboard.' });
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast({ title: 'Copy Failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const handleSaveSlug = async () => {
    if (!slugInput.trim() || slugInput === currentSlug) {
      setIsEditingSlug(false);
      return;
    }

    setIsSavingSlug(true);
    try {
      const res = await updateFormSlugAction(form.id, slugInput.trim());
      if (res.success && res.slug) {
        setCurrentSlug(res.slug);
        setIsEditingSlug(false);
        if (onSlugUpdated) onSlugUpdated(res.slug);
        toast({ title: 'URL Slug Updated', description: `Form is now accessible at /p/f/${res.slug}` });
      } else {
        toast({ title: 'Slug Update Failed', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSavingSlug(false);
    }
  };

  // Social Share Handlers
  const shareTitle = encodeURIComponent(form.title || 'Please fill out this form');
  const encodedUrl = encodeURIComponent(hostedUrl);

  const socialLinks = [
    {
      name: 'WhatsApp',
      url: `https://wa.me/?text=${shareTitle}%20${encodedUrl}`,
      color: 'hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30',
    },
    {
      name: 'LinkedIn',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/30',
    },
    {
      name: 'X (Twitter)',
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareTitle}`,
      color: 'hover:bg-slate-500/10 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-500/30',
    },
    {
      name: 'Email',
      url: `mailto:?subject=${shareTitle}&body=Please%20fill%20out%20this%20form:%20${encodedUrl}`,
      color: 'hover:bg-purple-500/10 hover:text-purple-600 hover:border-purple-500/30',
    },
  ];

  return (
    <Card className="rounded-3xl border-border/60 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Direct Hosted Link
            </CardTitle>
            <CardDescription className="text-xs">
              Your canonical standalone form page. Accessible by anyone without authentication.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            Public Active
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Link Display & Copy Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl bg-muted/20 border border-border/40">
          <div className="flex-1 px-3 py-1.5 font-mono text-xs text-foreground truncate select-all">
            {hostedUrl}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleCopyLink}
              className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
            >
              {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {hasCopied ? 'Copied' : 'Copy Link'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(hostedUrl, '_blank')}
              className="h-9 px-3 rounded-xl text-xs font-bold gap-1 min-h-[44px] sm:min-h-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Custom Slug Editor */}
        <div className="space-y-2 pt-1 border-t border-border/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Custom Public Slug
            </span>
            {!isEditingSlug && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSlugInput(currentSlug);
                  setIsEditingSlug(true);
                }}
                className="h-7 text-xs font-semibold text-primary hover:text-primary/80 gap-1"
              >
                <Edit3 className="h-3 w-3" />
                Customize Slug
              </Button>
            )}
          </div>

          {isEditingSlug ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center rounded-xl border border-border/60 bg-background px-3 h-10">
                <span className="text-xs text-muted-foreground font-mono">/p/f/</span>
                <Input
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                  placeholder="custom-slug"
                  className="border-0 shadow-none focus-visible:ring-0 text-xs font-mono h-8 px-1"
                />
              </div>

              <Button
                size="sm"
                onClick={handleSaveSlug}
                disabled={isSavingSlug || !slugInput.trim()}
                className="h-10 px-4 rounded-xl text-xs font-bold gap-1.5"
              >
                {isSavingSlug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingSlug(false)}
                className="h-10 px-3 rounded-xl text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-mono">
              Accessible path: <span className="text-foreground font-bold">/p/f/{currentSlug}</span>
            </p>
          )}
        </div>

        {/* Social Share Intents */}
        <div className="space-y-2.5 pt-1 border-t border-border/30">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            Instant Social Share
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {socialLinks.map((item) => (
              <Button
                key={item.name}
                variant="outline"
                size="sm"
                onClick={() => window.open(item.url, '_blank')}
                className={`h-10 rounded-2xl text-xs font-bold border-border/50 transition-colors ${item.color}`}
              >
                {item.name === 'Email' ? <Mail className="h-3.5 w-3.5 mr-1.5" /> : null}
                {item.name}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
