import * as z from 'zod';

export const GlobalAiKeysSchema = z.object({
  geminiApiKey: z.string().trim().refine(
    val => !val || val === '••••••••' || val.startsWith('AIzaSy'),
    { message: 'Gemini API Key must start with "AIzaSy" or be the placeholder' }
  ).optional().or(z.literal('')),
  claudeApiKey: z.string().trim().refine(
    val => !val || val === '••••••••' || val.startsWith('sk-ant-'),
    { message: 'Anthropic API Key must start with "sk-ant-" or be the placeholder' }
  ).optional().or(z.literal('')),
  openRouterApiKey: z.string().trim().refine(
    val => !val || val === '••••••••' || val.startsWith('sk-or-'),
    { message: 'OpenRouter API Key must start with "sk-or-" or be the placeholder' }
  ).optional().or(z.literal('')),
});

export type GlobalAiKeys = z.infer<typeof GlobalAiKeysSchema>;
