'use client';

import * as React from 'react';
import { useEditor } from '../EditorContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeftOpen, Save, Eye, Loader2 } from 'lucide-react';
import { Inspector } from './Inspector';

export function EditorSidebar() {
  const { isSidebarCollapsed, setIsSidebarCollapsed, onPreview, onSave, isSaving } = useEditor();

  return (
    <div 
      className={cn(
        "h-full bg-card border-l hidden md:flex flex-col z-30 shadow-xl transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-16" : "w-[384px]"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b shrink-0 bg-background/50 backdrop-blur-sm">
        {!isSidebarCollapsed && <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Properties</h2>}
        <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
          {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <Inspector />

      {!isSidebarCollapsed && (
        <div className="p-4 border-t flex flex-col gap-2 bg-muted/10 shrink-0">
          <Button variant="outline" onClick={onPreview} size="sm"><Eye className="mr-2 h-4 w-4" /> Preview</Button>
          <Button onClick={onSave} disabled={isSaving} size="sm">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
