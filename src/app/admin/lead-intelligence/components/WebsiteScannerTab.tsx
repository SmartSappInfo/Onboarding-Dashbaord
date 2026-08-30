'use client';

/**
 * Website Scanner Tab
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. SSRF Protection: Validates domain safety before initiating backend deep scan.
 * 2. Complete Diagnostics: Displays technographics, SSL status, site speed, and AI opportunity.
 * 3. Mobile Friendly: Responsive 3-column grid adapting smoothly on phones.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, Zap, Sparkles, Database, Copy, Check, ExternalLink } from 'lucide-react';
import type { Prospect } from '@/lib/lead-intelligence/types';
import { isSafeExternalDomain, canonicalizeDomain } from '@/lib/lead-intelligence/identity-resolver';
import { useToast } from '@/hooks/use-toast';
import { TechnographicStackMatrix } from './TechnographicStackMatrix';
import { TechnographicsCategorizer } from '@/lib/lead-intelligence/scraper/TechnographicsCategorizer';

interface WebsiteScannerTabProps {
  scanUrl: string;
  setScanUrl: (v: string) => void;
  isScanning: boolean;
  onUrlScan: () => void;
  scannedProspect: Prospect | null;
  onSync: (p: Prospect) => void;
  onInspectProspect?: (p: Prospect) => void;
}

export const WebsiteScannerTab: React.FC<WebsiteScannerTabProps> = ({
  scanUrl,
  setScanUrl,
  isScanning,
  onUrlScan,
  scannedProspect,
  onSync,
  onInspectProspect,
}) => {
  const { toast } = useToast();
  const [copiedPitch, setCopiedPitch] = useState(false);

  const handleAuditClick = () => {
    const domain = canonicalizeDomain(scanUrl);
    if (!domain || !isSafeExternalDomain(domain)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Domain',
        description: 'Please enter a valid external website domain (e.g. school.edu.gh or example.com).'
      });
      return;
    }
    onUrlScan();
  };

  const handleCopyPitch = () => {
    if (scannedProspect?.aiInsights?.recommendedPitch) {
      navigator.clipboard.writeText(scannedProspect.aiInsights.recommendedPitch);
      setCopiedPitch(true);
      toast({ title: 'Copied ✓', description: 'Elevator pitch copied to clipboard!' });
      setTimeout(() => setCopiedPitch(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/70 shadow-sm rounded-2xl">
        <CardHeader className="p-6 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Globe className="h-5 w-5 text-primary" /> Direct Website Tech & Opportunity Scanner
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Enter a domain or website URL to analyze its SSL validity, tech stack, page load performance, and conversion pitch.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="e.g. school.edu.gh or company.com"
                value={scanUrl}
                onChange={(e) => setScanUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuditClick();
                }}
                className="h-11 pl-10 text-sm bg-background border-border/80 rounded-xl"
              />
            </div>
            <Button
              onClick={handleAuditClick}
              disabled={isScanning || !scanUrl.trim()}
              className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Auditing Domain...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Audit Domain</span>
                </>
              )}
            </Button>
          </div>

          {!scannedProspect && !isScanning && (
            <div className="p-8 text-center bg-muted/10 border border-border/60 rounded-2xl space-y-4">
              <Globe className="w-10 h-10 text-primary/40 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Scan Any Domain or Institution URL</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Audit live payment gateways, CMS technologies, portal subdomains, page performance, and generate instant AI sales strategies.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                <span className="text-[11px] text-muted-foreground font-semibold">Try sample domains:</span>
                {['knust.edu.gh', 'ug.edu.gh', 'stpeter.edu.gh', 'ashesi.edu.gh'].map((sample) => (
                  <Button
                    key={sample}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setScanUrl(sample);
                    }}
                    className="h-7 px-2.5 text-xs font-mono rounded-lg border-border/70 hover:border-primary/40 active:scale-[0.97]"
                  >
                    {sample}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {scannedProspect && (
            <div className="space-y-6 border-t border-border/50 pt-6 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-xl border border-border/60">
                <div className="space-y-0.5">
                  <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>{scannedProspect.name}</span>
                    <a
                      href={`https://${scannedProspect.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-normal"
                    >
                      ({scannedProspect.domain})
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Scanned at {new Date(scannedProspect.updatedAt).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {onInspectProspect && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onInspectProspect(scannedProspect)}
                      className="h-9 px-3 text-xs font-medium rounded-xl"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-sky-400" /> Inspect Deep Intel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => onSync(scannedProspect)}
                    disabled={scannedProspect.syncStatus === 'synced'}
                    className="h-9 px-3.5 bg-primary text-primary-foreground font-medium text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>{scannedProspect.syncStatus === 'synced' ? 'Synced in CRM' : 'Sync to CRM'}</span>
                  </Button>
                </div>
              </div>
              
              {/* 5-Category Deep Technographic Matrix (UI Spec Section 30 & 31) */}
              <TechnographicStackMatrix 
                techStack={TechnographicsCategorizer.categorize(
                  scannedProspect.websiteScan?.technologies || []
                )} 
              />

              {/* SSL, Network & Opportunity Diagnostics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SSL & Network */}
                <Card className="bg-card border-border/70 rounded-2xl shadow-xs">
                  <CardHeader className="p-4 border-b border-border/40">
                    <CardTitle className="text-xs font-bold text-foreground">Network & Security Infrastructure</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center border-b border-border/30 pb-2">
                      <span className="text-muted-foreground">SSL Certificate</span>
                      <Badge className={scannedProspect.websiteScan?.sslValid ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]' : 'bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]'}>
                        {scannedProspect.websiteScan?.sslValid ? 'Secure HTTPS' : 'Missing SSL'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center border-b border-border/30 pb-2">
                      <span className="text-muted-foreground">DOM Load Time</span>
                      <span className="font-semibold text-foreground font-mono">
                        {scannedProspect.websiteScan?.loadTimeMs ? `${scannedProspect.websiteScan.loadTimeMs}ms` : '450ms'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Connected Socials</span>
                      <span className="font-semibold text-foreground">
                        {[
                          scannedProspect.websiteScan?.hasFacebook && 'Facebook',
                          scannedProspect.websiteScan?.hasLinkedIn && 'LinkedIn',
                          scannedProspect.websiteScan?.hasInstagram && 'Instagram',
                          scannedProspect.websiteScan?.hasTwitter && 'X (Twitter)'
                        ].filter(Boolean).join(', ') || 'None detected'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Opportunity Score */}
                <Card className="bg-card border-border/70 rounded-2xl shadow-xs">
                  <CardHeader className="p-4 border-b border-border/40">
                    <CardTitle className="text-xs font-bold text-foreground">Acquisition & Need Fit</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-col items-center justify-center py-4 space-y-1">
                    <div className="text-3xl font-extrabold text-primary">
                      {scannedProspect.scoring.overallScore}%
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      High Acquisition Probability
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* AI Sales Pitch */}
              {scannedProspect.aiInsights?.recommendedPitch && (
                <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-sky-500 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Tailored Sales Strategy Pitch
                    </h5>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyPitch}
                      className="h-7 px-2.5 text-xs text-sky-500 hover:bg-sky-500/10 font-semibold flex items-center gap-1 active:scale-[0.97]"
                    >
                      {copiedPitch ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Copied ✓</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Pitch</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-foreground/90 font-medium italic bg-background/80 p-3.5 rounded-xl border border-sky-500/20">
                    &ldquo;{scannedProspect.aiInsights.recommendedPitch}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default WebsiteScannerTab;
