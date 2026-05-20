/**
 * Safely parses Markdown-style links `[Link Text](url)` into HTML anchor tags.
 * Designed to run AFTER raw HTML tags are escaped, preventing XSS.
 *
 * @param text The escaped plain text payload
 * @returns The HTML payload with semantic anchor tags
 */
export function parseMarkdownLinksToHtml(text: string): string {
  if (!text) return '';

  // Regex to match Markdown links: [Text](URL)
  // We use a safe regex that captures the text and the URL.
  // URL matching is non-greedy and stops at the closing parenthesis.
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  return text.replace(markdownLinkRegex, (match, linkText, url) => {
    // SECURITY: Ensure the URL is safe. We only allow http and https protocols.
    // If a malicious user tries [Click Me](javascript:alert(1)), we refuse to parse it as a link.
    const safeUrl = url.trim();
    if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
      // If it's a relative path, we might want to allow it, but for our system generated links,
      // we ensure they are absolute using `ensureAbsoluteUrl()`.
      // If it doesn't look like a standard HTTP/HTTPS link, render it as plain text to be safe.
      return match;
    }

    // Modern, accessible, and highly styled anchor tag
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: #3B5FFF; text-decoration: underline; font-weight: 600;">${linkText}</a>`;
  });
}
