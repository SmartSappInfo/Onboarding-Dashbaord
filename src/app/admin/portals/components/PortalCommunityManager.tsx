'use client';

/**
 * {{Org_name}} Experience Platform — Portal Community Manager
 *
 * Visual studio management component for Community spaces, discussion channels,
 * visibility policies, and user moderation queue.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  deleteSpaceAction,
  listSpacesByPortalAction,
  listModerationReportsAction,
} from '@/app/actions/community-actions';
import type { CommunitySpace, ModerationReport } from '@/lib/types/community';
import { CreateSpaceModal } from './CreateSpaceModal';
import {
  MessageSquare,
  Plus,
  Search,
  MoreVertical,
  ShieldAlert,
  Edit,
  Trash2,
  ExternalLink,
  Lock,
  Globe,
  Sparkles,
  Users,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface PortalCommunityManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
}

export function PortalCommunityManager({
  portalId,
  portalSlug,
  organizationId,
  workspaceIds = ['onboarding'],
}: PortalCommunityManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('spaces');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingSpace, setEditingSpace] = React.useState<CommunitySpace | null>(null);
  const [serverSpaces, setServerSpaces] = React.useState<CommunitySpace[]>([]);
  const [serverReports, setServerReports] = React.useState<ModerationReport[]>([]);
  const [isLoadingServer, setIsLoadingServer] = React.useState(true);

  const fetchServerCommunityData = React.useCallback(async () => {
    if (!portalId) return;
    try {
      setIsLoadingServer(true);
      const [spacesRes, reportsRes] = await Promise.all([
        listSpacesByPortalAction(portalId),
        listModerationReportsAction(portalId),
      ]);
      if (spacesRes.success && spacesRes.data) {
        setServerSpaces(spacesRes.data);
      }
      if (reportsRes.success && reportsRes.data) {
        setServerReports(reportsRes.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingServer(false);
    }
  }, [portalId]);

  React.useEffect(() => {
    fetchServerCommunityData();
  }, [fetchServerCommunityData]);

  // Query Spaces (realtime sync when available)
  const spacesQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'community_spaces'),
            where('portalId', '==', portalId),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: spaces, isLoading: isLoadingSpacesCollection } = useCollection<CommunitySpace>(spacesQuery);

  // Query Moderation Reports
  const reportsQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'moderation_reports'),
            where('portalId', '==', portalId),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: reports, isLoading: isLoadingReportsCollection } = useCollection<ModerationReport>(reportsQuery);

  const effectiveSpaces = (spaces && spaces.length > 0) ? spaces : serverSpaces;
  const effectiveReports = (reports && reports.length > 0) ? reports : serverReports;

  const isLoadingSpaces = isLoadingSpacesCollection && isLoadingServer && effectiveSpaces.length === 0;
  const isLoadingReports = isLoadingReportsCollection && isLoadingServer && effectiveReports.length === 0;

  const filteredSpaces = React.useMemo(() => {
    return effectiveSpaces.filter(s => {
      return (
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [effectiveSpaces, searchQuery]);

  const handleOpenCreate = () => {
    setEditingSpace(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (space: CommunitySpace) => {
    setEditingSpace(space);
    setIsCreateOpen(true);
  };

  const handleDeleteSpace = async (spaceId: string) => {
    if (!confirm('Are you sure you want to delete this community space and all its posts?')) return;
    try {
      const res = await deleteSpaceAction(spaceId, portalId, portalSlug);
      if (!res.success) throw new Error(res.error);
      toast({ title: 'Space Deleted', description: 'Space and posts removed.' });
      fetchServerCommunityData();
    } catch (err: unknown) {
      toast({ title: 'Delete Failed', description: err instanceof Error ? err.message : 'Failed to delete space.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Tab Switcher ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="h-10 p-1 bg-muted/60 rounded-2xl">
            <TabsTrigger value="spaces" className="rounded-xl text-xs font-bold gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Spaces & Channels ({effectiveSpaces.length})
            </TabsTrigger>
            <TabsTrigger value="moderation" className="rounded-xl text-xs font-bold gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Moderation Queue ({reports?.length || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'spaces' && (
          <Button
            onClick={handleOpenCreate}
            className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Space
          </Button>
        )}
      </div>

      {/* ── Tab 1: Spaces ─────────────────────────────────────────────── */}
      {activeTab === 'spaces' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-border max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs border-0 focus-visible:ring-0 px-0"
            />
          </div>

          {isLoadingSpaces ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p>Loading community spaces...</p>
            </div>
          ) : filteredSpaces.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <MessageSquare className="w-10 h-10 mx-auto text-primary/60" />
              <h4 className="font-bold text-sm text-foreground">No Spaces Configured</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create channels for general discussion, announcements, student wins, and Q&A.
              </p>
              <Button onClick={handleOpenCreate} className="rounded-xl font-bold text-xs bg-primary text-white">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add First Space
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSpaces.map(space => (
                <Card
                  key={space.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{space.icon || '💬'}</span>
                        <div>
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            {space.name}
                            {space.isDefault && (
                              <Badge variant="outline" className="text-[9px] font-bold uppercase py-0">
                                Default
                              </Badge>
                            )}
                          </h4>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            #{space.slug}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl p-1.5 space-y-1">
                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(space)}
                            className="text-xs font-semibold rounded-xl gap-2 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit Space
                          </DropdownMenuItem>
                          <Link href={`/portal/${portalSlug}/community/${space.slug}`} target="_blank">
                            <DropdownMenuItem className="text-xs font-semibold rounded-xl gap-2 cursor-pointer">
                              <ExternalLink className="w-3.5 h-3.5" /> View Channel Feed
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            onClick={() => handleDeleteSpace(space.id)}
                            className="text-xs font-semibold rounded-xl gap-2 text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Space
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {space.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {space.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase capitalize">
                      {space.visibility.replace('_', ' ')}
                    </Badge>
                    <span className="font-semibold text-[11px] text-foreground">
                      {space.postCount || 0} Posts
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Moderation Queue ───────────────────────────────────── */}
      {activeTab === 'moderation' && (
        <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h4 className="font-bold text-sm text-foreground">Flagged Content & Reports</h4>
              <p className="text-xs text-muted-foreground">Review community posts reported by members.</p>
            </div>
          </div>

          {isLoadingReports ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading moderation queue...</div>
          ) : effectiveReports.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2 bg-muted/10 rounded-2xl">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
              <p className="font-bold text-foreground">Moderation Queue is Clean</p>
              <p>No community posts or comments are currently flagged.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {effectiveReports.map(rep => (
                <div key={rep.id} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-amber-600">
                      Report: {rep.targetType}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(rep.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground">Reason: {rep.reason}</p>
                  {rep.details && <p className="text-xs text-muted-foreground">{rep.details}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Create / Edit Space Modal ─────────────────────────────────── */}
      <CreateSpaceModal
        open={isCreateOpen}
        onOpenChange={(isOpen) => {
          setIsCreateOpen(isOpen);
          if (!isOpen) fetchServerCommunityData();
        }}
        portalId={portalId}
        portalSlug={portalSlug}
        organizationId={organizationId}
        workspaceIds={workspaceIds}
        editingSpace={editingSpace}
        existingOrder={(effectiveSpaces.length || 0) + 1}
      />
    </div>
  );
}
