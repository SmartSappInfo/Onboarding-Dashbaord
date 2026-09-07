'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  buildTimelineStream,
  filterTimelineStream,
  groupTimelineByPeriod,
  type RawTimelineEntityNote,
  type RawTimelineActivity,
  type RawTimelineTask,
} from '../quick-notes-domain';
import {
  QUICK_NOTES_COLLECTION,
  type QuickNote,
  type CRMKnowledgeTimelineItem,
  type TimelineFilterState,
  type TimelinePeriodGroup,
  type KnowledgeType,
  type TimelineAiBrief,
} from '../quick-notes-types';
import { summarizeEntityTimelineAction } from '../quick-notes-ai-actions';
import { createTaskAction } from '../task-server-actions';
import { logQuickNoteActivity } from '../quick-notes-actions';

export type EntityTimelineScope = 'entity' | 'contact' | 'lead' | 'deal' | 'task';

export interface UseUnifiedEntityTimelineOptions {
  workspaceId: string | null | undefined;
  organizationId?: string | null;
  by: EntityTimelineScope;
  recordId: string;
  recordName?: string;
  entityId?: string; // Optional parent entity ID (e.g. for deals)
  maxItems?: number;
}

export interface UseUnifiedEntityTimelineResult {
  items: CRMKnowledgeTimelineItem[];
  filteredItems: CRMKnowledgeTimelineItem[];
  groupedItems: TimelinePeriodGroup[];
  isLoading: boolean;
  filter: TimelineFilterState;
  setFilter: React.Dispatch<React.SetStateAction<TimelineFilterState>>;
  aiBrief: TimelineAiBrief | null;
  isGeneratingBrief: boolean;
  generateAiBrief: () => Promise<void>;
  addNote: (content: string, knowledgeType?: KnowledgeType, parentNoteId?: string) => Promise<boolean>;
  togglePin: (item: CRMKnowledgeTimelineItem) => Promise<void>;
  deleteItem: (item: CRMKnowledgeTimelineItem) => Promise<boolean>;
  updateNoteContent: (item: CRMKnowledgeTimelineItem, newContent: string) => Promise<boolean>;
  createTaskFromActionItem: (item: CRMKnowledgeTimelineItem, actionText: string) => Promise<boolean>;
}

/**
 * Unified Entity Knowledge Timeline Hook (Phase 3).
 *
 * Federates Company Brain Quick Notes, legacy entity_notes, activities (calls/meetings),
 * and tasks into a unified, reactive chronological intelligence stream.
 */
export function useUnifiedEntityTimeline({
  workspaceId,
  organizationId,
  by,
  recordId,
  recordName,
  entityId,
  maxItems = 100,
}: UseUnifiedEntityTimelineOptions): UseUnifiedEntityTimelineResult {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [filter, setFilter] = React.useState<TimelineFilterState>({
    type: 'all',
    searchQuery: '',
    sentiment: 'all',
    onlyPinned: false,
  });

  const [aiBrief, setAiBrief] = React.useState<TimelineAiBrief | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = React.useState(false);

  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return doc(firestore, 'workspaces', workspaceId, 'settings', 'company_brain');
  }, [firestore, workspaceId]);
  const { data: brainSettings } = useDoc<{
    enableCallsInTimeline?: boolean;
    enableMeetingsInTimeline?: boolean;
    enableTasksInTimeline?: boolean;
    customAiBriefDirectives?: string;
  }>(settingsDocRef);

  // 1. Query Native Quick Notes with matching link field
  const quickNotesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !recordId) return null;
    let field = 'links.entityId';
    if (by === 'contact') field = 'links.contactId';
    else if (by === 'lead') field = 'links.leadId';
    else if (by === 'deal') field = 'links.dealId';
    else if (by === 'task') field = 'links.taskId';

    return query(
      collection(firestore, QUICK_NOTES_COLLECTION),
      where('workspaceId', '==', workspaceId),
      where(field, '==', recordId),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
  }, [firestore, workspaceId, by, recordId, maxItems]);

  const { data: rawQuickNotes, isLoading: isQuickNotesLoading } =
    useCollection<QuickNote>(quickNotesQuery);

  // 2. Query Legacy Entity Notes (entity_notes)
  const entityNotesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !recordId) return null;
    if (by === 'deal') {
      return query(
        collection(firestore, 'entity_notes'),
        where('workspaceId', '==', workspaceId),
        where('dealId', '==', recordId),
        orderBy('createdAt', 'desc'),
        limit(maxItems)
      );
    }
    // Fall back to recordId if entityId is not explicitly specified (e.g. contacts / leads)
    const effectiveEntityId = entityId || recordId;
    if (!effectiveEntityId) return null;

    return query(
      collection(firestore, 'entity_notes'),
      where('workspaceId', '==', workspaceId),
      where('entityId', '==', effectiveEntityId),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
  }, [firestore, workspaceId, by, recordId, entityId, maxItems]);

  const { data: rawEntityNotes, isLoading: isEntityNotesLoading } =
    useCollection<RawTimelineEntityNote>(entityNotesQuery);

  // 3. Query Activities (Calls, Meetings, Field events)
  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !recordId) return null;
    if (by === 'deal') {
      return query(
        collection(firestore, 'activities'),
        where('workspaceId', '==', workspaceId),
        where('dealId', '==', recordId),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
      );
    }
    const effectiveEntityId = entityId || recordId;
    if (!effectiveEntityId) return null;

    return query(
      collection(firestore, 'activities'),
      where('workspaceId', '==', workspaceId),
      where('entityId', '==', effectiveEntityId),
      orderBy('timestamp', 'desc'),
      limit(maxItems)
    );
  }, [firestore, workspaceId, by, recordId, entityId, maxItems]);

  const { data: rawActivities, isLoading: isActivitiesLoading } =
    useCollection<RawTimelineActivity>(activitiesQuery);

  // 4. Query Tasks
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !recordId) return null;
    if (brainSettings?.enableTasksInTimeline === false) return null;
    const effectiveEntityId = entityId || recordId;
    if (!effectiveEntityId) return null;

    return query(
      collection(firestore, 'tasks'),
      where('workspaceId', '==', workspaceId),
      where('entityId', '==', effectiveEntityId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore, workspaceId, by, recordId, entityId, brainSettings?.enableTasksInTimeline]);

  const { data: rawTasks, isLoading: isTasksLoading } =
    useCollection<RawTimelineTask>(tasksQuery);

  // Combine and normalize all sources into unified timeline, respecting settings toggles
  const items = React.useMemo(() => {
    let filteredActs = rawActivities || [];
    if (brainSettings?.enableCallsInTimeline === false) {
      filteredActs = filteredActs.filter((a) => !a.type?.toLowerCase().includes('call'));
    }
    if (brainSettings?.enableMeetingsInTimeline === false) {
      filteredActs = filteredActs.filter((a) => !a.type?.toLowerCase().includes('meeting'));
    }

    return buildTimelineStream({
      quickNotes: rawQuickNotes || [],
      entityNotes: rawEntityNotes || [],
      activities: filteredActs,
      tasks: rawTasks || [],
    });
  }, [rawQuickNotes, rawEntityNotes, rawActivities, rawTasks, brainSettings]);

  // Filter items
  const filteredItems = React.useMemo(() => {
    return filterTimelineStream(items, filter);
  }, [items, filter]);

  // Group by calendar period
  const groupedItems = React.useMemo(() => {
    return groupTimelineByPeriod(filteredItems);
  }, [filteredItems]);

  const isLoading =
    isQuickNotesLoading ||
    isEntityNotesLoading ||
    isActivitiesLoading ||
    isTasksLoading;

  // Add new Note to timeline
  const addNote = async (
    content: string,
    knowledgeType: KnowledgeType = 'note',
    parentNoteId?: string
  ): Promise<boolean> => {
    if (!content.trim() || !firestore || !user || !workspaceId) return false;

    const sanitized = content.trim();

    try {
      const links: Record<string, string | undefined> = {};
      if (by === 'entity') {
        links.entityId = recordId;
        if (recordName) links.entityName = recordName;
      } else if (by === 'contact') {
        links.contactId = recordId;
        if (recordName) links.contactName = recordName;
        if (entityId) links.entityId = entityId;
      } else if (by === 'lead') {
        links.leadId = recordId;
        if (recordName) links.leadName = recordName;
        if (entityId) links.entityId = entityId;
      } else if (by === 'deal') {
        links.dealId = recordId;
        if (recordName) links.dealName = recordName;
        if (entityId) links.entityId = entityId;
      }

      const notePayload = {
        entityId: entityId || recordId,
        workspaceId,
        content: sanitized,
        noteType: knowledgeType,
        isPinned: false,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Team Member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(by === 'deal' ? { dealId: recordId, dealName: recordName } : {}),
        ...(parentNoteId ? { parentNoteId } : {}),
      };

      const docRef = await addDoc(collection(firestore, 'entity_notes'), notePayload);

      if (parentNoteId) {
        // Increment parent reply count
        const parentDoc = rawEntityNotes?.find((n) => n.id === parentNoteId);
        await updateDoc(doc(firestore, 'entity_notes', parentNoteId), {
          replyCount: (parentDoc?.replyCount || 0) + 1,
        });
      }

      // Log activity in background
      if (organizationId) {
        void logQuickNoteActivity({
          organizationId,
          workspaceId,
          noteId: docRef.id,
          title: content.slice(0, 50),
          createdBy: user.uid,
          createdByName: user.displayName || 'Me',
          contentPreview: content.slice(0, 100),
        });
      }

      toast({ title: parentNoteId ? 'Reply added' : 'Note added to timeline' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add note';
      toast({ title: 'Error adding note', description: message, variant: 'destructive' });
      return false;
    }
  };

  // Toggle Pin on item
  const togglePin = async (item: CRMKnowledgeTimelineItem): Promise<void> => {
    if (!firestore || !user) return;
    try {
      if (item.source === 'quick_note') {
        await updateDoc(doc(firestore, QUICK_NOTES_COLLECTION, item.sourceId), {
          isPinned: !item.isPinned,
          pinnedAt: !item.isPinned ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        });
      } else if (item.source === 'entity_note') {
        await updateDoc(doc(firestore, 'entity_notes', item.sourceId), {
          isPinned: !item.isPinned,
          pinnedAt: !item.isPinned ? new Date().toISOString() : null,
          pinnedBy: !item.isPinned ? user.uid : null,
          updatedAt: new Date().toISOString(),
        });
      }
      toast({ title: item.isPinned ? 'Item unpinned' : 'Item pinned to top' });
    } catch (error) {
      toast({ title: 'Failed to update pin', variant: 'destructive' });
    }
  };

  // Delete item
  const deleteItem = async (item: CRMKnowledgeTimelineItem): Promise<boolean> => {
    if (!firestore) return false;
    try {
      if (item.source === 'quick_note') {
        await deleteDoc(doc(firestore, QUICK_NOTES_COLLECTION, item.sourceId));
      } else if (item.source === 'entity_note') {
        await deleteDoc(doc(firestore, 'entity_notes', item.sourceId));
      }
      toast({ title: 'Item removed from timeline' });
      return true;
    } catch (error) {
      toast({ title: 'Failed to delete item', variant: 'destructive' });
      return false;
    }
  };

  // Update note content
  const updateNoteContent = async (
    item: CRMKnowledgeTimelineItem,
    newContent: string
  ): Promise<boolean> => {
    if (!firestore || !newContent.trim()) return false;
    try {
      if (item.source === 'quick_note') {
        await updateDoc(doc(firestore, QUICK_NOTES_COLLECTION, item.sourceId), {
          plainText: newContent.trim(),
          updatedAt: new Date().toISOString(),
        });
      } else if (item.source === 'entity_note') {
        await updateDoc(doc(firestore, 'entity_notes', item.sourceId), {
          content: newContent.trim(),
          updatedAt: new Date().toISOString(),
        });
      }
      toast({ title: 'Note updated successfully' });
      return true;
    } catch (error) {
      toast({ title: 'Failed to update note', variant: 'destructive' });
      return false;
    }
  };

  // Create Task from an Action Item
  const createTaskFromActionItem = async (
    item: CRMKnowledgeTimelineItem,
    actionText: string
  ): Promise<boolean> => {
    if (!user || !workspaceId) return false;
    try {
      const res = await createTaskAction({
        organizationId: organizationId || workspaceId,
        workspaceId,
        title: actionText,
        description: `Generated from ${item.title} (${item.timestamp})`,
        priority: 'medium',
        status: 'todo',
        category: 'follow_up',
        assignedTo: user.uid,
        assignedToName: user.displayName || 'Me',
        entityId: item.links.entityId || (by === 'entity' ? recordId : undefined),
        dealId: item.links.dealId || (by === 'deal' ? recordId : undefined),
        dueDate: new Date().toISOString(),
        reminders: [],
        reminderSent: false,
      }, user.uid);

      if (res.success) {
        toast({ title: 'Task created successfully', description: actionText });
        return true;
      } else {
        toast({ title: 'Failed to create task', description: res.error, variant: 'destructive' });
        return false;
      }
    } catch (error) {
      toast({ title: 'Error creating task', variant: 'destructive' });
      return false;
    }
  };

  // Generate AI Brief
  const generateAiBrief = async (): Promise<void> => {
    if (!items.length || !workspaceId || !user) return;
    setIsGeneratingBrief(true);
    try {
      const timelinePayload = items.slice(0, 30).map((i) => ({
        source: i.source,
        title: i.title,
        content: i.content,
        timestamp: i.timestamp,
        sentiment: i.sentiment,
      }));

      const res = await summarizeEntityTimelineAction({
        entityName: recordName || 'Entity',
        entityType: by,
        timelineItems: timelinePayload,
        workspaceId,
        userId: user.uid,
      });

      if (res.success) {
        setAiBrief(res.data);
        toast({ title: 'AI Intelligence Brief updated' });
      } else {
        toast({ title: 'AI Brief generation failed', description: res.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error generating AI brief', variant: 'destructive' });
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  return {
    items,
    filteredItems,
    groupedItems,
    isLoading,
    filter,
    setFilter,
    aiBrief,
    isGeneratingBrief,
    generateAiBrief,
    addNote,
    togglePin,
    deleteItem,
    updateNoteContent,
    createTaskFromActionItem,
  };
}
