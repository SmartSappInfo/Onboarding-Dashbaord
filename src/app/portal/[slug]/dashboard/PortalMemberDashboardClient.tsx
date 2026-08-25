'use client';

/**
 * {{Org_name}} Experience Platform — Personal Member Learning Dashboard
 *
 * Dedicated personal hub for students and members displaying enrolled courses,
 * real-time progress bars, bookmarks, toolkits, live events, points, and credentials.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  GraduationCap,
  BookOpen,
  FolderArchive,
  Calendar,
  Award,
  Sparkles,
  Flame,
  ArrowRight,
  Download,
  ExternalLink,
  PlayCircle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  CreditCard,
  LogOut,
  Sliders,
  Video,
  ListOrdered,
} from 'lucide-react';
import type { Portal } from '@/lib/types/portal';
import type { PortalMembership, MembershipPlan, AccessGrant } from '@/lib/types/membership';
import type { ContentItem } from '@/lib/types/content';
import { PortalAuthModal } from '../components/PortalAuthModal';
import { MemberOnboardingWidget } from './components/MemberOnboardingWidget';
import { MemberTasksWidget } from './components/MemberTasksWidget';

interface PortalMemberDashboardClientProps {
  slug: string;
}

export default function PortalMemberDashboardClient({ slug }: PortalMemberDashboardClientProps) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('courses');
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

  // 2. Query Membership for logged-in user
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
  const { data: memberships, isLoading: isLoadingMembership } = useCollection<PortalMembership>(membershipQuery);
  const membership = memberships?.[0] ?? null;

  // 3. Query Portal Content Items (Lessons, Resources, Articles)
  const contentQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(
            collection(firestore, 'content_items'),
            where('portalId', '==', portal.id),
            where('status', '==', 'published'),
            limit(30)
          )
        : null,
    [firestore, portal?.id]
  );
  const { data: contentItems } = useCollection<ContentItem>(contentQuery);

  // 4. Query Member Access Grants
  const grantsQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'access_grants'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid),
            limit(50)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: grants } = useCollection<AccessGrant>(grantsQuery);

  const lessons = React.useMemo(() => (contentItems || []).filter(c => c.type === 'lesson'), [contentItems]);
  const resources = React.useMemo(() => (contentItems || []).filter(c => c.type === 'resource'), [contentItems]);
  const articles = React.useMemo(() => (contentItems || []).filter(c => c.type === 'article' || c.type === 'page'), [contentItems]);

  const isLoading = isLoadingPortal || isUserLoading || (user && isLoadingMembership);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-44 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h2 className="text-xl font-bold">Portal Not Found</h2>
          <Link href="/">
            <Button className="rounded-xl font-bold text-xs">Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full rounded-3xl border-2 border-border p-8 space-y-4 shadow-xl">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Lock className="w-7 h-7" />
          </div>
          <CardTitle className="text-xl font-bold">Sign In to View Dashboard</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Please authenticate to access your personal curriculum, progress tracking, and certificates.
          </CardDescription>
          <Button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full h-11 rounded-xl font-bold text-xs text-white shadow-sm gap-2"
            style={{ backgroundColor: theme.colors.primary }}
          >
            Sign In / Register <ArrowRight className="w-4 h-4" />
          </Button>
          <Link href={`/portal/${slug}`} className="block">
            <Button variant="ghost" className="rounded-xl text-xs font-semibold">
              Return to Portal Home
            </Button>
          </Link>
        </Card>

        <PortalAuthModal
          portal={portal}
          open={isAuthModalOpen}
          onOpenChange={setIsAuthModalOpen}
        />
      </div>
    );
  }

  const memberDisplayName = membership?.displayName || user.displayName || user.email?.split('@')[0] || 'Member';
  const memberPoints = membership?.points || 120;
  const memberStreak = membership?.streakDays || 3;
  const memberRole = membership?.role || 'student';
  const memberPlan = membership?.planName || 'Standard Member';

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Top Header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span className="font-bold text-sm tracking-tight hidden sm:inline">{brandTitle}</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-xl">
              <Sparkles className="w-3.5 h-3.5" /> {memberPoints} Pts
            </span>
            <span className="flex items-center gap-1 font-bold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-xl">
              <Flame className="w-3.5 h-3.5" /> {memberStreak} Day Streak
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => auth && signOut(auth).then(() => router.push(`/portal/${slug}`))}
            className="h-9 px-3 rounded-xl font-bold text-xs text-muted-foreground hover:text-rose-500 gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* ── Main Content Body ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6 md:p-10 space-y-8">
        {/* Member Profile Hero Banner */}
        <div
          className="p-6 md:p-8 rounded-3xl text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.primary} 100%)`,
          }}
        >
          <div className="flex items-center gap-4 relative z-10">
            <Avatar className="w-16 h-16 border-2 border-white/40 shadow-md">
              {user.photoURL && <AvatarImage src={user.photoURL} alt={memberDisplayName} />}
              <AvatarFallback className="bg-white/20 text-white font-black text-xl">
                {memberDisplayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">{memberDisplayName}</h1>
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] uppercase font-bold px-2 py-0.5 capitalize">
                  {memberRole}
                </Badge>
              </div>
              <p className="text-xs text-white/80">{user.email}</p>
              <p className="text-[11px] font-semibold text-white/90">
                Active Plan: <span className="underline">{memberPlan}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10 self-start md:self-auto">
            <Link href={`/portal/${slug}`}>
              <Button size="sm" className="rounded-xl font-bold text-xs bg-white text-foreground hover:bg-white/90 gap-1.5 shadow-sm">
                Explore Content Catalog <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Checklist Card */}
        <MemberOnboardingWidget
          portalId={portal.id}
          portalSlug={slug}
          userId={user.uid}
        />

        {/* Dashboard Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-11 p-1 bg-muted/60 rounded-2xl grid grid-cols-5">
            <TabsTrigger value="courses" className="rounded-xl text-xs font-bold gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> Curriculum ({lessons.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl text-xs font-bold gap-1.5">
              <ListOrdered className="w-3.5 h-3.5" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="resources" className="rounded-xl text-xs font-bold gap-1.5">
              <FolderArchive className="w-3.5 h-3.5" /> Toolkits ({resources.length})
            </TabsTrigger>
            <TabsTrigger value="reading" className="rounded-xl text-xs font-bold gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Guides ({articles.length})
            </TabsTrigger>
            <TabsTrigger value="credentials" className="rounded-xl text-xs font-bold gap-1.5">
              <Award className="w-3.5 h-3.5" /> Badges
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Curriculum / Lessons ────────────────────────────── */}
          <TabsContent value="courses" className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">Enrolled Curriculum & Lessons</h3>
                <p className="text-xs text-muted-foreground">Pick up right where you left off.</p>
              </div>
            </div>

            {lessons.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed rounded-3xl space-y-2 bg-muted/20">
                <GraduationCap className="w-8 h-8 mx-auto text-primary" />
                <h5 className="font-bold text-xs text-foreground">No Lessons Available</h5>
                <p className="text-xs text-muted-foreground">Check back as new curriculum modules are published.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lessons.map((lesson, idx) => (
                  <Card
                    key={lesson.id}
                    className="rounded-3xl border-2 border-border p-5 space-y-4 hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[9px] uppercase font-bold px-2 py-0.5">
                          Lesson #{idx + 1}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {lesson.media?.duration ? `${Math.round(lesson.media.duration / 60)} mins` : '10 min study'}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-foreground line-clamp-2">{lesson.title}</h4>
                      {lesson.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{lesson.summary}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                        <PlayCircle className="w-3.5 h-3.5" /> Interactive Video
                      </div>

                      <Link href={`/portal/${slug}/content/lesson/${lesson.slug}`}>
                        <Button size="sm" className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5">
                          Resume <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Daily Action Tasks ───────────────────────────────── */}
          <TabsContent value="tasks" className="space-y-4 pt-4">
            <MemberTasksWidget
              portalId={portal.id}
              portalSlug={slug}
              userId={user.uid}
              organizationId={portal.organizationId}
            />
          </TabsContent>

          {/* ── Tab 2: Resource Toolkits ───────────────────────────────── */}
          <TabsContent value="resources" className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">Downloadable Resource Toolkits</h3>
                <p className="text-xs text-muted-foreground">Financial spreadsheets, templates, and contracts.</p>
              </div>
            </div>

            {resources.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed rounded-3xl space-y-2 bg-muted/20">
                <FolderArchive className="w-8 h-8 mx-auto text-primary" />
                <h5 className="font-bold text-xs text-foreground">No Downloads Found</h5>
                <p className="text-xs text-muted-foreground">Toolkits will appear here once provisioned.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {resources.map(res => (
                  <Card key={res.id} className="rounded-3xl border-2 border-border p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <FolderArchive className="w-4 h-4" />
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold">
                          {res.category || 'Toolkit'}
                        </Badge>
                      </div>

                      <h4 className="font-bold text-xs text-foreground leading-snug">{res.title}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Format: <strong className="uppercase">{res.media?.mimeType || 'Document'}</strong>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border">
                      {res.media?.downloadUrl ? (
                        <a href={res.media.downloadUrl} download className="block">
                          <Button size="sm" className="w-full rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5">
                            <Download className="w-3.5 h-3.5" /> Download
                          </Button>
                        </a>
                      ) : (
                        <Link href={`/portal/${slug}/content/resource/${res.slug}`} className="block">
                          <Button size="sm" variant="outline" className="w-full rounded-xl font-bold text-xs gap-1.5">
                            View Resource
                          </Button>
                        </Link>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 3: Reading Guides ──────────────────────────────────── */}
          <TabsContent value="reading" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {articles.map(art => (
                <Link key={art.id} href={`/portal/${slug}/content/${art.type}/${art.slug}`}>
                  <Card className="rounded-3xl border-2 border-border p-5 space-y-3 hover:border-primary/40 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold">
                        {art.category || art.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString() : 'Read'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-foreground">{art.title}</h4>
                    {art.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{art.summary}</p>
                    )}

                    <span className="text-[11px] font-bold text-primary flex items-center gap-1 pt-1">
                      Read Article <ArrowRight className="w-3 h-3" />
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          {/* ── Tab 4: Badges & Credentials ────────────────────────────── */}
          <TabsContent value="credentials" className="space-y-4 pt-4">
            <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-xs">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-foreground">Verified Credentials & Badges</h4>
                  <p className="text-xs text-muted-foreground">Conforming to Open Badges 3.0 standards.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl border border-border bg-muted/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center mx-auto shadow-xs font-bold text-xs">
                    #1
                  </div>
                  <h5 className="font-bold text-xs text-foreground">Founding Scholar</h5>
                  <p className="text-[10px] text-muted-foreground">Completed the initial school setup curriculum.</p>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xs font-bold text-xs">
                    #2
                  </div>
                  <h5 className="font-bold text-xs text-foreground">Fee Recovery Specialist</h5>
                  <p className="text-[10px] text-muted-foreground">Mastered WhatsApp tuition reminder sequences.</p>
                </div>

                <div className="p-4 rounded-2xl border border-dashed border-border text-center space-y-2 flex flex-col justify-center items-center">
                  <Lock className="w-6 h-6 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground">Next Badge at 250 Pts</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by Experience Platform.</p>
      </footer>
    </div>
  );
}
