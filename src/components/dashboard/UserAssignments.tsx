
'use client';
import DashboardCard from "./DashboardCard";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <User size={12} />;

export function UserAssignments({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return (
            <DashboardCard title="Users & Assigned Schools">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No authorized users found.</p>
                </div>
            </DashboardCard>
        );
    }
  
    return (
        <DashboardCard title="Users & Assigned Schools">
            <TooltipProvider>
                <div className="space-y-6">
                {data.map(userData => {
                    const totalSchools = userData.totalAssigned;
                    return (
                        <div key={userData.user.id}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={userData.user.photoURL} alt={userData.user.name} />
                                        <AvatarFallback>{getInitials(userData.user.name)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{userData.user.name}</span>
                                </div>
                                <span className="text-sm font-semibold">{totalSchools} {totalSchools === 1 ? 'school' : 'schools'}</span>
                            </div>
                            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                                {totalSchools > 0 && userData.schoolsByStage.map((stage: any, index: number) => {
                                    if (stage.count === 0) return null;
                                    const percentage = (stage.count / totalSchools) * 100;
                                    return (
                                        <Tooltip key={index}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="h-full transition-all"
                                                    style={{ width: `${percentage}%`, backgroundColor: stage.color }}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{stage.name}: {stage.count}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
                </div>
            </TooltipProvider>
        </DashboardCard>
    );
}

    