'use client';

/**
 * @fileOverview Cryptographic Invitations & Bulk CSV Manager (Workforce 2.0)
 *
 * Provides single-use cryptographic invitation dispatch, delivery status tracking,
 * CSV bulk invite parser with validation preview, and token resend/revoke controls.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialogs with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Copies clean acceptance link `https://domain/accept-invitation?token=...` to clipboard.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Mail,
  Send,
  Upload,
  RefreshCw,
  Ban,
  Copy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Invitation, InvitationStatus, Role, Workspace, Department } from '@/lib/types';
import {
  dispatchInvitationsAction,
  resendInvitationAction,
  revokeInvitationAction,
  listInvitationsAction,
} from '@/app/actions/workforce-actions';

interface InvitationsManagerProps {
  roles: Role[];
  workspaces: Workspace[];
  departments: Department[];
  onRefresh?: () => void;
}

export function InvitationsManager({
  roles,
  workspaces,
  departments,
}: InvitationsManagerProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Single Invite Modal State
  const [singleModalOpen, setSingleModalOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteName, setInviteName] = React.useState('');
  const [invitePhone, setInvitePhone] = React.useState('');
  const [inviteWorkspaceId, setInviteWorkspaceId] = React.useState('');
  const [inviteRoleIds, setInviteRoleIds] = React.useState<string[]>([]);
  const [inviteDeptId, setInviteDeptId] = React.useState('none');
  const [inviteDays, setInviteDays] = React.useState(7);
  const [isSendingSingle, setIsSendingSingle] = React.useState(false);

  // CSV Bulk Modal State
  const [csvModalOpen, setCsvModalOpen] = React.useState(false);
  const [csvText, setCsvText] = React.useState('');
  const [parsedCsvRows, setParsedCsvRows] = React.useState<Array<{ email: string; name?: string; valid: boolean }>>([]);
  const [isDispatchingCsv, setIsDispatchingCsv] = React.useState(false);

  const roleOptions = roles.map((r) => ({ label: r.name, value: r.id }));

  const loadInvitations = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await listInvitationsAction({
        idToken,
        organizationId: activeOrganizationId,
      });

      if (res.success) {
        setInvitations(res.invitations);
      }
    } catch (err: unknown) {
      console.warn('[InvitationsManager] Failed to load invitations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  // Handle Single Invite Dispatch
  const handleSendSingleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!inviteEmail.trim()) {
      toast({ title: 'Validation Error', description: 'Email address is required.', variant: 'destructive' });
      return;
    }
    if (inviteRoleIds.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one role must be selected.', variant: 'destructive' });
      return;
    }

    setIsSendingSingle(true);
    try {
      const idToken = await authUser.getIdToken();
      const ws = workspaces.find((w) => w.id === inviteWorkspaceId);
      const roleNames = inviteRoleIds.map((id) => roles.find((r) => r.id === id)?.name || id);

      const res = await dispatchInvitationsAction({
        idToken,
        organizationId: activeOrganizationId,
        invites: [
          {
            email: inviteEmail.trim(),
            invitedPersonName: inviteName.trim() || undefined,
            phone: invitePhone.trim() || undefined,
            workspaceId: inviteWorkspaceId || undefined,
            workspaceName: ws?.name,
            roleIds: inviteRoleIds,
            roleNames,
            departmentId: inviteDeptId !== 'none' ? inviteDeptId : undefined,
            expiresInDays: inviteDays,
            invitedBy: authUser.uid,
          },
        ],
      });

      if (res.success && res.results.length > 0) {
        toast({
          title: 'Invitation Dispatched',
          description: `Cryptographic invitation sent to ${inviteEmail}.`,
        });
        setSingleModalOpen(false);
        setInviteEmail('');
        setInviteName('');
        setInvitePhone('');
        setInviteRoleIds([]);
        loadInvitations();
      } else {
        throw new Error(res.errors[0]?.error || 'Failed to send invitation');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dispatch failed';
      toast({ title: 'Invitation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSendingSingle(false);
    }
  };

  // Parse CSV Input
  const handleParseCsv = (text: string) => {
    setCsvText(text);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const rows = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const email = parts[0] || '';
      const name = parts[1] || undefined;
      const valid = Boolean(email.includes('@') && email.includes('.'));
      return { email, name, valid };
    });
    setParsedCsvRows(rows);
  };

  // Handle CSV Bulk Dispatch
  const handleDispatchCsv = async () => {
    if (!authUser || !activeOrganizationId) return;

    const validRows = parsedCsvRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast({ title: 'Validation Error', description: 'No valid email rows found.', variant: 'destructive' });
      return;
    }
    if (inviteRoleIds.length === 0) {
      toast({ title: 'Validation Error', description: 'Please select default roles for bulk invitees.', variant: 'destructive' });
      return;
    }

    setIsDispatchingCsv(true);
    try {
      const idToken = await authUser.getIdToken();
      const ws = workspaces.find((w) => w.id === inviteWorkspaceId);
      const roleNames = inviteRoleIds.map((id) => roles.find((r) => r.id === id)?.name || id);

      const invites = validRows.map((r) => ({
        email: r.email,
        invitedPersonName: r.name,
        workspaceId: inviteWorkspaceId || undefined,
        workspaceName: ws?.name,
        roleIds: inviteRoleIds,
        roleNames,
        departmentId: inviteDeptId !== 'none' ? inviteDeptId : undefined,
        expiresInDays: 7,
        invitedBy: authUser.uid,
      }));

      const res = await dispatchInvitationsAction({
        idToken,
        organizationId: activeOrganizationId,
        invites,
      });

      toast({
        title: 'Bulk Dispatch Completed',
        description: `Dispatched ${res.dispatchedCount} invitations successfully.`,
      });
      setCsvModalOpen(false);
      setCsvText('');
      setParsedCsvRows([]);
      loadInvitations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk dispatch failed';
      toast({ title: 'Bulk Error', description: msg, variant: 'destructive' });
    } finally {
      setIsDispatchingCsv(false);
    }
  };

  // Resend Invite
  const handleResend = async (invitationId: string, email: string) => {
    if (!authUser || !activeOrganizationId) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await resendInvitationAction({
        idToken,
        organizationId: activeOrganizationId,
        invitationId,
      });

      if (res.success && res.rawToken) {
        const acceptUrl = `${window.location.origin}/accept-invitation?token=${res.rawToken}`;
        await navigator.clipboard.writeText(acceptUrl);
        toast({
          title: 'Invitation Refreshed',
          description: `New activation link copied to clipboard for ${email}.`,
        });
        loadInvitations();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resend failed';
      toast({ title: 'Resend Failed', description: msg, variant: 'destructive' });
    }
  };

  // Revoke Invite
  const handleRevoke = async (invitationId: string, email: string) => {
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: `Revoke Invitation for ${email}?`,
      description: 'The invitation link will become immediately invalid.',
      confirmText: 'Revoke Invitation',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await revokeInvitationAction({
        idToken,
        organizationId: activeOrganizationId,
        invitationId,
      });

      if (res.success) {
        toast({ title: 'Invitation Revoked' });
        loadInvitations();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Revoke failed';
      toast({ title: 'Revoke Failed', description: msg, variant: 'destructive' });
    }
  };

  const filteredInvites = invitations.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.email.toLowerCase().includes(q) ||
      inv.invitedPersonName?.toLowerCase().includes(q) ||
      inv.workspaceName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8.5 text-xs bg-muted/20">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Invitations</SelectItem>
              <SelectItem value="sent" className="text-xs">Active / Pending</SelectItem>
              <SelectItem value="accepted" className="text-xs">Accepted</SelectItem>
              <SelectItem value="expired" className="text-xs">Expired</SelectItem>
              <SelectItem value="revoked" className="text-xs">Revoked</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search invitees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8.5 text-xs bg-muted/20 border-border"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setInviteWorkspaceId(workspaces[0]?.id || '');
              setCsvModalOpen(true);
            }}
            className="text-xs h-8.5 px-3 active:scale-[0.97]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> CSV Bulk Invite
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setInviteWorkspaceId(workspaces[0]?.id || '');
              setSingleModalOpen(true);
            }}
            className="text-xs h-8.5 px-3.5 font-semibold active:scale-[0.97]"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Invite Member
          </Button>
        </div>
      </div>

      {/* Invitations Table */}
      <Card className="border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/20 border-b">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Invitee</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">Roles & Workspace</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">Status</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">Expires</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="p-4">
                      <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredInvites.length > 0 ? (
                filteredInvites.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="pl-4 py-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-foreground block">
                          {inv.invitedPersonName || inv.email.split('@')[0]}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">{inv.email}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {inv.roleNames?.map((rn, i) => (
                            <Badge key={i} variant="outline" className="text-[9px] py-0 bg-muted/30">
                              {rn}
                            </Badge>
                          ))}
                        </div>
                        {inv.workspaceName && (
                          <span className="text-[10px] text-muted-foreground block">
                            Workspace: {inv.workspaceName}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          inv.status === 'accepted'
                            ? 'default'
                            : inv.status === 'sent'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={cn(
                          'text-[9px] font-bold uppercase tracking-wider',
                          inv.status === 'accepted' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                          inv.status === 'sent' && 'bg-blue-500/10 text-blue-600 border-blue-500/30',
                          inv.status === 'expired' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                          inv.status === 'revoked' && 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                        )}
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="text-[10px] text-muted-foreground block">
                        {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </TableCell>

                    <TableCell className="text-right pr-4">
                      {inv.status === 'sent' ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResend(inv.id, inv.email)}
                            className="text-xs h-7 px-2 active:scale-[0.97]"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Resend
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(inv.id, inv.email)}
                            className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
                          >
                            <Ban className="w-3 h-3 mr-1" /> Revoke
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Completed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                    No invitations found. Click &quot;Invite Member&quot; to send single or bulk access links.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal: Single Invite Composer */}
      <Dialog open={singleModalOpen} onOpenChange={setSingleModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <form onSubmit={handleSendSingleInvite}>
            <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
              <DialogTitle className="text-base font-semibold">Invite Team Member</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Dispatch a single-use cryptographically signed activation link
              </DialogDescription>
            </DialogHeader>

            <div className="p-5 space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Email Address</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@organization.com"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Full Name (Optional)</Label>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Sarah Doe"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Phone (Optional)</Label>
                  <Input
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+233..."
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Workspace</Label>
                  <Select value={inviteWorkspaceId} onValueChange={setInviteWorkspaceId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Workspace..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id} className="text-xs">
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Department</Label>
                  <Select value={inviteDeptId} onValueChange={setInviteDeptId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Department..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">-- None --</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Assigned Roles</Label>
                <MultiSelect
                  options={roleOptions}
                  selected={inviteRoleIds}
                  onChange={setInviteRoleIds}
                  placeholder="Select roles..."
                  className="w-full text-xs"
                />
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSingleModalOpen(false)}
                disabled={isSendingSingle}
                className="text-xs h-9 px-4 active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSendingSingle || !inviteEmail || inviteRoleIds.length === 0}
                className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
              >
                {isSendingSingle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Dispatch Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: CSV Bulk Uploader */}
      <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-card border shadow-2xl">
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <DialogTitle className="text-base font-semibold">Bulk CSV Invitation Importer</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Paste CSV records formatted as &quot;email, full_name&quot; (one per line)
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CSV Data</Label>
              <Textarea
                value={csvText}
                onChange={(e) => handleParseCsv(e.target.value)}
                placeholder="alice@company.com, Alice Brown&#10;bob@company.com, Bob Smith"
                className="text-xs font-mono min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Target Workspace</Label>
                <Select value={inviteWorkspaceId} onValueChange={setInviteWorkspaceId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Workspace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id} className="text-xs">
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Assigned Roles</Label>
                <MultiSelect
                  options={roleOptions}
                  selected={inviteRoleIds}
                  onChange={setInviteRoleIds}
                  placeholder="Default roles..."
                  className="w-full text-xs"
                />
              </div>
            </div>

            {/* Validation Preview */}
            {parsedCsvRows.length > 0 && (
              <div className="p-3 rounded-xl border bg-muted/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Import Preview</span>
                  <Badge variant="outline" className="text-[10px]">
                    {parsedCsvRows.filter((r) => r.valid).length} Valid / {parsedCsvRows.filter((r) => !r.valid).length} Invalid
                  </Badge>
                </div>
                <div className="max-h-32 overflow-y-auto divide-y">
                  {parsedCsvRows.slice(0, 10).map((r, i) => (
                    <div key={i} className="py-1 flex items-center justify-between text-[11px]">
                      <span className="truncate">{r.email} ({r.name || 'No name'})</span>
                      {r.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCsvModalOpen(false)}
              disabled={isDispatchingCsv}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDispatchCsv}
              disabled={isDispatchingCsv || parsedCsvRows.filter((r) => r.valid).length === 0 || inviteRoleIds.length === 0}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isDispatchingCsv ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Processing Bulk Dispatches...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Dispatch {parsedCsvRows.filter((r) => r.valid).length} Invites
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InvitationsManager;
