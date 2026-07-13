'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cleanContactEmailAction, deleteContactAction } from '@/lib/automation-actions';
import { AlertTriangle, Check, Loader2, Sparkles, Trash2, Archive, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CleanContactEmailDialogProps {
  email: string;
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CleanMode = 'correct' | 'archive' | 'delete';

export function CleanContactEmailDialog({
  email,
  entityId,
  isOpen,
  onClose,
  onSuccess,
}: CleanContactEmailDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<CleanMode>('correct');
  const [replacement, setReplacement] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);

  const handleClean = async () => {
    if (mode === 'correct' && !replacement.includes('@')) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid replacement email address.',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'delete') {
      setShowConfirmDelete(true);
      return;
    }

    setLoading(true);
    try {
      const res = await cleanContactEmailAction(email, mode, replacement);
      if (res.success) {
        toast({
          title: 'Contact Cleaned',
          description: `The contact has been updated successfully.`,
        });
        onSuccess();
        onClose();
      } else {
        toast({
          title: 'Action Failed',
          description: res.error || 'Could not clean the contact.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    setShowConfirmDelete(false);
    try {
      const res = await deleteContactAction(entityId, email);
      if (res.success) {
        toast({
          title: 'Contact Deleted',
          description: res.deletedEntity
            ? 'Sole contact deleted. The entity has been completely removed.'
            : 'Contact deleted. Primary/Signatory roles transferred to remaining contacts.',
        });
        onSuccess();
        onClose();
      } else {
        toast({
          title: 'Deletion Failed',
          description: res.error || 'Could not delete the contact.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-slate-100 font-figtree p-6 rounded-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-400">
              <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
              Clean Bounced Contact
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1">
              Select an action to resolve deliverability failure for contact:
              <span className="block mt-1 font-semibold text-slate-200 break-all">{email}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <RadioGroup
              value={mode}
              onValueChange={(val) => setMode(val as CleanMode)}
              className="grid gap-3"
            >
              {/* Correct Option */}
              <div className="flex items-start space-x-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-700 transition">
                <RadioGroupItem value="correct" id="mode-correct" className="mt-1" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="mode-correct" className="font-semibold text-sm text-slate-200 cursor-pointer">
                    Correct Email Address
                  </Label>
                  <p className="text-xs text-slate-400">
                    Replace spelling mistakes, reset status, and lift suppressions.
                  </p>
                  {mode === 'correct' && (
                    <div className="pt-2">
                      <Input
                        type="email"
                        placeholder="new.email@example.com"
                        value={replacement}
                        onChange={(e) => setReplacement(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Archive Option */}
              <div className="flex items-start space-x-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-700 transition">
                <RadioGroupItem value="archive" id="mode-archive" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="mode-archive" className="font-semibold text-sm text-slate-200 cursor-pointer flex items-center gap-1.5">
                    <Archive className="h-4 w-4 text-amber-500" />
                    Archive Contact Email
                  </Label>
                  <p className="text-xs text-slate-400">
                    Mark contact status as archived to stop sending campaigns.
                  </p>
                </div>
              </div>

              {/* Delete Option */}
              <div className="flex items-start space-x-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-700 transition">
                <RadioGroupItem value="delete" id="mode-delete" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="mode-delete" className="font-semibold text-sm text-slate-200 cursor-pointer flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4 text-red-500" />
                    Delete Contact Record
                  </Label>
                  <p className="text-xs text-slate-400">
                    Remove contact from entity. Safely reassigns primary roles.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-slate-800 hover:bg-slate-800 text-slate-300 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClean}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Apply Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* High z-index confirmation modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-figtree">
          <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl max-w-sm w-full text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400 font-bold text-lg">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              Confirm Contact Deletion
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete this contact?
            </p>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300">Important safety checks:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li>Primary/Signatory roles will automatically transfer to the next contact.</li>
                <li>If this is the entity's sole contact, the entire company/entity will be permanently deleted.</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDelete(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl"
              >
                No, Go Back
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="bg-red-600 hover:bg-red-500 text-white rounded-xl"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
