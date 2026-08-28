import { NextRequest, NextResponse } from 'next/server';
import { validateExternalUrl } from '@/lib/security/ssrf-guard';

/**
 * @fileOverview AI Website Seeding API Route
 *
 * POST /api/organizations/scrape
 *
 * Fetches the HTML <head> of a given user-supplied URL, extracts meta tags and link tags,
 * then sends a truncated excerpt to the Gemini REST API to extract branding details.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by SSRF validation via `validateExternalUrl` to prevent targeting
 *   internal infrastructure, cloud metadata (169.254.169.254), loopback addresses, or private subnets.
 * - Resource Caps: Strict 10-second timeout, 6,000 character HTML head slice, and strict output token caps.
 * - Zero `any` or `any[]` typing.
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Timeout for the external site fetch (10 seconds max)
const SCRAPE_TIMEOUT_MS = 10_000;

// Maximum HTML characters sent to Gemini to keep token usage minimal
const MAX_HTML_EXCERPT_CHARS = 6_000;

interface SeedResult {
  name: string;
  description: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  country: string;
  language: string;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

/**
 * Extracts the raw <head>…</head> block from an HTML string.
 * Falls back to the first MAX_HTML_EXCERPT_CHARS if the head tag is missing.
 */
function extractHeadSection(html: string): string {
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  const raw = headMatch ? headMatch[0] : html;
  return raw.slice(0, MAX_HTML_EXCERPT_CHARS);
}

/**
 * Calls the Gemini REST API with a structured prompt and returns parsed JSON.
 */
async function callGeminiForSeed(htmlExcerpt: string, siteUrl: string): Promise<SeedResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on this server.');
  }

  const prompt = `You are an expert web analyst. Analyze the following HTML <head> block from the website "${siteUrl}" and extract branding and localization metadata.

HTML HEAD:
\`\`\`html
${htmlExcerpt}
\`\`\`

Rules:
- Extract the brand name from the <title> tag or og:site_name meta tag.
- Extract the description from the meta description or og:description tag.
- Extract the logo or favicon: prefer og:image, then apple-touch-icon, then /favicon.ico (relative to the base URL).
- For brandPrimaryColor and brandSecondaryColor: infer from theme-color meta tag, or from any inline CSS color variables in <style> tags, or from the favicon's dominant color if mentioned. If you cannot determine, use empty string "".
- For country: detect from og:locale, lang attributes, phone formats, address formats, or the TLD of the URL. Return the 2-letter ISO 3166-1 alpha-2 code (e.g., "GH", "US", "GB"). If unclear, return "".
- For language: detect from <html lang=""> attribute or og:locale. Return the 2-letter BCP 47 code (e.g., "en", "fr"). If unclear, return "en".
- All color values must be valid CSS hex codes like "#3B5FFF" or empty string.
- Never hallucinate data; if unsure leave the field as "".

Respond ONLY with a valid JSON object matching this exact schema:
{
  "name": "string",
  "description": "string",
  "logoUrl": "string (absolute URL)",
  "brandPrimaryColor": "string (hex or empty)",
  "brandSecondaryColor": "string (empty or secondary hex)",
  "country": "string (2-letter ISO code or empty)",
  "language": "string (2-letter BCP47 code)"
}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!rawText) throw new Error('Gemini returned an empty response.');

  // Strip any accidental markdown fencing before parsing
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as SeedResult;
}

/**
 * POST /api/organizations/scrape
 * Body: { url: string }
 * Returns: SeedResult or error
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const { url } = body;

    // --- Validation ---
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A valid "url" string is required.' }, { status: 400 });
    }

    // SSRF & Ingress Protection Check
    const ssrfCheck = validateExternalUrl(url);
    if (!ssrfCheck.isValid || !ssrfCheck.sanitizedUrl) {
      return NextResponse.json(
        { error: ssrfCheck.error || 'Invalid or forbidden URL.' },
        { status: 400 }
      );
    }

    const normalizedUrl = ssrfCheck.sanitizedUrl;
    const parsedUrl = new URL(normalizedUrl);

    // --- Fetch the target site HTML (with timeout) ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

    let html: string;
    try {
      const siteResponse = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: {
          // Mimic a real browser to reduce 403 bot-blocks
          'User-Agent':
            'Mozilla/5.0 (compatible; SmartSappBot/1.0; +https://smartsapp.com/bot) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
      });
      clearTimeout(timeoutId);

      if (!siteResponse.ok) {
        const status = siteResponse.status;
        if (status === 403 || status === 401) {
          return NextResponse.json(
            {
              error:
                'This website is protected by anti-bot measures (HTTP 403). Please enter your organization details manually.',
            },
            { status: 422 }
          );
        }
        return NextResponse.json(
          { error: `The website returned an error (HTTP ${status}). Please check the URL and try again.` },
          { status: 422 }
        );
      }

      html = await siteResponse.text();
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return NextResponse.json(
          { error: 'The request timed out after 10 seconds. The website may be slow or unreachable.' },
          { status: 408 }
        );
      }
      const fetchErrMsg = fetchErr instanceof Error ? fetchErr.message : 'Unknown network failure';
      return NextResponse.json(
        { error: `Could not reach the website: ${fetchErrMsg}` },
        { status: 422 }
      );
    }

    // --- Extract head section and pass to Gemini ---
    const headExcerpt = extractHeadSection(html);

    // Resolve relative logo URLs to absolute paths using the origin
    const origin = parsedUrl.origin;
    const seedResult = await callGeminiForSeed(headExcerpt, normalizedUrl);

    // Normalize relative logo URLs
    if (seedResult.logoUrl && !seedResult.logoUrl.startsWith('http')) {
      seedResult.logoUrl = seedResult.logoUrl.startsWith('/')
        ? `${origin}${seedResult.logoUrl}`
        : `${origin}/${seedResult.logoUrl}`;
    }

    // Fallback: if no logo found, construct a favicon fallback
    if (!seedResult.logoUrl) {
      seedResult.logoUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=128`;
    }

    return NextResponse.json({ success: true, result: seedResult }, { status: 200 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred during website extraction.';
    console.error('[API:SCRAPE:POST] Unhandled error:', error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
