
'use client';

import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DashboardCard from "./DashboardCard";
import { Badge } from '@/components/ui/badge';
import { MapPin, Users } from 'lucide-react';

interface ZoneMetric {
    name: string;
    schoolCount: number;
    studentCount: number;
}

export function ZoneDistribution({ data }: { data: ZoneMetric[] }) {
    const hasData = data && data.length > 0 && data.some(d => d.schoolCount > 0);

    if (!hasData) {
        return (
            <DashboardCard title="Zone Distribution">
                <div className="flex flex-col items-center justify-center h-64 text-center text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                    <MapPin className="h-8 w-8 mb-2 opacity-20" />
                    <p>No zone data available.</p>
                    <p className="text-[10px] uppercase font-bold tracking-tighter">Assign schools to zones to see analytics</p>
                </div>
            </DashboardCard>
        );
    }

    return (
        <DashboardCard title="Zone Distribution" description="School and student density across organizational areas.">
            <div className="space-y-8">
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                width={80}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 'bold' }}
                            />
                            <Tooltip
                                cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="rounded-xl border bg-background p-3 shadow-xl text-xs space-y-2">
                                                <p className="font-black uppercase tracking-widest text-primary">{d.name}</p>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Schools:</span>
                                                    <span className="font-bold">{d.schoolCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3 w-3" /> Students:</span>
                                                    <span className="font-bold">{d.studentCount.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="schoolCount" radius={[0, 4, 4, 0]} barSize={20}>
                                {data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.slice(0, 4).map((zone, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-muted/20 border border-border/50 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate max-w-[120px]">{zone.name}</span>
                                <Badge variant="secondary" className="h-4 text-[8px] px-1.5">{zone.schoolCount} Schools</Badge>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-lg font-black tabular-nums">{zone.studentCount.toLocaleString()}</span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Students</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardCard>
    );
}
