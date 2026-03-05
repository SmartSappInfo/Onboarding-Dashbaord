import { Suspense } from "react";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import DashboardGrid from "./DashboardGrid";
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
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Operational Hub</h1>
                        <p className="text-muted-foreground font-medium text-sm mt-1">High-level overview of school onboarding, performance metrics, and recent dispatches.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 shrink-0">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap shrink-0 ml-1">Quick Actions:</h3>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9">
                                <Link href="/admin/schools/new">
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add School
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9">
                                <Link href="/admin/meetings/new">
                                    <CalendarPlus className="h-4 w-4 mr-2" /> Schedule Meeting
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9">
                                <Link href="/admin/surveys/new">
                                    <FilePlus className="h-4 w-4 mr-2" /> Create Survey
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9">
                                <Link href="/admin/media">
                                    <Upload className="h-4 w-4 mr-2" /> Media Hub
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardData />
                </Suspense>
            </div>
        </div>
    );
}
