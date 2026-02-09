// components/dashboard/DashboardCard.tsx
export default function DashboardCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-card text-card-foreground p-4 rounded-lg shadow-md ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}
