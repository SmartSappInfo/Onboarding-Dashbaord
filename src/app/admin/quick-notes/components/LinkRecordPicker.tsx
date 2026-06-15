'use client';

import * as React from 'react';
import { collection, query, where, limit as fbLimit } from 'firebase/firestore';
import { School, CheckSquare, X, ChevronsUpDown } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { QuickNoteLinks } from '@/lib/quick-notes-types';

interface LinkableEntity {
  id: string;
  entityId: string;
  displayName?: string;
}
interface LinkableTask {
  id: string;
  title?: string;
  workspaceId: string;
}

export interface LinkRecordPickerProps {
  workspaceId: string;
  links: QuickNoteLinks;
  onChange: (links: QuickNoteLinks) => void;
}

const PICK_LIMIT = 200;

export default function LinkRecordPicker({ workspaceId, links, onChange }: LinkRecordPickerProps) {
  const firestore = useFirestore();
  const [entityOpen, setEntityOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);

  // Equality-only queries — no composite index needed; sorted client-side.
  const entitiesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', workspaceId),
      fbLimit(PICK_LIMIT)
    );
  }, [firestore, workspaceId]);

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(collection(firestore, 'tasks'), where('workspaceId', '==', workspaceId), fbLimit(PICK_LIMIT));
  }, [firestore, workspaceId]);

  const { data: entities } = useCollection<LinkableEntity>(entitiesQuery);
  const { data: tasks } = useCollection<LinkableTask>(tasksQuery);

  const entityOptions = React.useMemo(
    () =>
      (entities ?? [])
        .filter((e) => e.entityId && e.displayName)
        .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '')),
    [entities]
  );
  const taskOptions = React.useMemo(
    () => (tasks ?? []).filter((t) => t.title).sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')),
    [tasks]
  );

  const setEntity = (entityId?: string, entityName?: string) => {
    onChange({ ...links, entityId, entityName });
    setEntityOpen(false);
  };
  const setTask = (taskId?: string, taskName?: string) => {
    onChange({ ...links, taskId, taskName });
    setTaskOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Entity link */}
      <Popover open={entityOpen} onOpenChange={setEntityOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <School className="h-4 w-4" />
            {links.entityId ? (
              <span className="max-w-[140px] truncate">{links.entityName || 'Linked entity'}</span>
            ) : (
              'Link entity'
            )}
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Search entities…" />
            <CommandList>
              <CommandEmpty>No entities found.</CommandEmpty>
              {entityOptions.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.displayName} ${e.entityId}`}
                  onSelect={() => setEntity(e.entityId, e.displayName)}
                  className={cn(links.entityId === e.entityId && 'bg-accent')}
                >
                  <School className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{e.displayName}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {links.entityId && (
        <button
          type="button"
          aria-label="Clear entity link"
          onClick={() => setEntity(undefined, undefined)}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Task link */}
      <Popover open={taskOpen} onOpenChange={setTaskOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            {links.taskId ? (
              <span className="max-w-[140px] truncate">{links.taskName || 'Linked task'}</span>
            ) : (
              'Link task'
            )}
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Search tasks…" />
            <CommandList>
              <CommandEmpty>No tasks found.</CommandEmpty>
              {taskOptions.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.title} ${t.id}`}
                  onSelect={() => setTask(t.id, t.title)}
                  className={cn(links.taskId === t.id && 'bg-accent')}
                >
                  <CheckSquare className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {links.taskId && (
        <button
          type="button"
          aria-label="Clear task link"
          onClick={() => setTask(undefined, undefined)}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
