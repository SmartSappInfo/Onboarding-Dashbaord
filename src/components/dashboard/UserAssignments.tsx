'use client';
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
        <DashboardCard title={`${terminology.singular} Distribution by User`}>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                                <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold">{totalSchools}</p>
                                <p className="text-sm text-muted-foreground">Total {terminology.plural}</p>
                            </div>
                        </div>
                        <div className="mx-4 h-12 w-px bg-border" />
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
                        <div className="space-y-3">
                            {/* Segmented Bar */}
                            <div className="flex w-full h-8 gap-1">
                                {displayData.map((item) => (
                                    <div
                                        key={item.user.id}
                                        title={`${item.percentage.toFixed(1)}%`}
                                        className="h-full rounded-md transition-all hover:brightness-110"
                                        style={{
                                            width: `${item.percentage}%`,
                                            backgroundColor: item.color,
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Aligned Labels */}
                            <div className="flex w-full gap-1 mt-3">
                                {displayData.map((item) => (
                                    <div
                                        key={item.user.id}
                                        style={{ width: `${item.percentage}%` }}
                                        className="flex flex-col"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={item.user.photoURL} alt={item.user.name} />
                                                <AvatarFallback className="text-xs">{getInitials(item.user.name)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-medium text-muted-foreground">{item.user.name?.split(' ')[0]}</span>
                                        </div>
                                         <p className="text-sm font-semibold text-foreground mt-1">
                                            {item.totalAssigned} {item.totalAssigned === 1 ? terminology.singular : terminology.plural}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            ({item.totalStudents.toLocaleString()} Students)
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground pt-4">
                            <p>No {terminology.plural.toLowerCase()} assigned to any users.</p>
                        </div>
                    )}
                </div>
            </DashboardCard>
    );
}
