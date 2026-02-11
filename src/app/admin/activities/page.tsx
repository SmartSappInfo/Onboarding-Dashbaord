'use client';
import ActivityTimeline from '../components/ActivityTimeline';

export default function ActivitiesPage() {
    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Global Activity Feed</h1>
                    <p className="text-muted-foreground">A live look at all activities happening across the platform.</p>
                </div>
            </div>
            <div className="max-w-3xl mx-auto">
                <ActivityTimeline />
            </div>
        </div>
    );
}
