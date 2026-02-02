'use client';
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function EditSurveyPage() {
    const params = useParams();
    const { id } = params;

    return (
        <div>
            <h1 className="text-4xl font-bold tracking-tight mb-8">Edit Survey {id}</h1>
            <p className="mb-4">The survey editor will be implemented in Phase 3.</p>
             <Button asChild variant="outline">
                <Link href="/admin/surveys">Back to Surveys</Link>
            </Button>
        </div>
    );
}
