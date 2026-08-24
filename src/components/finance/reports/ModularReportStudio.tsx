'use client';

/**
 * SmartSapp Finance 2.0 - Modular Report Studio Container
 * Generic layout container hosting tabbed reports with unified filtering and exports.
 */

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ReportFilterBar } from './ReportFilterBar';
import { ReportExportToolbar } from './ReportExportToolbar';
import { DateRangePreset } from '@/lib/types';
import { BarChart3, Loader2 } from 'lucide-react';

export interface ReportTabConfig {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  renderContent: (dateRange: { preset: DateRangePreset; startDate?: string; endDate?: string }) => React.ReactNode;
}

export interface ModularReportStudioProps {
  title: string;
  subtitle?: string;
  tabs: ReportTabConfig[];
  defaultTabId?: string;
  onFilterChange?: (filter: { preset: DateRangePreset; startDate?: string; endDate?: string }) => void;
  onExportCsv?: (tabId: string) => void;
  onPrintPdf?: () => void;
  isLoading?: boolean;
}

export function ModularReportStudio({
  title,
  subtitle,
  tabs,
  defaultTabId,
  onFilterChange,
  onExportCsv,
  onPrintPdf,
  isLoading,
}: ModularReportStudioProps) {
  const [activeTab, setActiveTab] = React.useState<string>(defaultTabId || (tabs[0]?.id ?? ''));
  const [preset, setPreset] = React.useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = React.useState<string>('');
  const [customEnd, setCustomEnd] = React.useState<string>('');

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset);
    onFilterChange?.({ preset: newPreset, startDate: customStart, endDate: customEnd });
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    onFilterChange?.({ preset, startDate: start, endDate: end });
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <BarChart3 className="h-4 w-4" />
            Financial Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {onExportCsv && (
          <ReportExportToolbar
            title={title}
            onExportCsv={() => onExportCsv(activeTab)}
            onPrintPdf={onPrintPdf}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Tabs and Content Shell */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <TabsList className="bg-card border rounded-2xl p-1 h-auto flex-wrap justify-start">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-xl px-3 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Unified Filter Bar */}
        <ReportFilterBar
          selectedPreset={preset}
          onPresetChange={handlePresetChange}
          customStartDate={customStart}
          customEndDate={customEnd}
          onCustomDateChange={handleCustomDateChange}
        />

        {/* Tab Contents */}
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-4 outline-none">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-semibold">Compiling financial data...</p>
              </div>
            ) : (
              tab.renderContent({
                preset,
                startDate: customStart,
                endDate: customEnd,
              })
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
