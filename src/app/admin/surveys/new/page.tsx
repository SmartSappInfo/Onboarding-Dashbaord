'use client';
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewSurveyPage() {
    return (
        <div>
            <h1 className="text-4xl font-bold tracking-tight mb-8">Create New Survey</h1>
            <p className="mb-4">The survey builder will be implemented in Phase 3.</p>
            <Button asChild variant="outline">
                <Link href="/admin/surveys">Back to Surveys</Link>
            </Button>
        </div>
    );
}
