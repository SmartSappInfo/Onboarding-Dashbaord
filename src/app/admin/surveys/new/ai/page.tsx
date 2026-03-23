
import AiSurveyGenerator from '../../components/ai-survey-generator';

/**
 * @fileOverview AI Survey Generation Page.
 * Navigation is centralized in the global header.
 */

export default function NewSurveyAiPage() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-5xl mx-auto space-y-8">
        <AiSurveyGenerator />
      </div>
    </div>
  );
}
