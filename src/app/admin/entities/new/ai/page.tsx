import AiSchoolGenerator from '../../components/ai-entity-generator';
import { Metadata } from 'next';

/**
 * @fileOverview AI School Generation Page.
 */

export const metadata: Metadata = {
  title: 'AI New School',
  description: 'Automated institutional onboarding using generative AI extraction.',
};

export default function NewSchoolAiPage() {
  return (
 <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
 <div className="max-w-5xl mx-auto space-y-8">
        <AiSchoolGenerator />
      </div>
    </div>
  );
}
