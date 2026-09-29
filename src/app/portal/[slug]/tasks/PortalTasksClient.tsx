'use client';

/**
 * {{Org_name}} Experience Platform — Member Tasks & Action Hub Client
 *
 * Dedicated task execution hub for learners. Supports practical drills,
 * starter templates, dropzone deliverable submissions, and instructor review feedback.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ListOrdered,
  CheckCircle2,
  Clock,
  ExternalLink,
  Award,
  Loader2,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  Search,
  CheckSquare,
  Download,
} from 'lucide-react';
import {
  listTasksByPortalAction,
  completeTaskAction,
} from '@/app/actions/engagement-actions';
import type { Portal } from '@/lib/types/portal';
import type { PortalMembership } from '@/lib/types/membership';
import type { MemberTask, TaskSubmission } from '@/lib/types/engagement';
import { getPortalRadiusCss, getGoogleFontsUrl } from '@/lib/utils/portal-theme';
import { PortalShellHeader } from '../components/PortalShellHeader';
import { PortalShellFooter } from '../components/PortalShellFooter';
import { PortalThemeProvider } from '../components/PortalThemeProvider';
import { PortalSearchModal } from '../components/PortalSearchModal';
import { PortalAuthModal } from '../components/PortalAuthModal';
import { TaskSubmissionDropzoneModal } from './components/TaskSubmissionDropzoneModal';

interface PortalTasksClientProps {
  slug: string;
  initialPortal?: Portal | null;
}

export default function PortalTasksClient({ slug, initialPortal }: PortalTasksClientProps) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'all' | 'todo' | 'review' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');

  const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // Selected task for dropzone modal
  const [selectedTaskForUpload, setSelectedTaskForUpload] = React.useState<MemberTask | null>(null);
  const [isDropzoneOpen, setIsDropzoneOpen] = React.useState(false);

  // Direct completion loading state
  const [completingTaskId, setCompletingTaskId] = React.useState<string | null>(null);

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? initialPortal ?? null;

  // 2. Query Membership
  const membershipQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'portal_memberships'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid),
            limit(1)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: memberDocs } = useCollection<PortalMembership>(membershipQuery);
  const currentMembership = memberDocs?.[0] ?? null;
  const isMember = Boolean(currentMembership && currentMembership.status === 'active');

  // 3. Fallback server tasks
  const [serverTasks, setServerTasks] = React.useState<MemberTask[]>([]);
  const fetchTasks = React.useCallback(async () => {
    if (!portal?.id) return;
    try {
      const res = await listTasksByPortalAction(portal.id, await auth.currentUser?.getIdToken());
      if (res.success && res.data) {
        setServerTasks(res.data);
      }
    } catch {
      // Graceful fallback
    }
  }, [auth, portal?.id]);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 4. Query Tasks (Realtime)
  const tasksQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(
            collection(firestore, 'member_tasks'),
            where('portalId', '==', portal.id),
            where('isArchived', '==', false),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portal?.id]
  );
  const { data: tasksList, isLoading: isLoadingTasksList } = useCollection<MemberTask>(tasksQuery);
  const tasks = tasksList && tasksList.length > 0 ? tasksList : serverTasks;
  const isLoadingTasks = isLoadingTasksList && tasks.length === 0;

  // 5. Query Submissions for User
  const submissionsQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'task_submissions'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: submissions } = useCollection<TaskSubmission>(submissionsQuery);

  // Map submissions by taskId
  const submissionMap = React.useMemo(() => {
    const map = new Map<string, TaskSubmission>();
    (submissions || []).forEach(sub => {
      map.set(sub.taskId, sub);
    });
    return map;
  }, [submissions]);

  // Direct completion for non-file tasks
  const handleDirectComplete = async (task: MemberTask) => {
    if (!portal || !user) return;
    setCompletingTaskId(task.id);
    try {
      const res = await completeTaskAction(
        await user.getIdToken(),
        {
          portalId: portal.id,
          taskId: task.id,
        },
        slug
      );

      if (!res.success) throw new Error(res.error);
      toast({
        title: 'Task Completed! 🏆',
        description: `Claimed +${task.pointsReward} reward points.`,
      });
      fetchTasks();
    } catch (err: unknown) {
      toast({
        title: 'Task Action Failed',
        description: err instanceof Error ? err.message : 'Could not complete task.',
      });
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleOpenUploadModal = (task: MemberTask) => {
    setSelectedTaskForUpload(task);
    setIsDropzoneOpen(true);
  };

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      const sub = submissionMap.get(task.id);
      const isDone = sub?.status === 'completed' || sub?.reviewStatus === 'approved';
      const isReview = sub?.reviewStatus === 'pending_review';
      const isRejected = sub?.reviewStatus === 'rejected';

      // Tab filter
      if (activeTab === 'todo' && isDone) return false;
      if (activeTab === 'review' && !isReview && !isRejected) return false;
      if (activeTab === 'completed' && !isDone) return false;

      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description ? task.description.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchDesc) return false;
      }

      return true;
    });
  }, [tasks, submissionMap, activeTab, priorityFilter, searchQuery]);

  // Metrics
  const totalTasksCount = tasks.length;
  const completedCount = tasks.filter(t => {
    const s = submissionMap.get(t.id);
    return s?.status === 'completed' || s?.reviewStatus === 'approved';
  }).length;
  const underReviewCount = tasks.filter(t => submissionMap.get(t.id)?.reviewStatus === 'pending_review').length;
  const totalPointsEarned = tasks.reduce((sum, t) => {
    const s = submissionMap.get(t.id);
    if (s?.status === 'completed' || s?.reviewStatus === 'approved') {
      return sum + (t.pointsReward || 0);
    }
    return sum;
  }, 0);

  // Format relative due date
  const formatDueDate = (dateStr?: string): { text: string; isOverdue: boolean } => {
    if (!dateStr) return { text: '', isOverdue: false };
    const due = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, isOverdue: true };
    }
    if (diffDays === 0) {
      return { text: 'Due Today', isOverdue: false };
    }
    if (diffDays === 1) {
      return { text: 'Due Tomorrow', isOverdue: false };
    }
    return { text: `Due in ${diffDays}d`, isOverdue: false };
  };

  // Loading skeleton
  if (isLoadingPortal && !initialPortal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h2 className="text-xl font-bold text-foreground">Portal Not Found</h2>
          <Button asChild className="rounded-xl">
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const theme = portal.theme;
  const branding = portal.branding;
  const navigation = portal.navigation;
  const radiusCss = getPortalRadiusCss(theme.ui?.borderRadius);
  const googleFontsUrl = getGoogleFontsUrl(
    theme.typography?.headingFont || 'Figtree',
    theme.typography?.bodyFont || 'Figtree'
  );
  const brandTitle = branding.brandName || portal.name;

  return (
    <PortalThemeProvider
      portalId={portal.id}
      portalSlug={slug}
      theme={theme}
      className="min-h-screen flex flex-col justify-between"
    >
      {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl} />}

      {/* Header */}
      <PortalShellHeader
        slug={slug}
        brandTitle={brandTitle}
        theme={theme}
        branding={branding}
        navigation={navigation}
        radiusCss={radiusCss}
        user={user}
        isMember={isMember}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={() => auth && signOut(auth)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-bold text-xs bg-primary/10 text-primary gap-1 px-2.5 py-0.5 rounded-lg">
                  <CheckSquare className="w-3.5 h-3.5" /> Action Tasks Hub
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                Action Tasks & Deliverables
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Complete institutional drills, execute practical assignments, submit audit sheets, and earn XP points.
              </p>
            </div>

            <Button asChild variant="outline" className="rounded-xl font-bold text-xs self-start sm:self-auto min-h-[44px]">
              <Link href={`/portal/${slug}/dashboard`}>
                Return to Dashboard
              </Link>
            </Button>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Total Tasks</p>
              <p className="text-xl font-black text-foreground">{totalTasksCount}</p>
            </div>
            <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Completed</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{completedCount}</p>
            </div>
            <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Under Review</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{underReviewCount}</p>
            </div>
            <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-2xs space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-500" /> Points Earned
              </p>
              <p className="text-xl font-black text-primary">+{totalPointsEarned} XP</p>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val: string) => setActiveTab(val as 'all' | 'todo' | 'review' | 'completed')}
            className="w-full sm:w-auto"
          >
            <TabsList className="h-11 p-1 bg-muted/60 rounded-2xl">
              <TabsTrigger value="all" className="rounded-xl text-xs font-bold min-h-[36px]">
                All ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="todo" className="rounded-xl text-xs font-bold min-h-[36px]">
                To Do ({tasks.length - completedCount})
              </TabsTrigger>
              <TabsTrigger value="review" className="rounded-xl text-xs font-bold min-h-[36px]">
                Under Review ({underReviewCount})
              </TabsTrigger>
              <TabsTrigger value="completed" className="rounded-xl text-xs font-bold min-h-[36px]">
                Completed ({completedCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search & Priority Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9 h-11 text-xs rounded-xl min-h-[44px]"
              />
            </div>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-11 w-32 text-xs rounded-xl bg-background min-h-[44px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" className="text-xs">All Priority</SelectItem>
                <SelectItem value="urgent" className="text-xs">🔴 Urgent</SelectItem>
                <SelectItem value="high" className="text-xs">🟠 High</SelectItem>
                <SelectItem value="medium" className="text-xs">🟡 Medium</SelectItem>
                <SelectItem value="low" className="text-xs">🟢 Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tasks Grid */}
        {isLoadingTasks ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-56 rounded-3xl" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
            <ListOrdered className="w-12 h-12 mx-auto text-primary/40" />
            <h3 className="font-bold text-base text-foreground">No tasks match this filter</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Try adjusting your search query, priority filter, or view all tasks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTasks.map(task => {
              const sub = submissionMap.get(task.id);
              const isDone = sub?.status === 'completed' || sub?.reviewStatus === 'approved';
              const isUnderReview = sub?.reviewStatus === 'pending_review';
              const isRejected = sub?.reviewStatus === 'rejected';
              const dueInfo = formatDueDate(task.dueDate);

              return (
                <Card
                  key={task.id}
                  className={`rounded-3xl border-2 p-5 space-y-4 flex flex-col justify-between transition-all duration-200 shadow-2xs group ${
                    isDone
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : isUnderReview
                      ? 'border-amber-500/20 bg-amber-500/5'
                      : isRejected
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-border bg-card hover:border-primary/40 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold uppercase capitalize ${
                          task.priority === 'urgent'
                            ? 'bg-rose-500/10 text-rose-600'
                            : task.priority === 'high'
                            ? 'bg-amber-500/10 text-amber-600'
                            : ''
                        }`}
                      >
                        {task.priority} Priority
                      </Badge>

                      <Badge variant="outline" className="font-bold text-xs gap-1 text-primary border-primary/20">
                        <Award className="w-3 h-3 text-amber-500" />
                        +{task.pointsReward} Points
                      </Badge>
                    </div>

                    {/* Task Title & Description */}
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Due Date & Template Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {task.dueDate && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-semibold gap-1 ${
                            dueInfo.isOverdue
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {dueInfo.text} ({new Date(task.dueDate).toLocaleDateString()})
                        </Badge>
                      )}

                      {task.requireFileUpload && (
                        <Badge variant="outline" className="text-[10px] font-medium gap-1 text-primary border-primary/20 bg-primary/5">
                          <UploadCloud className="w-3 h-3" /> File Required
                        </Badge>
                      )}
                    </div>

                    {/* Starter Template Download */}
                    {task.downloadTemplateUrl && (
                      <div className="pt-1">
                        <a
                          href={task.downloadTemplateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline p-1.5 rounded-lg bg-emerald-500/10 min-h-[44px] flex items-center"
                        >
                          <FileSpreadsheet className="w-4 h-4 shrink-0" />
                          Download Assignment Template
                          <Download className="w-3 h-3 ml-0.5" />
                        </a>
                      </div>
                    )}

                    {/* Feedback if Rejected */}
                    {isRejected && sub.instructorFeedback && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        <p className="font-bold flex items-center gap-1 text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Instructor Feedback:
                        </p>
                        <p className="italic pl-4 text-[11px]">&ldquo;{sub.instructorFeedback}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="pt-3 border-t border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    {isDone ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Completed & Approved
                      </div>
                    ) : isUnderReview ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <Clock className="w-4 h-4" />
                        Under Instructor Review
                      </div>
                    ) : isRejected ? (
                      <Button
                        onClick={() => handleOpenUploadModal(task)}
                        className="w-full sm:w-auto rounded-xl font-bold text-xs bg-amber-600 text-white hover:bg-amber-700 min-h-[44px] active:scale-[0.97]"
                      >
                        Re-submit Assignment
                      </Button>
                    ) : task.requireFileUpload ? (
                      <Button
                        onClick={() => handleOpenUploadModal(task)}
                        className="w-full sm:w-auto rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97] gap-1.5 shadow-sm"
                      >
                        <UploadCloud className="w-4 h-4" /> Submit Deliverable
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleDirectComplete(task)}
                        disabled={completingTaskId === task.id}
                        className="w-full sm:w-auto rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97] gap-1.5 shadow-sm"
                      >
                        {completingTaskId === task.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Mark Complete
                      </Button>
                    )}

                    {task.actionUrl && (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-xs font-bold min-h-[44px] gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <a href={task.actionUrl} target="_blank" rel="noopener noreferrer">
                          Open Tool <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <PortalShellFooter
        slug={slug}
        brandTitle={brandTitle}
        tagline={branding.tagline || 'Experience Platform powered by SmartSapp.'}
        branding={branding}
        navigation={navigation}
      />

      {/* Instant Search Modal */}
      <PortalSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        portalId={portal.id}
        portalSlug={slug}
      />

      {/* Member Auth Modal */}
      <PortalAuthModal
        portal={portal}
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
      />

      {/* Dropzone File Upload Modal */}
      {user && selectedTaskForUpload && (
        <TaskSubmissionDropzoneModal
          open={isDropzoneOpen}
          onOpenChange={setIsDropzoneOpen}
          task={selectedTaskForUpload}
          portalId={portal.id}
          portalSlug={slug}
          userId={user.uid}
          existingSubmission={submissionMap.get(selectedTaskForUpload.id)}
          onSuccess={fetchTasks}
        />
      )}
    </PortalThemeProvider>
  );
}
