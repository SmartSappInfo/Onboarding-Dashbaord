'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Attribution Explorer:
 *    - Implements Section 111 of `media_prd.md` providing a multi-dimensional view of touchpoint influence.
 *    - 5 Semantic Tiers:
 *      - Touched: Any view or visit.
 *      - Engaged: Meaningful interaction (>=50% completion or >=30s).
 *      - Assisted: Mid-funnel multi-touch influence.
 *      - Influenced: Prior to deal creation or stage progression.
 *      - Converted: High-intent CTA click or proposal document download prior to deal won.
 * 2. Mobile & Touch Targets:
 *    - All buttons and interactive tabs conform to `min-h-[44px] min-w-[44px]`.
 *    - Emil Kowalski micro-animations (`active:scale-[0.97]`).
 * 3. Export Capabilities:
 *    - RFC 4180-compliant CSV export with sanitized string escaping.
 * 4. Strict Typing Standard:
 *    - Zero use of `any` or `any[]`.
 */

import * as React from 'react';
import { useFirestore } from '@/lib/firestore-context';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type {
  MediaAttribution,
  AttributionType,
  AttributionModelType,
} from '@/lib/types/media-2.0';
import { exportAttributionCsvAction } from '@/lib/media/attribution-service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  Video,
  FileText,
  Music,
  Image as ImageIcon,
  Sparkles,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttributionExplorerProps {
  workspaceId: string;
}

type SemanticTab = 'ALL' | AttributionType;

export function AttributionExplorer({ workspaceId }: AttributionExplorerProps) {
  const firestore = useFirestore();
  const [attributions, setAttributions] = React.useState<MediaAttribution[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<SemanticTab>('ALL');
  const [selectedModel, setSelectedModel] = React.useState<string>('ALL');
  const [sortDirection, setSortDirection] = React.useState<'desc' | 'asc'>('desc');

  // Load Attributions from Firestore
  React.useEffect(() => {
    let isMounted = true;
    async function loadAttributions() {
      if (!firestore || !workspaceId) return;
      setIsLoading(true);
      try {
        const q = query(
          collection(firestore, 'media_attributions'),
          where('workspaceId', '==', workspaceId),
          limit(500)
        );
        const snap = await getDocs(q);
        const records: MediaAttribution[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as MediaAttribution[];

        if (isMounted) {
          setAttributions(records);
        }
      } catch (err) {
        console.error('[AttributionExplorer] Failed to load attributions:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadAttributions();
    return () => {
      isMounted = false;
    };
  }, [firestore, workspaceId]);

  // Multi-dimensional Client-side Filtering & Sorting
  const filteredAttributions = React.useMemo(() => {
    let list = [...attributions];

    // 1. Semantic Tab Filter
    if (activeTab !== 'ALL') {
      list = list.filter((a) => a.attributionType === activeTab);
    }

    // 2. Model Filter
    if (selectedModel !== 'ALL') {
      list = list.filter((a) => a.model === selectedModel);
    }

    // 3. Search Term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.assetTitle && a.assetTitle.toLowerCase().includes(q)) ||
          (a.dealTitle && a.dealTitle.toLowerCase().includes(q)) ||
          (a.contactName && a.contactName.toLowerCase().includes(q)) ||
          a.id.toLowerCase().includes(q)
      );
    }

    // 4. Sort by Attributed Revenue
    list.sort((a, b) => {
      const diff = (b.attributedRevenue || 0) - (a.attributedRevenue || 0);
      return sortDirection === 'desc' ? diff : -diff;
    });

    return list;
  }, [attributions, activeTab, selectedModel, searchTerm, sortDirection]);

  // CSV Export Trigger
  const handleExportCsv = () => {
    if (filteredAttributions.length === 0) return;
    const csvContent = exportAttributionCsvAction(filteredAttributions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `media_attribution_export_${workspaceId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFormatIcon = (type?: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4 text-blue-500 shrink-0" />;
      case 'audio':
        return <Music className="h-4 w-4 text-purple-500 shrink-0" />;
      case 'document':
        return <FileText className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'image':
        return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />;
      default:
        return <Video className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const getSemanticBadge = (type: AttributionType) => {
    switch (type) {
      case 'CONVERTED_AFTER_EXPOSURE':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-extrabold uppercase">
            Converted
          </Badge>
        );
      case 'INFLUENCED':
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-extrabold uppercase">
            Influenced
          </Badge>
        );
      case 'ENGAGED':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-extrabold uppercase">
            Engaged
          </Badge>
        );
      case 'ASSISTED':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-extrabold uppercase">
            Assisted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-extrabold uppercase text-muted-foreground">
            Touched
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" /> Attribution Explorer
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Audit granular touchpoint revenue credits across the 5 semantic conversion tiers.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleExportCsv}
          disabled={filteredAttributions.length === 0}
          className="rounded-xl h-10 px-4 min-h-[44px] gap-2 active:scale-[0.97] font-bold text-xs shrink-0"
        >
          <Download className="h-4 w-4" /> Export CSV ({filteredAttributions.length})
        </Button>
      </div>

      {/* 5 Semantic Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        {(
          [
            { key: 'ALL', label: 'All Touchpoints' },
            { key: 'TOUCHED', label: '1. Touched' },
            { key: 'ENGAGED', label: '2. Engaged' },
            { key: 'ASSISTED', label: '3. Assisted' },
            { key: 'INFLUENCED', label: '4. Influenced' },
            { key: 'CONVERTED_AFTER_EXPOSURE', label: '5. Converted' },
          ] as { key: SemanticTab; label: string }[]
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === 'ALL'
              ? attributions.length
              : attributions.filter((a) => a.attributionType === tab.key).length;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center gap-2 whitespace-nowrap active:scale-[0.97]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-black',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by asset, deal, or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 min-h-[44px] rounded-xl text-xs font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[180px] h-10 min-h-[44px] rounded-xl text-xs font-bold">
              <SelectValue placeholder="Model Filter" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL" className="text-xs font-semibold">All Models</SelectItem>
              <SelectItem value="LINEAR" className="text-xs font-semibold">Linear</SelectItem>
              <SelectItem value="FIRST_TOUCH" className="text-xs font-semibold">First Touch</SelectItem>
              <SelectItem value="LAST_TOUCH" className="text-xs font-semibold">Last Touch</SelectItem>
              <SelectItem value="TIME_DECAY" className="text-xs font-semibold">Time Decay</SelectItem>
              <SelectItem value="POSITION_BASED" className="text-xs font-semibold">Position Based</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="rounded-xl h-10 px-3 min-h-[44px] gap-1.5 active:scale-[0.97] font-bold text-xs shrink-0"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortDirection === 'desc' ? 'Highest Credit' : 'Lowest Credit'}
          </Button>
        </div>
      </div>

      {/* Attributions Table View */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center">
          <Sparkles className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs font-extrabold text-foreground">Loading Attribution Records...</p>
        </div>
      ) : filteredAttributions.length > 0 ? (
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                <tr>
                  <th className="py-3 px-4">Media Asset</th>
                  <th className="py-3 px-4">Deal / Opportunity</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Semantic Tier</th>
                  <th className="py-3 px-4 text-center">Weight</th>
                  <th className="py-3 px-4 text-right">Attributed Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAttributions.map((attr) => {
                  const currency = attr.dealCurrency || 'GH₵';
                  const amount = attr.attributedRevenue || 0;
                  const weightPercent = Math.round(attr.weight * 1000) / 10;

                  return (
                    <tr
                      key={attr.id}
                      className="hover:bg-muted/10 transition-colors"
                    >
                      {/* Asset */}
                      <td className="py-3 px-4 font-bold text-foreground">
                        <div className="flex items-center gap-2.5 min-w-[180px]">
                          <div className="p-2 rounded-lg bg-muted/20 shrink-0">
                            {getFormatIcon(attr.assetType)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-foreground">
                              {attr.assetTitle || 'Untitled Asset'}
                            </p>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                              {attr.model.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Deal */}
                      <td className="py-3 px-4">
                        <div className="min-w-[160px]">
                          <p className="text-xs font-bold text-foreground truncate">
                            {attr.dealTitle || 'Unlinked Deal'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              {currency}{Number(attr.dealAmount || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">&bull;</span>
                            <span className={cn(
                              'text-[10px] font-bold',
                              attr.isClosedWon ? 'text-emerald-500' : 'text-primary'
                            )}>
                              {attr.dealStage || (attr.isClosedWon ? 'Won' : 'Open')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 text-muted-foreground font-semibold min-w-[130px]">
                        {attr.contactName || attr.contactId || 'Anonymous Prospect'}
                      </td>

                      {/* Semantic Tier */}
                      <td className="py-3 px-4">
                        {getSemanticBadge(attr.attributionType)}
                      </td>

                      {/* Weight */}
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-[10px] font-black">
                          {weightPercent}%
                        </Badge>
                      </td>

                      {/* Attributed Revenue */}
                      <td className="py-3 px-4 text-right font-black text-foreground text-xs">
                        <span className={cn(
                          attr.isClosedWon ? 'text-emerald-500' : 'text-foreground'
                        )}>
                          {currency}{amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-16 border border-dashed rounded-2xl bg-muted/10 text-center space-y-3">
          <Filter className="h-6 w-6 text-muted-foreground/40 mx-auto" />
          <p className="text-xs font-extrabold text-foreground">
            No Attributions Matching Active Filters
          </p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search term, switching the semantic tier tab, or run an attribution recomputation batch.
          </p>
        </div>
      )}
    </div>
  );
}
