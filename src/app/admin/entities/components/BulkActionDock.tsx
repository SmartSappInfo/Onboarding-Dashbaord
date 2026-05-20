'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useTerminology } from '@/hooks/use-terminology';
import { 
  CheckSquare, 
  Tag as TagIcon, 
  UserPlus, 
  DollarSign, 
  ClipboardList, 
  CalendarDays, 
  X,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface BulkActionDockProps {
  selectedCount: number;
  onClearSelection: () => void;
  onVerify: () => void;
  onTags: () => void;
  onAssign: () => void;
  onInitiateDeals: () => void;
  onCreateTasks: () => void;
  onInviteMeetings: () => void;
  className?: string;
}

export function BulkActionDock({
  selectedCount,
  onClearSelection,
  onVerify,
  onTags,
  onAssign,
  onInitiateDeals,
  onCreateTasks,
  onInviteMeetings,
  className,
}: BulkActionDockProps) {
  const { singular, plural } = useTerminology();
  const [isVisible, setIsVisible] = React.useState(false);

  // Trigger entrance slide animation when selectedCount > 0
  React.useEffect(() => {
    if (selectedCount > 0) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200); // match exit transition
      return () => clearTimeout(timer);
    }
  }, [selectedCount]);

  if (!isVisible && selectedCount === 0) return null;

  const entityLabel = selectedCount === 1 ? singular : plural;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out select-none',
        selectedCount > 0 
          ? 'translate-y-0 opacity-100 scale-100' 
          : 'translate-y-12 opacity-0 scale-95 pointer-events-none',
        className
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl bg-slate-950/85 dark:bg-slate-900/90 border border-slate-800 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.4)] ring-1 ring-white/5 max-w-[90vw] md:max-w-max">
        {/* Selection Indicator */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-800/80">
          <div className="h-6 px-2 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="font-mono text-xs font-black text-primary animate-pulse">{selectedCount}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:inline">
            {entityLabel} Selected
          </span>
        </div>

        {/* Action Buttons Matrix */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          {/* Quick Verify */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onVerify}
            className="h-9 px-3 rounded-xl text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors font-bold text-xs gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden md:inline">Verify Emails</span>
          </Button>

          {/* Tag Operations */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onTags}
            className="h-9 px-3 rounded-xl text-slate-300 hover:text-violet-400 hover:bg-violet-500/10 transition-colors font-bold text-xs gap-2"
          >
            <TagIcon className="h-4 w-4" />
            <span className="hidden md:inline">Manage Tags</span>
          </Button>

          {/* Assign Owner */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onAssign}
            className="h-9 px-3 rounded-xl text-slate-300 hover:text-sky-400 hover:bg-sky-500/10 transition-colors font-bold text-xs gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden md:inline">Assign Owner</span>
          </Button>

          {/* More Actions Dropdown Menu */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 rounded-xl text-slate-300 hover:text-primary hover:bg-primary/10 transition-colors font-bold text-xs gap-1.5"
              >
                <span>More Actions</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl bg-slate-950 dark:bg-slate-900 border border-slate-800 text-slate-200">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Workflow Pipelines</DropdownMenuLabel>
              
              <DropdownMenuItem 
                onClick={onInitiateDeals}
                className="rounded-xl p-2.5 gap-3 hover:bg-slate-800 cursor-pointer focus:bg-primary/25 focus:text-white"
              >
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-sm">Initiate Bulk Deals</span>
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={onCreateTasks}
                className="rounded-xl p-2.5 gap-3 hover:bg-slate-800 cursor-pointer focus:bg-primary/25 focus:text-white"
              >
                <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-400">
                  <ClipboardList className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-sm">Create CRM Tasks</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-2 border-slate-800" />
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Communications</DropdownMenuLabel>

              <DropdownMenuItem 
                onClick={onInviteMeetings}
                className="rounded-xl p-2.5 gap-3 hover:bg-slate-800 cursor-pointer focus:bg-primary/25 focus:text-white"
              >
                <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-sm">Invite to Session</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clear selection button */}
        <div className="pl-2 border-l border-slate-800/80">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
