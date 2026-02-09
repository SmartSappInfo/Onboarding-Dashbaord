
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
            <DashboardCard title="School Distribution">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No user data available.</p>
                </div>
            </DashboardCard>
        );
    }
    
    const assignedSchools = data.reduce((acc, userData) => acc + userData.totalAssigned, 0);
    const unassignedCount = totalSchools - assignedSchools;
    const unassignedPercentage = totalSchools > 0 ? (unassignedCount / totalSchools) * 100 : 0;

    const displayData = [...data.map(d => ({
        name: d.user.name.split(' ')[0], // First name
        percentage: d.assignmentPercentage,
    }))];
    
    if (unassignedCount > 0) {
        displayData.push({
            name: "Unassigned",
            percentage: unassignedPercentage,
        });
    }

    if (displayData.length === 0) {
        return (
            <DashboardCard title="School Distribution">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No schools to distribute.</p>
                </div>
            </DashboardCard>
        );
    }

    return (
        <DashboardCard title="School Distribution">
            <div className="space-y-4">
                <div>
                    <h2 className="text-3xl font-bold">{totalSchools}</h2>
                    <p className="text-sm text-muted-foreground">Total Schools in System</p>
                </div>

                <div className="flex w-full h-3 rounded-full overflow-hidden bg-muted">
                    {displayData.map((item, index) => (
                        <div
                            key={item.name}
                            className="h-full transition-all duration-300"
                            style={{
                                width: `${item.percentage}%`,
                                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                            }}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3 pt-2">
                    {displayData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2">
                             <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                             />
                            <div className="flex flex-col">
                                <p className="text-sm font-medium leading-none">{item.name}</p>
                                <p className="text-sm text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardCard>
    );
}
