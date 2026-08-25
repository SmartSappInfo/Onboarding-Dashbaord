'use client';

/**
 * {{Org_name}} Experience Platform — Post Detail & Threaded Discussions Client
 *
 * Full-page discussion thread view with rich post body, media viewer,
 * interactive poll widget, nested comment replies, and moderation report menu.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  createCommentAction,
  deleteCommentAction,
  castPollVoteAction,
  toggleReactionAction,
  reportContentAction,
} from '@/app/actions/community-actions';
import type { Portal } from '@/lib/types/portal';
import type {
  CommunitySpace,
  CommunityPost,
  CommunityComment,
  ReactionType,
} from '@/lib/types/community';
import {
  ArrowLeft,
  MessageSquare,
  Pin,
  ThumbsUp,
  Heart,
  Flame,
  MessageCircle,
  MoreVertical,
  Flag,
  Reply,
  Trash2,
  Share2,
  Sparkles,
  Send,
  Loader2,
  Check,
} from 'lucide-react';
import { PortalAuthModal } from '../../../components/PortalAuthModal';

interface PortalPostDetailClientProps {
  slug: string;
  spaceSlug: string;
  postSlug: string;
}

export default function PortalPostDetailClient({
  slug,
  spaceSlug,
  postSlug,
}: PortalPostDetailClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [commentText, setCommentText] = React.useState('');
  const [replyingToCommentId, setReplyingToCommentId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState('');
  const [isPostingComment, setIsPostingComment] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

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

  // 2. Query Space
  const spaceQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && spaceSlug
        ? query(
            collection(firestore, 'community_spaces'),
            where('portalId', '==', portal.id),
            where('slug', '==', spaceSlug),
            limit(1)
          )
        : null,
    [firestore, portal?.id, spaceSlug]
  );
  const { data: spaces } = useCollection<CommunitySpace>(spaceQuery);
  const space = spaces?.[0] ?? null;

  // 3. Query Post
  const postQuery = useMemoFirebase(
    () =>
      firestore && space?.id && postSlug
        ? query(
            collection(firestore, 'community_posts'),
            where('spaceId', '==', space.id),
            where('slug', '==', postSlug),
            limit(1)
          )
        : null,
    [firestore, space?.id, postSlug]
  );
  const { data: posts, isLoading: isLoadingPost } = useCollection<CommunityPost>(postQuery);
  const post = posts?.[0] ?? null;

  // 4. Query Comments
  const commentsQuery = useMemoFirebase(
    () =>
      firestore && post?.id
        ? query(
            collection(firestore, 'community_comments'),
            where('postId', '==', post.id),
            orderBy('createdAt', 'asc')
          )
        : null,
    [firestore, post?.id]
  );
  const { data: comments, isLoading: isLoadingComments } = useCollection<CommunityComment>(commentsQuery);

  // Group top-level comments and replies
  const { topLevelComments, replyMap } = React.useMemo(() => {
    const top: CommunityComment[] = [];
    const map = new Map<string, CommunityComment[]>();

    (comments || []).forEach(c => {
      if (!c.parentCommentId) {
        top.push(c);
      } else {
        const existing = map.get(c.parentCommentId) || [];
        existing.push(c);
        map.set(c.parentCommentId, existing);
      }
    });

    return { topLevelComments: top, replyMap: map };
  }, [comments]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal || !space || !post) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!commentText.trim()) return;

    setIsPostingComment(true);
    try {
      const res = await createCommentAction(
        {
          organizationId: portal.organizationId,
          portalId: portal.id,
          spaceId: space.id,
          postId: post.id,
          authorId: user.uid,
          authorName: user.displayName || user.email?.split('@')[0] || 'Member',
          authorAvatarUrl: user.photoURL || undefined,
          authorRole: 'member',
          content: commentText.trim(),
        },
        slug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Comment Posted! 💬', description: 'Earned +2 Community Points.' });
      setCommentText('');
    } catch (err: any) {
      toast({ title: 'Comment Failed', description: err?.message });
    } finally {
      setIsPostingComment(false);
    }
  };

  const handlePostReply = async (parentCommentId: string) => {
    if (!portal || !space || !post || !user) {
      if (!user) setIsAuthModalOpen(true);
      return;
    }

    if (!replyText.trim()) return;

    setIsPostingComment(true);
    try {
      const res = await createCommentAction(
        {
          organizationId: portal.organizationId,
          portalId: portal.id,
          spaceId: space.id,
          postId: post.id,
          parentCommentId,
          authorId: user.uid,
          authorName: user.displayName || user.email?.split('@')[0] || 'Member',
          authorAvatarUrl: user.photoURL || undefined,
          authorRole: 'member',
          content: replyText.trim(),
        },
        slug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Reply Posted! 💬', description: 'Response added to thread.' });
      setReplyText('');
      setReplyingToCommentId(null);
    } catch (err: any) {
      toast({ title: 'Reply Failed', description: err?.message });
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteCommentAction(commentId, slug, space?.id, post?.id);
      toast({ title: 'Comment Deleted', description: 'Comment removed from thread.' });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message });
    }
  };

  const handleReportPost = async () => {
    if (!portal || !post || !user) {
      if (!user) setIsAuthModalOpen(true);
      return;
    }

    const reason = prompt('Please describe why you are reporting this post for moderation:');
    if (!reason?.trim()) return;

    try {
      await reportContentAction({
        organizationId: portal.organizationId,
        portalId: portal.id,
        targetType: 'post',
        targetId: post.id,
        targetAuthorId: post.authorId,
        reporterUserId: user.uid,
        reason: reason.trim(),
      });
      toast({ title: 'Report Submitted', description: 'Our moderation team will review this post.' });
    } catch (err: any) {
      toast({ title: 'Report Failed', description: err?.message });
    }
  };

  if (isLoadingPortal || isLoadingPost) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!portal || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Discussion Not Found</h2>
          <Link href={`/portal/${slug}/community`}>
            <Button className="rounded-xl font-bold text-xs">Return to Community</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = portal.theme;
  const brandTitle = portal.branding?.brandName || portal.name;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}/community/${space?.slug || ''}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">{brandTitle}</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/portal/${slug}/community`}>
            <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold text-xs gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary" /> All Channels
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Main Thread Body ──────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-8 space-y-6">
        {/* Post Card */}
        <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-6 bg-card shadow-xs">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-11 h-11 border border-border">
                {post.authorAvatarUrl && <AvatarImage src={post.authorAvatarUrl} />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {(post.authorName || 'M').charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{post.authorName}</span>
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase py-0 capitalize">
                    {post.authorRole}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{space?.icon || '💬'} #{space?.name || 'General'}</span>
                  <span>•</span>
                  <span>{new Date(post.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-1.5 space-y-1">
                <DropdownMenuItem
                  onClick={handleReportPost}
                  className="text-xs font-semibold rounded-xl gap-2 text-rose-500 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" /> Report for Moderation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Title & Body */}
          <div className="space-y-3">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
              {post.title}
            </h1>
            <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {post.content}
            </div>
          </div>

          {/* Attached Media */}
          {post.mediaUrls && post.mediaUrls.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-border aspect-video max-h-96 bg-muted/20">
              <img src={post.mediaUrls[0]} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Action Counts */}
          <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-xs flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4 text-primary" /> {post.likeCount || 0} Likes
              </span>
              <span className="font-semibold text-xs flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-primary" /> {comments?.length || 0} Comments
              </span>
            </div>
          </div>
        </Card>

        {/* ── Threaded Comments Section ───────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Discussion Thread ({comments?.length || 0})
          </h3>

          {/* Comment Composer */}
          <Card className="rounded-3xl border-2 border-border p-4 sm:p-5 space-y-3 bg-card shadow-xs">
            <form onSubmit={handlePostComment} className="space-y-3">
              <Textarea
                placeholder={user ? "Write a thoughtful response..." : "Sign in to participate in discussion..."}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onClick={() => {
                  if (!user) setIsAuthModalOpen(true);
                }}
                rows={3}
                className="text-xs rounded-2xl resize-none leading-relaxed"
                required
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Markdown formatting supported.</span>
                <Button
                  type="submit"
                  disabled={isPostingComment || !commentText.trim()}
                  className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 shadow-xs gap-1.5"
                >
                  {isPostingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post Comment'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Comments Tree */}
          {isLoadingComments ? (
            <div className="space-y-3">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          ) : topLevelComments.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-3xl space-y-2 bg-muted/10">
              <p className="text-xs text-muted-foreground">No replies yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topLevelComments.map(comment => {
                const replies = replyMap.get(comment.id) || [];
                const isAuthor = user?.uid === comment.authorId;

                return (
                  <div key={comment.id} className="space-y-3">
                    {/* Top Level Comment Card */}
                    <Card className="rounded-2xl border border-border p-4 space-y-3 bg-card shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-8 h-8 border border-border">
                            {comment.authorAvatarUrl && <AvatarImage src={comment.authorAvatarUrl} />}
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {(comment.authorName || 'M').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-foreground">{comment.authorName}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {isAuthor && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-muted-foreground hover:text-rose-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line pl-10">
                        {comment.content}
                      </p>

                      <div className="pl-10 flex items-center gap-3 text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            if (!user) setIsAuthModalOpen(true);
                            else setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id);
                          }}
                          className="font-bold text-primary flex items-center gap-1 hover:underline text-[11px]"
                        >
                          <Reply className="w-3 h-3" /> Reply
                        </button>
                      </div>
                    </Card>

                    {/* Inline Reply Composer */}
                    {replyingToCommentId === comment.id && (
                      <div className="pl-8 sm:pl-12 space-y-2">
                        <Textarea
                          placeholder={`Reply to ${comment.authorName}...`}
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          rows={2}
                          className="text-xs rounded-xl resize-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyingToCommentId(null)}
                            className="rounded-xl text-xs h-8"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={isPostingComment || !replyText.trim()}
                            onClick={() => handlePostReply(comment.id)}
                            className="rounded-xl text-xs font-bold h-8 bg-primary text-white"
                          >
                            Reply
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Nested Replies (Level 2) */}
                    {replies.length > 0 && (
                      <div className="pl-8 sm:pl-12 space-y-2">
                        {replies.map(reply => (
                          <Card key={reply.id} className="rounded-2xl border border-border p-3.5 space-y-2 bg-muted/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6 border border-border">
                                  {reply.authorAvatarUrl && <AvatarImage src={reply.authorAvatarUrl} />}
                                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                                    {(reply.authorName || 'M').charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-xs text-foreground">{reply.authorName}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(reply.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line pl-8">
                              {reply.content}
                            </p>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
