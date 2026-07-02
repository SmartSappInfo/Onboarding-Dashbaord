'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, MapPin, Loader2, Building2, RefreshCw, X } from 'lucide-react';
import type { Prospect } from '@/lib/lead-intelligence/types';

interface ProspectFinderTabProps {
  industryFilter: string;
  setIndustryFilter: (v: string) => void;
  cityFilter: string;
  setCityFilter: (v: string) => void;
  isSearching: boolean;
  onSearch: () => void;
  onSaveSearch: () => void;
  prospects: Prospect[];
  selectedProspect: Prospect | null;
  setSelectedProspect: (p: Prospect | null) => void;
  onEnrich: (p: Prospect) => void;
  onSync: (p: Prospect) => void;
}

export default function ProspectFinderTab({
  industryFilter,
  setIndustryFilter,
  cityFilter,
  setCityFilter,
  isSearching,
  onSearch,
  onSaveSearch,
  prospects,
  selectedProspect,
  setSelectedProspect,
  onEnrich,
  onSync
}: ProspectFinderTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Filters sidebar */}
      <Card className="lg:col-span-1 bg-card/35 backdrop-blur-sm border-border/50 h-fit">
        <CardHeader className="p-4">
          <CardTitle className="text-xs font-bold uppercase tracking-wider">Search Filters</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="industry-filter" className="text-[10px] font-bold uppercase text-muted-foreground">Industry / Keyword</Label>
            <Input 
              id="industry-filter" 
              value={industryFilter} 
              onChange={(e) => setIndustryFilter(e.target.value)} 
              className="h-8 text-xs border-border/60 bg-muted/10 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city-filter" className="text-[10px] font-bold uppercase text-muted-foreground">City / Region</Label>
            <Input 
              id="city-filter" 
              value={cityFilter} 
              onChange={(e) => setCityFilter(e.target.value)} 
              className="h-8 text-xs border-border/60 bg-muted/10 rounded-lg"
            />
          </div>
          <div className="pt-2">
            <Button 
              onClick={onSearch} 
              disabled={isSearching} 
              className="w-full h-8 bg-blue-500 hover:bg-blue-600 active:scale-[0.97] transition-all rounded-lg text-white font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Run Discovery
            </Button>
          </div>
          <div className="pt-1">
            <Button 
              onClick={onSaveSearch} 
              variant="ghost" 
              className="w-full h-8 text-[10px] font-bold text-muted-foreground border border-border/40 hover:bg-muted/10 hover:text-foreground active:scale-[0.97] transition-all rounded-lg"
            >
              Save Search Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid View */}
      <div className="lg:col-span-3 space-y-6">
        {/* Interactive Mock Map */}
        {prospects.length > 0 && (
          <Card className="bg-card/35 backdrop-blur-sm border-border/50 overflow-hidden relative shadow-md">
            <CardHeader className="p-4 border-b border-border/30 bg-muted/10 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-blue-400" />
                Target Area Map Pins (Kumasi / Accra)
              </CardTitle>
            </CardHeader>
            <div className="h-44 bg-zinc-950 relative flex items-center justify-center p-2">
              <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                <line x1="0" y1="50" x2="100%" y2="50" stroke="white" strokeWidth="2" />
                <line x1="0" y1="120" x2="100%" y2="120" stroke="white" strokeWidth="2" />
                <line x1="100" y1="0" x2="100" y2="100%" stroke="white" strokeWidth="2" />
                <line x1="250" y1="0" x2="250" y2="100%" stroke="white" strokeWidth="2" />
              </svg>

              {prospects.map((p, index) => {
                const isSelected = selectedProspect?.id === p.id;
                const isSynced = p.syncStatus === 'synced';
                const leftPercent = 15 + (index * 13) % 70;
                const topPercent = 20 + (index * 17) % 60;

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProspect(p);
                      // Trigger table row scroll on pin selection
                      const targetRow = document.getElementById(`prospect-row-${p.id}`);
                      if (targetRow) {
                        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className="absolute active:scale-90 transition-transform focus:outline-none"
                    style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                  >
                    <div className={`relative flex items-center justify-center h-5 w-5 rounded-full shadow-lg ${
                      isSelected ? 'bg-primary border-2 border-white scale-125 z-20' : 
                      isSynced ? 'bg-blue-500 border border-blue-600' : 'bg-rose-500 border border-rose-600'
                    }`}>
                      <MapPin className="h-3 w-3 text-black" />
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] font-bold px-1 rounded truncate max-w-[80px]">
                        {p.name.substring(0, 8)}..
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Search result list */}
        <Card className="bg-card/35 backdrop-blur-sm border-border/50">
          <CardContent className="p-0">
            {prospects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <Building2 className="h-10 w-10 text-muted-foreground opacity-40" />
                <div className="text-xs text-muted-foreground">Search and scan prospects to populate list.</div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Business</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Rating</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Google claimed</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Need Score</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((p) => {
                    const isSelected = selectedProspect?.id === p.id;
                    return (
                      <TableRow 
                        key={p.id} 
                        id={`prospect-row-${p.id}`}
                        className={`cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-blue-500/5' : 'hover:bg-muted/10'}`}
                        onClick={() => setSelectedProspect(p)}
                      >
                        <TableCell className="p-3">
                          <div className="font-bold text-xs">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{p.domain}</div>
                        </TableCell>
                        <TableCell className="p-3 text-xs">{p.rating ? `⭐ ${p.rating} (${p.reviewsCount})` : 'N/A'}</TableCell>
                        <TableCell className="p-3">
                          <Badge variant="outline" className={`text-[8px] uppercase font-bold ${p.claimed ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                            {p.claimed ? 'Claimed' : 'Unclaimed'}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-3">
                          <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/10 text-[10px] font-extrabold">{p.scoring.overallScore}%</Badge>
                        </TableCell>
                        <TableCell className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button 
                              onClick={() => onEnrich(p)} 
                              variant="ghost" 
                              className="h-7 px-2 text-[10px] hover:bg-muted/10 hover:text-blue-400 active:scale-[0.97] transition-all rounded-lg"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Enrich
                            </Button>
                            <Button 
                              onClick={() => onSync(p)} 
                              disabled={p.syncStatus === 'synced'} 
                              className="h-7 px-2 text-[10px] bg-blue-500 hover:bg-blue-600 text-white font-semibold active:scale-[0.97] transition-all rounded-lg"
                            >
                              {p.syncStatus === 'synced' ? 'Synced ✓' : 'Sync CRM'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Prospect Side Drawer Detail Sheet */}
        {selectedProspect && (
          <Card className="bg-card/45 border-blue-500/20 relative shadow-lg">
            <div className="absolute top-3 right-3">
              <Button variant="ghost" className="h-6 w-6 p-0 rounded-full" onClick={() => setSelectedProspect(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardHeader className="p-4 border-b border-border/30">
              <div className="flex justify-between items-start pr-6">
                <div>
                  <CardTitle className="text-sm font-extrabold text-blue-400">{selectedProspect.name}</CardTitle>
                  <CardDescription className="text-xs">{selectedProspect.domain}</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-blue-400">{selectedProspect.scoring.overallScore}%</div>
                  <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Smart Score</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-3 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-b border-border/30 pb-3">
                <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Need</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.needScore}/25</div></div>
                <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Digital Maturity</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.digitalMaturity}/15</div></div>
                <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Intent</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.buyingIntent}/20</div></div>
                <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Budget</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.budgetProbability}/15</div></div>
                <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Decision Maker</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.decisionMakerFound}/10</div></div>
              </div>

              {selectedProspect.aiInsights ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-blue-400 text-[10px] uppercase tracking-wider">AI Summary Analysis</h4>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{selectedProspect.aiInsights.summary}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-bold text-[10px] uppercase tracking-wider text-rose-400">Problems Found</h4>
                      <ul className="list-disc pl-4 mt-1 space-y-1 text-muted-foreground">
                        {selectedProspect.aiInsights.problemsFound.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-[10px] uppercase tracking-wider text-blue-400">Smart Opportunities</h4>
                      <ul className="list-disc pl-4 mt-1 space-y-1 text-muted-foreground">
                        {selectedProspect.aiInsights.opportunities.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="border-t border-border/30 pt-3">
                    <h4 className="font-bold text-blue-400 text-[10px] uppercase tracking-wider">Recommended Pitch</h4>
                    <p className="mt-1 text-muted-foreground italic bg-muted/10 p-2 border border-border/40 rounded-lg">"{selectedProspect.aiInsights.recommendedPitch}"</p>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-muted-foreground mb-2">Detailed AI insights, pitches, and technographic analysis have not been generated.</p>
                  <Button 
                    onClick={() => onEnrich(selectedProspect)} 
                    className="h-8 bg-blue-500 text-white font-semibold rounded-lg text-xs"
                  >
                    Run AI Opportunity Scan
                  </Button>
                </div>
              )}

              {selectedProspect.contacts.length > 0 && (
                <div className="border-t border-border/30 pt-3">
                  <h4 className="font-bold text-blue-400 text-[10px] uppercase tracking-wider">Found Decision Makers</h4>
                  <div className="mt-2 space-y-1.5">
                    {selectedProspect.contacts.map((c, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span><strong>{c.name}</strong> ({c.role})</span>
                        <span className="text-muted-foreground">{c.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
