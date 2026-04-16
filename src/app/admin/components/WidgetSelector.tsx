'use client';

import * as React from 'react';
import { useFeatures } from '@/hooks/use-features';
import { getAllWidgets, filterWidgetsByFeatures, STATIC_WIDGETS } from '@/lib/widget-registry';
import type { Pipeline, WidgetDefinition } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Search,
  X,
  Check,
  Plus,
  Minus,
  LayoutGrid,
  Workflow,
  CheckSquare,
  Calendar,
  Zap,
  BarChart3,
  Globe,
  Film,
  ClipboardList,
  FileText,
  MessageSquareText,
  Tags,
  FileCheck,
  Receipt,
  Package,
  Timer,
  Settings2,
  Target,
  History,
  MapPin,
  Users,
  School,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  School, Workflow, CheckSquare, Calendar, Zap, BarChart3,
  Globe, Film, ClipboardList, FileText, MessageSquareText, Tags,
  FileCheck, Receipt, Package, Timer, Settings2, Target, History, MapPin,
  Users, LayoutGrid,
};

interface WidgetSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeWidgetIds: string[];
  pipelines: Pipeline[];
  onToggleWidget: (widgetId: string, action: 'add' | 'remove') => void;
  terminology?: { singular: string, plural: string };
}

/**
 * Widget Selector dialog.
 * Allows users to add/remove dashboard widgets.
 * Grouped by category with search functionality.
 */
export default function WidgetSelector({
  open,
  onOpenChange,
  activeWidgetIds,
  pipelines,
  onToggleWidget,
  terminology,
}: WidgetSelectorProps) {
  const { isFeatureEnabled } = useFeatures();
  const [searchTerm, setSearchTerm] = React.useState('');

  const allWidgets = React.useMemo(() => {
    const pipelineData = pipelines.map(p => ({ id: p.id, name: p.name }));
    const rawWidgets = getAllWidgets(pipelineData);
    
    if (!terminology) return rawWidgets;
    
    return rawWidgets.map(w => ({
      ...w,
      label: w.label.replace(/{Entity}/g, terminology.singular).replace(/{Entities}/g, terminology.plural),
      description: w.description.replace(/{Entity}/g, terminology.singular).replace(/{Entities}/g, terminology.plural)
    }));
  }, [pipelines, terminology]);

  // Filter by enabled features
  const availableWidgets = React.useMemo(() => {
    return filterWidgetsByFeatures(allWidgets, isFeatureEnabled);
  }, [allWidgets, isFeatureEnabled]);

  // Filter by search
  const filteredWidgets = React.useMemo(() => {
    if (!searchTerm.trim()) return availableWidgets;
    const lower = searchTerm.toLowerCase();
    return availableWidgets.filter(w =>
      w.label.toLowerCase().includes(lower) ||
      w.description.toLowerCase().includes(lower) ||
      w.category.toLowerCase().includes(lower)
    );
  }, [availableWidgets, searchTerm]);

  // Group by category
  const grouped = React.useMemo(() => {
    const groups: Record<string, WidgetDefinition[]> = {};
    filteredWidgets.forEach(w => {
      if (!groups[w.category]) groups[w.category] = [];
      groups[w.category].push(w);
    });
    return groups;
  }, [filteredWidgets]);

  const activeCount = activeWidgetIds.length;
  const totalAvailable = availableWidgets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.2)] rounded-[2.5rem] bg-background/80 backdrop-blur-2xl">
        <DialogHeader className="p-8 pb-6 bg-gradient-to-b from-primary/5 to-transparent border-b shrink-0 relative overflow-hidden">
          {/* Subtle glow effect behind header */}
          <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-primary/10 blur-3xl pointer-events-none rounded-full" />
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="p-3.5 bg-gradient-to-br from-primary to-primary/80 text-white rounded-2xl shadow-lg ring-4 ring-primary/10">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Widget Library
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-muted-foreground">
                {activeCount} of {totalAvailable} widgets active on your dashboard
              </DialogDescription>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-6 relative z-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search available widgets..."
              className="h-12 pl-12 pr-12 rounded-2xl bg-background/50 backdrop-blur-sm border-white/10 shadow-inner focus-visible:ring-primary focus-visible:bg-background font-semibold text-sm transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {Object.entries(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Search className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No widgets match your search</p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, widgets]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase px-2 h-5">
                      {category}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {widgets.map(widget => {
                      const isActive = activeWidgetIds.includes(widget.id);
                      const Icon = ICON_MAP[widget.icon] || Zap;

                      return (
                        <button
                          key={widget.id}
                          type="button"
                          onClick={() => onToggleWidget(widget.id, isActive ? 'remove' : 'add')}
                          className={cn(
                            'relative p-4 rounded-3xl border-2 transition-all duration-300 text-left group overflow-hidden',
                            isActive
                              ? 'bg-primary/5 border-primary/40 shadow-sm hover:border-primary/60'
                              : 'bg-muted/30 border-transparent hover:border-primary/20 hover:bg-muted/50 hover:shadow-lg'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'p-2 rounded-xl transition-colors shrink-0',
                              isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold tracking-tight truncate">{widget.label}</p>
                                {widget.type === 'pipeline' && (
                                  <Badge variant="secondary" className="text-[7px] font-bold uppercase px-1 h-3.5 shrink-0">
                                    Pipeline
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[9px] font-medium text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                {widget.description}
                              </p>
                            </div>
                            <div className={cn(
                              'p-1 rounded-lg transition-all shrink-0',
                              isActive 
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                            )}>
                              {isActive ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
