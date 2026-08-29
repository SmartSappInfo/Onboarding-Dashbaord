'use client';

/**
 * Omnisearch Ribbon & AI Query Bar
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Accessibility: Provides Cmd+K / Ctrl+K keyboard shortcut listener for fast power-user navigation.
 * 2. Natural Language AI Parser: Converts natural conversational queries into structured filters via Server Action.
 * 3. Mobile Ergonomics: Touch targets >= 44px with smooth Emil Kowalski button press states (active:scale-[0.97]).
 */

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { 
  Search, 
  Sparkles, 
  Filter, 
  X, 
  BookmarkPlus, 
  ChevronDown, 
  SlidersHorizontal, 
  MapPin, 
  Building2, 
  Star, 
  Layers, 
  FileSpreadsheet, 
  Cpu, 
  Globe 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import type { SearchFilters, DiscoverySourceType } from '@/lib/lead-intelligence/types';
import { parseNaturalLanguageQueryAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';

interface OmnisearchRibbonProps {
  queryText: string;
  onQueryTextChange: (text: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  selectedSource: DiscoverySourceType;
  onSourceChange: (source: DiscoverySourceType) => void;
  onExecuteSearch: () => void;
  onSaveSearch: (name: string) => void;
  isSearching: boolean;
  onOpenCSVImport: () => void;
}

const COMMON_INDUSTRIES = [
  'Education',
  'Private Schools',
  'Tertiary Institutions',
  'Healthcare & Clinics',
  'Hospitality & Hotels',
  'Real Estate',
  'Financial Services',
  'Retail & E-commerce',
  'Legal & Consulting',
  'Technology'
];

const COMMON_CITIES = [
  'Accra',
  'Kumasi',
  'Takoradi',
  'Tamale',
  'Tema',
  'Cape Coast',
  'Koforidua',
  'Sunyani'
];

export const OmnisearchRibbon: React.FC<OmnisearchRibbonProps> = ({
  queryText,
  onQueryTextChange,
  filters,
  onFiltersChange,
  selectedSource,
  onSourceChange,
  onExecuteSearch,
  onSaveSearch,
  isSearching,
  onOpenCSVImport,
}) => {
  const { toast } = useToast();
  const [isNLMode, setIsNLMode] = useState(false);
  const [nlPrompt, setNlPrompt] = useState('');
  const [isPendingNL, startNLTransition] = useTransition();
  const [saveSearchName, setSaveSearchName] = useState('');
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Global Keyboard Shortcut: ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('lead-omnisearch-input');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRunNLParser = useCallback(async () => {
    if (!nlPrompt.trim()) return;

    startNLTransition(async () => {
      const res = await parseNaturalLanguageQueryAction(nlPrompt);
      if (res.success && res.result) {
        onFiltersChange({
          ...filters,
          ...res.result.parsedFilters
        });
        if (res.result.extractedKeywords) {
          onQueryTextChange(res.result.extractedKeywords);
        }
        toast({
          title: 'AI Parsed Query Filters',
          description: res.result.explanation
        });
        setIsNLMode(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Could Not Parse Query',
          description: res.error || 'Please try standard keyword search.'
        });
      }
    });
  }, [nlPrompt, filters, onFiltersChange, onQueryTextChange, toast]);

  const handleClearFilter = (key: keyof SearchFilters) => {
    const updated = { ...filters };
    delete updated[key];
    onFiltersChange(updated);
  };

  const handleSaveSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveSearchName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a search name.'
      });
      return;
    }
    onSaveSearch(saveSearchName.trim());
    setSaveSearchName('');
    setIsSaveOpen(false);
  };

  // Count active non-empty filters
  const activeFilterCount = Object.entries(filters).filter(([_, v]) => 
    v !== undefined && v !== '' && v !== 'all' && (!Array.isArray(v) || v.length > 0)
  ).length;

  return (
    <div className="w-full space-y-3 bg-card border border-border/70 rounded-xl p-4 shadow-sm">
      {/* Top Main Command Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
        {/* Source Provider Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="h-11 px-3.5 border-border/80 bg-background/50 hover:bg-accent flex items-center gap-2 shrink-0 active:scale-[0.97] transition-transform text-xs font-medium"
            >
              {selectedSource === 'google_places' && <Globe className="w-4 h-4 text-blue-500" />}
              {selectedSource === 'ai_simulation' && <Cpu className="w-4 h-4 text-sky-400" />}
              {selectedSource === 'csv_import' && <FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
              <span className="hidden sm:inline">
                {selectedSource === 'google_places' && 'Google Places'}
                {selectedSource === 'ai_simulation' && 'AI Simulation'}
                {selectedSource === 'csv_import' && 'CSV Ingest'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Discovery Source</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onSourceChange('google_places')} className="cursor-pointer">
              <Globe className="w-4 h-4 mr-2 text-blue-500" />
              <div className="flex flex-col">
                <span className="font-medium text-xs">Google Places API</span>
                <span className="text-[10px] text-muted-foreground">Real-time local listings</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSourceChange('ai_simulation')} className="cursor-pointer">
              <Cpu className="w-4 h-4 mr-2 text-sky-400" />
              <div className="flex flex-col">
                <span className="font-medium text-xs">AI Simulation</span>
                <span className="text-[10px] text-muted-foreground">Dynamic Gemini lead engine</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenCSVImport} className="cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
              <div className="flex flex-col">
                <span className="font-medium text-xs">Import CSV / Paste</span>
                <span className="text-[10px] text-muted-foreground">Upload spreadsheets</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Input Bar: Standard vs AI Natural Language Mode */}
        <div className="relative flex-1">
          {isNLMode ? (
            <div className="relative flex items-center">
              <Sparkles className="absolute left-3.5 w-4 h-4 text-sky-400 animate-pulse" />
              <Input
                id="lead-omnisearch-nl-input"
                placeholder="Ask AI: e.g. 'Find private schools in Kumasi with outdated websites'..."
                value={nlPrompt}
                onChange={(e) => setNlPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunNLParser();
                  if (e.key === 'Escape') setIsNLMode(false);
                }}
                disabled={isPendingNL}
                className="h-11 pl-10 pr-24 text-sm bg-background border-sky-500/40 focus-visible:ring-sky-500/30"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsNLMode(false)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleRunNLParser}
                  disabled={isPendingNL || !nlPrompt.trim()}
                  className="h-7 px-2.5 text-xs bg-sky-500 hover:bg-sky-600 text-white font-medium active:scale-[0.97]"
                >
                  {isPendingNL ? 'Parsing...' : 'Parse'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
              <Input
                id="lead-omnisearch-input"
                placeholder="Search prospects by keyword, industry, location... (Press ⌘K)"
                value={queryText}
                onChange={(e) => onQueryTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onExecuteSearch();
                }}
                className="h-11 pl-10 pr-24 text-sm bg-background border-border/80 focus-visible:ring-primary/20"
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsNLMode(true);
                    setNlPrompt(queryText);
                  }}
                  className="h-7 px-2 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 flex items-center gap-1 active:scale-[0.97]"
                  title="Switch to Natural Language AI Prospecting"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-medium">AI Query</span>
                </Button>
                <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">
                  ⌘K
                </kbd>
              </div>
            </div>
          )}
        </div>

        {/* Filter Popover & Search Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={activeFilterCount > 0 ? "secondary" : "outline"}
                className={`h-11 px-3.5 flex items-center gap-2 active:scale-[0.97] transition-all text-xs font-medium ${
                  activeFilterCount > 0 ? "border-primary/40 bg-primary/10 text-primary" : ""
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 space-y-4 shadow-xl border-border">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-primary" /> Advanced Filters
                </h4>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => onFiltersChange({})}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Reset all
                  </button>
                )}
              </div>

              {/* City Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" /> City / Region
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="e.g. Kumasi, Accra"
                    value={filters.city || ''}
                    onChange={(e) => onFiltersChange({ ...filters, city: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 max-h-48 overflow-y-auto">
                      {COMMON_CITIES.map((c) => (
                        <DropdownMenuItem 
                          key={c} 
                          onClick={() => onFiltersChange({ ...filters, city: c })}
                          className="text-xs cursor-pointer"
                        >
                          {c}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Industry Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-muted-foreground" /> Industry
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="e.g. Private Schools"
                    value={filters.industry || ''}
                    onChange={(e) => onFiltersChange({ ...filters, industry: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 max-h-48 overflow-y-auto">
                      {COMMON_INDUSTRIES.map((ind) => (
                        <DropdownMenuItem 
                          key={ind} 
                          onClick={() => onFiltersChange({ ...filters, industry: ind })}
                          className="text-xs cursor-pointer"
                        >
                          {ind}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Rating & Score Thresholds */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" /> Min Rating
                  </Label>
                  <select
                    aria-label="Minimum Star Rating"
                    value={filters.ratingMin ?? ''}
                    onChange={(e) => onFiltersChange({ 
                      ...filters, 
                      ratingMin: e.target.value ? Number(e.target.value) : undefined 
                    })}
                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
                  >
                    <option value="">Any</option>
                    <option value="3.0">3.0+ Stars</option>
                    <option value="3.5">3.5+ Stars</option>
                    <option value="4.0">4.0+ Stars</option>
                    <option value="4.5">4.5+ Stars</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3 text-blue-400" /> Min Score
                  </Label>
                  <select
                    aria-label="Minimum Lead Score"
                    value={filters.scoreMin ?? ''}
                    onChange={(e) => onFiltersChange({ 
                      ...filters, 
                      scoreMin: e.target.value ? Number(e.target.value) : undefined 
                    })}
                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
                  >
                    <option value="">Any</option>
                    <option value="50">50+ (Moderate)</option>
                    <option value="70">70+ (High)</option>
                    <option value="85">85+ (Priority)</option>
                  </select>
                </div>
              </div>

              {/* Synced Status Filter */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">CRM Ingestion Status</Label>
                <select
                  aria-label="CRM Ingestion Status"
                  value={filters.syncedStatus || 'all'}
                  onChange={(e) => onFiltersChange({ 
                    ...filters, 
                    syncedStatus: e.target.value as 'all' | 'unregistered' | 'synced' 
                  })}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
                >
                  <option value="all">All Prospects</option>
                  <option value="unregistered">Unregistered Only</option>
                  <option value="synced">Already Synced to CRM</option>
                </select>
              </div>

              <Button 
                size="sm" 
                onClick={() => setIsFiltersOpen(false)}
                className="w-full h-8 text-xs font-medium active:scale-[0.97]"
              >
                Apply Filters
              </Button>
            </PopoverContent>
          </Popover>

          {/* Save Search Button */}
          <Popover open={isSaveOpen} onOpenChange={setIsSaveOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 active:scale-[0.97]"
                title="Save this search"
              >
                <BookmarkPlus className="w-4 h-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 space-y-3">
              <form onSubmit={handleSaveSearchSubmit} className="space-y-2">
                <h5 className="font-semibold text-xs">Save Current Search</h5>
                <Input
                  placeholder="e.g. Kumasi Top Schools"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSaveOpen(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 text-xs bg-primary text-primary-foreground font-medium"
                  >
                    Save
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>

          {/* Execute Search CTA */}
          <Button
            onClick={onExecuteSearch}
            disabled={isSearching}
            className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs flex items-center gap-2 active:scale-[0.97] transition-transform shrink-0"
          >
            {isSearching ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Find Prospects</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Active Filter Chips Ribbon */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
          <span className="text-[11px] text-muted-foreground mr-1">Active Filters:</span>
          {filters.city && (
            <Badge variant="outline" className="text-[11px] gap-1 bg-muted/40 font-normal pr-1">
              City: {filters.city}
              <button 
                onClick={() => handleClearFilter('city')} 
                className="hover:text-destructive ml-0.5"
                aria-label={`Remove city filter ${filters.city}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.industry && (
            <Badge variant="outline" className="text-[11px] gap-1 bg-muted/40 font-normal pr-1">
              Industry: {filters.industry}
              <button 
                onClick={() => handleClearFilter('industry')} 
                className="hover:text-destructive ml-0.5"
                aria-label={`Remove industry filter ${filters.industry}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.ratingMin !== undefined && (
            <Badge variant="outline" className="text-[11px] gap-1 bg-muted/40 font-normal pr-1">
              Rating: {filters.ratingMin}+ ★
              <button 
                onClick={() => handleClearFilter('ratingMin')} 
                className="hover:text-destructive ml-0.5"
                aria-label={`Remove rating filter ${filters.ratingMin}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.scoreMin !== undefined && (
            <Badge variant="outline" className="text-[11px] gap-1 bg-muted/40 font-normal pr-1">
              Score: {filters.scoreMin}+
              <button 
                onClick={() => handleClearFilter('scoreMin')} 
                className="hover:text-destructive ml-0.5"
                aria-label={`Remove score filter ${filters.scoreMin}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.syncedStatus && filters.syncedStatus !== 'all' && (
            <Badge variant="outline" className="text-[11px] gap-1 bg-muted/40 font-normal pr-1">
              CRM: {filters.syncedStatus}
              <button 
                onClick={() => handleClearFilter('syncedStatus')} 
                className="hover:text-destructive ml-0.5"
                aria-label={`Remove CRM status filter ${filters.syncedStatus}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          <button
            onClick={() => onFiltersChange({})}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
