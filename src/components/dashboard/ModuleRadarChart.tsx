"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart as RechartsRadarChart } from "recharts";
import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

/**
 * @fileOverview Module Implementation Radar Chart.
 * Visualizes the functional footprint of schools within the active workspace.
 */
export function ModuleRadarChart({ data }: { data: { abbreviation: string; name: string; count: number }[] }) {
  const chartConfig = {
    count: {
      label: "Schools",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  // Resilience: Check for data before attempting to sort
  const chartData = React.useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [data]);

  if (!data || chartData.length < 3) {
      return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm h-full">
          <CardHeader className="items-center pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Module Footprint</CardTitle>
          </CardHeader>
          <CardContent className="pb-0 h-[250px] flex items-center justify-center">
              <p className="text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest opacity-40 italic">
                {!data ? 'Awaiting metrics...' : 'Insufficent module data'}
              </p>
          </CardContent>
        </Card>
      )
  }

  return (
    <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm h-full">
      <CardHeader className="items-center pb-4 text-center">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Module Footprint</CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RechartsRadarChart data={chartData}>
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload
                  return (
                    <div className="rounded-xl border bg-background p-3 shadow-2xl text-xs space-y-1">
                      <p className="font-black uppercase tracking-widest text-primary">{d.name}</p>
                      <p className="text-muted-foreground font-bold">{d.count} Schools Active</p>
                    </div>
                  )
                }
                return null;
              }}
            />
            <PolarAngleAxis dataKey="abbreviation" tick={{ fontSize: 10, fontWeight: 'bold' }} />
            <PolarGrid strokeDasharray="3 3" strokeOpacity={0.1} />
            <defs>
              <filter
                id="stroke-line-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <Radar
              dataKey="count"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.1}
              strokeWidth={3}
              filter="url(#stroke-line-glow)"
            />
          </RechartsRadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
