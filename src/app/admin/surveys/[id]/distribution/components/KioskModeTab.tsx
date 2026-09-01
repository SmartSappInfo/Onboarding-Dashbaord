'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Physical Kiosk & Front-Desk Runner Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Physical Device & Event Kiosk Mode:
 *    - Fullscreen launcher with auto-reset countdown timers (5s, 10s, 30s).
 *    - Inactivity reset prevention for abandoned sessions.
 * 2. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Monitor, Clock, Play, ExternalLink, ShieldCheck, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Survey } from '@/lib/types';

export interface KioskModeTabProps {
  survey: Survey;
  defaultUrl: string;
}

export function KioskModeTab({ survey, defaultUrl }: KioskModeTabProps) {
  const { toast } = useToast();
  const [autoResetSeconds, setAutoResetSeconds] = React.useState<number>(10);
  const [showProgressBar, setShowProgressBar] = React.useState<boolean>(true);
  const [lockNavigation, setLockNavigation] = React.useState<boolean>(true);
  const [copied, setCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const kioskUrl = React.useMemo(() => {
    const separator = defaultUrl.includes('?') ? '&' : '?';
    return `${defaultUrl}${separator}kiosk=true&reset=${autoResetSeconds}`;
  }, [defaultUrl, autoResetSeconds]);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(kioskUrl);
      setCopied(true);
      toast({
        title: 'Kiosk URL Copied',
        description: 'Launch URL is copied and ready for your front-desk tablet or kiosk device.',
      });
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not access clipboard.' });
    }
  };

  const handleLaunchKiosk = () => {
    window.open(kioskUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Physical Kiosk & Front-Desk Mode</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Deploy continuous survey collection on tablets, iPads, front-desk reception, or physical events.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[5, 10, 30].map((seconds) => (
              <Button
                key={seconds}
                type="button"
                variant={autoResetSeconds === seconds ? 'default' : 'outline'}
                onClick={() => setAutoResetSeconds(seconds)}
                className="h-16 flex flex-col items-center justify-center p-2 rounded-xl active:scale-[0.97]"
              >
                <span className="font-bold text-sm">{seconds} Seconds</span>
                <span className="text-[10px] text-muted-foreground/80">Post-submission reset</span>
              </Button>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Show Progress Bar Indicator</Label>
                <p className="text-[11px] text-muted-foreground">Displays live completion percentage to encourage respondents.</p>
              </div>
              <Switch checked={showProgressBar} onCheckedChange={setShowProgressBar} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Lock Navigation & External Links</Label>
                <p className="text-[11px] text-muted-foreground">Prevents respondents from navigating away from the survey.</p>
              </div>
              <Switch checked={lockNavigation} onCheckedChange={setLockNavigation} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleLaunchKiosk}
              className="w-full sm:w-auto h-12 px-6 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 active:scale-[0.97]"
            >
              <Play className="h-4 w-4 mr-2 fill-current" /> Launch Full-Screen Kiosk
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="w-full sm:w-auto h-12 px-5 rounded-xl font-semibold active:scale-[0.97]"
            >
              {copied ? <Check className="h-4 w-4 mr-1.5 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1.5" />}
              {copied ? 'Copied' : 'Copy Kiosk Link'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
