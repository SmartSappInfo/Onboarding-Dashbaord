import { transformBodyWithTracking } from './src/lib/link-tracking';
import { resolveVariables } from './src/lib/messaging-utils';

async function test() {
  const templateBody = "The Enrollment Efficiency Report for {{respondent_name}} is ready. Go here for your next steps: {{survey_results_link}}";
  
  const finalVariables = {
    respondent_name: "Joseph Aidoo Test",
    survey_results_link: "https://onb.ac/surveys/abc"
  };

  const resolvedBody = resolveVariables(templateBody, finalVariables);
  console.log("Resolved Body:", resolvedBody);

  const trackedBody = await transformBodyWithTracking({
    body: resolvedBody,
    campaignId: 'manual',
    jobId: '123',
    taskId: '456'
  });

  console.log("Tracked Body:", trackedBody);
}

test();
