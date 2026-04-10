// components/dashboard/MetricCard.tsx
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
    <Card className="glass-card transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer">
       <Link href={href}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-headline font-black uppercase tracking-widest text-muted-foreground opacity-60">{label}</CardTitle>
                 <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black tracking-tight">
                    {value}
                </div>
            </CardContent>
       </Link>
    </Card>
  )
}
