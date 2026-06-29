import { z } from 'zod';
import { ListChecks } from 'lucide-react';
import { EmbeddedSurvey } from '@/components/page-builder/embeds/EmbeddedSurvey';
import { registerBlock } from '../registry';

const schema = z.object({ 
  surveyId: z.string().default(''),
  displayMode: z.enum(['inline', 'button']).default('inline')
});
type SurveyBlockProps = z.infer<typeof schema>;

registerBlock({
  type: 'survey',
  label: 'Survey',
  category: 'embed',
  icon: ListChecks,
  fields: [
    { kind: 'resource', key: 'surveyId', label: 'Survey', resource: 'survey' },
    { 
      kind: 'select', 
      key: 'displayMode', 
      label: 'Display Mode', 
      options: [
        { value: 'inline', label: 'Embedded Inline' },
        { value: 'button', label: 'Start Button' }
      ] 
    }
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: SurveyBlockProps, _block, ctx) => {
    if (ctx.mode === 'view') {
      if (props.surveyId) return <EmbeddedSurvey surveyId={props.surveyId} pageId={ctx.page?.id} displayMode={props.displayMode} />;
      return <></>;
    }
    const survey = ctx.resources.surveys.find((s) => s.id === props.surveyId);
    return (
      <div className="max-w-md mx-auto p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
          <ListChecks className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Embedded Survey</h3>
        {survey ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{survey.title}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Mode: {props.displayMode === 'inline' ? 'Inline Iframe' : 'Redirect Button'}</p>
          </div>
        ) : (
          <p className="text-xs text-amber-500 font-medium italic">No survey selected</p>
        )}
      </div>
    );
  },
});
