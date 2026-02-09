// components/dashboard/MetricCard.tsx
import Link from "next/link";

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
    <Link
      href={href}
      className="block rounded-lg bg-card text-card-foreground shadow-md p-4 hover:shadow-lg transition hover:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">
            {value}
          </p>
        </div>
        <Icon className="h-6 w-6 text-primary" />
      </div>
    </Link>
  )
}
