import AiSurveyGenerator from '../../components/ai-survey-generator';

export default function NewSurveyAiPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Create Survey with AI</h1>
      <p className="text-muted-foreground mb-8">Generate a survey from text, a URL, or a document.</p>
      <AiSurveyGenerator />
    </div>
  );
}
