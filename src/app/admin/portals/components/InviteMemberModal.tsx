'use client';

/**
 * {{Org_name}} Experience Platform — Invite Member Modal Wizard
 *
 * Supports single email invitations, bulk CSV/email lists, and shareable
 * multi-use invite links with configurable roles, tiers, and expiration.
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  createInvitationAction,
  createBulkInvitationsAction,
} from '@/app/actions/membership-actions';
import type { PortalMemberRole, MembershipPlan } from '@/lib/types/membership';
import { Mail, Link2, Users, Copy, Check, Sparkles, Loader2 } from 'lucide-react';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds: string[];
  plans?: MembershipPlan[];
  onInvited?: () => void;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  portalId,
  portalSlug,
  organizationId,
  workspaceIds,
  plans = [],
  onInvited,
}: InviteMemberModalProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('single');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form states
  const [email, setEmail] = React.useState('');
  const [bulkEmails, setBulkEmails] = React.useState('');
  const [role, setRole] = React.useState<PortalMemberRole>('member');
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>('none');
  const [maxUses, setMaxUses] = React.useState<number>(100);
  const [expirationDays, setExpirationDays] = React.useState<number>(30);
  const [note, setNote] = React.useState('');

  // Generated Link result
  const [generatedLink, setGeneratedLink] = React.useState<string | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCreateSingle = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please provide a valid member email.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const res = await createInvitationAction({
        portalId,
        organizationId,
        workspaceIds,
        email: email.trim().toLowerCase(),
        role,
        planId: selectedPlanId !== 'none' ? selectedPlanId : undefined,
        maxUses: 1,
        expiresAt: expiresAt.toISOString(),
        note: note || undefined,
      });

      if (!res.success || !res.data) throw new Error(res.error || 'Failed to send invite.');

      const link = `${window.location.origin}/portal/${portalSlug}/join?token=${res.data.token}`;
      setGeneratedLink(link);
      toast({ title: 'Invitation Created! 🎉', description: `Invite link generated for ${email}.` });
      onInvited?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Invitation failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBulk = async () => {
    const rawList = bulkEmails
      .split(/[\n,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (rawList.length === 0) {
      toast({ title: 'No Emails Found', description: 'Enter valid email addresses separated by commas or lines.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createBulkInvitationsAction(
        portalId,
        organizationId,
        workspaceIds,
        rawList,
        role,
        selectedPlanId !== 'none' ? selectedPlanId : undefined
      );

      if (!res.success || !res.data) throw new Error(res.error || 'Bulk invitation failed.');

      toast({ title: 'Bulk Invitations Created! 🚀', description: `Generated ${res.data.length} invitations.` });
      onInvited?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Bulk invite failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateShareableLink = async () => {
    setIsSubmitting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const res = await createInvitationAction({
        portalId,
        organizationId,
        workspaceIds,
        role,
        planId: selectedPlanId !== 'none' ? selectedPlanId : undefined,
        maxUses,
        expiresAt: expiresAt.toISOString(),
        note: note || 'Shareable portal join link',
      });

      if (!res.success || !res.data) throw new Error(res.error || 'Failed to generate link.');

      const link = `${window.location.origin}/portal/${portalSlug}/join?token=${res.data.token}`;
      setGeneratedLink(link);
      toast({ title: 'Shareable Link Ready! 🔗', description: 'Invite link is ready to copy and share.' });
      onInvited?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Link generation failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setIsCopied(true);
    toast({ title: 'Copied to Clipboard!', description: 'Link copied to clipboard.' });
    setTimeout(() => setIsCopied(false), 2500);
  };

  const resetForm = () => {
    setGeneratedLink(null);
    setEmail('');
    setBulkEmails('');
    setNote('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={val => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-xl rounded-3xl p-6 sm:p-8 space-y-4 border-2 border-border shadow-2xl">
        <DialogHeader className="space-y-1 pb-2 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Users className="w-4 h-4" /> Onboard Members
          </div>
          <DialogTitle className="text-xl font-bold">Invite Members & Students</DialogTitle>
          <DialogDescription className="text-xs">
            Generate secure single-use or multi-use invitation links with automatic role and tier provisioning.
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4 py-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                <Check className="w-4 h-4" /> Invite Link Generated Successfully
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with your member. Upon clicking, they will be registered and granted their role.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={generatedLink}
                readOnly
                className="h-11 font-mono text-xs bg-muted/50 rounded-xl"
              />
              <Button
                onClick={handleCopy}
                className="h-11 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shrink-0"
              >
                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {isCopied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={resetForm}
                className="rounded-xl font-bold text-xs w-full"
              >
                Invite Another Member
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full h-10 p-1 bg-muted/60 rounded-xl grid grid-cols-3">
                <TabsTrigger value="single" className="rounded-lg text-xs font-bold gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Single Email
                </TabsTrigger>
                <TabsTrigger value="bulk" className="rounded-lg text-xs font-bold gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Bulk Import
                </TabsTrigger>
                <TabsTrigger value="shareable" className="rounded-lg text-xs font-bold gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Shareable Link
                </TabsTrigger>
              </TabsList>

              {/* ── Common Role & Tier Configuration ─────────────────── */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Assigned Role</Label>
                  <Select value={role} onValueChange={(r: PortalMemberRole) => setRole(r)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="member">Standard Member</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="content_editor">Content Editor</SelectItem>
                      <SelectItem value="admin">Portal Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Membership Tier</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Default / Free" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">No Specific Plan (Default)</SelectItem>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.price > 0 ? `${p.currency} ${p.price}` : 'Free'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Tab 1: Single Email ────────────────────────────────── */}
              <TabsContent value="single" className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Recipient Email</Label>
                  <Input
                    placeholder="student@example.com"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Admin Note / Cohort Reference</Label>
                  <Input
                    placeholder="e.g. Spring 2026 Batch"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    onClick={handleCreateSingle}
                    disabled={isSubmitting || !email.trim()}
                    className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Generate Individual Invite Link
                  </Button>
                </DialogFooter>
              </TabsContent>

              {/* ── Tab 2: Bulk CSV ───────────────────────────────────── */}
              <TabsContent value="bulk" className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Paste Email Addresses</Label>
                  <Textarea
                    placeholder="john@example.com&#10;sarah@example.com&#10;david@example.com"
                    value={bulkEmails}
                    onChange={e => setBulkEmails(e.target.value)}
                    className="rounded-xl text-xs min-h-[110px] font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Separate multiple emails with new lines, commas, or semicolons.
                  </p>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    onClick={handleCreateBulk}
                    disabled={isSubmitting || !bulkEmails.trim()}
                    className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    Generate Bulk Invites
                  </Button>
                </DialogFooter>
              </TabsContent>

              {/* ── Tab 3: Shareable Multi-use Link ─────────────────────── */}
              <TabsContent value="shareable" className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Max Uses / Seats</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      value={maxUses}
                      onChange={e => setMaxUses(parseInt(e.target.value) || 1)}
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Expires In (Days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={expirationDays}
                      onChange={e => setExpirationDays(parseInt(e.target.value) || 30)}
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Note / Campaign Tag</Label>
                  <Input
                    placeholder="e.g. WhatsApp Broadcast Link"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    onClick={handleCreateShareableLink}
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Generate Multi-Use Link
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
