'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  MoreHorizontal,
  Eye,
  Pause,
  Play,
  AlertTriangle,
  Plus,
  Users,
  Layers,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listAllOrganizations, suspendOrganization, restoreOrganization } from '@/lib/backoffice/backoffice-org-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { Organization } from '@/lib/types';

// ─────────────────────────────────────────────────
// Organization List Client
// Data table with filtering, sorting, and row actions.
// ─────────────────────────────────────────────────

type OrgWithStats = Organization & {
  workspaceCount: number;
  userCount: number;
  activeUsers: number;
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  trial: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

export default function OrgListClient() {
  const { can, profile } = useBackoffice();
  const [orgs, setOrgs] = React.useState<OrgWithStats[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  React.useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    setIsLoading(true);
    const result = await listAllOrganizations();
    if (result.success && result.data) {
      setOrgs(result.data);
    }
    setIsLoading(false);
  }

  // Filter orgs by search and status
  const filteredOrgs = React.useMemo(() => {
    return orgs.filter((org) => {
      const matchesSearch =
        !search ||
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.slug?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || (org.status || 'active') === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orgs, search, statusFilter]);

  async function handleSuspend(orgId: string) {
    if (!profile) return;
    const reason = prompt('Enter suspension reason:');
    if (!reason) return;

    const result = await suspendOrganization(orgId, reason, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadOrgs();
  }

  async function handleRestore(orgId: string) {
    if (!profile) return;
    const result = await restoreOrganization(orgId, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadOrgs();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Organizations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all platform organizations and their configurations.
          </p>
        </div>
        {can('organizations', 'create') ? (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4 cursor-pointer"
            aria-label="Create new organization"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Organization
          </Button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center"
        >
          {filteredOrgs.length} organization{filteredOrgs.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Organization
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Status
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                <Layers className="h-3.5 w-3.5 inline mr-1" />
                Workspaces
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                <Users className="h-3.5 w-3.5 inline mr-1" />
                Users
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Created
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-accent animate-pulse" />
                      <div>
                        <div className="h-4 w-32 bg-accent rounded animate-pulse" />
                        <div className="h-3 w-20 bg-accent/60 rounded animate-pulse mt-1" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><div className="h-5 w-16 bg-accent rounded-full animate-pulse" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 w-6 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 w-6 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-accent rounded animate-pulse" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filteredOrgs.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <Building2 className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No organizations found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrgs.map((org) => (
                <TableRow
                  key={org.id}
                  className="border-border hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <TableCell>
                    <Link
                      href={`/backoffice/organizations/${org.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{org.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{org.slug}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-bold px-2 h-5 ${STATUS_COLORS[org.status || 'active']}`}
                    >
                      {org.status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-foreground/80 font-semibold">
                    {org.workspaceCount}
                  </TableCell>
                  <TableCell className="text-center text-sm text-foreground/80 font-semibold">
                    {org.activeUsers}/{org.userCount}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {org.createdAt
                      ? new Date(org.createdAt).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={`Actions for ${org.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-muted border-border rounded-xl"
                      >
                        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                          <Link href={`/backoffice/organizations/${org.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {can('organizations', 'edit') ? (
                          <>
                            <DropdownMenuSeparator className="bg-accent" />
                            {org.status === 'suspended' ? (
                              <DropdownMenuItem
                                onClick={() => handleRestore(org.id)}
                                className="cursor-pointer rounded-lg text-emerald-400 focus:text-emerald-400"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleSuspend(org.id)}
                                className="cursor-pointer rounded-lg text-red-400 focus:text-red-400"
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
