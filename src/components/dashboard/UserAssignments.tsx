'use client';
import DashboardCard from "./DashboardCard";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { User } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.map((userData: any) => {
                    const percentage = userData.assignmentPercentage || 0;
                    return (
                        <div key={userData.user.id} className="p-4 border rounded-lg bg-card shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={userData.user.photoURL} alt={userData.user.name} />
                                        <AvatarFallback>{getInitials(userData.user.name)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium text-sm">{userData.user.name}</span>
                                </div>
                                <span className="text-lg font-bold">
                                    {userData.totalAssigned}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Progress value={percentage} className="w-full h-2" />
                                <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                                    {percentage.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </DashboardCard>
    );
}