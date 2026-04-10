import { googleAI } from '@genkit-ai/google-genai';

const plugin = googleAI({ apiKey: 'test' }) as any;

console.log('Plugin keys:', Object.keys(plugin));
console.log('Plugin.model type:', typeof plugin.model);
if (typeof plugin.model === 'function') {
    console.log('Plugin.model exist');
} else {
    console.log('Plugin.model DOES NOT EXIST');
}
