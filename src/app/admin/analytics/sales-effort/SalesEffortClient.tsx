'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageContainer } from '@/components/ui/page-container';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Trophy, 
  Flame, 
  Phone, 
  Calendar, 
  CheckSquare, 
  TrendingUp, 
  Users, 
  Activity, 
  CalendarDays,
  Target,
  Sparkles,
  Loader2,
  ChevronRight,
  ListCollapse
} from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import type { UserEffortSummaryDoc } from '@/lib/scoring-performance-engine';

interface LeaderboardUser extends UserEffortSummaryDoc {
  userName: string;
  userEmail: string;
  photoURL?: string;
}

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee'];

export default function SalesEffortClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();

  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);

  // 1. Fetch user effort summaries
  const summaryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'userEffortSummary'));
  }, [firestore]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection<UserEffortSummaryDoc>(summaryQuery);

  // 2. Fetch workspace users to resolve names/emails
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspace?.organizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeWorkspace.organizationId)
    );
  }, [firestore, activeWorkspace?.organizationId]);
  const { data: orgUsers } = useCollection<UserProfile>(usersQuery);

  // 3. Query ledger for selected user's detailed activity stream
  const repLedgerQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId || !selectedRepId) return null;
    return query(
      collection(firestore, 'effortScoringLedger'),
      where('workspaceId', '==', activeWorkspaceId),
      where('actorId', '==', selectedRepId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore, activeWorkspaceId, selectedRepId]);
  const { data: repLogs, isLoading: isLogsLoading } = useCollection<any>(repLedgerQuery);

  // Resolve leaderboard list
  const leaderboard = useMemo<LeaderboardUser[]>(() => {
    if (!summaries || !orgUsers) return [];
    const usersMap = new Map<string, UserProfile>();
    orgUsers.forEach(u => usersMap.set(u.id, u));

    const list: LeaderboardUser[] = [];
    summaries.forEach(s => {
      const u = usersMap.get(s.userId);
      if (u) {
        list.push({
          ...s,
          userName: u.name || 'Anonymous Representative',
          userEmail: u.email || '',
          photoURL: u.photoURL
        });
      }
    });

    return list.sort((a, b) => b.totalPoints - a.totalPoints);
  }, [summaries, orgUsers]);

  const selectedRep = useMemo(() => {
    return leaderboard.find(r => r.userId === selectedRepId);
  }, [leaderboard, selectedRepId]);

  // Aggregate high level metrics
  const metrics = useMemo(() => {
    if (leaderboard.length === 0) {
      return { totalPoints: 0, avgPoints: 0, activeReps: 0, topRep: null };
    }

    const totalPoints = leaderboard.reduce((sum, u) => sum + u.totalPoints, 0);
    const activeReps = leaderboard.length;
    const avgPoints = Math.round(totalPoints / activeReps);
    const topRep = leaderboard[0];

    return { totalPoints, avgPoints, activeReps, topRep };
  }, [leaderboard]);

  // Prepare chart data
  const chartDataPoints = useMemo(() => {
    return leaderboard.slice(0, 8).map(u => ({
      name: u.userName.split(' ')[0],
      Points: u.totalPoints
    }));
  }, [leaderboard]);

  const chartDataActivities = useMemo(() => {
    let meetings = 0;
    let calls = 0;
    let tasks = 0;
    let deals = 0;
    let campaigns = 0;

    leaderboard.forEach(u => {
      meetings += u.meetings || 0;
      calls += u.calls || 0;
      tasks += u.tasks || 0;
      deals += u.deals || 0;
      campaigns += u.campaigns || 0;
    });

    return [
      { name: 'Meetings', count: meetings },
      { name: 'Calls', count: calls },
      { name: 'Tasks', count: tasks },
      { name: 'Deals', count: deals },
      { name: 'Campaigns', count: campaigns }
    ].filter(item => item.count > 0);
  }, [leaderboard]);

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500 fill-current animate-bounce" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-slate-400 fill-current" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600 fill-current" />;
    return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-24 w-full text-left">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Flame className="h-6 w-6 text-orange-500 fill-current animate-pulse" /> Sales Effort & Productivity
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor operational activity points and reward leaderboard standouts in the CRM workspace.
            </p>
          </div>
        </div>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Top Rep Card */}
          <Card className="rounded-2xl border-yellow-500/20 bg-yellow-500/5 backdrop-blur-md shadow-sm p-5 flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-yellow-500 shadow-md">
              <AvatarImage src={metrics.topRep?.photoURL} />
              <AvatarFallback className="bg-yellow-500/10 text-yellow-600 font-extrabold">
                {metrics.topRep?.userName.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <Trophy className="h-3 w-3 fill-current" /> Leader
              </span>
              <h4 className="font-extrabold text-xs text-foreground truncate max-w-[140px]">
                {metrics.topRep?.userName || 'No reps yet'}
              </h4>
              <p className="text-xs font-black text-muted-foreground font-mono">
                {metrics.topRep?.totalPoints || 0} pts
              </p>
            </div>
          </Card>

          {/* Total Points */}
          <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Total Workspace Effort</span>
              <h2 className="text-2xl font-black font-mono">{metrics.totalPoints}</h2>
            </div>
            <TrendingUp className="h-8 w-8 text-primary opacity-60" />
          </Card>

          {/* Avg Points */}
          <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Average Points / Rep</span>
              <h2 className="text-2xl font-black font-mono">{metrics.avgPoints}</h2>
            </div>
            <Target className="h-8 w-8 text-emerald-500 opacity-60" />
          </Card>

          {/* Active Reps */}
          <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Active Sales reps</span>
              <h2 className="text-2xl font-black font-mono">{metrics.activeReps}</h2>
            </div>
            <Users className="h-8 w-8 text-indigo-500 opacity-60" />
          </Card>
        </div>

        {/* Main Grid: Leaderboard & Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Leaderboard list - 7 Cols */}
          <Card className="lg:col-span-7 rounded-2xl border-border/40 bg-card/35 backdrop-blur-md overflow-hidden">
            <CardHeader className="border-b border-border/30 pb-4">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <ListCollapse className="h-4 w-4 text-primary" /> Performance Standings
              </CardTitle>
              <CardDescription className="text-xs">
                Rep ranking based on weighted sales effort points awarded. Click on a row to audit activities.
              </CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead className="w-12 text-center text-xs font-bold uppercase tracking-wider">Rank</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Representative</TableHead>
                  <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Meetings</TableHead>
                  <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Calls</TableHead>
                  <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Deals</TableHead>
                  <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Tasks</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase tracking-wider w-[100px]">Total Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isSummariesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                      Loading performance standings...
                    </TableCell>
                  </TableRow>
                ) : leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                      No points have been logged in the active workspace.
                    </TableCell>
                  </TableRow>
                ) : (
                  leaderboard.map((user, idx) => (
                    <TableRow
                      key={user.userId}
                      onClick={() => setSelectedRepId(user.userId)}
                      className="hover:bg-muted/20 cursor-pointer transition-all duration-150 group border-b border-border/20 last:border-none"
                    >
                      <TableCell className="py-4 text-center">
                        <div className="flex justify-center">{getRankBadge(idx)}</div>
                      </TableCell>
                      <TableCell className="py-4 font-bold text-xs">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shadow-sm">
                            <AvatarImage src={user.photoURL} />
                            <AvatarFallback className="bg-muted text-[10px] font-bold">
                              {user.userName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="group-hover:text-primary transition-colors font-extrabold">{user.userName}</span>
                            <span className="text-[9px] text-muted-foreground font-medium">{user.userEmail}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                        {user.meetings || 0}
                      </TableCell>
                      <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                        {user.calls || 0}
                      </TableCell>
                      <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                        {user.deals || 0}
                      </TableCell>
                      <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                        {user.tasks || 0}
                      </TableCell>
                      <TableCell className="py-4 text-right font-black text-sm font-mono text-foreground">
                        <div className="flex items-center justify-end gap-1.5 font-bold pr-1">
                          {user.totalPoints}
                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Charts section - 5 Cols */}
          <div className="lg:col-span-5 space-y-6">
            {/* Top Reps Chart */}
            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md p-5">
              <h4 className="text-sm font-extrabold tracking-tight mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500 fill-current" /> Effort by Executive (Top 8)
              </h4>
              <div className="h-[200px] w-full">
                {chartDataPoints.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-semibold">
                    No data to chart.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataPoints} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} 
                        labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}
                        itemStyle={{ fontSize: '11px', color: '#818cf8' }}
                      />
                      <Bar dataKey="Points" fill="#818cf8" radius={[4, 4, 0, 0]}>
                        {chartDataPoints.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Activities Distribution */}
            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md p-5">
              <h4 className="text-sm font-extrabold tracking-tight mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" /> CRM Action Mix
              </h4>
              <div className="h-[200px] w-full flex flex-col sm:flex-row items-center justify-around gap-4">
                {chartDataActivities.length === 0 ? (
                  <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground font-semibold">
                    No activity data to chart.
                  </div>
                ) : (
                  <>
                    <div className="h-full w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartDataActivities}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={4}
                            dataKey="count"
                          >
                            {chartDataActivities.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} 
                            itemStyle={{ fontSize: '11px', color: '#fff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 w-1/2 justify-center">
                      {chartDataActivities.map((item, idx) => (
                        <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="text-muted-foreground font-medium">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold pr-4">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Detailed logs modal */}
        <Dialog open={selectedRepId !== null} onOpenChange={(open) => !open && setSelectedRepId(null)}>
          <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border shadow-sm">
                  <AvatarImage src={selectedRep?.photoURL} />
                  <AvatarFallback className="bg-muted text-xs font-bold">
                    {selectedRep?.userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <DialogTitle className="text-base font-extrabold">{selectedRep?.userName}</DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Activity className="h-3.5 w-3.5 text-primary" /> Point Ledger Details ({selectedRep?.totalPoints} points earned)
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {isLogsLoading ? (
                <div className="flex items-center justify-center py-12 text-xs font-semibold text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
                  Loading activity log audit trail...
                </div>
              ) : !repLogs || repLogs.length === 0 ? (
                <div className="text-center py-12 text-xs italic text-muted-foreground">
                  No individual scoring points events logged for this user.
                </div>
              ) : (
                <div className="space-y-3">
                  {repLogs.map((log: any) => {
                    const date = log.createdAt ? new Date(log.createdAt) : new Date();
                    return (
                      <div 
                        key={log.id} 
                        className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-muted/10 transition-all hover:bg-muted/15"
                      >
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-lg px-1.5 py-0">
                              {log.eventType}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                              <CalendarDays className="h-2.5 w-2.5" />
                              {date.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs font-extrabold text-foreground">
                            {log.entityType} Activity Logged
                          </p>
                          {log.metadata?.description && (
                            <p className="text-[10px] text-muted-foreground font-medium italic">
                              "{log.metadata.description}"
                            </p>
                          )}
                        </div>
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-mono font-black text-xs px-2 py-0.5">
                          +{log.points} Pts
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
