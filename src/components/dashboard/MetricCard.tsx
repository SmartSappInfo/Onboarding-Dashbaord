import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"


export function MetricCard({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string
  value: number | string
  href: string
  icon: React.ElementType
}) {
  return (
    <Card className="rounded-2xl border border-border bg-transparent shadow-sm ring-1 ring-border hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden group">
       <Link href={href} className="block p-7">
            <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60 group-hover:text-primary transition-colors">{label}</span>
                <div className="p-3 rounded-xl bg-primary/5 text-primary ring-1 ring-primary/20 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="text-4xl font-black tracking-tighter text-foreground">
                {value}
            </div>
       </Link>
    </Card>
  )
}
