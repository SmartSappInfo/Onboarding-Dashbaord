'use client';

/**
 * {{Org_name}} Experience Platform — Member Public Profile Modal
 *
 * Polished, high-converting social profile modal presenting member achievements,
 * gamification tier, streak, and community contributions.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Sparkles,
  Flame,
  BookOpen,
  CheckCircle2,
  Calendar,
  Award,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import { getMemberPublicProfileAction } from '@/app/actions/community-actions';
import type { MemberPublicProfile } from '@/lib/types/community';

interface MemberPublicProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  userId: string | null;
  fallbackName?: string;
  fallbackAvatar?: string;
  fallbackRole?: string;
}

export function MemberPublicProfileModal({
  open,
  onOpenChange,
  portalId,
  userId,
  fallbackName,
  fallbackAvatar,
  fallbackRole,
}: MemberPublicProfileModalProps) {
  const [profile, setProfile] = React.useState<MemberPublicProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!open || !userId || !portalId) {
      setProfile(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getMemberPublicProfileAction(portalId, userId)
      .then(res => {
        if (isMounted && res.success && res.data) {
          setProfile(res.data);
        }
      })
      .catch(() => {
        // Silently keep fallback
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, portalId, userId]);

  const displayName = profile?.displayName || fallbackName || 'Community Member';
  const avatarUrl = profile?.avatarUrl || fallbackAvatar;
  const role = profile?.role || fallbackRole || 'member';
  const points = profile?.points ?? 0;
  const streakDays = profile?.streakDays ?? 0;
  const level = profile?.level ?? 1;
  const levelName = profile?.levelName ?? 'Novice';

  // Level progress percentage calculation
  const nextLevelThreshold = level === 1 ? 10 : level === 2 ? 25 : level === 3 ? 50 : 100;
  const prevLevelThreshold = level === 1 ? 0 : level === 2 ? 10 : level === 3 ? 25 : 50;
  const levelProgressPct =
    level >= 5
      ? 100
      : Math.min(
          100,
          Math.max(
            5,
            Math.round(((points - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100)
          )
        );

  const formattedJoinedDate = profile?.joinedAt
    ? new Date(profile.joinedAt).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-2 border-border rounded-3xl bg-card shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{displayName}&apos;s Public Profile</DialogTitle>
          <DialogDescription>
            Community reputation, badges, and learning journey on the platform.
          </DialogDescription>
        </DialogHeader>

        {/* ── Banner Header ─────────────────────────────────────────────── */}
        <div className="h-28 bg-gradient-to-r from-primary/80 via-primary to-indigo-600 relative flex items-end px-6 pb-2">
          <div className="absolute -bottom-10 left-6">
            <Avatar className="w-20 h-20 border-4 border-card rounded-2xl shadow-md bg-muted">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary text-white font-extrabold text-xl">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* ── Profile Details ───────────────────────────────────────────── */}
        <div className="pt-12 px-6 pb-6 space-y-5">
          {/* Name & Role Badges */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="font-extrabold text-lg text-foreground leading-tight flex items-center gap-2">
                {displayName}
                {role === 'instructor' && (
                  <span title="Course Instructor">
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </span>
                )}
                {(role === 'admin' || role === 'owner') && (
                  <span title="Community Administrator">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] font-bold uppercase capitalize py-0">
                  {role}
                </Badge>
                {profile?.planName && (
                  <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary py-0">
                    ⭐ {profile.planName}
                  </Badge>
                )}
              </div>
            </div>

            {formattedJoinedDate && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Member since {formattedJoinedDate}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Gamification Level & Points Card */}
              <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/[0.03] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                      L{level}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        {levelName}
                        <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                      </h4>
                      <p className="text-[10px] text-muted-foreground">Level {level} Community Rank</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-base text-foreground tracking-tight">
                      {points}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold ml-1">pts</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                    <span>Progress to Level {level < 5 ? level + 1 : 'Max'}</span>
                    <span>{level >= 5 ? 'Max Level' : `${points}/${nextLevelThreshold} pts`}</span>
                  </div>
                  <Progress value={levelProgressPct} className="h-2 rounded-full" />
                </div>
              </div>

              {/* Key Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-0.5">
                  <Flame className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                  <div className="font-bold text-sm text-foreground">{streakDays}</div>
                  <div className="text-[10px] text-muted-foreground font-medium">Day Streak</div>
                </div>

                <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-0.5">
                  <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                  <div className="font-bold text-sm text-foreground">{profile?.completedLessonCount ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground font-medium">Completed</div>
                </div>

                <div className="p-3 rounded-2xl border border-border bg-muted/20 space-y-0.5">
                  <BookOpen className="w-4 h-4 mx-auto text-primary mb-1" />
                  <div className="font-bold text-sm text-foreground">{profile?.enrolledCourseCount ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground font-medium">Courses</div>
                </div>
              </div>

              {/* Badges / Accolades */}
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-primary" /> Earned Badges & Milestones
                </h5>

                {profile?.badges && profile.badges.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.badges.map(badge => (
                      <div
                        key={badge.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs font-semibold"
                      >
                        <Trophy className="w-3 h-3 text-amber-500" />
                        <span>{badge.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic bg-muted/30 p-3 rounded-2xl border border-border/50">
                    Earn badges by completing courses, maintaining daily streaks, and answering peer questions.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Close Action */}
          <div className="pt-2 border-t border-border flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 px-5 rounded-xl font-bold text-xs active:scale-[0.97] transition-all min-h-[44px]"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
