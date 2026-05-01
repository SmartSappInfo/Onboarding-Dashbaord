'use client';

import * as React from 'react';
import { Layout } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';

interface WorkspaceDestinationSelectorProps {
  options: { label: string; value: string }[];
  selectedWorkspaces: string[];
  onChange: (values: string[]) => void;
  isSuperAdmin: boolean;
}

export function WorkspaceDestinationSelector({
  options,
  selectedWorkspaces,
  onChange,
  isSuperAdmin
}: WorkspaceDestinationSelectorProps) {
  return (
    <div className="space-y-3 p-5 bg-card/50 rounded-2xl border border-border shadow-sm text-left">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-primary/10 rounded-md">
            <Layout className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-foreground">
            Targeted Hubs
            {isSuperAdmin && <span className="text-muted-foreground font-medium ml-2 text-xs">(Optional for Admins)</span>}
        </h3>
      </div>
      
      <MultiSelect 
        options={options}
        value={selectedWorkspaces}
        onChange={onChange}
        placeholder={isSuperAdmin ? "Global Asset (No hubs selected)" : "Select destination hubs..."}
        className="bg-background border-border rounded-xl shadow-sm h-11"
      />
      
      <p className="text-[11px] font-medium text-muted-foreground mt-1 px-1">
        {selectedWorkspaces.length > 0 
            ? "Asset will be securely shared across all selected hubs." 
            : "Asset will be stored globally and accessible platform-wide."}
      </p>
    </div>
  );
}
