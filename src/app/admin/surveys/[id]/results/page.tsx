'use client';
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SurveyResultsPage() {
    const params = useParams();
    const { id } = params;

    return (
        <div>
            <h1 className="text-4xl font-bold tracking-tight mb-8">Results for Survey {id}</h1>
            <p className="mb-4">The survey analytics page will be implemented in a future phase.</p>
             <Button asChild variant="outline">
                <Link href="/admin/surveys">Back to Surveys</Link>
            </Button>
        </div>
    );
}
