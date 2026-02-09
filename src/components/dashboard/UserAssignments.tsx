
'use client';
import DashboardCard from "./DashboardCard";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
    '#f72585', '#b5179e', '#7209b7', '#560bad', 
    '#480ca8', '#3f37c9', '#4361ee', '#4895ef', 
    '#4cc9f0', '#d00000', '#e85d04', '#ffba08'
];

export function UserAssignments({ data, totalSchools }: { data: any[], totalSchools: number }) {
    if (!data) {
        return (
            <DashboardCard title="School Distribution by User">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No user data available.</p>
                </div>
            </DashboardCard>
        );
    }
    
    const assignedUsersData = data
        .filter(d => d.assignmentPercentage > 0)
        .map((d, index) => ({
            name: d.user.name.split(' ')[0],
            percentage: d.assignmentPercentage,
            color: CHART_COLORS[index % CHART_COLORS.length]
        }));

    const assignedSchools = data.reduce((acc, userData) => acc + userData.totalAssigned, 0);
    const unassignedCount = totalSchools - assignedSchools;
    const unassignedPercentage = totalSchools > 0 ? (unassignedCount / totalSchools) * 100 : 0;

    const displayData = [...assignedUsersData];
    if (unassignedPercentage > 0) {
        displayData.push({
            name: "Unassigned",
            percentage: unassignedPercentage,
            color: '#6c757d' // A neutral color for unassigned
        });
    }

    return (
        <DashboardCard title="School Distribution by User">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold">{totalSchools}</p>
                        <p className="text-sm text-muted-foreground">Total Schools</p>
                    </div>
                </div>

                {displayData.length > 0 ? (
                    <div className="space-y-4">
                        {/* Segmented Bar */}
                        <div className="flex w-full h-4 gap-1">
                            {displayData.map((item, index) => (
                                <div
                                    key={item.name}
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${item.percentage}%`,
                                        backgroundColor: item.color,
                                    }}
                                    title={`${item.name}: ${item.percentage.toFixed(1)}%`}
                                />
                            ))}
                        </div>

                        {/* Aligned Labels */}
                        <div className="flex w-full gap-1">
                            {displayData.map((item) => (
                                <div
                                    key={item.name}
                                    style={{ width: `${item.percentage}%` }}
                                    className="flex flex-col"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-xs text-muted-foreground">{item.name}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground mt-0.5">
                                        {item.percentage.toFixed(1)}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground pt-4">
                        <p>No schools assigned to any users.</p>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}
