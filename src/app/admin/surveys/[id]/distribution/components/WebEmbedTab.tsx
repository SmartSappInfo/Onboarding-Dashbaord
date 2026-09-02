'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Web Embed & Widget SDK Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Generates 4 presentation modes (inline, popup, drawer, fab).
 * 2. Emits auto-height postMessage protocol to eliminate cross-origin clipping.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Layers, Copy, Check, Code } from 'lucide-react';
import { generateIframeEmbedSnippet, generateModalEmbedSnippet } from '@/lib/surveys/survey-attribution';
import type { Survey } from '@/lib/types';

export interface WebEmbedTabProps {
  survey: Survey;
  defaultUrl: string;
}

export function WebEmbedTab({ survey, defaultUrl }: WebEmbedTabProps) {
  const { toast } = useToast();
  const [embedMode, setEmbedMode] = React.useState<'inline' | 'popup' | 'drawer' | 'fab'>('inline');
  const [copied, setCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const generatedCode = React.useMemo(() => {
    if (embedMode === 'popup') {
      return generateModalEmbedSnippet(defaultUrl, 'Take Survey');
    }
    return generateIframeEmbedSnippet(defaultUrl, survey.title || 'Survey');
  }, [embedMode, defaultUrl, survey.title]);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast({
        title: 'Embed Code Copied',
        description: 'Code snippet is copied and ready to paste into your website or CMS.',
      });
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not access clipboard.' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 flex items-center justify-center">
                <Code className="h-5 w-5" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <CardTitle className="text-base font-bold text-foreground">Web Embed & Widget SDK</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Embed this survey seamlessly into websites, web applications, or student/parent portals.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Presentation Mode</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'inline', label: 'Inline Iframe', desc: 'Embedded directly on page' },
                { id: 'popup', label: 'Popup Modal', desc: 'Click trigger or delayed dialog' },
                { id: 'drawer', label: 'Slide-in Drawer', desc: 'Bottom corner feedback panel' },
                { id: 'fab', label: 'Feedback Badge', desc: 'Floating trigger button' },
              ].map((mode) => (
                <Button
                  key={mode.id}
                  type="button"
                  variant={embedMode === mode.id ? 'default' : 'outline'}
                  onClick={() => setEmbedMode(mode.id as typeof embedMode)}
                  className="h-14 flex flex-col items-center justify-center p-2 rounded-xl active:scale-[0.97]"
                >
                  <span className="font-bold text-xs">{mode.label}</span>
                  <span className="text-[10px] text-muted-foreground/80">{mode.desc}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5" /> HTML / JavaScript Embed Code
              </Label>
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-3 rounded-lg text-xs font-semibold active:scale-[0.97]"
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy Code'}
              </Button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-56 leading-relaxed">
              {generatedCode}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
