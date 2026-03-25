import type { MessageBlock, MessageBlockRule } from './types';

/**
 * UTF-8 safe Base64 encoding.
 * Supports characters outside the Latin1 range (e.g. bullet points, emojis).
 */
function toBase64(str: string): string {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => 
      String.fromCharCode(parseInt(p1, 16))
    ));
  } catch (e) {
    console.error("Base64 Encoding Error:", e);
    return "";
  }
}

/**
 * UTF-8 safe Base64 decoding.
 */
function fromBase64(str: string): string {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), (c: string) => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
  } catch (e) {
    console.error("Base64 Decoding Error:", e);
    return "";
  }
}

/**
 * Clean up editor artifacts (classes, empty tags) from raw HTML content.
 */
function sanitizeContent(html: string): string {
  if (!html) return '';
  return html
    .replace(/class="isSelectedEnd"/g, '')
    .replace(/class='isSelectedEnd'/g, '')
    .replace(/<p><\/p>/g, '<br/>')
    .trim();
}

/**
 * Resolves variables in a text string using {{variable_name}} syntax.
 * Supports tag_list (JSON array) by rendering as a comma-separated string.
 */
export function resolveVariables(text: string, variables: Record<string, any>): string {
  if (!text) return '';
  const sanitized = sanitizeContent(text);
  return sanitized.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const cleanKey = key.trim();
    const value = variables[cleanKey];
    if (value === undefined) return match;
    // tag_list is stored as JSON array string — render as comma-separated for display
    if (cleanKey === 'tag_list') {
      try {
        const arr = JSON.parse(String(value));
        if (Array.isArray(arr)) return arr.join(', ');
      } catch { /* fall through */ }
    }
    return String(value);
  });
}

/**
 * Evaluates block-level visibility logic against provided variables.
 */
export function shouldShowBlock(block: MessageBlock, variables: Record<string, any>): boolean {
  if (!block.visibilityLogic || !block.visibilityLogic.rules || block.visibilityLogic.rules.length === 0) {
    return true;
  }

  const { rules, matchType } = block.visibilityLogic;

  const evaluateRule = (rule: MessageBlockRule): boolean => {
    const value = variables[rule.variableKey];
    const strValue = String(value ?? '').trim();
    const target = (rule.value || '').trim();

    // Tag-specific operators (FR5.2.2)
    // has_tag variable is a JSON object: { "tag name": true, ... }
    if (rule.variableKey === 'has_tag' || rule.variableKey === 'contact_tags') {
      let hasTagMap: Record<string, boolean> = {};
      if (rule.variableKey === 'has_tag') {
        try { hasTagMap = JSON.parse(strValue || '{}'); } catch { hasTagMap = {}; }
      } else {
        // contact_tags is comma-separated; build map on the fly
        strValue.split(',').forEach(t => {
          const trimmed = t.trim().toLowerCase();
          if (trimmed) hasTagMap[trimmed] = true;
        });
      }
      const targetLower = target.toLowerCase();
      switch (rule.operator) {
        case 'isEqualTo':
        case 'contains':
          return !!hasTagMap[targetLower];
        case 'isNotEqualTo':
        case 'doesNotContain':
          return !hasTagMap[targetLower];
        default:
          break; // fall through to generic handling
      }
    }

    // tag_count comparisons (FR5.2.2)
    if (rule.variableKey === 'tag_count') {
      const numValue = Number(strValue);
      const numTarget = Number(target);
      switch (rule.operator) {
        case 'isEqualTo': return numValue === numTarget;
        case 'isNotEqualTo': return numValue !== numTarget;
        case 'isGreaterThan': return numValue > numTarget;
        case 'isLessThan': return numValue < numTarget;
        case 'isEmpty': return numValue === 0;
        case 'isNotEmpty': return numValue > 0;
        default: break;
      }
    }

    switch (rule.operator) {
      case 'isEqualTo': return strValue === target;
      case 'isNotEqualTo': return strValue !== target;
      case 'contains': return strValue.toLowerCase().includes(target.toLowerCase());
      case 'doesNotContain': return !strValue.toLowerCase().includes(target.toLowerCase());
      case 'isGreaterThan': return Number(strValue) > Number(target);
      case 'isLessThan': return Number(target) > Number(strValue);
      case 'isEmpty': return strValue === '';
      case 'isNotEmpty': return strValue.length > 0;
      default: return true;
    }
  };

  if (matchType === 'any') {
    return rules.some(evaluateRule);
  }
  return rules.every(evaluateRule);
}

/**
 * Renders an array of MessageBlocks into a clean, high-compatibility HTML string.
 * Optimized for Outlook, Gmail, and Mobile clients.
 * Produces a professional card-based layout with high visual fidelity.
 */
export function renderBlocksToHtml(
  blocks: MessageBlock[], 
  variables: Record<string, any>, 
  options?: { 
    width?: string, 
    backgroundColor?: string,
    wrapper?: string 
  }
): string {
  if (!blocks || !blocks.length) return '';

  const maxWidth = options?.width || '600px';
  const outerBg = options?.backgroundColor || '#F1F5F9'; // Light gray viewport
  const cardBg = '#FFFFFF';

  const renderBlock = (block: MessageBlock): string => {
    if (!shouldShowBlock(block, variables)) {
      return '';
    }

    const metadata = `<!-- BLOCK_DATA:${toBase64(JSON.stringify(block))} -->`;

    const align = block.style?.textAlign || 'left';
    const alignStyle = `text-align: ${align};`;
    const blockBgColor = block.style?.backgroundColor ? `background-color: ${block.style.backgroundColor};` : '';
    const padding = block.style?.padding || '12px 0';
    
    // Core typography inheritance
    const baseStyle = `font-family: 'Figtree', Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b;`;
    const wrapperStyle = `padding: ${padding}; ${alignStyle} ${blockBgColor} ${baseStyle}`;

    let blockHtml = '';

    switch (block.type) {
      case 'heading': {
        const tag = block.variant || 'h2';
        const fontSize = tag === 'h1' ? '32px' : tag === 'h2' ? '24px' : '18px';
        const title = resolveVariables(block.title || '', variables);
        blockHtml = `<div style="${wrapperStyle}"><${tag} style="${baseStyle} margin: 0; font-size: ${fontSize}; font-weight: 900; line-height: 1.2; letter-spacing: -0.02em;">${title}</${tag}></div>`;
        break;
      }
      
      case 'text': {
        const content = resolveVariables(block.content || '', variables);
        blockHtml = `<div style="${wrapperStyle}"><div style="${baseStyle} font-size: 16px; margin: 0; font-weight: 500;">${content}</div></div>`;
        break;
      }

      case 'logo': {
        const url = resolveVariables(block.url || 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/SmartSapp%20Logo%20short.png?alt=media&token=046f95a8-b331-4129-a4ef-43ae7837eadd', variables);
        blockHtml = `<div style="${wrapperStyle} padding: 20px 0;"><img src="${url}" style="height: 48px; width: auto; display: block; ${align === 'center' ? 'margin: 0 auto;' : align === 'right' ? 'margin-left: auto;' : ''}" alt="Logo" /></div>`;
        break;
      }

      case 'image': {
        const url = resolveVariables(block.url || '', variables);
        if (!url) {
            blockHtml = '';
        } else {
            blockHtml = `<div style="${wrapperStyle}"><img src="${url}" style="max-width: 100%; height: auto; border-radius: 16px; display: block; border: 1px solid #e2e8f0; ${align === 'center' ? 'margin: 0 auto;' : align === 'right' ? 'margin-left: auto;' : ''}" alt="Image" /></div>`;
        }
        break;
      }

      case 'button': {
        const title = resolveVariables(block.title || 'Click Here', variables);
        const link = resolveVariables(block.link || '#', variables);
        blockHtml = `
          <div style="${wrapperStyle} margin: 24px 0;">
            <a href="${link}" style="background-color: #3B5FFF; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 800; font-family: 'Figtree', sans-serif; display: inline-block; font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 10px 15px -3px rgba(59, 95, 255, 0.3);">
              ${title}
            </a>
          </div>
        `;
        break;
      }

      case 'quote': {
        const content = resolveVariables(block.content || '', variables);
        blockHtml = `
          <div style="margin: 24px 0; padding: 24px; border-left: 4px solid #3B5FFF; background-color: #f8fafc; font-family: 'Figtree', sans-serif; font-style: italic; color: #475569; font-size: 18px; line-height: 1.6; border-radius: 0 16px 16px 0; ${alignStyle}">
            ${content}
          </div>
        `;
        break;
      }

      case 'list': {
        const tag = block.listStyle === 'ordered' ? 'ol' : 'ul';
        const items = (block.items || []).map(item => `<li style="margin-bottom: 10px;">${resolveVariables(item, variables)}</li>`).join('');
        blockHtml = `<div style="${wrapperStyle}"><${tag} style="${baseStyle} font-size: 16px; margin: 0; padding-left: 20px; text-align: left; font-weight: 500;">${items}</${tag}></div>`;
        break;
      }

      case 'divider':
        blockHtml = `<div style="padding: 32px 0;"><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 0;" /></div>`;
        break;

      case 'score-card': {
        const score = variables.score || 0;
        const maxScore = variables.max_score || 100;
        blockHtml = `
          <div style="background-color: #3B5FFF; color: #ffffff; padding: 48px 32px; border-radius: 24px; text-align: center; margin: 32px 0; font-family: 'Figtree', sans-serif; box-shadow: 0 20px 25px -5px rgba(59, 95, 255, 0.2);">
            <div style="text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 0.2em; margin-bottom: 16px; opacity: 0.8;">Assessment Result</div>
            <div style="font-size: 72px; font-weight: 900; line-height: 1; letter-spacing: -0.05em;">${score}</div>
            <div style="font-size: 14px; font-weight: 700; opacity: 0.6; margin-top: 8px; letter-spacing: 0.1em;">OUT OF ${maxScore} POINTS</div>
          </div>
        `;
        break;
      }

      default:
        blockHtml = '';
    }

    return blockHtml + '\n' + metadata;
  };

  const contentHtml = blocks.map(renderBlock).join('\n');

  const wrapperHtml = options?.wrapper && options.wrapper.includes('{{content}}')
    ? options.wrapper.replace('{{content}}', contentHtml)
    : contentHtml;

  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title></title>
<!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style type="text/css">
  #outlook a { padding:0; }
  body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; font-family: 'Figtree', Helvetica, Arial, sans-serif !important; }
  table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
  img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
  p { display:block;margin:13px 0; line-height: 1.6; }
  * { font-family: 'Figtree', Helvetica, Arial, sans-serif !important; }
</style>
</head>
<body style="word-spacing:normal;background-color:${outerBg};padding: 40px 20px;">
  <div style="background-color:${outerBg};">
    <div style="margin:0px auto;max-width:${maxWidth};">
      <!-- Gradient Top Line -->
      <div style="height: 4px; background: linear-gradient(to right, #3B5FFF, #8B5CF6, #3B5FFF); border-radius: 24px 24px 0 0;"></div>
      
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background-color: ${cardBg}; border-radius: 0 0 24px 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:48px 40px;text-align:center;font-family: 'Figtree', sans-serif;">
              ${wrapperHtml}
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Footer -->
      <div style="margin-top: 32px; text-align: center;">
        <p style="font-family: 'Figtree', sans-serif; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">
          Powered by SmartSapp Intelligence Hub &copy; ${new Date().getFullYear()}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Reconstructs a MessageBlock array from an HTML string.
 */
export function parseHtmlToBlocks(html: string): MessageBlock[] {
  if (!html) return [];
  const blocks: MessageBlock[] = [];
  const markerRegex = /<!--\s*BLOCK_DATA:(.*?)\s*-->/g;
  let match;
  while ((match = markerRegex.exec(html)) !== null) {
    try {
      const base64Data = match[1];
      const blockJson = fromBase64(base64Data);
      if (blockJson) {
        blocks.push(JSON.parse(blockJson));
      }
    } catch (e) {
      console.warn("Failed to parse block metadata:", e);
    }
  }
  return blocks;
}
