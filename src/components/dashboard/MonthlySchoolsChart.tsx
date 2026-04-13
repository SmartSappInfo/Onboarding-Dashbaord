
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DashboardCard from "./DashboardCard";

const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlySchoolsChart({ 
    data,
    terminology = { singular: 'Entity', plural: 'Entities' }
}: { 
    data: { name: string, total: number }[],
    terminology?: { singular: string, plural: string }
}) {

    const chartData = monthOrder.map(month => {
        const monthData = data.find(d => d.name === month);
        return {
            name: month,
            total: monthData ? monthData.total : 0,
        };
    });

    const hasData = data.some(d => d.total > 0);

    return (
        <DashboardCard 
            title={`${terminology.plural} Added Per Month`}
            description={`Monthly trend of new ${terminology.singular.toLowerCase()} registrations.`}
        >
             <div className="w-full h-72">
                {hasData ? (
                    <ResponsiveContainer>
                        <BarChart
                            data={chartData}
                            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    background: "hsl(var(--card))",
                                    borderColor: "hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                    fontSize: "12px"
                                }}
                            />
                            <Bar dataKey="total" name={`${terminology.plural} Added`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                        <p>No {terminology.plural.toLowerCase()} added this year to display.</p>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}

    