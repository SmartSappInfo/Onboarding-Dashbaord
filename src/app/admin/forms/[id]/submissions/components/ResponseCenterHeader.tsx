'use client';

/**
 * SmartSapp Forms 2.0: Response Center Header Bar
 * 
 * Top bar housing navigation, search, quick status filter tabs,
 * column customizer toggle, and CSV export.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Inbox, 
  ArrowLeft, 
  Search, 
  Columns, 
  Download, 
  Edit, 
  BarChart3, 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Form } from '@/lib/types';
import type { SubmissionStatus } from '@/lib/forms/form-response-types';

interface ResponseCenterHeaderProps {
  form: Form;
  totalSubmissions: number;
  filteredCount?: number;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  activeStatus: SubmissionStatus | 'all';
  onStatusChange: (status: SubmissionStatus | 'all') => void;
  onOpenColumnCustomizer: () => void;
  onExportCsv: () => void;
  isExporting?: boolean;
}

export default function ResponseCenterHeader({
  form,
  totalSubmissions,
  searchTerm,
  onSearchChange,
  activeStatus,
  onStatusChange,
  onOpenColumnCustomizer,
  onExportCsv,
  isExporting = false,
}: ResponseCenterHeaderProps) {
  const router = useRouter();

  return (
    <div className="space-y-4 pb-2 border-b border-border/40">
      {/* Top Title & Action Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/forms/${form.id}`)}
              className="h-8 px-2 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Form
            </Button>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
              Response Center 2.0
            </Badge>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Inbox className="h-7 w-7 text-primary" />
              {form.internalName || form.title}
            </h1>
            <Badge variant="secondary" className="font-mono text-xs px-2.5 py-0.5 rounded-full font-bold">
              {totalSubmissions.toLocaleString()} Total Responses
            </Badge>
          </div>
        </div>

        {/* Quick Link Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/forms/${form.id}/analytics`)}
            className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
          >
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span>Analytics</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/forms/${form.id}/edit`)}
            className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Studio</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenColumnCustomizer}
            className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
          >
            <Columns className="h-3.5 w-3.5" />
            <span>Columns</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={isExporting}
            className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
        <Tabs
          value={activeStatus}
          onValueChange={(val) => onStatusChange(val as SubmissionStatus | 'all')}
          className="w-full lg:w-auto"
        >
          <TabsList className="h-10 p-1 rounded-2xl bg-muted/30 border border-border/40 flex-wrap overflow-x-auto">
            <TabsTrigger value="all" className="text-xs font-bold rounded-xl min-h-[36px]">
              All Responses
            </TabsTrigger>
            <TabsTrigger value="new" className="text-xs font-bold rounded-xl min-h-[36px]">
              New
            </TabsTrigger>
            <TabsTrigger value="qualified" className="text-xs font-bold rounded-xl min-h-[36px] text-emerald-600">
              Qualified
            </TabsTrigger>
            <TabsTrigger value="contacted" className="text-xs font-bold rounded-xl min-h-[36px]">
              Contacted
            </TabsTrigger>
            <TabsTrigger value="converted" className="text-xs font-bold rounded-xl min-h-[36px] text-purple-600">
              Converted
            </TabsTrigger>
            <TabsTrigger value="needs_review" className="text-xs font-bold rounded-xl min-h-[36px] text-amber-600">
              Needs Review
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search across all captured answers..."
            className="h-10 pl-9 rounded-2xl text-xs bg-background border-border/60 focus-visible:ring-primary/20 min-h-[44px] sm:min-h-0"
          />
        </div>
      </div>
    </div>
  );
}
