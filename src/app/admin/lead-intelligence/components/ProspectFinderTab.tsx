'use client';

/**
 * Prospect Finder Tab (High-Density Discovery Workspace)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Ergonomics: Seamless split-pane workspace with Omnisearch ribbon, multi-select rows, and Mapbox/Map pins.
 * 2. High-Density Layout: Compact typography, heat status indicators, and one-click slide-over inspection.
 * 3. CSV Ingestion: Integrated modal allowing drag-and-drop or pasting tabular prospect files.
 */

import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Star, 
  CheckCircle2, 
  Database, 
  Sparkles, 
  FileSpreadsheet, 
  Map as MapIcon, 
  ListFilter, 
  Flame, 
  Zap, 
  Globe 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { OmnisearchRibbon } from './OmnisearchRibbon';
import type { Prospect, SearchFilters, DiscoverySourceType } from '@/lib/lead-intelligence/types';
import { useToast } from '@/hooks/use-toast';

interface ProspectFinderTabProps {
  prospects: Prospect[];
  selectedProspect: Prospect | null;
  onSelectProspect: (p: Prospect | null) => void;
  selectedRowIds: Set<string>;
  onToggleRowSelect: (id: string) => void;
  onSelectAllRows: (selectAll: boolean) => void;
  queryText: string;
  onQueryTextChange: (text: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  selectedSource: DiscoverySourceType;
  onSourceChange: (source: DiscoverySourceType) => void;
  onSearch: () => void;
  onSaveSearch: (name: string) => void;
  isSearching: boolean;
  onEnrich: (prospect: Prospect) => void;
  onSync: (prospect: Prospect) => void;
  onImportCSV: (csvData: string) => Promise<void>;
}

export const ProspectFinderTab: React.FC<ProspectFinderTabProps> = ({
  prospects,
  selectedProspect,
  onSelectProspect,
  selectedRowIds,
  onToggleRowSelect,
  onSelectAllRows,
  queryText,
  onQueryTextChange,
  filters,
  onFiltersChange,
  selectedSource,
  onSourceChange,
  onSearch,
  onSaveSearch,
  isSearching,
  onEnrich,
  onSync,
  onImportCSV,
}) => {
  const { toast } = useToast();
  const [showMap, setShowMap] = useState(true);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [pastedCSV, setPastedCSV] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const allSelected = prospects.length > 0 && prospects.every((p) => selectedRowIds.has(p.id));
  const someSelected = prospects.some((p) => selectedRowIds.has(p.id)) && !allSelected;

  const handleCSVSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedCSV.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please paste CSV text or column data.' });
      return;
    }
    try {
      setIsImporting(true);
      await onImportCSV(pastedCSV.trim());
      setPastedCSV('');
      setIsCSVModalOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Import Failed', description: 'CSV Import failed. Check column format.' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Omnisearch Ribbon Bar */}
      <OmnisearchRibbon
        queryText={queryText}
        onQueryTextChange={onQueryTextChange}
        filters={filters}
        onFiltersChange={onFiltersChange}
        selectedSource={selectedSource}
        onSourceChange={onSourceChange}
        onExecuteSearch={onSearch}
        onSaveSearch={onSaveSearch}
        isSearching={isSearching}
        onOpenCSVImport={() => setIsCSVModalOpen(true)}
      />

      {/* 2. Map & View Mode Toggle Header */}
      {prospects.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              {prospects.length} Prospects Found
            </span>
            <Badge variant="outline" className="text-[10px] bg-muted/30">
              {prospects.filter((p) => p.scoring?.overallScore >= 75).length} High Priority
            </Badge>
          </div>

          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
            <Button
              size="sm"
              variant={showMap ? "secondary" : "ghost"}
              onClick={() => setShowMap(true)}
              className="h-7 px-2.5 text-[11px] font-medium rounded-md active:scale-[0.97]"
            >
              <MapIcon className="w-3 h-3 mr-1 text-blue-500" />
              Split Map
            </Button>
            <Button
              size="sm"
              variant={!showMap ? "secondary" : "ghost"}
              onClick={() => setShowMap(false)}
              className="h-7 px-2.5 text-[11px] font-medium rounded-md active:scale-[0.97]"
            >
              <ListFilter className="w-3 h-3 mr-1 text-muted-foreground" />
              Table Only
            </Button>
          </div>
        </div>
      )}

      {/* 3. Interactive Target Map (When Enabled) */}
      {showMap && prospects.length > 0 && (
        <div className="h-44 bg-zinc-950/90 border border-border/70 rounded-2xl relative flex items-center justify-center p-2 overflow-hidden shadow-inner">
          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="50" x2="100%" y2="50" stroke="white" strokeWidth="2" />
            <line x1="0" y1="120" x2="100%" y2="120" stroke="white" strokeWidth="2" />
            <line x1="100" y1="0" x2="100" y2="100%" stroke="white" strokeWidth="2" />
            <line x1="250" y1="0" x2="250" y2="100%" stroke="white" strokeWidth="2" />
            <circle cx="200" cy="80" r="40" stroke="white" strokeWidth="1" fill="none" />
          </svg>

          {prospects.map((p, index) => {
            const isSelected = selectedProspect?.id === p.id;
            const isSynced = p.syncStatus === 'synced';
            const score = p.scoring?.overallScore ?? 50;
            const leftPercent = 10 + (index * 14) % 78;
            const topPercent = 18 + (index * 19) % 62;

            return (
              <button
                key={p.id}
                onClick={() => onSelectProspect(p)}
                className="absolute active:scale-90 transition-transform focus:outline-none z-10"
                style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                title={`${p.name} (${score}/100)`}
              >
                <div className={`relative flex items-center justify-center h-6 w-6 rounded-full shadow-lg transition-all ${
                  isSelected ? 'bg-primary border-2 border-white scale-125 z-20 ring-2 ring-primary/50' : 
                  isSynced ? 'bg-blue-600 border border-blue-400' :
                  score >= 75 ? 'bg-amber-500 border border-amber-300' : 'bg-zinc-700 border border-zinc-500'
                }`}>
                  <MapPin className="h-3.5 w-3.5 text-white" />
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-zinc-950/90 text-zinc-100 text-[8px] font-bold px-1.5 py-0.2 rounded truncate max-w-[90px] border border-zinc-800">
                    {p.name.substring(0, 10)}..
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. High-Density Prospect Results Table */}
      <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
        {prospects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-3">
            <div className="p-4 bg-muted/40 rounded-full">
              <Building2 className="h-8 w-8 text-muted-foreground opacity-60" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">No prospects loaded yet</h4>
              <p className="text-xs text-muted-foreground max-w-sm">
                Enter an industry or location above and click <strong>Find Prospects</strong>, or paste spreadsheet data.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={onSearch} disabled={isSearching} className="h-8 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Discover Leads
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsCSVModalOpen(true)} className="h-8 text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Ingest CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30 border-b border-border/60">
                <TableRow>
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) => onSelectAllRows(checked === true)}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground h-10">Company & Domain</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground h-10">Location</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground h-10">Rating</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground h-10">Tech Footprint</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground h-10">Smart Score</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground h-10">CRM Status</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground h-10 text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/40">
                {prospects.map((p) => {
                  const isChecked = selectedRowIds.has(p.id);
                  const isInspected = selectedProspect?.id === p.id;
                  const score = p.scoring?.overallScore ?? 50;
                  const isHot = score >= 75;
                  const isWarm = score >= 50 && score < 75;

                  return (
                    <TableRow
                      key={p.id}
                      id={`prospect-row-${p.id}`}
                      className={`cursor-pointer transition-colors duration-150 ${
                        isInspected ? 'bg-primary/10' : isChecked ? 'bg-muted/30' : 'hover:bg-muted/15'
                      }`}
                      onClick={() => onSelectProspect(p)}
                    >
                      <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => onToggleRowSelect(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.claimed && (
                            <span title="Verified Listing">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Globe className="w-3 h-3 opacity-60" />
                          <span className="hover:underline">{p.domain}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-3 text-xs text-muted-foreground">
                        {p.address || p.industry || '—'}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-xs">
                        {p.rating ? (
                          <div className="flex items-center gap-1 font-semibold text-foreground">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span>{p.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">({p.reviewsCount || 0})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        {p.websiteScan?.technologies && p.websiteScan.technologies.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {p.websiteScan.technologies.slice(0, 2).map((tech, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[9px] px-1.5 py-0 bg-muted/80">
                                {tech}
                              </Badge>
                            ))}
                            {p.websiteScan.technologies.length > 2 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                +{p.websiteScan.technologies.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <Badge 
                          className={`text-[10px] font-bold flex items-center gap-1 w-fit ${
                            isHot 
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                              : isWarm 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                              : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                          }`}
                        >
                          {isHot ? <Flame className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                          <span>{score}/100</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        {p.syncStatus === 'synced' ? (
                          <Badge className="bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20 flex items-center gap-1 w-fit">
                            <Database className="w-3 h-3" /> Synced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground w-fit">
                            Unregistered
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEnrich(p)}
                            className="h-7 px-2 text-[11px] hover:bg-muted active:scale-[0.97]"
                          >
                            <Sparkles className="w-3 h-3 text-sky-400 mr-1" />
                            Enrich
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => onSync(p)}
                            disabled={p.syncStatus === 'synced'}
                            className="h-7 px-2.5 text-[11px] bg-primary text-primary-foreground font-medium active:scale-[0.97]"
                          >
                            {p.syncStatus === 'synced' ? 'Synced ✓' : 'Sync'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* CSV Ingestion Modal */}
      <Dialog open={isCSVModalOpen} onOpenChange={setIsCSVModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCSVSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Ingest CSV / Tabular Leads
              </DialogTitle>
              <DialogDescription className="text-xs">
                Paste CSV or spreadsheet columns (e.g. Name, Website, Phone, Email, Address). Auto-maps headers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="csv-paste" className="text-xs font-semibold">Paste CSV Data *</Label>
                <Textarea
                  id="csv-paste"
                  rows={8}
                  placeholder={`Name,Website,Phone,Email,Industry\nKumasi International School,kumasischool.edu.gh,+233240001122,info@kumasischool.edu.gh,Education\nRoyal Crown Academy,royalcrown.edu.gh,+233201112233,admin@royalcrown.edu.gh,Education`}
                  value={pastedCSV}
                  onChange={(e) => setPastedCSV(e.target.value)}
                  required
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCSVModalOpen(false)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isImporting} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                {isImporting ? 'Ingesting...' : 'Ingest Leads'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default ProspectFinderTab;
