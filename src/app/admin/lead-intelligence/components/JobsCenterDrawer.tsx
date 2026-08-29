'use client';

/**
 * Jobs Center & Operation Progress Tracker Drawer
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Implements intelligence_ui Sections 10 & 11 (Async processing & Job detail).
 * 2. High Load Invariant: Transparently tracks batch sync, enrichment, and CSV parsing jobs.
 * 3. Mobile Accessibility: Full responsive sheet with touch targets >= 44px.
 * 4. Zero any[] Policy: 100% strictly typed using IntelligenceJob.
 */

import React, { useState } from 'react';
import { 
  Activity, 
  Pause, 
  Play, 
  X, 
  ExternalLink, 
  Clock, 
  Layers, 
  Sparkles,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { IntelligenceJob, JobType } from '@/lib/lead-intelligence/types';

interface JobsCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: IntelligenceJob[];
  onCancelJob?: (jobId: string) => void;
  onTogglePauseJob?: (jobId: string) => void;
  onClearCompletedJobs?: () => void;
  onViewJobResults?: (job: IntelligenceJob) => void;
}

export const JobsCenterDrawer: React.FC<JobsCenterDrawerProps> = ({
  isOpen,
  onClose,
  jobs,
  onCancelJob,
  onTogglePauseJob,
  onClearCompletedJobs,
  onViewJobResults,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed'>('all');

  const runningJobs = jobs.filter((j) => j.status === 'running' || j.status === 'paused');
  const completedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed');

  const filteredJobs = activeTab === 'running' 
    ? runningJobs 
    : activeTab === 'completed' 
    ? completedJobs 
    : jobs;

  const getJobIcon = (type: JobType) => {
    switch (type) {
      case 'discovery':
        return <Layers className="w-4 h-4 text-primary" />;
      case 'batch_enrich':
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      case 'batch_sync':
        return <Database className="w-4 h-4 text-blue-500" />;
      case 'csv_import':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl p-0 flex flex-col bg-card border-l border-border/80 shadow-2xl z-[10000] overflow-hidden"
      >
        {/* Header Bar */}
        <SheetHeader className="p-5 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Intelligence Jobs Center
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Monitor in-flight discovery, batch enrichment, and CRM ingestion tasks.
            </SheetDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {completedJobs.length > 0 && onClearCompletedJobs && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearCompletedJobs}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Completed
              </Button>
            )}
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onClose} 
              className="h-8 w-8 rounded-lg"
              aria-label="Close Jobs Drawer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Tab Filters */}
        <div className="px-5 pt-3 border-b border-border/40 bg-card">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'running' | 'completed')} className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-xs h-8 bg-muted/40 p-0.5 rounded-lg">
              <TabsTrigger value="all" className="text-xs">
                All ({jobs.length})
              </TabsTrigger>
              <TabsTrigger value="running" className="text-xs">
                Running ({runningJobs.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                Done ({completedJobs.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Jobs List Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">No background jobs found.</p>
              <p className="text-[11px] text-muted-foreground/80">Batch discoveries, enrichments, and CRM syncs will appear here live.</p>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isRunning = job.status === 'running';
              const isPaused = job.status === 'paused';
              const isCompleted = job.status === 'completed';

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border bg-card transition-all space-y-3 ${
                    isRunning 
                      ? 'border-primary/50 shadow-sm ring-1 ring-primary/20' 
                      : 'border-border/70 hover:border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-muted/40 border border-border/60">
                        {getJobIcon(job.type)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground truncate">{job.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Started {new Date(job.startedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>

                    <Badge 
                      variant="outline" 
                      className={`text-[10px] uppercase font-bold py-0.5 px-2 ${
                        isRunning 
                          ? 'bg-primary/10 text-primary border-primary/30' 
                          : isPaused 
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : isCompleted 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                      }`}
                    >
                      {isRunning ? 'Running' : isPaused ? 'Paused' : isCompleted ? 'Completed' : 'Failed'}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-mono text-foreground">{job.progressPercent}%</span>
                    </div>
                    <Progress value={job.progressPercent} className="h-1.5 bg-muted rounded-full" />
                  </div>

                  {/* Metric Chips (intelligence_ui Section 11 Breakdown) */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-muted/20 border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Found</div>
                      <div className="text-xs font-bold text-foreground mt-0.5">{job.foundCount}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Unique</div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{job.uniqueCount}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Duplicates</div>
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">{job.duplicateCount}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">Errors</div>
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">{job.errorCount}</div>
                    </div>
                  </div>

                  {/* Job Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      {isRunning && onTogglePauseJob && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onTogglePauseJob(job.id)}
                          className="h-7 px-2.5 text-xs rounded-lg active:scale-[0.97]"
                        >
                          <Pause className="w-3 h-3 mr-1" /> Pause
                        </Button>
                      )}
                      {isPaused && onTogglePauseJob && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onTogglePauseJob(job.id)}
                          className="h-7 px-2.5 text-xs rounded-lg active:scale-[0.97]"
                        >
                          <Play className="w-3 h-3 mr-1" /> Resume
                        </Button>
                      )}
                      {(isRunning || isPaused) && onCancelJob && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCancelJob(job.id)}
                          className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg active:scale-[0.97]"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>

                    {isCompleted && onViewJobResults && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          onViewJobResults(job);
                          onClose();
                        }}
                        className="h-7 px-3 text-xs font-medium rounded-lg active:scale-[0.97] flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> View Results
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
export default JobsCenterDrawer;
