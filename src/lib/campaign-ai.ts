'use server';

/**
 * Phase 6 Story 5: AI copy generation using the Gemini REST API directly.
 * 
 * Server action that calls the Gemini API via REST — no extra packages needed.
 * Requires env var: GEMINI_API_KEY
 * 
 * Falls back gracefully if the API key is not configured.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface CopyResult {
  subject: string;
  body: string;
  subjectVariants: string[];
}

async function callGemini(prompt: string, jsonMode: boolean = false): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 2048,
        ...(jsonMode && { responseMimeType: 'application/json' }),
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

/**
 * Generate campaign copy (subject + body + variants) using Gemini.
 */
export async function generateCampaignCopy(params: {
  channel: 'email' | 'sms';
  target: string;
  campaignName: string;
  context?: string;
}): Promise<{ success: boolean; result?: CopyResult; error?: string }> {
  try {
    const channelGuidance = params.channel === 'sms'
      ? 'Keep the body under 160 characters. No HTML. Plain text only. Be concise and punchy.'
      : 'Write professional email content. Include a compelling subject line.';

    const targetGuidance = params.target === 'internal_team'
      ? 'Tone: professional but warm, like a colleague. Use first-person plural (we/our).'
      : 'Tone: professional and respectful. Address the recipient formally. Focus on value proposition.';

    const prompt = `You are a professional marketing copywriter for a CRM platform.

Generate campaign content for the following:
- Campaign name: "${params.campaignName}"
- Channel: ${params.channel.toUpperCase()}
- Target audience: ${params.target === 'internal_team' ? 'Internal team / staff' : 'External clients / customers'}
${params.context ? `- Additional context: ${params.context}` : ''}

${channelGuidance}
${targetGuidance}

Available template variables (use double curly braces): entity_name, entity_email, entity_phone, org_name

Respond with a JSON object containing:
{
  "subject": "The primary subject line",
  "body": "The message body content",
  "subjectVariants": ["Alternative subject 1", "Alternative subject 2", "Alternative subject 3"]
}`;

    const text = await callGemini(prompt, true);
    const parsed = JSON.parse(text) as CopyResult;

    return {
      success: true,
      result: {
        subject: parsed.subject || '',
        body: parsed.body || '',
        subjectVariants: parsed.subjectVariants || [],
      },
    };
  } catch (error: any) {
    console.error('[CAMPAIGN-AI] Generate failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Refine existing campaign copy using Gemini with a natural language instruction.
 */
export async function refineCampaignCopy(params: {
  original: string;
  instruction: string;
  field: 'subject' | 'body';
}): Promise<{ success: boolean; refined?: string; error?: string }> {
  try {
    const prompt = `You are a professional copywriter. Refine the following ${params.field === 'subject' ? 'email subject line' : 'message body'}.

Original:
"""
${params.original}
"""

Instruction: ${params.instruction}

Rules:
- Maintain the original intent and key information
- Apply the requested changes precisely
- Return ONLY the refined text, nothing else (no JSON, no explanation, no quotes)`;

    const refined = await callGemini(prompt, false);
    return { success: true, refined: refined.trim() };
  } catch (error: any) {
    console.error('[CAMPAIGN-AI] Refine failed:', error.message);
    return { success: false, error: error.message };
  }
}
