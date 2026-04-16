
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

export function ZoneDistribution({ 
    data,
    terminology = { singular: 'Entity', plural: 'Entities' }
}: { 
    data: ZoneMetric[],
    terminology?: { singular: string, plural: string }
}) {
    const hasData = data && data.length > 0 && data.some(d => d.schoolCount > 0);

    if (!hasData) {
        return (
            <DashboardCard title="Zone Distribution">
                <div className="flex flex-col items-center justify-center h-64 text-center text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                    <MapPin className="h-8 w-8 mb-2 opacity-20" />
                    <p>No zone data available.</p>
                    <p className="text-[10px] uppercase font-bold tracking-tighter">Assign {terminology.plural.toLowerCase()} to zones to see analytics</p>
                </div>
            </DashboardCard>
        );
    }

    return (
        <DashboardCard title="{Entity} distribution" terminology={terminology}>
            <div className="space-y-6">
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
                                            <div className="rounded-2xl border bg-background/80 backdrop-blur-xl p-3 shadow-2xl text-[10px] space-y-2">
                                                <p className="font-black uppercase tracking-widest text-primary">{d.name}</p>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-muted-foreground flex items-center gap-1.5 font-bold uppercase tracking-tighter"><MapPin className="h-2 w-2" /> {terminology.plural}:</span>
                                                    <span className="font-black">{d.schoolCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-muted-foreground flex items-center gap-1.5 font-bold uppercase tracking-tighter"><Users className="h-2 w-2" /> Students:</span>
                                                    <span className="font-black">{d.studentCount.toLocaleString()}</span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {data.slice(0, 4).map((zone, idx) => (
                        <div key={idx} className="p-4 rounded-3xl bg-muted/10 border border-transparent hover:border-primary/10 hover:bg-white transition-all group">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate max-w-[120px]">{zone.name}</span>
                                <Badge className="bg-primary/10 text-primary border-none text-[8px] h-4 px-1.5 font-bold">
                                    {zone.schoolCount} {zone.schoolCount === 1 ? terminology.singular : terminology.plural}
                                </Badge>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-xl font-black tracking-tight tabular-nums">{zone.studentCount.toLocaleString()}</span>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 mb-1">Students</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardCard>
    );
}
