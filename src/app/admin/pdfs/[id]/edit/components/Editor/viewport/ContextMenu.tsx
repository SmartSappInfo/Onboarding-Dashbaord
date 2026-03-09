'use client';

import * as React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useEditor } from '../EditorContext';
import { 
    Plus, 
    Undo, 
    Redo, 
    Settings, 
    Text, 
    Signature, 
    Calendar, 
    ChevronDownSquare, 
    Phone, 
    Mail, 
    Clock, 
    Camera, 
    Tag,
    Database
} from 'lucide-react';

export function EditorContextMenu({ children }: { children: React.ReactNode }) {
  const { 
    addField, undo, redo, canUndo, canRedo, 
    selectedFieldIds, setIsSidebarCollapsed, setSidebarTab 
  } = useEditor();

  const handleViewProperties = () => {
    setIsSidebarCollapsed(false);
    // @ts-ignore - Internal state sync
    if (setSidebarTab) setSidebarTab('properties');
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64 rounded-xl border-none shadow-2xl p-2">
        <ContextMenuSub>
          <ContextMenuSubTrigger className="rounded-lg gap-3 p-2.5">
            <Plus className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Insert Field</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56 rounded-xl border-none shadow-2xl p-2">
            <ContextMenuItem onClick={() => addField('static-text')} className="rounded-lg gap-3 p-2.5">
              <Tag className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Add Label</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('variable')} className="rounded-lg gap-3 p-2.5">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Add Variable</span>
            </ContextMenuItem>
            <ContextMenuSeparator className="my-1" />
            <ContextMenuItem onClick={() => addField('text')} className="rounded-lg gap-3 p-2.5">
              <Text className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Short Text</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('signature')} className="rounded-lg gap-3 p-2.5">
              <Signature className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Signature</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('date')} className="rounded-lg gap-3 p-2.5">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Date</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('dropdown')} className="rounded-lg gap-3 p-2.5">
              <ChevronDownSquare className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Dropdown</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('phone')} className="rounded-lg gap-3 p-2.5">
              <Phone className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Phone</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('email')} className="rounded-lg gap-3 p-2.5">
              <Mail className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Email</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('time')} className="rounded-lg gap-3 p-2.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Time</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => addField('photo')} className="rounded-lg gap-3 p-2.5">
              <Camera className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Photo</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator className="my-1" />

        <ContextMenuItem onClick={undo} disabled={!canUndo} className="rounded-lg gap-3 p-2.5">
          <Undo className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold text-sm">Undo</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={redo} disabled={!canRedo} className="rounded-lg gap-3 p-2.5">
          <Redo className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold text-sm">Redo</span>
        </ContextMenuItem>

        {selectedFieldIds.length > 0 && (
          <>
            <ContextMenuSeparator className="my-1" />
            <ContextMenuItem onClick={handleViewProperties} className="rounded-lg gap-3 p-2.5">
              <Settings className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">View Properties</span>
            </ContextMenuItem>
          </>
        )}
      </を開くContent>
    </ContextMenu>
  );
}
