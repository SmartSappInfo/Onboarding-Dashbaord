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
    <Card className="hover:shadow-lg transition-shadow">
       <Link href={href}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                 <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {value}
                </div>
            </CardContent>
       </Link>
    </Card>
  )
}
