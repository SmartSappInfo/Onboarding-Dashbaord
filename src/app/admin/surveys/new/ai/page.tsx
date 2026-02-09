
import AiSurveyGenerator from '../../components/ai-survey-generator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewSurveyAiPage() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link href="/admin/surveys">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Surveys
        </Link>
      </Button>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Create Survey with AI</h1>
      <p className="text-muted-foreground mb-8">Generate a survey from text, a URL, or a document.</p>
      <AiSurveyGenerator />
    </div>
  );
}
