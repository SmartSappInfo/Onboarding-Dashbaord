'use client';

/**
 * {{Org_name}} Experience Platform — Community Hub & Feed Client
 *
 * Full-featured social learning community with channels/spaces, rich post composer,
 * interactive polls, multi-emoji reactions, and community leaderboards.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createPostAction,
  castPollVoteAction,
  toggleReactionAction,
} from '@/app/actions/community-actions';
import type { Portal } from '@/lib/types/portal';
import type {
  CommunitySpace,
  CommunityPost,
  PostType,
  ReactionType,
} from '@/lib/types/community';
import {
  MessageSquare,
  Sparkles,
  ArrowLeft,
  Pin,
  Heart,
  Flame,
  Lightbulb,
  ThumbsUp,
  PartyPopper,
  MessageCircle,
  Share2,
  Lock,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
  Award,
  Users,
  Search,
  Loader2,
  Check,
} from 'lucide-react';
import { PortalAuthModal } from '../components/PortalAuthModal';

interface PortalCommunityClientProps {
  slug: string;
  activeSpaceSlug?: string;
}

export default function PortalCommunityClient({
  slug,
  activeSpaceSlug,
}: PortalCommunityClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // Post Composer State
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [postTitle, setPostTitle] = React.useState('');
  const [postContent, setPostContent] = React.useState('');
  const [postType, setPostType] = React.useState<PostType>('discussion');
  const [selectedSpaceId, setSelectedSpaceId] = React.useState<string>('');
  const [mediaUrlInput, setMediaUrlInput] = React.useState('');
  const [pollQuestion, setPollQuestion] = React.useState('');
  const [pollOptions, setPollOptions] = React.useState<string[]>(['', '']);
  const [isPublishing, setIsPublishing] = React.useState(false);

  // Optimistic Reactions State: Map of postId -> { userReaction?: ReactionType, counts: Record<ReactionType, number> }
  const [optimisticReactions, setOptimisticReactions] = React.useState<
    Record<string, { userReaction?: ReactionType; counts: Record<ReactionType, number> }>
  >({});

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  // 2. Query Spaces
  const spacesQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(
            collection(firestore, 'community_spaces'),
            where('portalId', '==', portal.id),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portal?.id]
  );
  const { data: spaces, isLoading: isLoadingSpaces } = useCollection<CommunitySpace>(spacesQuery);

  const currentSpace = React.useMemo(() => {
    if (!spaces || !activeSpaceSlug) return null;
    return spaces.find(s => s.slug === activeSpaceSlug) || null;
  }, [spaces, activeSpaceSlug]);

  // Set default space for composer
  React.useEffect(() => {
    if (currentSpace) {
      setSelectedSpaceId(currentSpace.id);
    } else if (spaces && spaces.length > 0 && !selectedSpaceId) {
      const def = spaces.find(s => s.isDefault) || spaces[0];
      setSelectedSpaceId(def.id);
    }
  }, [currentSpace, spaces]);

  // 3. Query Posts
  const postsQuery = useMemoFirebase(
    () => {
      if (!firestore || !portal?.id) return null;
      if (currentSpace?.id) {
        return query(
          collection(firestore, 'community_posts'),
          where('portalId', '==', portal.id),
          where('spaceId', '==', currentSpace.id),
          orderBy('isPinned', 'desc'),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
      }
      return query(
        collection(firestore, 'community_posts'),
        where('portalId', '==', portal.id),
        orderBy('isPinned', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
    },
    [firestore, portal?.id, currentSpace?.id]
  );
  const { data: posts, isLoading: isLoadingPosts } = useCollection<CommunityPost>(postsQuery);

  // Filtered Posts
  const filteredPosts = React.useMemo(() => {
    return (posts || []).filter(p => {
      return (
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.authorName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [posts, searchQuery]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!postTitle.trim() || !postContent.trim()) {
      toast({ title: 'Fields Required', description: 'Please provide both a title and post content.' });
      return;
    }

    const targetSpace = (spaces || []).find(s => s.id === selectedSpaceId) || (spaces || [])[0];
    if (!targetSpace) {
      toast({ title: 'Space Required', description: 'Please select a space for your post.' });
      return;
    }

    setIsPublishing(true);
    try {
      const cleanPollOptions = pollOptions.filter(o => o.trim().length > 0);

      const res = await createPostAction(
        {
          organizationId: portal.organizationId,
          portalId: portal.id,
          spaceId: targetSpace.id,
          workspaceIds: portal.workspaceIds,
          authorId: user.uid,
          authorName: user.displayName || user.email?.split('@')[0] || 'Member',
          authorAvatarUrl: user.photoURL || undefined,
          authorRole: 'member',
          type: postType,
          title: postTitle.trim(),
          content: postContent.trim(),
          mediaUrls: mediaUrlInput.trim() ? [mediaUrlInput.trim()] : [],
          pollQuestion: postType === 'poll' ? pollQuestion.trim() : undefined,
          pollOptions: postType === 'poll' ? cleanPollOptions : undefined,
        },
        slug
      );

      if (!res.success) throw new Error(res.error);

      toast({ title: 'Post Published! 🎉', description: 'Earned +5 Community Points.' });
      setPostTitle('');
      setPostContent('');
      setMediaUrlInput('');
      setPollQuestion('');
      setPollOptions(['', '']);
      setIsComposerOpen(false);
    } catch (err: any) {
      toast({ title: 'Publishing Failed', description: err?.message });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleVotePoll = async (pollId: string, postId: string, optionId: string) => {
    if (!portal) return;
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const res = await castPollVoteAction(
        {
          pollId,
          postId,
          portalId: portal.id,
          userId: user.uid,
          selectedOptionIds: [optionId],
        },
        slug,
        currentSpace?.id
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Vote Counted! 📊', description: 'Your selection was recorded.' });
    } catch (err: any) {
      toast({ title: 'Voting Failed', description: err?.message });
    }
  };

  const handleToggleReaction = async (postId: string, type: ReactionType) => {
    if (!portal) return;
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    // Optimistic update
    const currentOpt = optimisticReactions[postId] || {
      userReaction: undefined,
      counts: { like: 0, heart: 0, fire: 0, celebrate: 0, insightful: 0 },
    };

    const isCurrent = currentOpt.userReaction === type;
    const nextReaction = isCurrent ? undefined : type;
    const nextCounts = { ...currentOpt.counts };

    if (isCurrent) {
      nextCounts[type] = Math.max(0, (nextCounts[type] || 1) - 1);
    } else {
      if (currentOpt.userReaction) {
        nextCounts[currentOpt.userReaction] = Math.max(0, (nextCounts[currentOpt.userReaction] || 1) - 1);
      }
      nextCounts[type] = (nextCounts[type] || 0) + 1;
    }

    setOptimisticReactions({
      ...optimisticReactions,
      [postId]: { userReaction: nextReaction, counts: nextCounts },
    });

    try {
      await toggleReactionAction({
        organizationId: portal.organizationId,
        portalId: portal.id,
        targetType: 'post',
        targetId: postId,
        userId: user.uid,
        type,
      });
    } catch (err: any) {
      // Revert on error
      toast({ title: 'Reaction Error', description: err?.message });
    }
  };

  if (isLoadingPortal || isLoadingSpaces) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Skeleton className="h-96 rounded-3xl" />
            <Skeleton className="lg:col-span-3 h-96 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Portal Not Found</h2>
          <Link href="/">
            <Button className="rounded-xl font-bold text-xs">Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = portal.theme;
  const brandTitle = portal.branding?.brandName || portal.name;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            {portal.branding?.logoUrl ? (
              <img src={portal.branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span className="font-bold text-sm tracking-tight">{brandTitle}</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/portal/${slug}/dashboard`}>
            <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold text-xs gap-1.5">
              <Award className="w-3.5 h-3.5 text-primary" /> Member Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Main Community Layout ─────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Left Sidebar: Spaces / Channels ─────────────────────────── */}
        <aside className="space-y-4">
          <Card className="rounded-3xl border-2 border-border p-4 space-y-3 bg-card shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" /> Channels & Spaces
              </span>
            </div>

            <div className="space-y-1">
              <Link
                href={`/portal/${slug}/community`}
                className={`flex items-center justify-between p-2.5 rounded-2xl text-xs transition-colors ${
                  !activeSpaceSlug
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'text-foreground hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-base">🌐</span>
                  <span className="truncate">All Discussions</span>
                </div>
                <span className={`text-[10px] ${!activeSpaceSlug ? 'text-white/80' : 'text-muted-foreground'}`}>
                  {posts?.length || 0}
                </span>
              </Link>

              {(spaces || []).map(space => {
                const isActive = activeSpaceSlug === space.slug;
                const isGated = space.visibility === 'plan_gated' || space.visibility === 'private_cohort';

                return (
                  <Link
                    key={space.id}
                    href={`/portal/${slug}/community/${space.slug}`}
                    className={`flex items-center justify-between p-2.5 rounded-2xl text-xs transition-colors ${
                      isActive
                        ? 'bg-primary text-white font-bold shadow-xs'
                        : 'text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base">{space.icon || '💬'}</span>
                      <span className="truncate">{space.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isGated && (
                        <Lock
                          className={`w-3 h-3 ${isActive ? 'text-white/80' : 'text-amber-500'}`}
                        />
                      )}
                      <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {space.postCount || 0}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Community Guidelines Card */}
          <Card className="rounded-3xl border-2 border-border p-4 space-y-2 bg-muted/20 text-xs text-muted-foreground">
            <h5 className="font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Community Rules
            </h5>
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
              <li>Be supportive and share practical workflows.</li>
              <li>Post fee templates and bursary wins.</li>
              <li>Respect confidential student records.</li>
            </ul>
          </Card>
        </aside>

        {/* ── Center Column: Feed & Composer ───────────────────────────── */}
        <section className="lg:col-span-3 space-y-6">
          {/* Post Composer Card */}
          <Card className="rounded-3xl border-2 border-border p-5 space-y-4 bg-card shadow-xs">
            {!isComposerOpen ? (
              <div
                onClick={() => {
                  if (!user) setIsAuthModalOpen(true);
                  else setIsComposerOpen(true);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border cursor-pointer hover:bg-muted/60 transition-colors"
              >
                <Avatar className="w-8 h-8 border border-border">
                  {user?.photoURL && <AvatarImage src={user.photoURL} />}
                  <AvatarFallback className="bg-primary text-white font-bold text-xs">
                    {(user?.displayName || 'M').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground font-medium">
                  Start a discussion, share a win, or ask a question...
                </span>
              </div>
            ) : (
              <form onSubmit={handlePublishPost} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" /> Create New Post
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground font-bold"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">Channel</span>
                    <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
                      <SelectTrigger className="h-10 text-xs rounded-xl">
                        <SelectValue placeholder="Select space..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {(spaces || []).map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.icon || '💬'} {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">Post Type</span>
                    <Select value={postType} onValueChange={(val: PostType) => setPostType(val)}>
                      <SelectTrigger className="h-10 text-xs rounded-xl capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="discussion">💬 Discussion</SelectItem>
                        <SelectItem value="question">❓ Question</SelectItem>
                        <SelectItem value="announcement">📢 Announcement</SelectItem>
                        <SelectItem value="showcase">🏆 Win / Showcase</SelectItem>
                        <SelectItem value="resource">📁 Resource</SelectItem>
                        <SelectItem value="poll">📊 Interactive Poll</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Input
                  placeholder="Post title or topic summary..."
                  value={postTitle}
                  onChange={e => setPostTitle(e.target.value)}
                  className="h-10 text-xs rounded-xl font-bold"
                  required
                />

                <Textarea
                  placeholder="Share your thoughts, workflow tips, or question details..."
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  rows={4}
                  className="text-xs rounded-xl resize-none leading-relaxed"
                  required
                />

                {/* Poll Builder if postType === 'poll' */}
                {postType === 'poll' && (
                  <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
                    <span className="font-bold text-xs text-primary flex items-center gap-1.5">
                      📊 Poll Settings
                    </span>
                    <Input
                      placeholder="Poll Question..."
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      className="h-9 text-xs rounded-xl bg-background"
                      required
                    />
                    <div className="space-y-2">
                      {pollOptions.map((opt, optIdx) => (
                        <Input
                          key={optIdx}
                          placeholder={`Option ${optIdx + 1}`}
                          value={opt}
                          onChange={e => {
                            const next = [...pollOptions];
                            next[optIdx] = e.target.value;
                            setPollOptions(next);
                          }}
                          className="h-8 text-xs rounded-xl bg-background"
                        />
                      ))}
                    </div>
                    {pollOptions.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="rounded-xl text-[11px] font-bold h-7"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Option
                      </Button>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <Input
                    placeholder="Optional image attachment URL..."
                    value={mediaUrlInput}
                    onChange={e => setMediaUrlInput(e.target.value)}
                    className="h-9 text-xs rounded-xl max-w-xs"
                  />

                  <Button
                    type="submit"
                    disabled={isPublishing}
                    className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 shadow-sm gap-1.5"
                  >
                    {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Post'}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border-2 border-border shadow-2xs">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search community discussions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs border-0 focus-visible:ring-0 px-0"
            />
          </div>

          {/* Feed Stream */}
          {isLoadingPosts ? (
            <div className="space-y-4">
              <Skeleton className="h-44 rounded-3xl" />
              <Skeleton className="h-44 rounded-3xl" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <MessageSquare className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Discussions Found</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Be the first to post a question, bursary strategy, or discussion in this channel!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map(post => {
                const space = (spaces || []).find(s => s.id === post.spaceId);
                const optReaction = optimisticReactions[post.id];
                const likeCount = optReaction ? optReaction.counts.like : post.likeCount || 0;

                return (
                  <Card
                    key={post.id}
                    className={`rounded-3xl border-2 p-6 space-y-4 bg-card shadow-xs transition-all ${
                      post.isPinned ? 'border-primary/50 bg-primary/[0.02]' : 'border-border'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border border-border">
                          {post.authorAvatarUrl && <AvatarImage src={post.authorAvatarUrl} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {(post.authorName || 'M').charAt(0)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{post.authorName}</span>
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0 capitalize">
                              {post.authorRole}
                            </Badge>
                            {post.isPinned && (
                              <Badge className="bg-primary/10 text-primary border-0 text-[9px] font-bold gap-1 py-0">
                                <Pin className="w-3 h-3" /> Pinned
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{space?.icon || '💬'} #{space?.name || 'General'}</span>
                            <span>•</span>
                            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <Badge variant="outline" className="text-[10px] font-bold uppercase capitalize">
                        {post.type}
                      </Badge>
                    </div>

                    {/* Title & Body */}
                    <div className="space-y-2">
                      <Link
                        href={`/portal/${slug}/community/${space?.slug || 'general'}/${post.slug}`}
                        className="group block"
                      >
                        <h3 className="font-extrabold text-base text-foreground group-hover:text-primary transition-colors">
                          {post.title}
                        </h3>
                      </Link>
                      <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                        {post.content}
                      </p>
                    </div>

                    {/* Media Image */}
                    {post.mediaUrls && post.mediaUrls.length > 0 && (
                      <div className="rounded-2xl overflow-hidden border border-border aspect-video max-h-72 bg-muted/20">
                        <img src={post.mediaUrls[0]} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Poll Widget */}
                    {post.pollData && (
                      <div className="p-4 rounded-2xl border-2 border-border bg-muted/20 space-y-3">
                        <p className="font-bold text-xs text-foreground">{post.pollData.question}</p>
                        <div className="space-y-2">
                          {post.pollData.options.map(opt => {
                            const total = post.pollData?.totalVotes || 0;
                            const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleVotePoll(post.pollData!.id, post.id, opt.id)}
                                className="w-full text-left p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-all space-y-1.5 group"
                              >
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="group-hover:text-primary transition-colors">{opt.text}</span>
                                  <span className="text-[11px] text-muted-foreground">{pct}% ({opt.voteCount})</span>
                                </div>
                                <Progress value={pct} className="h-1.5 rounded-full" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleReaction(post.id, 'like')}
                          className="h-8 px-2.5 rounded-xl font-bold text-xs gap-1.5 hover:text-primary"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> {likeCount}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleReaction(post.id, 'heart')}
                          className="h-8 px-2.5 rounded-xl font-bold text-xs gap-1.5 hover:text-rose-500"
                        >
                          <Heart className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleReaction(post.id, 'fire')}
                          className="h-8 px-2.5 rounded-xl font-bold text-xs gap-1.5 hover:text-amber-500"
                        >
                          <Flame className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <Link href={`/portal/${slug}/community/${space?.slug || 'general'}/${post.slug}`}>
                        <Button variant="outline" size="sm" className="h-8 rounded-xl font-bold text-xs gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-primary" /> {post.commentCount || 0} Comments
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by Experience Platform.</p>
      </footer>

      {/* ── Auth Modal ────────────────────────────────────────────────── */}
      <PortalAuthModal
        portal={portal}
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
      />
    </div>
  );
}
