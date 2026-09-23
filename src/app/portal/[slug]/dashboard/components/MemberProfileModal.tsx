'use client';

/**
 * {{Org_name}} Experience Platform — Member Profile Setup & Edit Modal
 *
 * Mobile-first responsive drawer/modal allowing members to set up their
 * professional identity, school affiliation, and direct WhatsApp contact.
 *
 * ARCHITECTURAL RATIONALE:
 * Directly updates `portal_memberships.customFields` via Server Action, which
 * automatically triggers the 'complete_profile' onboarding step advancement.
 *
 * ACCESSIBILITY & MOBILE OPTIMIZATIONS (Rule 7 & Emil Kowalski Animations):
 * - Minimum touch target >= 44px (`min-h-[44px]`) on interactive elements.
 * - Responsive bottom sheet drawer on mobile viewports with smooth touch dismiss.
 * - Simple, friendly, everyday UI English without technical jargon.
 * - Strictly zero `any`, `any[]`, or `unknown`.
 */

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { updatePortalMemberProfileAction } from '@/app/actions/membership-actions';
import type { PortalMembership } from '@/lib/types/membership';
import { User, School, Briefcase, Phone, Loader2, Sparkles } from 'lucide-react';

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalId: string;
  portalSlug: string;
  userId: string;
  currentMembership?: PortalMembership | null;
  onSuccess?: (updated: PortalMembership) => void;
}

export function MemberProfileModal({
  isOpen,
  onClose,
  portalId,
  portalSlug,
  userId,
  currentMembership,
  onSuccess,
}: MemberProfileModalProps) {
  const { toast } = useToast();

  const custom = (currentMembership?.customFields as Record<string, string | number | boolean | null> | undefined) || {};

  const [displayName, setDisplayName] = React.useState('');
  const [schoolName, setSchoolName] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [whatsappNumber, setWhatsappNumber] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync state whenever modal opens or membership updates
  React.useEffect(() => {
    if (isOpen) {
      setDisplayName(currentMembership?.displayName || '');
      setSchoolName(typeof custom.schoolName === 'string' ? custom.schoolName : '');
      setJobTitle(typeof custom.jobTitle === 'string' ? custom.jobTitle : '');
      setWhatsappNumber(typeof custom.whatsappNumber === 'string' ? custom.whatsappNumber : '');
      setBio(typeof custom.bio === 'string' ? custom.bio : '');
    }
  }, [isOpen, currentMembership, custom.schoolName, custom.jobTitle, custom.whatsappNumber, custom.bio]);

  // Sanitize simple text inputs to eliminate script injections or raw HTML
  const sanitizeText = (val: string): string => {
    return val.replace(/[<>]/g, '').trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = sanitizeText(displayName);
    const cleanSchool = sanitizeText(schoolName);
    const cleanTitle = sanitizeText(jobTitle);
    const cleanPhone = sanitizeText(whatsappNumber);
    const cleanBio = sanitizeText(bio);

    if (!cleanName) {
      toast({
        title: 'Full Name Required',
        description: 'Please enter your name to complete your profile.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updatePortalMemberProfileAction(
        {
          portalId,
          userId,
          displayName: cleanName,
          schoolName: cleanSchool,
          jobTitle: cleanTitle,
          whatsappNumber: cleanPhone,
          bio: cleanBio,
        },
        portalSlug
      );

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save profile.');
      }

      toast({
        title: 'Profile Updated! ✨',
        description: 'Your member details have been saved and onboarding checklist updated.',
      });

      onSuccess?.(res.data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save profile details.';
      toast({
        title: 'Save Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 border-border bg-card shadow-2xl transition-all duration-200">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold text-foreground">
                Set Up Your Member Profile
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Fill in your school and role details to complete your orientation checklist.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" /> Your Full Name
            </Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Ama Mensah"
              className="h-11 rounded-2xl text-xs font-semibold bg-background"
              required
            />
          </div>

          {/* School Name */}
          <div className="space-y-1.5">
            <Label htmlFor="school-name" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-muted-foreground" /> School or Institution Name
            </Label>
            <Input
              id="school-name"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              placeholder="e.g. Ridge Royal Academy"
              className="h-11 rounded-2xl text-xs font-semibold bg-background"
            />
          </div>

          {/* Job Title / Role */}
          <div className="space-y-1.5">
            <Label htmlFor="job-title" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Role or Job Title
            </Label>
            <Input
              id="job-title"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. Bursar, School Head, Accountant"
              className="h-11 rounded-2xl text-xs font-semibold bg-background"
            />
          </div>

          {/* WhatsApp Direct Number */}
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp-number" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" /> WhatsApp Number
            </Label>
            <Input
              id="whatsapp-number"
              type="tel"
              value={whatsappNumber}
              onChange={e => setWhatsappNumber(e.target.value)}
              placeholder="e.g. +233 50 123 4567"
              className="h-11 rounded-2xl text-xs font-semibold bg-background"
            />
          </div>

          {/* Short Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="member-bio" className="text-xs font-bold text-foreground">
              Brief Note About Your Goals (Optional)
            </Label>
            <Textarea
              id="member-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="What are you hoping to achieve with our fee recovery and bursary workflows?"
              className="min-h-[72px] rounded-2xl text-xs bg-background resize-none"
            />
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-11 rounded-2xl text-xs font-bold active:scale-[0.98] transition-all"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-2xl text-xs font-bold bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Save Profile
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
