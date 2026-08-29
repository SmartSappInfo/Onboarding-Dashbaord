'use client';

/**
 * Filter Builder Pane (Discovery Studio Left Pane)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Implements intelligence_ui Section 13 & 14 (Two-pane layout & Facet Filter Builder).
 * 2. Immutable State: Dispatches clean, typed SearchFilters updates to parent component.
 * 3. Mobile Ergonomics: Collapsible drawer/pane with touch-accessible range controls and checkboxes.
 */

import React from 'react';
import { 
  Filter, 
  RotateCcw, 
  Building2, 
  MapPin, 
  Flame, 
  ShieldCheck, 
  Layers 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { SearchFilters } from '@/lib/lead-intelligence/types';

interface FilterBuilderPaneProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApplyFilters: () => void;
  className?: string;
}

const COMMON_INDUSTRIES = ['Education', 'Healthcare', 'Hospitality', 'Retail', 'Real Estate', 'Finance', 'Technology'];
const COMMON_TECHS = ['WordPress', 'Shopify', 'WooCommerce', 'Paystack', 'Flutterwave', 'Stripe', 'Google Analytics'];

export const FilterBuilderPane: React.FC<FilterBuilderPaneProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  className = '',
}) => {
  const handleReset = () => {
    onFiltersChange({});
    onApplyFilters();
  };

  const handleToggleTech = (tech: string) => {
    const current = new Set(filters.technologies || []);
    if (current.has(tech)) {
      current.delete(tech);
    } else {
      current.add(tech);
    }
    onFiltersChange({ ...filters, technologies: Array.from(current) });
  };

  return (
    <div className={`p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-5 text-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <Filter className="w-4 h-4 text-primary" />
          <span>Filter Facets</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground active:scale-[0.97]"
        >
          <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </Button>
      </div>

      {/* 1. Target Geography */}
      <div className="space-y-2">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" /> Location / City
        </Label>
        <Input
          placeholder="e.g. Kumasi, Accra, Takoradi"
          value={filters.city || ''}
          onChange={(e) => onFiltersChange({ ...filters, city: e.target.value })}
          className="h-8 text-xs bg-background"
        />
      </div>

      {/* 2. Target Industry */}
      <div className="space-y-2">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-primary" /> Industry Focus
        </Label>
        <div className="flex flex-wrap gap-1">
          {COMMON_INDUSTRIES.map((ind) => {
            const isSelected = filters.industry?.toLowerCase() === ind.toLowerCase();
            return (
              <Badge
                key={ind}
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => onFiltersChange({ ...filters, industry: isSelected ? undefined : ind })}
                className={`cursor-pointer text-[10px] px-2 py-0.5 transition-all ${
                  isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted'
                }`}
              >
                {ind}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* 3. Smart Score & Intent Thresholds */}
      <div className="space-y-2.5 pt-1 border-t border-border/40">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-500" /> Smart Score Threshold
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            type="button"
            variant={filters.scoreMin === 75 ? 'secondary' : 'outline'}
            onClick={() => onFiltersChange({ ...filters, scoreMin: filters.scoreMin === 75 ? undefined : 75 })}
            className={`h-7 text-[11px] ${filters.scoreMin === 75 ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold' : ''}`}
          >
            🔥 High (≥75)
          </Button>
          <Button
            size="sm"
            type="button"
            variant={filters.scoreMin === 50 ? 'secondary' : 'outline'}
            onClick={() => onFiltersChange({ ...filters, scoreMin: filters.scoreMin === 50 ? undefined : 50 })}
            className="h-7 text-[11px]"
          >
            ⚡ Qualified (≥50)
          </Button>
        </div>
      </div>

      {/* 4. CRM Ingestion Status */}
      <div className="space-y-2.5 pt-1 border-t border-border/40">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> CRM Status
        </Label>
        <div className="grid grid-cols-3 gap-1">
          {(['all', 'unregistered', 'synced'] as const).map((status) => {
            const isSelected = (filters.syncedStatus || 'all') === status;
            return (
              <Button
                key={status}
                size="sm"
                type="button"
                variant={isSelected ? 'secondary' : 'ghost'}
                onClick={() => onFiltersChange({ ...filters, syncedStatus: status })}
                className={`h-7 text-[10px] capitalize font-medium rounded-lg ${
                  isSelected ? 'border border-border bg-muted/80 font-bold' : 'text-muted-foreground'
                }`}
              >
                {status}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 5. Technographics Multi-Select */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-sky-400" /> Tech Signatures
        </Label>
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {COMMON_TECHS.map((tech) => {
            const isChecked = filters.technologies?.includes(tech) ?? false;
            return (
              <label key={tech} className="flex items-center gap-2 cursor-pointer text-[11px] text-foreground hover:text-primary">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => handleToggleTech(tech)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span>{tech}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Apply Action Button */}
      <Button
        onClick={onApplyFilters}
        className="w-full h-8 text-xs font-semibold bg-primary text-primary-foreground active:scale-[0.97]"
      >
        Apply Filters
      </Button>
    </div>
  );
};
export default FilterBuilderPane;
