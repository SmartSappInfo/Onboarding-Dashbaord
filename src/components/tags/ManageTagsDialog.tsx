'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TagSelector } from "./TagSelector";

interface ManageTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName: string;
  currentTagIds: string[];
  contactType?: 'school' | 'prospect' | 'workspace_entity' | 'entity';
  onTagsChange?: (newTagIds: string[]) => void;
}

export function ManageTagsDialog({
  open,
  onOpenChange,
  entityId,
  entityName,
  currentTagIds,
  contactType = 'workspace_entity',
  onTagsChange,
}: ManageTagsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl max-w-md">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="font-semibold">Manage Tags</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {entityName}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <TagSelector
          contactId={entityId}
          contactType={contactType}
          currentTagIds={currentTagIds}
          onTagsChange={onTagsChange}
        />
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl" onClick={() => onOpenChange(false)}>Done</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
