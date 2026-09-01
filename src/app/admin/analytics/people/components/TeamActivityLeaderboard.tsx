'use client';

/**
 * @fileOverview Team & Squad Engagement Leaderboard (Analytics 2.0)
 *
 * Ranks teams and squads by adoption velocity, weekly event throughput, and active member ratio.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Table with zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users2, Award, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamLeaderboardItem {
  teamId: string;
  teamName: string;
  memberCount: number;
  activeMemberCount: number;
  activePercent: number;
  weeklyEventVolume: number;
}

interface TeamActivityLeaderboardProps {
  leaderboard: TeamLeaderboardItem[];
  isLoading: boolean;
}

export function TeamActivityLeaderboard({
  leaderboard,
  isLoading,
}: TeamActivityLeaderboardProps) {
  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-sm font-bold">Team & Squad Activity Leaderboard</CardTitle>
            <CardDescription className="text-xs">
              Weekly collaboration velocity and member engagement rates across departments
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Rank & Team</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Total Members</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Active Ratio</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Weekly Event Volume</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="p-4">
                    <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : leaderboard.length > 0 ? (
              leaderboard.map((team, index) => (
                <TableRow key={team.teamId} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                        index === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'
                      )}>
                        {index + 1}
                      </span>
                      <span className="font-semibold text-xs text-foreground">{team.teamName}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-foreground font-medium">{team.memberCount} members</span>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1 w-28">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">{team.activeMemberCount}/{team.memberCount}</span>
                        <span className="font-bold text-foreground">{team.activePercent}%</span>
                      </div>
                      <Progress value={team.activePercent} className="h-1.5" />
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1 text-xs font-mono font-semibold">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {team.weeklyEventVolume} actions/wk
                    </div>
                  </TableCell>

                  <TableCell className="text-right pr-4">
                    <Badge
                      variant={team.activePercent >= 70 ? 'default' : 'outline'}
                      className={cn(
                        'text-[9px] uppercase tracking-wider',
                        team.activePercent >= 70 && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      )}
                    >
                      {team.activePercent >= 70 ? 'Optimal' : 'Needs Nudge'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                  No active teams found. Create teams in Workforce Hub to track squad velocity.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default TeamActivityLeaderboard;
