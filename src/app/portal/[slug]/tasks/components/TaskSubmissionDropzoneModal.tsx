'use client';

/**
 * {{Org_name}} Experience Platform — Task Submission Dropzone Modal
 *
 * Polished file upload dropzone modal for learners submitting practical deliverables,
 * spreadsheets, documents, and assignment notes for instructor evaluation.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Direct Firebase Storage client-side upload (eliminating 413 Payload Too Large on Server Actions)
 * - Actionable toast with relative path navigation
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import { useAuth } from '@/firebase';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { submitTaskAction } from '@/app/actions/engagement-actions';
import type { MemberTask, TaskSubmission } from '@/lib/types/engagement';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  UploadCloud,
  FileText,
  X,
  Loader2,
  Award,
  AlertCircle,
} from 'lucide-react';

interface TaskSubmissionDropzoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MemberTask | null;
  portalId: string;
  portalSlug: string;
  userId: string;
  existingSubmission?: TaskSubmission | null;
  onSuccess?: () => void;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function TaskSubmissionDropzoneModal({
  open,
  onOpenChange,
  task,
  portalId,
  portalSlug,
  userId,
  existingSubmission,
  onSuccess,
}: TaskSubmissionDropzoneModalProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string>('');
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Initialize state when modal opens or existing submission changes
  React.useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setExistingFileUrl(existingSubmission?.submittedFileUrl || null);
      setNotes(existingSubmission?.notes || '');
      setUploadProgress(null);
      setErrorMessage(null);
    }
  }, [open, existingSubmission]);

  const handleFileChange = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('File size exceeds the 20MB limit. Please upload a smaller file.');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    if (task.requireFileUpload && !selectedFile && !existingFileUrl) {
      setErrorMessage('Please upload a file deliverable to complete this assignment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalFileUrl = existingFileUrl || undefined;
      let finalFileName = existingSubmission?.submittedFileName || 'deliverable.pdf';
      let finalFileSize = existingSubmission?.submittedFileSizeBytes || 0;

      // Direct Firebase Storage Client Upload: bypasses Next.js 1MB Server Action limit
      if (selectedFile) {
        setUploadProgress(0);
        const storage = getStorage();
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `portals/${portalId}/submissions/${userId}/${task.id}/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, selectedFile, {
          contentType: selectedFile.type || undefined,
        });

        finalFileUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            snapshot => {
              if (snapshot.totalBytes > 0) {
                const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setUploadProgress(pct);
              }
            },
            reject,
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadUrl);
              } catch (urlErr) {
                reject(urlErr);
              }
            }
          );
        });

        finalFileName = selectedFile.name;
        finalFileSize = selectedFile.size;
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Please sign in again to submit.');
      const res = await submitTaskAction(
        idToken,
        {
          portalId,
          taskId: task.id,
          notes: notes.trim() || undefined,
          submittedFileUrl: finalFileUrl,
          submittedFileName: finalFileName,
          submittedFileSizeBytes: finalFileSize,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);

      // Actionable error & toast navigation complying with Workspace Rules (safe relative path)
      toast({
        title: 'Assignment Submitted! 🚀',
        description: 'Your deliverable has been uploaded and submitted for instructor evaluation.',
        actionConfig: {
          path: `/portal/${portalSlug}/tasks`,
          label: 'View Tasks',
        },
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit assignment.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <UploadCloud className="w-4 h-4" />
              Assignment Deliverable
            </div>
            {task && (
              <Badge variant="secondary" className="font-bold text-xs gap-1 text-primary">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                +{task.pointsReward} Points
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl font-black">
            {existingSubmission?.reviewStatus === 'rejected'
              ? 'Re-submit Assignment'
              : 'Submit Assignment'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {task ? task.title : 'Upload your completed deliverable for review.'}
          </DialogDescription>
        </DialogHeader>

        {/* Prior feedback note if revision requested */}
        {existingSubmission?.reviewStatus === 'rejected' && existingSubmission.instructorFeedback && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Instructor Revision Request:
            </div>
            <p className="italic leading-relaxed pl-5">
              &ldquo;{existingSubmission.instructorFeedback}&rdquo;
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* File Dropzone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Deliverable File {task?.requireFileUpload && <span className="text-rose-500">*</span>}
            </Label>

            {selectedFile || (existingFileUrl && existingSubmission?.submittedFileName) ? (
              <div className="p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {selectedFile ? selectedFile.name : existingSubmission?.submittedFileName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedFile
                        ? formatBytes(selectedFile.size)
                        : existingSubmission?.submittedFileSizeBytes
                        ? formatBytes(existingSubmission.submittedFileSizeBytes)
                        : 'Attached File'}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSelectedFile(null);
                    setExistingFileUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-500 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                  title="Remove File"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all space-y-2 ${
                  isDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-border/80 hover:border-primary/50 hover:bg-muted/10 bg-card'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.png,.jpg,.jpeg"
                />
                <UploadCloud className="w-8 h-8 mx-auto text-primary/70" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    PDF, Excel, Word, CSV, ZIP, or Image (Max 20MB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {uploadProgress !== null && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between text-xs font-bold text-primary">
                <span>Uploading Deliverable...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2 rounded-full" />
            </div>
          )}

          {/* Member Notes / Comments */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Notes for Reviewer (Optional)
            </Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any context, links, or notes regarding your submission..."
              rows={3}
              disabled={isSubmitting}
              className="text-xs rounded-xl resize-none"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-xs w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 w-full sm:w-auto min-h-[44px] active:scale-[0.97] gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadProgress !== null ? `Uploading (${uploadProgress}%)...` : 'Submitting...'}
                </>
              ) : existingSubmission?.reviewStatus === 'rejected' ? (
                'Re-submit for Review'
              ) : (
                'Submit Assignment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
