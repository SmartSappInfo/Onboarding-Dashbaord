import React from 'react';

export function TaskCompletionKpi({ workspaceId }: { workspaceId: string }) {
  // Mock data
  const completed = 45;
  const overdue = 12;
  const open = 28;

  return (
    <div className="flex flex-col h-full justify-between p-2">
      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
          <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{completed}</span>
          <span className="text-xs font-semibold uppercase text-emerald-600/70 dark:text-emerald-400/70 mt-1">Completed</span>
        </div>
        
        <div className="flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/50">
          <span className="text-3xl font-bold text-red-600 dark:text-red-400">{overdue}</span>
          <span className="text-xs font-semibold uppercase text-red-600/70 dark:text-red-400/70 mt-1">Overdue</span>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <span className="text-sm font-medium">Open Tasks</span>
        <span className="text-sm font-bold">{open}</span>
      </div>
    </div>
  );
}
