
import AiSurveyGenerator from '../../components/ai-survey-generator';

/**
 * @fileOverview AI Survey Generation Page.
 * Navigation is centralized in the global header.
 */

export default function NewSurveyAiPage() {
  return (
 <div className="h-full overflow-y-auto  bg-background">
 <div className="max-w-5xl mx-auto space-y-8">
        <AiSurveyGenerator />
      </div>
    </div>
  );
}
