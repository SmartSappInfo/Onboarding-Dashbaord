'use client';

/**
 * @fileoverview Standings & Leaderboard Table Component with Working Audit Modal (Phase 1).
 *
 * ARCHITECTURAL POINTER:
 * Preserves the familiar performance standings table while enhancing it with:
 * - 0-100 Performance Index and Target Attainment metrics.
 * - Working Point Ledger Audit Modal powered by getRepAuditLedgerAction (eliminating
 *   the collection naming mismatch defect).
 * - Medal tiers (🥇 Gold, 🥈 Silver, 🥉 Bronze).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Mobile-friendly horizontal scrolling container with sticky header.
 */

import * as React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Trophy, 
  ChevronRight, 
  Loader2, 
  Activity, 
  CalendarDays, 
  ListCollapse
} from 'lucide-react';
import type { LeaderboardRepSummary } from '@/lib/sales-performance/types';
import type { EffortEventDoc } from '@/lib/scoring-performance-engine';
import { getRepAuditLedgerAction } from '@/app/actions/sales-performance-actions';

interface StandingsTableTabProps {
  workspaceId: string;
  leaderboard: LeaderboardRepSummary[];
  selectedRepId: string | null;
  onSelectRep: (repId: string | null) => void;
}

export function StandingsTableTab({
  workspaceId,
  leaderboard,
  selectedRepId,
  onSelectRep,
}: StandingsTableTabProps) {
  const [repLogs, setRepLogs] = React.useState<EffortEventDoc[]>([]);
  const [isLogsLoading, setIsLogsLoading] = React.useState(false);

  const selectedRep = React.useMemo(() => {
    return leaderboard.find((r) => r.userId === selectedRepId) || null;
  }, [leaderboard, selectedRepId]);

  // Fetch individual rep audit trail when dialog opens
  React.useEffect(() => {
    if (!selectedRepId || !workspaceId) {
      setRepLogs([]);
      return;
    }

    let isCancelled = false;
    setIsLogsLoading(true);

    getRepAuditLedgerAction({ workspaceId, repId: selectedRepId, limitCount: 50 })
      .then((res) => {
        if (!isCancelled && res.success && res.data) {
          setRepLogs(res.data);
        }
      })
      .catch((err) => {
        console.error('[StandingsTableTab] Failed to fetch ledger:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLogsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedRepId, workspaceId]);

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500 fill-current animate-bounce" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-slate-400 fill-current" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600 fill-current" />;
    return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/30 pb-4">
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <ListCollapse className="h-4 w-4 text-primary" /> Performance Standings
          </CardTitle>
          <CardDescription className="text-xs">
            Rep ranking based on multi-dimensional performance index and effort points. Click on any row to audit individual activity points.
          </CardDescription>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/15">
                <TableHead className="w-12 text-center text-xs font-bold uppercase tracking-wider">Rank</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Representative</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Performance Index</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Attainment</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Meetings</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Calls</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Deals</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider">Tasks</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase tracking-wider w-[110px]">Total Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                    No active performance records logged in this period.
                  </TableCell>
                </TableRow>
              ) : (
                leaderboard.map((user, idx) => (
                  <TableRow
                    key={user.userId}
                    onClick={() => onSelectRep(user.userId)}
                    className="hover:bg-muted/20 cursor-pointer transition-all duration-150 group border-b border-border/20 last:border-none active:scale-[0.99]"
                  >
                    <TableCell className="py-4 text-center">
                      <div className="flex justify-center">{getRankBadge(idx)}</div>
                    </TableCell>
                    <TableCell className="py-4 font-bold text-xs">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shadow-sm">
                          <AvatarImage src={user.photoURL} />
                          <AvatarFallback className="bg-muted text-[10px] font-bold">
                            {user.userName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-left">
                          <span className="group-hover:text-primary transition-colors font-extrabold text-foreground">
                            {user.userName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">{user.userEmail}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <Badge variant="outline" className="font-mono font-black text-xs px-2.5 py-0.5 border-primary/30 text-primary bg-primary/5">
                        {user.performanceIndex} / 100
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      {user.targetAttainmentPercent !== undefined ? (
                        <span className="font-mono text-xs font-bold text-foreground">
                          {user.targetAttainmentPercent}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs font-mono">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                      {user.meetings}
                    </TableCell>
                    <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                      {user.calls}
                    </TableCell>
                    <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                      {user.deals}
                    </TableCell>
                    <TableCell className="py-4 text-center text-xs font-bold font-mono text-muted-foreground">
                      {user.tasks}
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
        </div>
      </Card>

      {/* Point Ledger Audit Trail Modal */}
      <Dialog open={selectedRepId !== null} onOpenChange={(open) => !open && onSelectRep(null)}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border shadow-sm">
                <AvatarImage src={selectedRep?.photoURL} />
                <AvatarFallback className="bg-muted text-xs font-bold">
                  {selectedRep?.userName.charAt(0) || 'R'}
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
            ) : repLogs.length === 0 ? (
              <div className="text-center py-12 text-xs italic text-muted-foreground">
                No individual scoring events logged for this user in the selected workspace.
              </div>
            ) : (
              <div className="space-y-3">
                {repLogs.map((log) => {
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
                            &ldquo;{String(log.metadata.description)}&rdquo;
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
  );
}
