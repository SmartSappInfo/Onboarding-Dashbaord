'use client';
import DashboardCard from "./DashboardCard";

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
    
    // Filter for users with assigned schools and prepare their data
    const assignedUsersData = data
        .filter(d => d.assignmentPercentage > 0)
        .map(d => ({
            name: d.user.name.split(' ')[0], // First name
            percentage: d.assignmentPercentage,
        }));

    const assignedSchools = data.reduce((acc, userData) => acc + userData.totalAssigned, 0);
    const unassignedCount = totalSchools - assignedSchools;
    const unassignedPercentage = totalSchools > 0 ? (unassignedCount / totalSchools) * 100 : 0;

    // Combine assigned user data with unassigned data if it exists
    const displayData = [...assignedUsersData];
    if (unassignedPercentage > 0) {
        displayData.push({
            name: "Unassigned",
            percentage: unassignedPercentage,
        });
    }

    if (displayData.length === 0) {
        return (
            <DashboardCard title="School Distribution by User">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No schools assigned to any users.</p>
                </div>
            </DashboardCard>
        );
    }

    return (
        <DashboardCard title="School Distribution by User" description="Percentage of total schools assigned to each user.">
            <div className="space-y-6 pt-2">
                {/* Segmented Bar */}
                <div className="flex w-full h-4 gap-1">
                    {displayData.map((item, index) => (
                        <div
                            key={item.name}
                            className="h-full rounded-full"
                            style={{
                                width: `${item.percentage}%`,
                                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                            }}
                            title={`${item.name}: ${item.percentage.toFixed(1)}%`}
                        />
                    ))}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-4">
                    {displayData.map((item, index) => (
                        <div key={item.name} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                <span className="text-sm text-muted-foreground">{item.name}</span>
                            </div>
                            <p className="text-xl font-semibold text-foreground">
                                {item.percentage.toFixed(1)}%
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardCard>
    );
}
