import { z } from 'zod';
import { ListChecks } from 'lucide-react';
import { EmbeddedSurvey } from '@/components/page-builder/embeds/EmbeddedSurvey';
import { registerBlock } from '../registry';

const schema = z.object({ surveyId: z.string().default('') });
type SurveyBlockProps = z.infer<typeof schema>;

registerBlock({
  type: 'survey',
  label: 'Survey',
  category: 'embed',
  icon: ListChecks,
  fields: [{ kind: 'resource', key: 'surveyId', label: 'Survey', resource: 'survey' }],
  defaults: schema.parse({}),
  schema,
  render: (props: SurveyBlockProps, _block, ctx) => {
    if (ctx.mode === 'view') {
      if (props.surveyId) return <EmbeddedSurvey surveyId={props.surveyId} pageId={ctx.page?.id} />;
      return <></>;
    }
    const survey = ctx.resources.surveys.find((s) => s.id === props.surveyId);
    return (
      <div className="max-w-md mx-auto p-10 bg-white rounded-3xl border border-slate-100 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
          <ListChecks className="h-6 w-6 text-indigo-600" />
        </div>
        <h3 className="text-lg font-bold">Embedded Survey</h3>
        {survey ? (
          <p className="text-xs text-slate-500">{survey.title}</p>
        ) : (
          <p className="text-xs text-amber-500 font-medium italic">No survey selected</p>
        )}
      </div>
    );
  },
});
