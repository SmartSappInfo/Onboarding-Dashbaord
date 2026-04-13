'use client';

import * as React from 'react';
import { useEditor } from '../EditorContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Inspector } from './Inspector';

export function EditorSidebar() {
  const { isSidebarCollapsed, setIsSidebarCollapsed, viewMode } = useEditor();

  if (viewMode === 'preview') return null;

  return (
    <div 
 className={cn(
        "h-full bg-card border-l hidden md:flex flex-col z-30 shadow-xl transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-16" : "w-[384px]"
      )}
    >
 <div className="flex items-center justify-between p-4 border-b shrink-0 bg-background/50 backdrop-blur-sm">
        {!isSidebarCollapsed && (
 <div className="flex flex-col">
 <h2 className="font-bold text-xs tracking-wider text-muted-foreground">Properties</h2>
 <p className="text-[10px] text-muted-foreground/60 font-medium">Fine-tune selected elements</p>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          type="button"
 className={cn("h-8 w-8", isSidebarCollapsed ? "mx-auto" : "ml-auto")} 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
 {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <Inspector />
    </div>
  );
}
