import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"


export function MetricCard({
  title,
  value,
  trend,
  href,
  icon: Icon,
}: {
  title: string
  value: number | string
  trend?: string
  href?: string
  icon?: React.ElementType
}) {
  const CardContentInner = (
    <div className="block p-7">
        <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-medium tracking-[0.05em] text-muted-foreground opacity-60 group-hover:text-primary transition-colors">{title}</span>
            {Icon && (
              <div className="p-3 rounded-xl bg-primary/5 text-primary ring-1 ring-primary/20 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Icon className="h-4 w-4" />
              </div>
            )}
        </div>
        <div className="flex items-end justify-between">
          <div className="text-4xl font-semibold tracking-tighter text-foreground">
              {value}
          </div>
          {trend && (
            <div className={`text-sm font-medium ${trend.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>
              {trend}
            </div>
          )}
        </div>
    </div>
  );

  return (
    <Card className="rounded-2xl border border-border bg-transparent shadow-sm ring-1 ring-border hover:shadow-md transition-all duration-300 overflow-hidden group h-full">
       {href ? (
         <Link href={href}>{CardContentInner}</Link>
       ) : (
         CardContentInner
       )}
    </Card>
  )
}
