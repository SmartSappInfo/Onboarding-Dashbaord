import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()],
});

console.log('AI object keys:', Object.keys(ai));
console.log('AI.model type:', typeof (ai as any).model);
if (typeof (ai as any).model === 'function') {
    console.log('AI.model exist');
} else {
    console.log('AI.model DOES NOT EXIST');
}
