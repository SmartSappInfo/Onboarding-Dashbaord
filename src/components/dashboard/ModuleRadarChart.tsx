
"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart as RechartsRadarChart } from "recharts";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function ModuleRadarChart({ data }: { data: { abbreviation: string; name: string; count: number }[] }) {
  const chartConfig = {
    count: {
      label: "Schools",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  // The radar chart looks best with 3 to 8 items. Let's take the top 6.
  const chartData = React.useMemo(() => data.sort((a, b) => b.count - a.count).slice(0, 6), [data]);

  if (chartData.length < 3) {
      return (
        <Card>
          <CardHeader className="items-center pb-4">
            <CardTitle>Module Implementations</CardTitle>
            <CardDescription>
              Distribution of modules being implemented across all schools.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-0 h-[250px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground text-center">Not enough module data to display a chart. (Requires at least 3)</p>
          </CardContent>
        </Card>
      )
  }

  return (
    <Card>
      <CardHeader className="items-center pb-4">
        <CardTitle>Module Implementations</CardTitle>
        <CardDescription>
          Top {chartData.length} most implemented modules across all schools.
        </CardDescription>
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
                  const data = payload[0].payload
                  return (
                    <div className="rounded-lg border bg-background p-2 text-sm shadow-sm">
                      <div className="grid gap-1">
                        <p className="font-medium">{data.name}</p>
                        <p className="text-muted-foreground">Schools: {data.count}</p>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <PolarAngleAxis dataKey="abbreviation" />
            <PolarGrid strokeDasharray="3 3" />
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
              stroke="var(--color-count)"
              fill="none"
              strokeWidth={2}
              filter="url(#stroke-line-glow)"
            />
          </RechartsRadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
