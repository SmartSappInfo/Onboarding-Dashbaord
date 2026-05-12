import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardNotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
      <div className="rounded-lg border bg-card p-8 shadow-sm max-w-md w-full">
        <h2 className="text-4xl font-bold tracking-tight mb-2 text-primary">404</h2>
        <h3 className="text-xl font-semibold mb-2">Dashboard Not Found</h3>
        <p className="text-muted-foreground mb-6">
          The dashboard or entity view you are looking for does not exist or you don't have access to it.
        </p>
        <Button asChild>
          <Link href="/dashboard">Return to Main Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
