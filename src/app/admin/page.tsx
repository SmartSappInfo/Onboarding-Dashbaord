
import { Suspense } from "react";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import DashboardGrid from "./components/DashboardGrid";
import { Button } from "@/components/ui/button";
import { PlusCircle, CalendarPlus, FilePlus, Upload } from "lucide-react";
import Link from "next/link";

async function DashboardData() {
  const data = await getDashboardData();
  return <DashboardGrid initialData={data} />;
}

export default async function AdminDashboardPage() {
    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="flex items-center gap-4 mb-6">
                <h3 className="text-sm font-medium text-muted-foreground whitespace-nowrap">Quick Actions:</h3>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href="/admin/schools/new">
                            <PlusCircle className="h-4 w-4" /> Add School
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/admin/meetings/new">
                            <CalendarPlus className="h-4 w-4" /> Schedule Meeting
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/admin/surveys/new">
                            <FilePlus className="h-4 w-4" /> Create Survey
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/admin/media">
                            <Upload className="h-4 w-4" /> Upload Media
                        </Link>
                    </Button>
                </div>
            </div>
            <Suspense fallback={<DashboardSkeleton />}>
                <DashboardData />
            </Suspense>
        </div>
    );
}
