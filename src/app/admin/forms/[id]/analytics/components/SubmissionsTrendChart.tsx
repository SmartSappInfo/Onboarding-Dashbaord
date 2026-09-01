'use client';

/**
 * SmartSapp Forms 2.0: Submissions & Traffic Trend Chart
 * 
 * Renders daily visitors vs submissions time series chart using Recharts.
 */

import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TimeSeriesTrendPoint } from '@/lib/forms/form-analytics-types';

interface SubmissionsTrendChartProps {
  trends: TimeSeriesTrendPoint[];
}

export default function SubmissionsTrendChart({ trends = [] }: SubmissionsTrendChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Card className="rounded-3xl border border-border/60 shadow-sm p-6">
        <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
          Loading trend charts...
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Traffic & Submissions Over Time
            </CardTitle>
            <CardDescription className="text-xs">
              Daily comparison of unique visitors and completed submissions.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
            Daily Volume
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="formattedDate" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '1rem',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                formatter={(val) => <span className="text-xs font-semibold capitalize text-foreground">{val}</span>} 
              />
              <Area 
                type="monotone" 
                dataKey="visitors" 
                name="Visitors" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorVisitors)" 
              />
              <Area 
                type="monotone" 
                dataKey="submissions" 
                name="Submissions" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorSubmissions)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
