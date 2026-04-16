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
    <Card className="rounded-[2.5rem] border-none bg-background/50 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden group">
       <Link href={href} className="block p-7">
            <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground opacity-50">{label}</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="text-4xl font-black tracking-tighter">
                {value}
            </div>
       </Link>
    </Card>
  )
}
