'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Network,
  Globe,
  Share2,
  Download,
  Upload,
  Webhook,
  Key,
  Building,
  Plus,
  Search,
  Filter,
  Layers,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Sparkles,
  Sliders,
  ExternalLink,
  Users,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  getWorkspaceFederatedSpacesAction,
  getFederatedKnowledgeFeedAction,
  subscribeToFederatedSpaceAction,
  unsubscribeFromFederatedSpaceAction,
} from '@/lib/quick-notes-federation-actions';
import { QuickNotesRepository } from '@/lib/quick-notes-repository';
import { listApiKeys } from '@/lib/api-key-actions';
import {
  getKnowledgeSpaceAccessLevelMeta,
  getFederationPolicyMeta,
} from '@/lib/quick-notes-domain';
import { FederatedKnowledgeCard } from './FederatedKnowledgeCard';
import { CreateFederatedSpaceDialog } from './CreateFederatedSpaceDialog';
import { WebhookGeneratorDialog } from './WebhookGeneratorDialog';
import { ImportExportModal } from './ImportExportModal';
import type {
  FederatedKnowledgeSpace,
  FederatedKnowledgeItem,
  QuickNote,
} from '@/lib/quick-notes-types';

export function FederationHubView() {
  const { toast } = useToast();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const organizationId = (user as unknown as { organizationId?: string })?.organizationId || 'default-org';

  const [activeTab, setActiveTab] = React.useState<'spaces' | 'feed' | 'webhooks' | 'migration'>('spaces');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSpaceFilter, setSelectedSpaceFilter] = React.useState<string>('all');

  // Spaces state
  const [ownedSpaces, setOwnedSpaces] = React.useState<FederatedKnowledgeSpace[]>([]);
  const [subscribedSpaces, setSubscribedSpaces] = React.useState<FederatedKnowledgeSpace[]>([]);
  const [orgSharedSpaces, setOrgSharedSpaces] = React.useState<FederatedKnowledgeSpace[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = React.useState(true);

  // Feed state
  const [feedItems, setFeedItems] = React.useState<FederatedKnowledgeItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = React.useState(false);
  const [copyingItemId, setCopyingItemId] = React.useState<string | null>(null);

  // Webhooks state
  const [activeKeyCount, setActiveKeyCount] = React.useState<number>(0);

  // Dialog states
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = React.useState(false);
  const [isWebhookDialogOpen, setIsWebhookDialogOpen] = React.useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = React.useState(false);

  // Load Spaces
  const loadSpaces = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoadingSpaces(true);
    try {
      const res = await getWorkspaceFederatedSpacesAction({
        organizationId,
        workspaceId: activeWorkspaceId,
      });

      if (res.success && res.data) {
        setOwnedSpaces(res.data.ownedSpaces);
        setSubscribedSpaces(res.data.subscribedSpaces);
        setOrgSharedSpaces(res.data.orgSharedSpaces);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load federated spaces', variant: 'destructive' });
    } finally {
      setIsLoadingSpaces(false);
    }
  }, [organizationId, activeWorkspaceId, toast]);

  // Load Feed
  const loadFeed = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoadingFeed(true);
    try {
      const res = await getFederatedKnowledgeFeedAction({
        organizationId,
        workspaceId: activeWorkspaceId,
        options: {
          searchQuery,
          spaceId: selectedSpaceFilter,
        },
      });

      if (res.success && res.data) {
        setFeedItems(res.data.items);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load federated feed', variant: 'destructive' });
    } finally {
      setIsLoadingFeed(false);
    }
  }, [organizationId, activeWorkspaceId, searchQuery, selectedSpaceFilter, toast]);

  // Load API Keys count
  const loadKeyCount = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await listApiKeys(activeWorkspaceId);
      if (res.success && res.keys) {
        setActiveKeyCount(res.keys.length);
      }
    } catch {
      // Ignore
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadSpaces();
    loadKeyCount();
  }, [loadSpaces, loadKeyCount]);

  React.useEffect(() => {
    if (activeTab === 'feed') {
      loadFeed();
    }
  }, [activeTab, loadFeed]);

  const handleSubscribeToggle = async (space: FederatedKnowledgeSpace, isSubscribed: boolean) => {
    if (!activeWorkspaceId) return;
    try {
      if (isSubscribed) {
        const res = await unsubscribeFromFederatedSpaceAction({
          spaceId: space.id,
          workspaceId: activeWorkspaceId,
        });
        if (res.success) {
          toast({ title: 'Unsubscribed', description: `Unsubscribed from "${space.name}".` });
          loadSpaces();
        }
      } else {
        const res = await subscribeToFederatedSpaceAction({
          spaceId: space.id,
          workspaceId: activeWorkspaceId,
        });
        if (res.success) {
          toast({ title: 'Subscribed', description: `Subscribed to "${space.name}".` });
          loadSpaces();
        }
      }
    } catch {
      toast({ title: 'Action Failed', description: 'Could not update subscription', variant: 'destructive' });
    }
  };

  const handleCopyAsLocalNote = async (item: FederatedKnowledgeItem) => {
    if (!activeWorkspaceId || !user) return;
    setCopyingItemId(item.id);
    try {
      const newNote: QuickNote = {
        id: `note_fed_copy_${Date.now()}`,
        workspaceId: activeWorkspaceId,
        title: `${item.title} (from ${item.sourceSpaceName})`,
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: item.snippet }],
            },
          ],
        },
        categoryName: item.categoryName || 'Federated Knowledge',
        tags: [...item.tags, 'federated-copy'],
        knowledgeType: 'note',
        sentiment: 'neutral',
        isPinned: false,
        isArchived: false,
        authorId: user.uid,
        authorName: user.displayName || 'User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await QuickNotesRepository.create(newNote);
      toast({
        title: 'Saved to Local Workspace',
        description: `Successfully cloned "${item.title}" into your local notes board.`,
        actionConfig: {
          path: '/admin/quick-notes',
          label: 'View Board',
        },
      });
      loadFeed();
    } catch {
      toast({ title: 'Cloning Failed', description: 'Could not save note to workspace', variant: 'destructive' });
    } finally {
      setCopyingItemId(null);
    }
  };

  const allSpaces = [...ownedSpaces, ...subscribedSpaces, ...orgSharedSpaces];
  const uniqueSpaces = Array.from(new Map(allSpaces.map((s) => [s.id, s])).values());

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/quick-notes"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
              <Network className="h-5 w-5 text-indigo-500" />
              Federation & Integrations Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cross-workspace shared knowledge spaces, inbound third-party webhooks, and lossless data archiving.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsImportExportOpen(true)}
            className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
            Import / Export
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsWebhookDialogOpen(true)}
            className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
          >
            <Webhook className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
            New Webhook Key
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateSpaceOpen(true)}
            className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white h-9 min-h-[44px] sm:min-h-[36px]"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Publish Shared Space
          </Button>
        </div>
      </div>

      {/* 4 Executive KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Shared Spaces</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {uniqueSpaces.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ownedSpaces.length} published • {subscribedSpaces.length + orgSharedSpaces.length} subscribed
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Organization Peers</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {orgSharedSpaces.length > 0 ? 'Connected' : 'Standalone'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Campus network active
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Ingestion Keys</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Key className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {activeKeyCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Slack, Discord & Zapier keys
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">API Rate Limit</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            60 req/min
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            SSRF & DoS shielded
          </p>
        </div>
      </div>

      {/* 4 Interactive Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="w-full space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-10 rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="spaces" className="rounded-xl text-xs font-medium">
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Federated Spaces
          </TabsTrigger>
          <TabsTrigger value="feed" className="rounded-xl text-xs font-medium">
            <Globe className="h-3.5 w-3.5 mr-1.5" />
            Federated Feed
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-xl text-xs font-medium">
            <Webhook className="h-3.5 w-3.5 mr-1.5" />
            Ingestion Connectors
          </TabsTrigger>
          <TabsTrigger value="migration" className="rounded-xl text-xs font-medium">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Bulk Migration
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Federated Spaces */}
        <TabsContent value="spaces" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Knowledge Spaces Available to this Workspace ({uniqueSpaces.length})
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadSpaces}
              disabled={isLoadingSpaces}
              className="text-xs h-8 rounded-xl"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingSpaces ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {isLoadingSpaces ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
              <p className="text-xs font-medium">Loading federated spaces...</p>
            </div>
          ) : uniqueSpaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center space-y-3 bg-muted/10">
              <Network className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">No Knowledge Spaces Published Yet</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Publish a space to share curricula, brand guides, and sales battlecards across sibling campuses.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCreateSpaceOpen(true)}
                className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px] sm:min-h-[36px]"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Publish First Knowledge Space
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueSpaces.map((space) => {
                const isOwner = space.ownerWorkspaceId === activeWorkspaceId;
                const isSubscribed = space.subscriberWorkspaceIds.includes(activeWorkspaceId || '') || space.federationPolicy === 'organization_shared';
                const accessMeta = getKnowledgeSpaceAccessLevelMeta(space.accessLevel);
                const policyMeta = getFederationPolicyMeta(space.federationPolicy);

                return (
                  <div
                    key={space.id}
                    className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-xs hover:border-border transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            <Layers className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground line-clamp-1">{space.name}</h4>
                            <p className="text-[11px] text-muted-foreground">
                              {isOwner ? 'Owned by this workspace' : 'Published upstream'}
                            </p>
                          </div>
                        </div>

                        <Badge variant="outline" className={`text-[10px] font-medium ${accessMeta.badgeClass}`}>
                          {accessMeta.label}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {space.description || 'No description provided.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Badge variant="secondary" className={`text-[10px] ${policyMeta.badgeClass}`}>
                          {policyMeta.label}
                        </Badge>

                        {space.tags && space.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{space.subscribersCount || space.subscriberWorkspaceIds.length} peers</span>
                      </div>

                      {!isOwner && (
                        <Button
                          type="button"
                          variant={isSubscribed ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => handleSubscribeToggle(space, isSubscribed)}
                          className="h-8 text-xs font-semibold rounded-xl min-h-[32px] sm:min-h-[32px]"
                        >
                          {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Federated Live Feed */}
        <TabsContent value="feed" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search across federated spaces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs rounded-xl"
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadFeed}
              disabled={isLoadingFeed}
              className="text-xs h-8 rounded-xl"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingFeed ? 'animate-spin' : ''}`} />
              Refresh Feed
            </Button>
          </div>

          {isLoadingFeed ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
              <p className="text-xs font-medium">Loading federated knowledge feed...</p>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center space-y-2 bg-muted/10">
              <Globe className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
              <p className="text-sm font-bold text-foreground">No Federated Notes Found</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Subscribe to knowledge spaces or publish notes in shared categories to see cross-campus feeds here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {feedItems.map((item) => (
                <FederatedKnowledgeCard
                  key={item.id}
                  item={item}
                  onCopyAsLocal={handleCopyAsLocalNote}
                  isCopying={copyingItemId === item.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Ingestion Connectors */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Active Ingestion Connectors</h3>
              <p className="text-xs text-muted-foreground">
                Inbound endpoints for capturing intelligence from third-party chat and automation tools.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsWebhookDialogOpen(true)}
              className="rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white min-h-[44px] sm:min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Webhook Key
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Slack Connector Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Webhook className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Slack Inbound Bot</h4>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    Ready
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Reactions or slash commands in your Slack admissions channels automatically create structured notes.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsWebhookDialogOpen(true)}
                className="w-full text-xs rounded-xl h-8 min-h-[36px]"
              >
                Configure Webhook
              </Button>
            </div>

            {/* Zapier / Make Connector Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Zapier & Make</h4>
                  <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                    REST Endpoint
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Forward Google Forms, Typeform surveys, and email leads directly into the Knowledge Inbox.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsWebhookDialogOpen(true)}
                className="w-full text-xs rounded-xl h-8 min-h-[36px]"
              >
                Configure Webhook
              </Button>
            </div>

            {/* Chrome Extension Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Globe className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Chrome Clipper</h4>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Browser Extension
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Clip articles, competitor fee tables, and research snippets straight from the web into your workspace.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsWebhookDialogOpen(true)}
                className="w-full text-xs rounded-xl h-8 min-h-[36px]"
              >
                Get API Token
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Bulk Migration */}
        <TabsContent value="migration" className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <Download className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Enterprise Bulk Backup & Migration</h3>
                  <p className="text-xs text-muted-foreground">
                    Export lossless Markdown archives with frontmatter or full JSON database dumps.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsImportExportOpen(true)}
                className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground min-h-[44px] sm:min-h-[36px]"
              >
                Open Migration Wizard
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Markdown & YAML Archive (.md)
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generates clean Markdown files with embedded metadata headers. Fully compatible with Notion, Obsidian, and standard git repositories for offline disaster recovery.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  Full Database JSON Bundle (.json)
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Complete snapshot of all notes, categories, strategic ideas, battlecard rebuttals, and executive insights ready for instant re-import into new tenant instances.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Modals */}
      {user && activeWorkspaceId && (
        <>
          <CreateFederatedSpaceDialog
            open={isCreateSpaceOpen}
            onOpenChange={setIsCreateSpaceOpen}
            workspaceId={activeWorkspaceId}
            organizationId={organizationId}
            userId={user.uid}
            userName={user.displayName || 'Admin'}
            onSpaceCreated={loadSpaces}
          />

          <WebhookGeneratorDialog
            open={isWebhookDialogOpen}
            onOpenChange={setIsWebhookDialogOpen}
            workspaceId={activeWorkspaceId}
            organizationId={organizationId}
            userId={user.uid}
          />

          <ImportExportModal
            open={isImportExportOpen}
            onOpenChange={setIsImportExportOpen}
            workspaceId={activeWorkspaceId}
            organizationId={organizationId}
            userId={user.uid}
            userName={user.displayName || 'Admin'}
            onImportCompleted={loadSpaces}
          />
        </>
      )}
    </div>
  );
}
