import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Automation, AutomationTriggerDef } from '@/lib/types';
import {
  getAutomationBackup,
  saveAutomationBackup,
  clearAutomationBackup,
  AutomationBackup,
} from '@/lib/automation-storage';

interface FunctionalSnapshotInput {
  name?: string;
  description?: string;
  triggers?: AutomationTriggerDef[];
  nodes?: Array<{ id: string; type?: string; data?: Record<string, unknown> }>;
  edges?: Array<{ id: string; source?: string; target?: string; sourceHandle?: string | null; targetHandle?: string | null; type?: string }>;
}

/**
 * Normalizes automation blueprint state to compare functional equivalence.
 */
function getFunctionalSnapshot(data: FunctionalSnapshotInput | null | undefined) {
  if (!data) return null;
  return {
    name: data.name || '',
    description: data.description || '',
    triggers: data.triggers ?? [],
    edges: data.edges?.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
    })) ?? [],
    nodes: data.nodes?.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data,
    })) ?? [],
  };
}

export function useAutomationAutosave(
  automationId: string,
  currentData: Partial<Automation>,
  automation: Automation | undefined,
  isDirty: boolean
) {
  const { toast } = useToast();
  const [showRestoreDialog, setShowRestoreDialog] = React.useState(false);
  const [backupData, setBackupData] = React.useState<AutomationBackup | null>(null);
  const [builderKey, setBuilderKey] = React.useState(0);
  const [hasPromptedRestore, setHasPromptedRestore] = React.useState(false);

  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = React.useRef(false);

  /**
   * Immediately cancels any pending autosave timer and purges local storage backups.
   * MUST be invoked upon manual save completion.
   */
  const clearAutosave = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    clearAutomationBackup(automationId);
    setBackupData(null);
    setShowRestoreDialog(false);
  }, [automationId]);

  // 1. Scan for backup on initial mount (after doc loads)
  React.useEffect(() => {
    if (!automation || hasPromptedRestore) return;

    const backup = getAutomationBackup(automationId);
    if (backup) {
      const backupTime = new Date(backup.timestamp).getTime();
      const dbTime = automation.updatedAt ? new Date(automation.updatedAt).getTime() : 0;

      // Strict Timestamp Invariant:
      // Under no circumstance should an autosave record be equal to or older than the saved record.
      if (backupTime <= dbTime) {
        clearAutomationBackup(automationId);
        setHasPromptedRestore(true);
        return;
      }

      // Check if backup has functional differences from DB version
      const backupSnap = JSON.stringify(getFunctionalSnapshot(backup));
      const dbSnap = JSON.stringify(getFunctionalSnapshot(automation));

      // Only offer recovery if backup is newer than DB version AND has functional differences
      if (backupTime > dbTime && backupSnap !== dbSnap) {
        setBackupData(backup);
        setShowRestoreDialog(true);
      } else {
        // Automatically prune stale or identical backup
        clearAutomationBackup(automationId);
      }
    }
    setHasPromptedRestore(true);
  }, [automation, automationId, hasPromptedRestore]);

  // 2. Debounced Autosave Effect
  React.useEffect(() => {
    if (!automation || automation.isArchived || isRestoringRef.current) return;

    // Only autosave if there are unsaved (dirty) changes
    if (!isDirty) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveAutomationBackup(automationId, {
        name: currentData.name ?? automation.name,
        description: currentData.description ?? automation.description ?? '',
        triggers: currentData.triggers ?? automation.triggers ?? [],
        nodes: (currentData.nodes as Record<string, unknown>[]) ?? (automation.nodes as Record<string, unknown>[]) ?? [],
        edges: (currentData.edges as Record<string, unknown>[]) ?? (automation.edges as Record<string, unknown>[]) ?? [],
        dbUpdatedAt: automation.updatedAt,
      });
    }, 1000); // 1-second debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentData, automation, isDirty, automationId]);

  const handleRestore = React.useCallback(
    (onRestore: (data: Partial<Automation>) => void) => {
      if (!backupData) return;

      isRestoringRef.current = true;

      // Pass restored data to parent page's state setter callback
      onRestore({
        name: backupData.name,
        description: backupData.description,
        triggers: backupData.triggers,
        nodes: backupData.nodes as unknown as Automation['nodes'],
        edges: backupData.edges as unknown as Automation['edges'],
      });

      // Increment visual canvas key to trigger a clean React Flow remount
      setBuilderKey((prev) => prev + 1);
      setShowRestoreDialog(false);

      toast({
        title: 'Workflow Recovered',
        description: 'Your unsaved progress has been restored from your local backup.',
      });

      // Allow autosaving to resume on subsequent edits
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 200);
    },
    [backupData, toast]
  );

  const handleDiscard = React.useCallback(() => {
    clearAutomationBackup(automationId);
    setShowRestoreDialog(false);
    setBackupData(null);
    toast({
      title: 'Backup Discarded',
      description: 'The local backup was removed. Using the database version.',
    });
  }, [automationId, toast]);

  return {
    showRestoreDialog,
    setShowRestoreDialog,
    backupData,
    builderKey,
    handleRestore,
    handleDiscard,
    clearAutosave,
  };
}
