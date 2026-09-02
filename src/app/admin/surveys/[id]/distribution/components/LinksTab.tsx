'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Public & Custom Links Distribution Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Manages primary public survey URLs, custom slugs, expiration, and password gates.
 * 2. Strict Zero-Any Invariant.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Globe, Copy, Check, ExternalLink, ShieldCheck, RefreshCw } from 'lucide-react';
import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from '@/lib/surveys/survey-v2-types';

export interface LinksTabProps {
  survey: Survey;
  deployments: SurveyDeployment[];
  defaultUrl: string;
  onRefresh: () => void;
}

export function LinksTab({
  survey,
  deployments,
  defaultUrl,
  onRefresh,
}: LinksTabProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: 'Link Copied',
        description: 'Survey URL has been copied to your clipboard.',
      });
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not access clipboard.' });
    }
  };

  const webDeployments = deployments.filter((d) => d.channel === 'web');

  return (
    <div className="space-y-6">
      {/* Primary Public Link Card */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <CardTitle className="text-base font-bold text-foreground">Public Link</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  The primary respondent-facing URL for this survey blueprint.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold text-xs ml-auto shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              {survey.status === 'published' ? 'Active & Published' : 'Draft / Private'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Public Respondent URL</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={defaultUrl}
                className="font-mono text-xs bg-muted/40 h-11 rounded-xl"
              />
              <Button
                type="button"
                onClick={() => handleCopy(defaultUrl)}
                className="h-11 px-4 rounded-xl font-semibold shrink-0 shadow-sm active:scale-[0.97]"
              >
                {copied ? <Check className="h-4 w-4 mr-1 text-emerald-400" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(defaultUrl, '_blank')}
                className="h-11 px-3 rounded-xl shrink-0 hover:bg-muted active:scale-[0.97]"
                title="Open public survey in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Access Mode</span>
              <p className="text-xs font-medium text-foreground">Open Public Access</p>
            </div>
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Slug Identifier</span>
              <p className="text-xs font-mono font-medium text-foreground">{survey.slug || survey.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Web Deployments List */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 flex items-center justify-center">
                <Link2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <CardTitle className="text-sm font-bold text-foreground">Web Distribution Channels</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Segmented tracking links created for targeted web channels.
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-8 text-xs text-muted-foreground hover:text-foreground ml-auto shrink-0 active:scale-[0.97]">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webDeployments.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No additional web tracking links configured yet. Use the Deployment Manager to generate custom UTM campaign links.
            </div>
          ) : (
            <div className="space-y-3">
              {webDeployments.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{dep.name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{dep.status}</Badge>
                    </div>
                    <p className="font-mono text-muted-foreground truncate">{dep.url}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(dep.url)}
                    className="h-9 px-3 rounded-lg active:scale-[0.97]"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
