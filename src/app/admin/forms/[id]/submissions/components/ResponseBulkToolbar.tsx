'use client';

/**
 * SmartSapp Forms 2.0: Response Center Floating Bulk Actions Toolbar
 * 
 * Renders an elevated floating toolbar when rows are selected, supporting
 * batch qualification, CSV export, and batch deletion with confirmation.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  UserCheck, 
  XCircle, 
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SubmissionStatus } from '@/lib/forms/form-response-types';

interface ResponseBulkToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkStatusChange: (status: SubmissionStatus) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onBulkExport: () => void;
  isProcessing?: boolean;
}

export default function ResponseBulkToolbar({
  selectedCount,
  onClearSelection,
  onBulkStatusChange,
  onBulkDelete,
  onBulkExport,
  isProcessing = false,
}: ResponseBulkToolbarProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-primary/30 shadow-2xl rounded-3xl p-2 px-4 flex items-center gap-3 pointer-events-auto max-w-xl w-full justify-between">
            {/* Selected Count & Clear */}
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-extrabold">
                {selectedCount}
              </span>
              <span className="text-xs font-bold text-foreground">
                Selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-7 px-2 text-[11px] rounded-lg text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Mark Status Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    className="h-9 text-xs font-bold rounded-2xl gap-1.5 min-h-[44px] sm:min-h-0"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Mark Status</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl w-48">
                  <DropdownMenuLabel className="text-xs">Update Qualification</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onBulkStatusChange('qualified')} className="text-xs font-bold text-emerald-600 gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Qualified
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkStatusChange('contacted')} className="text-xs font-semibold gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-cyan-500" /> Mark Contacted
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkStatusChange('converted')} className="text-xs font-semibold gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-purple-500" /> Mark Converted
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkStatusChange('needs_review')} className="text-xs font-semibold gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Needs Review
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onBulkStatusChange('rejected')} className="text-xs font-semibold text-rose-600 gap-2">
                    <XCircle className="h-3.5 w-3.5" /> Reject Responses
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Export Selected CSV */}
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkExport}
                disabled={isProcessing}
                className="h-9 text-xs font-bold rounded-2xl gap-1.5 min-h-[44px] sm:min-h-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>

              {/* Bulk Delete */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isProcessing}
                className="h-9 text-xs font-bold rounded-2xl gap-1.5 min-h-[44px] sm:min-h-0"
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Delete {selectedCount} Submissions?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently remove the {selectedCount} selected submissions from this form. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsDeleteDialogOpen(false);
                await onBulkDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl font-bold"
            >
              Confirm Bulk Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
