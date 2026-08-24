'use client';

/**
 * SmartSapp Finance 2.0 - Report Filter Bar Component
 * Reusable date-range preset selector, custom date pickers, and search bar for modular reports.
 */

import * as React from 'react';
import { Calendar, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePreset } from '@/lib/types';

export interface ReportFilterBarProps {
  selectedPreset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export function ReportFilterBar({
  selectedPreset,
  onPresetChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Filter report records...',
  children,
}: ReportFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 p-3 bg-card border rounded-2xl shadow-sm">
      {/* Date Range Preset Selector */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={selectedPreset} onValueChange={(val) => onPresetChange(val as DateRangePreset)}>
          <SelectTrigger className="rounded-xl h-10 min-h-[44px] text-xs font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="custom">Custom Date Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom Date Inputs if 'custom' is selected */}
      {selectedPreset === 'custom' && onCustomDateChange && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStartDate || ''}
            onChange={(e) => onCustomDateChange(e.target.value, customEndDate || '')}
            className="rounded-xl h-10 min-h-[44px] text-xs font-mono w-[140px]"
          />
          <span className="text-xs text-muted-foreground font-semibold">to</span>
          <Input
            type="date"
            value={customEndDate || ''}
            onChange={(e) => onCustomDateChange(customStartDate || '', e.target.value)}
            className="rounded-xl h-10 min-h-[44px] text-xs font-mono w-[140px]"
          />
        </div>
      )}

      {/* Search Bar */}
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 rounded-xl h-10 min-h-[44px] text-xs"
          />
        </div>
      )}

      {/* Extra Filter Slots */}
      {children}
    </div>
  );
}
