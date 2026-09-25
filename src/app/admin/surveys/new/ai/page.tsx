
import AiSurveyGenerator from '../../components/ai-survey-generator';

/**
 * @fileOverview AI Survey Generation Page.
 * Centered command studio layout conforming to admin design system.
 */

export default function NewSurveyAiPage() {
  return (
    <div className="flex-1 min-h-[calc(100vh-4.5rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto my-auto">
        <AiSurveyGenerator />
      </div>
    </div>
  );
}
