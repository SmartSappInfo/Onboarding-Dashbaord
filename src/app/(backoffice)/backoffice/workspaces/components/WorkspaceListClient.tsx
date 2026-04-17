'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Layers,
  Search,
  MoreHorizontal,
  Eye,
  Archive,
  RotateCcw,
  Users,
  Building2,
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
import { 
  listAllWorkspaces, 
  type BackofficeWorkspace,
  archiveWorkspaceFromBackoffice,
  restoreWorkspaceFromBackoffice
} from '@/lib/backoffice/backoffice-workspace-actions';
import { useBackoffice } from '../../context/BackofficeProvider';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

const SCOPE_COLORS: Record<string, string> = {
  institution: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  family: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  person: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

export default function WorkspaceListClient() {
  const { can, profile } = useBackoffice();
  const [workspaces, setWorkspaces] = React.useState<BackofficeWorkspace[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  React.useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    setIsLoading(true);
    const result = await listAllWorkspaces();
    if (result.success && result.data) {
      setWorkspaces(result.data);
    }
    setIsLoading(false);
  }

  // Filter workspaces
  const filteredWorkspaces = React.useMemo(() => {
    return workspaces.filter((ws) => {
      const matchesSearch =
        !search ||
        ws.name.toLowerCase().includes(search.toLowerCase()) ||
        ws.organizationName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || (ws.status || 'active') === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [workspaces, search, statusFilter]);

  async function handleArchive(workspaceId: string) {
    if (!profile) return;
    if (!confirm('Are you sure you want to archive this workspace?')) return;
    
    const result = await archiveWorkspaceFromBackoffice(workspaceId, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadWorkspaces();
  }

  async function handleRestore(workspaceId: string) {
    if (!profile) return;
    const result = await restoreWorkspaceFromBackoffice(workspaceId, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadWorkspaces();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Workspaces
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all operational workspaces across organizations.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces or organizations..."
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
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center"
        >
          {filteredWorkspaces.length} workspace{filteredWorkspaces.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Workspace
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Organization
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Scope & Status
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
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><div className="h-4 w-24 bg-accent rounded animate-pulse" /></TableCell>
                  <TableCell>
                     <div className="flex gap-2">
                       <div className="h-5 w-16 bg-accent rounded-full animate-pulse" />
                       <div className="h-5 w-16 bg-accent rounded-full animate-pulse" />
                     </div>
                  </TableCell>
                  <TableCell className="text-center"><div className="h-4 w-6 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-accent rounded animate-pulse" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filteredWorkspaces.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <Layers className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No workspaces found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredWorkspaces.map((ws) => (
                <TableRow
                  key={ws.id}
                  className="border-border hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <TableCell>
                    <Link
                      href={`/backoffice/workspaces/${ws.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Layers className="h-4 w-4 text-blue-400" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{ws.name}</p>
                    </Link>
                  </TableCell>
                  <TableCell>
                     <Link
                      href={`/backoffice/organizations/${ws.organizationId}`}
                      className="flex items-center gap-2 hover:text-foreground text-foreground/80 transition-colors"
                     >
                       <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                       <span className="text-sm">{ws.organizationName}</span>
                     </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-bold px-2 h-5 ${SCOPE_COLORS[ws.contactScope || 'institution'] || SCOPE_COLORS.institution}`}
                      >
                        {ws.contactScope || 'unknown'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-bold px-2 h-5 ${STATUS_COLORS[ws.status || 'active']}`}
                      >
                        {ws.status || 'active'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-foreground/80 font-semibold">
                    {ws.userCount}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ws.createdAt
                      ? new Date(ws.createdAt).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={`Actions for ${ws.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-muted border-border rounded-xl"
                      >
                        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                          <Link href={`/backoffice/workspaces/${ws.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {can('workspaces', 'edit') ? (
                          <>
                            <DropdownMenuSeparator className="bg-accent" />
                            {ws.status === 'archived' ? (
                              <DropdownMenuItem
                                onClick={() => handleRestore(ws.id)}
                                className="cursor-pointer rounded-lg text-emerald-400 focus:text-emerald-400"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleArchive(ws.id)}
                                className="cursor-pointer rounded-lg text-red-400 focus:text-red-400"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
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
