import { genkit } from 'genkit';
import openAICompatible from 'genkitx-openai-compatible';

const ai = genkit({
    plugins: [
        openAICompatible({ 
            name: 'openrouter',
            baseURL: 'https://openrouter.ai/api/v1',
            models: ['openrouter/auto']
        })
    ]
});

async function main() {
    const models = await ai.registry.listModels();
    console.log("Registered models:");
    console.log(models.map(m => m.name));
}

main().catch(console.error);
