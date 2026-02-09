'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DashboardCard from "./DashboardCard";

const COLORS = [
    '#7209b7', // Purple
    '#A8E063', // Lemon Green
    '#FFBA08', // Yellow
    '#4361ee',
    '#f72585',
    '#b5179e',
    '#560bad',
    '#480ca8',
    '#3f37c9',
    '#4895ef',
    '#4cc9f0',
    '#d00000',
];

export function PipelinePieChart({ stages }: { stages: { name: string; count: number; color?: string }[] }) {
    const chartData = stages.filter(stage => stage.count > 0);
    const totalSchools = chartData.reduce((acc, curr) => acc + curr.count, 0);

    if (totalSchools === 0) {
        return (
            <DashboardCard title="Onboarding Pipeline">
                <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                    <p>No schools in the pipeline yet.</p>
                </div>
            </DashboardCard>
        );
    }
  
  return (
    <DashboardCard title="Onboarding Pipeline">
        <div className="w-full h-80">
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={110}
                        innerRadius={80}
                        cornerRadius={8}
                        paddingAngle={2}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="name"
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                            const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                            if (percent < 0.05) return null; // Don't render label for small slices
                            return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold">
                                    {`${(percent * 100).toFixed(0)}%`}
                                </text>
                            );
                        }}
                    >
                        {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            background: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                        }}
                    />
                    <Legend iconSize={10} wrapperStyle={{fontSize: '12px'}}/>
                </PieChart>
            </ResponsiveContainer>
        </div>
    </DashboardCard>
  )
}
