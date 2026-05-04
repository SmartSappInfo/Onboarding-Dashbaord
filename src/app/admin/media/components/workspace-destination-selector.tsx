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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <Layout className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">
            Target Workspaces
        </span>
      </div>
      
      <MultiSelect 
        options={options}
        value={selectedWorkspaces}
        onChange={onChange}
        placeholder={isSuperAdmin ? "Global Asset" : "Select destinations..."}
        className="bg-background border-border rounded-xl shadow-sm h-9 min-w-[250px] text-xs"
      />
    </div>
  );
}
