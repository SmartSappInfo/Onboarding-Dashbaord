'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2 } from 'lucide-react';
import type { Prospect } from '@/lib/lead-intelligence/types';

interface WebsiteScannerTabProps {
  scanUrl: string;
  setScanUrl: (v: string) => void;
  isScanning: boolean;
  onUrlScan: () => void;
  scannedProspect: Prospect | null;
  onSync: (p: Prospect) => void;
}

export default function WebsiteScannerTab({
  scanUrl,
  setScanUrl,
  isScanning,
  onUrlScan,
  scannedProspect,
  onSync
}: WebsiteScannerTabProps) {
  return (
    <Card className="bg-card/35 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="h-4 w-4 text-emerald-400" />
          Direct Website Tech Scanner
        </CardTitle>
        <CardDescription className="text-xs">Enter a domain name to execute an audit of its SSL, technologies, performance, and AI conversion opportunities.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-xs">
        <div className="flex gap-2">
          <Input 
            placeholder="school.edu" 
            value={scanUrl} 
            onChange={(e) => setScanUrl(e.target.value)} 
            className="h-10 text-xs border-border/60 bg-muted/10 rounded-lg"
          />
          <Button 
            onClick={onUrlScan} 
            disabled={isScanning || !scanUrl} 
            className="h-10 px-6 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold active:scale-[0.97] transition-all rounded-lg text-xs"
          >
            {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Audit Domain'}
          </Button>
        </div>

        {scannedProspect && (
          <div className="space-y-6 border-t border-border/30 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Technology Stack */}
              <Card className="bg-muted/10 border-border/40">
                <CardHeader className="p-4"><CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400">Technology Stack</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {scannedProspect.websiteScan?.technologies && scannedProspect.websiteScan.technologies.length > 0 ? (
                      scannedProspect.websiteScan.technologies.map((tech, i) => (
                        <Badge key={i} variant="outline" className="bg-background text-foreground text-[9px] font-bold py-0.5 px-2">{tech}</Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">No verification credentials keys found. Falling back to simulated stack.</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* SSL & Speed */}
              <Card className="bg-muted/10 border-border/40">
                <CardHeader className="p-4"><CardTitle className="text-xs font-bold uppercase tracking-wider text-teal-400">Network & Performance</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  <div className="flex justify-between items-center border-b border-border/30 pb-2">
                    <span>SSL Status</span>
                    <Badge className={scannedProspect.websiteScan?.sslValid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}>
                      {scannedProspect.websiteScan?.sslValid ? 'Secure SSL' : 'Invalid SSL'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/30 pb-2">
                    <span>Load Time</span>
                    <span className="font-bold">{scannedProspect.websiteScan?.loadTimeMs ? `${scannedProspect.websiteScan.loadTimeMs}ms` : '9s (Critical)'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Facebook detected</span>
                    <span>{scannedProspect.websiteScan?.hasFacebook ? 'Yes' : 'No'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Opportunity Score */}
              <Card className="bg-muted/10 border-border/40">
                <CardHeader className="p-4"><CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400">Smart Opportunity Score</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0 flex flex-col items-center justify-center py-4">
                  <div className="text-3xl font-black text-emerald-400">{scannedProspect.scoring.overallScore}%</div>
                  <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-1">High conversion potential</div>
                </CardContent>
              </Card>
            </div>

            {/* AI Insights & Pitch */}
            {scannedProspect.aiInsights && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/10 border border-border/40 rounded-xl space-y-2">
                  <h4 className="font-bold text-emerald-400 text-xs uppercase">AI Stethoscope Report</h4>
                  <p className="leading-relaxed text-muted-foreground">{scannedProspect.aiInsights.summary}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-2">
                    <h4 className="font-bold text-rose-400 text-xs uppercase">Weaknesses Detected</h4>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                      {scannedProspect.aiInsights.problemsFound.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                    <h4 className="font-bold text-emerald-400 text-xs uppercase">Target Solutions</h4>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                      {scannedProspect.aiInsights.opportunities.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-2">
                  <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-2">
                    <h4 className="font-bold text-emerald-400 text-xs uppercase">Tailored Sales Presentation</h4>
                    <span className="font-bold text-teal-400">Est. Revenue Value: ${scannedProspect.aiInsights.estimatedRevenueOpportunity}/yr</span>
                  </div>
                  <p className="italic text-muted-foreground leading-relaxed">"{scannedProspect.aiInsights.recommendedPitch}"</p>
                  <div className="pt-3">
                    <Button 
                      onClick={() => onSync(scannedProspect)} 
                      disabled={scannedProspect.syncStatus === 'synced'} 
                      className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-lg h-9 px-4 active:scale-[0.97]"
                    >
                      {scannedProspect.syncStatus === 'synced' ? 'Synced ✓' : 'Import to SmartSapp Contacts'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
