'use client';
import * as React from 'react';
import DashboardCard from "./DashboardCard";
import { Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Progress } from "@/components/ui/progress";


const CHART_COLORS = [
    '#f72585', '#b5179e', '#7209b7', '#560bad', 
    '#480ca8', '#3f37c9', '#4361ee', '#4895ef', 
    '#4cc9f0', '#d00000', '#e85d04', '#ffba08'
];

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <User size={12} />;
const getFirstName = (name?: string | null) => name ? name.split(' ')[0] : 'User';

export function UserAssignments({ 
    data, 
    totalSchools, 
    totalStudents,
    terminology = { singular: 'Entity', plural: 'Entities' }
}: { 
    data: any[], 
    totalSchools: number, 
    totalStudents: number,
    terminology?: { singular: string; plural: string }
}) {
    const isMobile = useIsMobile();
    
    if (!data) {
        return (
            <DashboardCard title={`${terminology.singular} Distribution by User`}>
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No user data available.</p>
                </div>
            </DashboardCard>
        );
    }
    
    const displayData = data
        .filter((d: any) => d.assignmentPercentage > 0)
        .map((d: any, index: number) => ({
            user: d.user,
            totalAssigned: d.totalAssigned,
            totalStudents: d.totalStudents,
            percentage: d.assignmentPercentage,
            color: d.user.color || CHART_COLORS[index % CHART_COLORS.length]
        }));
        
    if (isMobile) {
        return (
            <DashboardCard title={`${terminology.singular} Distribution by User`}>
                <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                                <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold">{totalSchools}</p>
                                <p className="text-sm text-muted-foreground">Total {terminology.plural}</p>
                            </div>
                        </div>
                         <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                                <User className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold">{totalStudents.toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground">Total Students</p>
                            </div>
                        </div>
                    </div>

                    {displayData.length > 0 ? (
                        <div className="space-y-4">
                            {displayData.map((item) => (
                                <div key={item.user.id} className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={item.user.photoURL} alt={item.user.name} />
                                                <AvatarFallback className="text-xs">{getInitials(item.user.name)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium">{item.user.name?.split(' ')[0]}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-muted-foreground">
                                            {item.totalAssigned} / {totalSchools} {item.totalAssigned === 1 ? terminology.singular.toLowerCase() : terminology.plural.toLowerCase()} ({item.percentage.toFixed(0)}%)
                                        </span>
                                    </div>
                                    <Progress value={item.percentage} style={{'--indicator-color': item.color} as React.CSSProperties} className="h-2 [&>div]:bg-[--indicator-color]" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground pt-4">
                            <p>No {terminology.plural.toLowerCase()} assigned to any users.</p>
                        </div>
                    )}
                </div>
            </DashboardCard>
        )
    }

    return (
        <DashboardCard title="Team Workload" terminology={terminology} className="flex flex-col">
                <div className="space-y-8">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
                                <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-2xl font-black tracking-tight">{totalSchools}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Total {terminology.plural}</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-border/40" />
                         <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 shadow-inner">
                                <User className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-2xl font-black tracking-tight">{totalStudents.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Cumulative Nominal Roll</p>
                            </div>
                        </div>
                    </div>

                    {displayData.length > 0 ? (
                        <div className="pt-8 pb-4">
                            {/* Unified Above-Bar-Below Layout */}
                            <div className="flex w-full gap-2">
                                {displayData.map((item) => (
                                    <div
                                        key={item.user.id}
                                        className="flex flex-col group transition-all"
                                        style={{ width: `${item.percentage}%`, minWidth: item.percentage < 5 ? 'auto' : '60px' }}
                                    >
                                        {/* Statistics Above */}
                                        <div className="mb-2.5 flex flex-col items-start min-h-[32px] justify-end">
                                            <div className="flex items-center gap-1.5">
                                                <Avatar className="h-5 w-5 rounded-md border border-background shadow-sm ring-1 ring-primary/5">
                                                    <AvatarImage src={item.user.photoURL} alt={item.user.name} />
                                                    <AvatarFallback className="text-[8px] font-bold bg-primary/5 text-primary">{getInitials(item.user.name)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-black uppercase tracking-tight text-foreground truncate max-w-[50px]">
                                                    {getFirstName(item.user.name)}
                                                </span>
                                            </div>
                                            <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5 ml-6">
                                                {item.percentage.toFixed(0)}%
                                            </div>
                                        </div>

                                        {/* Bar Segment */}
                                        <div
                                            className="h-5 w-full rounded-full transition-all hover:brightness-110 shadow-sm border border-black/5"
                                            style={{ backgroundColor: item.color }}
                                            title={`${item.user.name}: ${item.percentage.toFixed(1)}%`}
                                        />

                                        {/* Statistics Below */}
                                        <div className="mt-3 flex flex-col items-start">
                                            <div className="text-xs font-black tracking-tighter text-foreground whitespace-nowrap">
                                                {item.totalAssigned} <span className="text-[8px] font-bold text-muted-foreground uppercase ml-0.5 opacity-60">
                                                    {item.totalAssigned === 1 ? terminology.singular : terminology.plural}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500/80 uppercase tracking-tighter">
                                                {item.totalStudents.toLocaleString()} <span className="opacity-60">Students</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center gap-3 opacity-20 border-2 border-dashed rounded-[2.5rem] bg-muted/10">
                            <Users className="h-10 w-10" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No assigned operations</p>
                        </div>
                    )}
                </div>
            </DashboardCard>
    );
}
