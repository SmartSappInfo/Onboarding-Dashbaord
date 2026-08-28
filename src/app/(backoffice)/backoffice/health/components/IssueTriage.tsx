/**
 * @fileoverview Platform Control Plane Tenant Issue Triage Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Real-time issue inspection table and support triage drawer.
 * - Supports status lifecycle progression and audit-logged notes.
 * - Touch targets >= 44px for mobile accessibility.
 */

'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  Plus,
  Send,
  User,
  Building2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import {
  listTenantIssuesAction,
  updateTenantIssueStatusAction,
  addTenantIssueNoteAction,
} from '@/lib/backoffice/backoffice-health-actions';
import type { TenantIssue, IssueStatus, IssueSeverity } from '@/lib/backoffice/backoffice-types';

const SEVERITY_BADGES: Record<IssueSeverity, string> = {
  critical: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-extrabold',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
};

const STATUS_BADGES: Record<IssueStatus, string> = {
  detected: 'bg-red-500/10 text-red-500 border-red-500/20',
  acknowledged: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  investigating: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  closed: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

export default function IssueTriage() {
  const { can } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [issues, setIssues] = React.useState<TenantIssue[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<IssueStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = React.useState<IssueSeverity | 'all'>('all');

  // Active drawer inspection state
  const [selectedIssue, setSelectedIssue] = React.useState<TenantIssue | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [newNoteText, setNewNoteText] = React.useState('');
  const [isSavingNote, setIsSavingNote] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  const fetchIssues = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await listTenantIssuesAction(
        {
          status: statusFilter,
          severity: severityFilter,
        },
        idToken
      );

      if (res.success && res.issues) {
        setIssues(res.issues);
      }
    } catch (err) {
      console.error('Failed to list tenant issues:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, statusFilter, severityFilter]);

  React.useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleSelectIssue = (issue: TenantIssue) => {
    setSelectedIssue(issue);
    setIsSheetOpen(true);
    setNewNoteText('');
  };

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!selectedIssue) return;
    setIsUpdatingStatus(true);
    try {
      const idToken = await getToken();
      const res = await updateTenantIssueStatusAction(selectedIssue.id, newStatus, idToken);
      if (res.success) {
        toast({ title: 'Status Updated', description: `Issue transitioned to ${newStatus}.` });
        setSelectedIssue({ ...selectedIssue, status: newStatus });
        fetchIssues();
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: res.error || 'Failed to update issue status.',
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update issue status.' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedIssue || !newNoteText.trim()) return;
    setIsSavingNote(true);
    try {
      const idToken = await getToken();
      const res = await addTenantIssueNoteAction(selectedIssue.id, newNoteText.trim(), idToken);
      if (res.success) {
        toast({ title: 'Note Added', description: 'Internal support note recorded.' });
        setNewNoteText('');
        fetchIssues();
        // Refresh local selected issue notes
        setSelectedIssue((prev) =>
          prev
            ? {
                ...prev,
                notes: [
                  ...prev.notes,
                  {
                    id: `note_${Date.now()}`,
                    author: {
                      userId: 'current',
                      name: 'Support Admin',
                      email: 'admin@smartsapp.com',
                      role: 'support_admin',
                    },
                    text: newNoteText.trim(),
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null
        );
      } else {
        toast({ variant: 'destructive', title: 'Note Failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to record note.' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const filteredIssues = React.useMemo(() => {
    return issues.filter((i) => {
      const matchesSearch =
        search === '' ||
        i.title.toLowerCase().includes(search.toLowerCase()) ||
        i.organizationName.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [issues, search]);

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues by title, organization, or signal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-border text-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Select
            value={severityFilter}
            onValueChange={(v) => setSeverityFilter(v as IssueSeverity | 'all')}
          >
            <SelectTrigger className="h-11 w-full sm:w-[140px] rounded-xl bg-card border-border text-xs font-semibold">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as IssueStatus | 'all')}
          >
            <SelectTrigger className="h-11 w-full sm:w-[140px] rounded-xl bg-card border-border text-xs font-semibold">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="detected">Detected</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Issues Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Scanning active tenant anomalies...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-foreground">Zero Active Anomalies</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              All multi-tenant operations, webhooks, and automation pipelines are currently operating normally.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Severity</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Tenant</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Anomaly / Issue</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Signal</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.map((issue) => (
                  <TableRow
                    key={issue.id}
                    onClick={() => handleSelectIssue(issue)}
                    className="border-border/60 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <TableCell className="py-4">
                      <Badge
                        className={`capitalize text-[10px] rounded-lg border ${
                          SEVERITY_BADGES[issue.severity] || ''
                        }`}
                      >
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-xs text-foreground">{issue.organizationName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-xs text-foreground">{issue.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-md">
                          {issue.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px] text-muted-foreground">{issue.signalType}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize text-[10px] font-bold rounded-lg border ${STATUS_BADGES[issue.status] || ''}`}>
                        {issue.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 rounded-lg text-xs font-semibold gap-1"
                      >
                        <span>Triage</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Support Triage Sliding Sheet Drawer */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md bg-card border-l border-border p-6 overflow-y-auto space-y-6">
          {selectedIssue && (
            <>
              <SheetHeader className="space-y-2 text-left">
                <div className="flex items-center justify-between gap-2">
                  <Badge className={`capitalize text-[10px] rounded-lg border ${SEVERITY_BADGES[selectedIssue.severity]}`}>
                    {selectedIssue.severity} severity
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {new Date(selectedIssue.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <SheetTitle className="text-base font-bold text-foreground">
                  {selectedIssue.title}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Tenant: <span className="font-semibold text-foreground">{selectedIssue.organizationName}</span>
                </SheetDescription>
              </SheetHeader>

              {/* Issue Description */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs leading-relaxed text-foreground/90">
                {selectedIssue.description}
              </div>

              {/* Status Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Lifecycle State</label>
                <Select
                  value={selectedIssue.status}
                  onValueChange={(val) => handleStatusChange(val as IssueStatus)}
                  disabled={!can('health', 'edit') || isUpdatingStatus}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-card border-border text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="detected">Detected</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Support Notes History */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                  Support Notes & Audit Trail
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedIssue.notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No notes added yet.</p>
                  ) : (
                    selectedIssue.notes.map((note) => (
                      <div key={note.id} className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="font-bold text-foreground">{note.author.name}</span>
                          <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-foreground/90">{note.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {can('health', 'edit') && (
                  <div className="space-y-2 pt-2">
                    <Textarea
                      placeholder="Add an internal troubleshooting note or diagnosis..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="min-h-[80px] rounded-xl bg-card border-border text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddNote}
                      disabled={isSavingNote || !newNoteText.trim()}
                      className="w-full h-10 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97] transition-all gap-1.5"
                    >
                      {isSavingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {isSavingNote ? 'Saving...' : 'Post Support Note'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
