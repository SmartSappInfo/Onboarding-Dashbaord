import type { MessageBlock, MessageBlockRule, MessageStyle } from './types';
import { parseMarkdownLinksToHtml } from './utils/markdown-link-parser';
import { getBaseUrl } from './utils/url-helpers';
import { resolveTextWithMap } from './utils/variable-replacer';

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
function sanitizeContent(html: unknown): string {
  if (!html) return '';
  const str = String(html);
  return str
    .replace(/class="isSelectedEnd"/g, '')
    .replace(/class='isSelectedEnd'/g, '')
    .replace(/<p><\/p>/g, '<br/>')
    .trim();
}

const ensureUnit = (val: string | number | undefined, defaultUnit = 'px'): string => {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  if (str.endsWith('px') || str.endsWith('%') || str.endsWith('pt') || str.endsWith('em') || str.endsWith('rem')) {
    return str;
  }
  return `${str}${defaultUnit}`;
};

export function resolveVariables(text: unknown, variables: Record<string, unknown>): string {
  if (text === null || text === undefined) return '';
  const textStr = String(text);
  if (!textStr) return '';
  const sanitized = sanitizeContent(textStr);

  const valuesMap = new Map<string, unknown>();
  Object.entries(variables).forEach(([k, v]) => {
    let finalVal = v;
    if (k === 'tag_list') {
      try {
        const arr = JSON.parse(String(v));
        if (Array.isArray(arr)) finalVal = arr.join(', ');
      } catch { /* ignore */ }
    }
    valuesMap.set(k, finalVal);

    // Also register camelCase version for keys with underscores
    if (k.includes('_')) {
      const camelKey = k.replace(/_([a-z])/g, (_: string, p1: string) => p1.toUpperCase());
      if (variables[camelKey] === undefined) {
        valuesMap.set(camelKey, finalVal);
      }
    }
  });

  return resolveTextWithMap(sanitized, valuesMap);
}

/**
 * Converts a plain-text body (with \n line breaks) into well-formatted HTML
 * suitable for email clients and iframe previews.
 * 
 * This is the canonical conversion function used by:
 * - Simulation Studio preview (iframe srcDoc)
 * - Single message dispatch (sendMessage → sendEmail html:)
 * - Bulk message dispatch (processBulkJobChunk / processJobChunkBackground)
 * 
 * Handles:
 * - \n → <br> conversion for line breaks
 * - Double newlines → paragraph separation
 * - Proper font styling for email client compatibility
 * - Emoji/Unicode safe rendering
 */
export function plainTextToHtml(text: unknown, isDark?: boolean): string {
  if (!text) return '';
  const textStr = String(text);

  const outerBg = isDark ? '#090d16' : '#F1F5F9';
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const textColor = isDark ? '#f3f4f6' : '#1e293b';
  const footerColor = isDark ? '#6b7280' : '#94a3b8';

  // Escape HTML entities to prevent XSS in user-authored content
  const escaped = textStr
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Convert markdown links [Link Text](URL) to styled <a> tags after escaping
  const withLinks = parseMarkdownLinksToHtml(escaped);

  // Convert newlines to <br> tags
  const withBreaks = withLinks.replace(/\n/g, '<br>\n');

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800;900&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: ${outerBg}; font-family: 'Figtree', Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background-color: ${cardBg}; padding: 48px 40px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
      <div style="font-family: 'Figtree', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: ${textColor}; font-weight: 500;">
        ${withBreaks}
      </div>
    </div>
    <div style="margin-top: 32px; text-align: center;">
      <p style="font-family: 'Figtree', sans-serif; font-size: 11px; font-weight: 700; color: ${footerColor}; text-transform: uppercase; letter-spacing: 0.1em;">
        Powered by SmartSapp Intelligence Hub &copy; ${new Date().getFullYear()}
      </p>
    </div>
  </div>
</body>
</html>`;
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
    wrapper?: string,
    isDark?: boolean,
    style?: Partial<MessageStyle>
  }
): string {
  if (!blocks || !blocks.length) return '';

  const isDark = options?.isDark;
  const maxWidth = options?.width || '600px';
  const outerBg = options?.style?.backgroundColor || options?.backgroundColor || (isDark ? '#090d16' : '#F1F5F9');
  const cardBg = options?.style?.cardBackgroundColor || (isDark ? '#111827' : '#FFFFFF');
  const textColor = options?.style?.textColor || (isDark ? '#f3f4f6' : '#1e293b');
  const dividerColor = isDark ? '#374151' : '#e2e8f0';
  const footerTextColor = isDark ? '#6b7280' : '#94a3b8';
  const subBg = isDark ? '#1f2937' : '#f8fafc';
  const fontFam = options?.style?.fontFamily || 'Figtree';
  const hasUnit = (val: string) => /px|%|em|rem|pt|vw|vh$/.test(val);

  const cardRadius = options?.style?.borderRadius 
    ? (hasUnit(options.style.borderRadius) ? options.style.borderRadius : `${options.style.borderRadius}px`) 
    : '24px';

  const renderBlock = (block: MessageBlock, isNested?: boolean): string => {
    if (!shouldShowBlock(block, variables)) {
      return '';
    }

    const metadata = `<!-- BLOCK_DATA:${toBase64(JSON.stringify(block))} -->`;

    const s = block.style || {};
    const align = s.textAlign || 'left';
    const alignStyle = `text-align: ${align};`;
    
    // Spacing
    const paddingTopVal = ensureUnit(s.paddingTop);
    const paddingBottomVal = ensureUnit(s.paddingBottom);
    const paddingLeftVal = ensureUnit(s.paddingLeft);
    const paddingRightVal = ensureUnit(s.paddingRight);

    const paddingStyles = [
      paddingTopVal ? `padding-top: ${paddingTopVal};` : '',
      paddingBottomVal ? `padding-bottom: ${paddingBottomVal};` : '',
      paddingLeftVal ? `padding-left: ${paddingLeftVal};` : '',
      paddingRightVal ? `padding-right: ${paddingRightVal};` : '',
    ].filter(Boolean).join(' ') || (s.padding ? `padding: ${s.padding};` : 'padding: 12px 0;');
    
    const marginStyles = [
      s.marginTop ? `margin-top: ${ensureUnit(s.marginTop)};` : '',
      s.marginBottom ? `margin-bottom: ${ensureUnit(s.marginBottom)};` : '',
    ].filter(Boolean).join(' ');

    // Borders
    const borderStyles = [
      s.borderWidth ? `border-width: ${ensureUnit(s.borderWidth)};` : '',
      s.borderStyle ? `border-style: ${s.borderStyle};` : '',
      s.borderColor ? `border-color: ${s.borderColor};` : '',
      s.borderRadius ? `border-radius: ${ensureUnit(s.borderRadius)};` : '',
    ].filter(Boolean).join(' ');

    const blockBgColor = s.backgroundColor ? `background-color: ${s.backgroundColor};` : '';
    const fontColor = s.color ? `color: ${s.color};` : `color: ${textColor};`;
    const fontSizeVal = s.fontSize ? ensureUnit(s.fontSize) : (s.width ? ensureUnit(s.width) : '');
    const fontSize = fontSizeVal ? `font-size: ${fontSizeVal};` : '';
    const fontFamily = s.fontFamily ? `font-family: ${s.fontFamily};` : '';
    const fontWeight = s.fontWeight ? `font-weight: ${s.fontWeight};` : '';
    const lineHeight = s.lineHeight ? `line-height: ${s.lineHeight};` : '';

    const bgImageStyles = [
      s.backgroundImage ? `background-image: ${s.backgroundImage};` : '',
      s.backgroundSize ? `background-size: ${s.backgroundSize};` : '',
    ].filter(Boolean).join(' ');

    const baseStyle = `font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"}; ${fontColor} ${fontSize} ${fontWeight} ${lineHeight} ${alignStyle}`;
    const wrapperStyle = `${paddingStyles} ${marginStyles} ${borderStyles} ${blockBgColor} ${bgImageStyles} ${alignStyle} ${baseStyle}`;

    let blockHtml = '';

    switch (block.type) {
      case 'heading': {
        const tag = block.variant || 'h2';
        const defaultFontSize = tag === 'h1' ? '32px' : tag === 'h2' ? '24px' : '18px';
        const title = resolveVariables(block.title || '', variables);
        const headingFontSize = fontSizeVal || defaultFontSize;

        const variant = s.variant || 'standard';
        const isLeftAccent = variant === 'left_accent';
        const isDarkSlate = variant === 'dark_slate';
        const isEnvelopeBadge = variant === 'envelope_badge';
        const isNestedCard = variant === 'nested_card';
        const isSimpleWide = variant === 'simple_wide';

        const align = s.textAlign || (isDarkSlate || isEnvelopeBadge || isSimpleWide ? 'center' : 'left');
        const headingColor = isDarkSlate ? '#ffffff' : (s.color || '#0f172a');
        const headingStyle = `margin: 0; font-size: ${headingFontSize}; ${fontWeight || 'font-weight: 900;'} ${lineHeight || 'line-height: 1.2;'} letter-spacing: -0.02em; color: ${headingColor}; ${fontFamily}`;

        // Build wrapper style specifically for left_accent if applicable
        let headingWrapperStyle = wrapperStyle;
        if (isLeftAccent) {
          headingWrapperStyle += ' border-left: 4px solid #2563eb !important;';
        }

        let headerContent = '';

        // Badge/Pill Text
        if (block.pillText) {
          const pillTextVal = resolveVariables(block.pillText, variables);
          if (isDarkSlate) {
            headerContent += `
              <div style="margin-bottom: 10px; text-align: center;">
                <span style="font-size: 11px; font-weight: 900; letter-spacing: 0.05em; color: #93c5fd; text-transform: uppercase; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"};">
                  ${pillTextVal}
                </span>
              </div>
            `;
          } else {
            const hasEnvelope = isEnvelopeBadge && block.url === 'envelope';
            const envelopeIcon = hasEnvelope ? `
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin-right: 6px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            ` : '';
            
            headerContent += `
              <div style="margin-bottom: 10px; text-align: ${align};">
                <span style="display: inline-block; background-color: #eff6ff; color: #2563eb; border-radius: 9999px; padding: 4px 12px; font-size: 11px; font-weight: 600; line-height: 1.2; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"};">
                  ${envelopeIcon}${pillTextVal}
                </span>
              </div>
            `;
          }
        }

        // Title
        headerContent += `<${tag} style="${headingStyle}">${title}</${tag}>`;

        // Subtext Description
        if (block.content && !isSimpleWide) {
          const contentVal = resolveVariables(block.content, variables);
          
          if (isNestedCard) {
            headerContent += `
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 16px; font-size: 13px; font-weight: 500; line-height: 1.5; color: #475569; text-align: left; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"};">
                    ${contentVal}
                  </td>
                </tr>
              </table>
            `;
          } else {
            const iconUrl = block.url ? resolveVariables(block.url, variables) : '';
            let iconHtml = '';
            
            if (iconUrl === 'calendar') {
              iconHtml = `
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin-right: 6px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              `;
            } else if (iconUrl && iconUrl.startsWith('http')) {
              iconHtml = `<img src="${iconUrl}" style="width: 20px; height: 20px; border-radius: 50%; vertical-align: middle; margin-right: 6px; display: inline-block;" alt="avatar" />`;
            }

            const descColor = isDarkSlate ? '#cbd5e1' : '#4b5563';
            headerContent += `
              <div style="margin-top: 10px; font-size: 14px; font-weight: 500; line-height: 1.5; color: ${descColor}; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"}; text-align: ${align};">
                ${iconHtml}<span style="vertical-align: middle; display: inline-block;">${contentVal}</span>
              </div>
            `;
          }
        }

        // Details Footer for Left Accent
        if (isLeftAccent && block.rsvpDate !== undefined) {
          const rsvpDateVal = resolveVariables(block.rsvpDate || '', variables);
          const rsvpTimeVal = block.rsvpTime ? resolveVariables(block.rsvpTime, variables) : '';
          const iconUrl = block.url ? resolveVariables(block.url, variables) : '';
          
          let iconHtml = '';
          if (iconUrl === 'clock') {
            iconHtml = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            `;
          }

          headerContent += `
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #f1f5f9; width: 100%; border-collapse: collapse;">
              <tr>
                ${iconHtml ? `
                  <td valign="middle" style="width: 24px; padding-right: 8px;">
                    ${iconHtml}
                  </td>
                ` : ''}
                <td valign="middle" style="text-align: left;">
                  <div style="font-size: 12px; font-weight: 800; color: #1e293b; line-height: 1.3; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"};">${rsvpDateVal}</div>
                  ${rsvpTimeVal ? `<div style="font-size: 10px; font-weight: 500; color: #64748b; line-height: 1.3; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"};">${rsvpTimeVal}</div>` : ''}
                </td>
              </tr>
            </table>
          `;
        }

        blockHtml = `<div style="${headingWrapperStyle}">${headerContent}</div>`;
        break;
      }
      
      case 'text': {
        const content = resolveVariables(block.content || '', variables);
        const parsedContent = parseMarkdownLinksToHtml(content).replace(/\n/g, '<br>\n');
        const textFontSize = fontSizeVal || '16px';
        const textStyle = `margin: 0; font-size: ${textFontSize}; ${fontWeight || 'font-weight: 500;'} ${lineHeight || 'line-height: 1.6;'} ${fontColor} ${fontFamily}`;
        blockHtml = `<div style="${wrapperStyle}"><div style="${textStyle}">${parsedContent}</div></div>`;
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
            const defaultImgRadius = options?.style?.borderRadius ? (hasUnit(options.style.borderRadius) ? options.style.borderRadius : `${options.style.borderRadius}px`) : '16px';
            const imgRadius = s.borderRadius ? (hasUnit(s.borderRadius) ? s.borderRadius : `${s.borderRadius}px`) : defaultImgRadius;
            
            // Image border styles (from block styling s)
            const imgBorder = s.borderWidth 
              ? `${ensureUnit(s.borderWidth)} ${s.borderStyle || 'solid'} ${s.borderColor || dividerColor}`
              : `1px solid ${dividerColor}`;

            // Outer wrapper should not inherit the image border or background color
            const outerStyle = [
              alignStyle,
              marginStyles,
              paddingStyles,
            ].filter(Boolean).join(' ');

            blockHtml = `<div style="${outerStyle}"><img src="${url}" style="max-width: 100%; height: auto; border-radius: ${imgRadius}; display: block; border: ${imgBorder}; ${align === 'center' ? 'margin: 0 auto;' : align === 'right' ? 'margin-left: auto;' : ''}" alt="Image" /></div>`;
        }
        break;
      }

      case 'button': {
        const title = resolveVariables(block.title || 'Click Here', variables);
        let link = resolveVariables(block.link || '#', variables);
        if (link.startsWith('/')) {
          link = `${getBaseUrl()}${link}`;
        }
        const variant = s.variant || 'default';
        const primaryColor = options?.style?.primaryColor || '#3B5FFF';

        let btnBg = s.backgroundColor;
        let btnColor = s.color;
        let btnBorderWidth = s.borderWidth ? ensureUnit(s.borderWidth) : '';
        let btnBorderStyle = s.borderStyle || '';
        let btnBorderColor = s.borderColor || '';
        let shadowColor = options?.style?.primaryColor ? `${options.style.primaryColor}4D` : 'rgba(59, 95, 255, 0.3)';
        let btnShadow = `box-shadow: 0 10px 15px -3px ${shadowColor};`;
        let btnTextDecoration = 'text-decoration: none;';

        if (variant === 'default') {
          btnBg = btnBg || primaryColor;
          btnColor = btnColor || '#ffffff';
        } else if (variant === 'outline') {
          btnBg = btnBg || 'transparent';
          btnColor = btnColor || primaryColor;
          btnBorderWidth = btnBorderWidth || '2px';
          btnBorderStyle = btnBorderStyle || 'solid';
          btnBorderColor = btnBorderColor || primaryColor;
        } else if (variant === 'secondary') {
          btnBg = btnBg || '#f3f4f6';
          btnColor = btnColor || '#1f2937';
        } else if (variant === 'destructive') {
          btnBg = btnBg || '#dc2626';
          btnColor = btnColor || '#ffffff';
        } else if (variant === 'ghost') {
          btnBg = btnBg || 'transparent';
          btnColor = btnColor || '#4b5563';
          btnShadow = '';
        } else if (variant === 'link') {
          btnBg = btnBg || 'transparent';
          btnColor = btnColor || primaryColor;
          btnShadow = '';
          btnTextDecoration = 'text-decoration: underline;';
        }

        const styleRadius = options?.style?.borderRadius;
        const defaultRadius = styleRadius ? (hasUnit(styleRadius) ? styleRadius : `${styleRadius}px`) : '12px';
        const btnRadius = s.borderRadius ? (hasUnit(s.borderRadius) ? s.borderRadius : `${s.borderRadius}px`) : defaultRadius;
        const btnFontSize = fontSizeVal || '16px';
        const btnPadding = [
          s.paddingTop || '16px',
          s.paddingRight || '32px',
          s.paddingBottom || '16px',
          s.paddingLeft || '32px'
        ].map(p => ensureUnit(p)).join(' ');

        // Extract button border styles from block styles s
        const btnBorder = [
          btnBorderWidth ? `border-width: ${btnBorderWidth}` : '',
          btnBorderStyle ? `border-style: ${btnBorderStyle}` : '',
          btnBorderColor ? `border-color: ${btnBorderColor}` : '',
        ].filter(Boolean).join('; ');

        // Outer div should not inherit block background color or borders (they belong on the button link)
        const outerStyle = [
          alignStyle,
          marginStyles,
        ].filter(Boolean).join(' ');

        blockHtml = `
          <div style="${outerStyle} margin: 24px 0;">
            <a href="${link}" style="background-color: ${btnBg}; color: ${btnColor}; padding: ${btnPadding}; ${btnTextDecoration} border-radius: ${btnRadius}; ${btnBorder ? `${btnBorder};` : ''} ${fontWeight || 'font-weight: 800;'} ${fontFamily} display: inline-block; font-size: ${btnFontSize}; text-transform: uppercase; letter-spacing: 0.05em; ${btnShadow}">
              ${title}
            </a>
          </div>
        `;
        break;
      }

      case 'quote': {
        const content = resolveVariables(block.content || '', variables);
        const parsedContent = parseMarkdownLinksToHtml(content).replace(/\n/g, '<br>\n');
        blockHtml = `
          <div style="margin: 24px 0; padding: 24px; border-left: 4px solid ${options?.style?.primaryColor || '#3B5FFF'}; background-color: ${subBg}; font-family: ${s.fontFamily || "'" + fontFam + "', sans-serif"}; font-style: italic; color: ${s.color || (isDark ? '#9ca3af' : '#475569')}; font-size: ${fontSizeVal || '18px'}; line-height: 1.6; border-radius: 0 16px 16px 0; ${alignStyle}">
            ${parsedContent}
          </div>
        `;
        break;
      }

      case 'list': {
        const tag = (block.listStyle === 'ordered' || block.listStyle === 'roman') ? 'ol' : 'ul';
        const listStyleType = block.listStyle === 'roman' ? 'upper-roman' : block.listStyle === 'ordered' ? 'decimal' : block.listStyle === 'checkmark' || block.listStyle === 'arrow' ? 'none' : 'disc';
        
        const items = (block.items || []).map((item, i) => {
          let prefix = '';
          if (block.listStyle === 'checkmark') {
            prefix = '<span style="color: #10b981; margin-right: 8px; font-weight: bold;">✓</span>';
          } else if (block.listStyle === 'arrow') {
            prefix = '<span style="color: #3b82f6; margin-right: 8px; font-weight: bold;">→</span>';
          }
          return `<li style="margin-bottom: 10px; list-style-type: ${listStyleType};">${prefix}${resolveVariables(item, variables)}</li>`;
        }).join('');
        
        const listFontSize = fontSizeVal || '16px';
        const listStyle = `${baseStyle} font-size: ${listFontSize}; margin: 0; padding-left: ${block.listStyle === 'checkmark' || block.listStyle === 'arrow' ? '0px' : '20px'}; text-align: left; ${fontWeight || 'font-weight: 500;'}`;
        blockHtml = `<div style="${wrapperStyle}"><${tag} style="${listStyle}">${items}</${tag}></div>`;
        break;
      }

      case 'divider':
        blockHtml = `<div style="padding: 32px 0;"><hr style="border: 0; border-top: 1px solid ${dividerColor}; margin: 0;" /></div>`;
        break;

      case 'score-card': {
        const score = variables.score || 0;
        const maxScore = variables.max_score || 100;
        const pillTextVal = resolveVariables(block.pillText || 'Assessment Result', variables);
        const subtitleVal = resolveVariables(block.content || `OUT OF ${maxScore} POINTS`, variables);
        
        const scoreBg = s.backgroundColor || options?.style?.primaryColor || '#3B5FFF';
        const scoreColor = s.color || '#ffffff';
        const scoreRadius = s.borderRadius ? ensureUnit(s.borderRadius) : '24px';
        
        blockHtml = `
          <div style="background-color: ${scoreBg}; color: ${scoreColor}; ${paddingStyles ? '' : 'padding: 48px 32px;'} border-radius: ${scoreRadius}; text-align: center; margin: 32px 0; font-family: '${fontFam}', sans-serif; box-shadow: 0 20px 25px -5px rgba(59, 95, 255, 0.2); ${wrapperStyle}">
            <div style="text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 0.2em; margin-bottom: 16px; opacity: 0.8; color: ${scoreColor};">${pillTextVal}</div>
            <div style="font-size: 72px; font-weight: 900; line-height: 1; letter-spacing: -0.05em; color: ${scoreColor};">${score}</div>
            <div style="font-size: 14px; font-weight: 700; opacity: 0.6; margin-top: 8px; letter-spacing: 0.1em; color: ${scoreColor};">${subtitleVal}</div>
          </div>
        `;
        break;
      }

      case 'audio': {
        const audioTitle = resolveVariables(block.audioTitle || 'Listen to Audio', variables);
        const audioDuration = resolveVariables(block.audioDuration || '0:00', variables);
        const audioUrl = resolveVariables(block.url || '#', variables);
        const action = block.audioAction || 'play_inline';
        
        let link = audioUrl;
        if ((action === 'redirect' || action === 'play_inline') && block.audioRedirectUrl) {
            link = resolveVariables(block.audioRedirectUrl, variables);
        }
        if (link.startsWith('/')) {
            link = `${getBaseUrl()}${link}`;
        }

        const primaryColor = options?.style?.primaryColor || '#3B5FFF';
        const styleRadius = options?.style?.borderRadius;
        const defaultRadius = styleRadius ? (hasUnit(styleRadius) ? styleRadius : `${styleRadius}px`) : '16px';
        const cardRadius = s.borderRadius ? (hasUnit(s.borderRadius) ? s.borderRadius : `${s.borderRadius}px`) : defaultRadius;
        
        const cardBg = s.backgroundColor || '#ffffff';
        const borderConfig = s.borderWidth 
            ? `${ensureUnit(s.borderWidth)} ${s.borderStyle || 'solid'} ${s.borderColor || dividerColor}`
            : `1px solid ${dividerColor}`;

        const cardTextColor = s.color || textColor;
        const subTextColor = isDark ? '#9ca3af' : '#64748b';
        const actionText = action === 'download' ? 'Download Note' : 'Listen Now';

        const styleBlock = action === 'play_inline' ? `
            <style>
              @media screen and (-webkit-min-device-pixel-ratio: 0) {
                .audio-native-${block.id} {
                  display: block !important;
                  max-height: none !important;
                  overflow: visible !important;
                }
                .audio-card-${block.id} {
                  display: none !important;
                }
              }
            </style>
        ` : '';

        const nativePlayer = action === 'play_inline' ? `
            <!--[if !mso]><!-->
            <div class="audio-native-${block.id}" style="display:none; max-height:0px; overflow:hidden; mso-hide:all; margin-bottom:12px;">
                <audio src="${audioUrl}" controls style="width: 100%;"></audio>
            </div>
            <!--<![endif]-->
        ` : '';

        blockHtml = `
            ${styleBlock}
            ${nativePlayer}

            <div class="audio-card-${block.id}" style="margin: 16px 0; ${marginStyles}">
                <a href="${link}" style="text-decoration: none; display: block; outline: none; border: none;">
                    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; background-color: ${cardBg}; border: ${borderConfig}; border-radius: ${cardRadius}; overflow: hidden;">
                        <tr>
                            <td style="padding: 16px 12px 16px 20px; width: 40px; vertical-align: middle;">
                                <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin: 0;">
                                    <tr>
                                        <td align="center" valign="middle" style="width: 40px; height: 40px; border-radius: 20px; background-color: ${primaryColor}; text-align: center; font-size: 0; line-height: 0;">
                                            <div style="width: 0; height: 0; border-style: solid; border-width: 6px 0 6px 10px; border-color: transparent transparent transparent #ffffff; margin-left: 3px; display: inline-block; vertical-align: middle;"></div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td style="padding: 16px 20px 16px 12px; vertical-align: middle; text-align: left;">
                                <div style="font-size: 14px; font-weight: bold; color: ${cardTextColor}; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"}; line-height: 1.3; margin-bottom: 4px;">
                                    ${audioTitle}
                                </div>
                                <div style="font-size: 11px; font-weight: 600; color: ${subTextColor}; font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"}; line-height: 1; text-transform: uppercase; letter-spacing: 0.05em;">
                                    ${audioDuration} &bull; ${actionText}
                                </div>
                            </td>
                        </tr>
                    </table>
                </a>
            </div>
        `;
        break;
      }

      case 'video': {
        const videoUrl = resolveVariables(block.url || '#', variables);
        const thumbnailUrl = resolveVariables(block.videoThumbnailUrl || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80', variables);
        const action = block.videoAction || 'play_inline';
        
        let link = videoUrl;
        if ((action === 'redirect' || action === 'play_inline') && block.videoRedirectUrl) {
            link = resolveVariables(block.videoRedirectUrl, variables);
        }
        if (link.startsWith('/')) {
            link = `${getBaseUrl()}${link}`;
        }

        const styleRadius = options?.style?.borderRadius;
        const defaultRadius = styleRadius ? (hasUnit(styleRadius) ? styleRadius : `${styleRadius}px`) : '16px';
        const imgRadius = s.borderRadius ? (hasUnit(s.borderRadius) ? s.borderRadius : `${s.borderRadius}px`) : defaultRadius;
        
        const borderConfig = s.borderWidth 
            ? `${ensureUnit(s.borderWidth)} ${s.borderStyle || 'solid'} ${s.borderColor || dividerColor}`
            : `1px solid ${dividerColor}`;

        const styleBlock = action === 'play_inline' ? `
            <style>
              @media screen and (-webkit-min-device-pixel-ratio: 0) {
                .video-native-${block.id} {
                  display: block !important;
                  max-height: none !important;
                  overflow: visible !important;
                }
                .video-card-${block.id} {
                  display: none !important;
                }
              }
            </style>
        ` : '';

        const nativePlayer = action === 'play_inline' ? `
            <!--[if !mso]><!-->
            <div class="video-native-${block.id}" style="display:none; max-height:0px; overflow:hidden; mso-hide:all; margin-bottom:12px;">
                <video src="${videoUrl}" poster="${thumbnailUrl}" controls style="width: 100%; border-radius: ${imgRadius};"></video>
            </div>
            <!--<![endif]-->
        ` : '';

        blockHtml = `
            ${styleBlock}
            ${nativePlayer}

            <div class="video-card-${block.id}" style="margin: 16px 0; ${marginStyles} text-align: ${align};">
                <a href="${link}" style="text-decoration: none; display: block; outline: none; border: none;">
                    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; border-collapse: collapse; border-radius: ${imgRadius}; border: ${borderConfig}; overflow: hidden; background-color: #000000; margin: 0 auto;">
                        <tr>
                            <td style="padding: 0; text-align: center; line-height: 0; position: relative;">
                                <div style="position: relative; display: block;">
                                    <!-- Poster Background Image -->
                                    <img src="${thumbnailUrl}" style="display: block; width: 100%; height: auto; max-width: 100%; border-radius: ${imgRadius}; border: none;" alt="Watch Video" />
                                    
                                    <!-- Centered Play Button Overlay (Hidden in Outlook which doesn't support positioning) -->
                                    <!--[if !mso]><!-->
                                    <div style="position: absolute; top: 50%; left: 50%; margin-top: -30px; margin-left: -30px; width: 60px; height: 60px; border-radius: 30px; background-color: rgba(255, 255, 255, 0.25); text-align: center; font-size: 0; line-height: 0;">
                                        <div style="width: 0; height: 0; border-style: solid; border-width: 10px 0 10px 16px; border-color: transparent transparent transparent #ffffff; margin-top: 20px; margin-left: 4px; display: inline-block; vertical-align: middle;"></div>
                                    </div>
                                    <!--<![endif]-->
                                </div>
                            </td>
                        </tr>
                    </table>
                </a>
            </div>
        `;
        break;
      }

      case 'header': {
        const headerLogo = resolveVariables(block.url || '{{org_logo_url}}', variables);
        const headerName = resolveVariables('{{org_name}}', variables);
        blockHtml = `
          <div style="${wrapperStyle} padding: 24px 0; border-bottom: 1px solid ${dividerColor};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td style="vertical-align: middle;">
                  <img src="${headerLogo}" alt="${headerName}" style="height: 40px; width: auto; display: block;" width="100" height="40" />
                </td>
                <td style="vertical-align: middle; text-align: right;">
                  <span style="${baseStyle} font-size: 16px; font-weight: 800; color: ${textColor};">${headerName}</span>
                </td>
              </tr>
            </table>
          </div>
        `;
        break;
      }

      case 'footer': {
        const fName = resolveVariables('{{org_name}}', variables);
        const fEmail = resolveVariables('{{org_email}}', variables);
        const fPhone = resolveVariables('{{org_phone}}', variables);
        const fAddr = resolveVariables('{{org_address}}', variables);
        const fYear = resolveVariables('{{current_year}}', variables) || new Date().getFullYear().toString();
        blockHtml = `
          <div data-block-type="footer" style="padding: 32px 0 16px; margin-top: 24px; border-top: 1px solid ${dividerColor}; text-align: center; font-family: '${fontFam}', sans-serif;">
            <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: ${isDark ? '#9ca3af' : '#475569'};">${fName}</p>
            <p style="margin: 0 0 4px; font-size: 11px; font-weight: 500; color: ${isDark ? '#6b7280' : '#94a3b8'};">${fAddr}</p>
            <p style="margin: 0 0 8px; font-size: 11px; font-weight: 500; color: ${isDark ? '#6b7280' : '#94a3b8'};">${fEmail} | ${fPhone}</p>
            <p style="margin: 0; font-size: 10px; font-weight: 600; color: ${isDark ? '#4b5563' : '#cbd5e1'};">&copy; ${fYear} ${fName}. All rights reserved.</p>
          </div>
        `;
        break;
      }

      case 'rsvp': {
        const title = resolveVariables(block.title || 'Will you attend this meeting?', variables);
        const going = resolveVariables(block.goingLabel || 'Going', variables);
        const declined = resolveVariables(block.declinedLabel || 'Not Going', variables);
        const later = resolveVariables(block.laterLabel || 'Later', variables);
        const goingUrl = resolveVariables('{{rsvp_going_url}}', variables);
        const laterUrl = resolveVariables('{{rsvp_later_url}}', variables);
        const declinedUrl = resolveVariables('{{rsvp_declined_url}}', variables);

        const rsvpStyle = block.rsvpStyle || 'standard';
        const isDetailed = rsvpStyle === 'card_bento' || rsvpStyle === 'card_inline';
        const rsvpDate = resolveVariables(block.rsvpDate || 'Tuesday, Sep 24', variables);
        const rsvpTime = resolveVariables(block.rsvpTime || '10:00 - 11:00 AM', variables);
        const rsvpLocation = resolveVariables(block.rsvpLocation || 'Google Meet', variables);

        const pillText = resolveVariables(block.pillText || 'Invitation', variables);
        const rsvpDateLabel = resolveVariables(block.rsvpDateLabel || 'DATE', variables);
        const rsvpTimeLabel = resolveVariables(block.rsvpTimeLabel || 'TIME', variables);
        const rsvpLocationLabel = resolveVariables(block.rsvpLocationLabel || 'TYPE', variables);
        const description = resolveVariables(block.content || '', variables);

        const isEventStyle = ['event_full_bento', 'event_full_inline', 'event_compact_bento', 'event_compact_inline'].includes(rsvpStyle);
        if (isEventStyle) {
          const hasPillDesc = ['event_full_bento', 'event_full_inline'].includes(rsvpStyle);
          const isBento = ['event_full_bento', 'event_compact_bento'].includes(rsvpStyle);
          const pillTextVal = pillText || 'Invitation';
          const rsvpDateLabelVal = rsvpDateLabel || 'DATE';
          const rsvpTimeLabelVal = rsvpTimeLabel || 'TIME';
          const rsvpLocationLabelVal = rsvpLocationLabel || 'TYPE';
          const eventDescVal = description || 'Reviewing the quarterly brand evolution and digital style guidance for the upcoming luxury client launch.';
          
          let buttonsHtml = '';
          if (isBento) {
            buttonsHtml = `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${goingUrl}" style="background-color: #0052cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 14px; border: 1px solid #0052cc;">
                      <span style="vertical-align: middle; display: inline-block;">${going}</span>
                      <span style="display: inline-block; vertical-align: middle; margin-left: 6px; margin-top: -2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                      </span>
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 49%; padding-right: 6px; vertical-align: middle;">
                    <a href="${laterUrl}" style="background-color: #ffffff; color: #334155; padding: 11px 16px; text-decoration: none; border-radius: 12px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 13px; border: 1.5px solid #e2e8f0;">
                      <span style="vertical-align: middle; display: inline-block;">${later}</span>
                      <span style="display: inline-block; vertical-align: middle; margin-left: 6px; margin-top: -2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </span>
                    </a>
                  </td>
                  <td style="width: 49%; padding-left: 6px; vertical-align: middle;">
                    <a href="${declinedUrl}" style="background-color: #ffffff; color: #334155; padding: 11px 16px; text-decoration: none; border-radius: 12px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 13px; border: 1.5px solid #e2e8f0;">
                      <span style="vertical-align: middle; display: inline-block;">${declined}</span>
                      <span style="display: inline-block; vertical-align: middle; margin-left: 6px; margin-top: -2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      </span>
                    </a>
                  </td>
                </tr>
              </table>
            `;
          } else {
            buttonsHtml = `
              <style>
                @media only screen and (max-width: 480px) {
                  .rsvp-btn-going-${block.id} {
                    display: block !important;
                    width: 100% !important;
                    padding-bottom: 12px !important;
                    padding-right: 0 !important;
                    padding-left: 0 !important;
                  }
                  .rsvp-btn-later-${block.id} {
                    display: inline-block !important;
                    width: 49% !important;
                    padding-right: 6px !important;
                    padding-left: 0 !important;
                    box-sizing: border-box !important;
                  }
                  .rsvp-btn-notgoing-${block.id} {
                    display: inline-block !important;
                    width: 49% !important;
                    padding-left: 6px !important;
                    padding-right: 0 !important;
                    box-sizing: border-box !important;
                  }
                  .rsvp-btn-going-${block.id} a, .rsvp-btn-later-${block.id} a, .rsvp-btn-notgoing-${block.id} a {
                    padding: 12px 16px !important;
                    font-size: 13px !important;
                  }
                }
              </style>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td class="rsvp-btn-going-${block.id}" style="width: 32%; padding-right: 6px; vertical-align: middle;">
                    <a href="${goingUrl}" style="background-color: #0052cc; color: #ffffff; padding: 11px 8px; text-decoration: none; border-radius: 12px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 12px; border: 1px solid #0052cc;">
                      <span style="vertical-align: middle; display: inline-block;">${going}</span>
                      <span style="display: inline-block; vertical-align: middle; margin-left: 4px; margin-top: -2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                      </span>
                    </a>
                  </td>
                  <td class="rsvp-btn-later-${block.id}" style="width: 32%; padding-left: 3px; padding-right: 3px; vertical-align: middle;">
                    <a href="${laterUrl}" style="background-color: #ffffff; color: #334155; padding: 10px 8px; text-decoration: none; border-radius: 12px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 12px; border: 1.5px solid #e2e8f0;">
                      <span style="vertical-align: middle; display: inline-block;">${later}</span>
                      <span style="display: inline-block; vertical-align: middle; margin-left: 4px; margin-top: -2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </span>
                    </a>
                  </td>
                  <td class="rsvp-btn-notgoing-${block.id}" style="width: 32%; padding-left: 6px; vertical-align: middle;">
                    <a href="${declinedUrl}" style="background-color: #ffffff; color: #334155; padding: 10px 8px; text-decoration: none; border-radius: 12px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 12px; border: 1.5px solid #e2e8f0;">
                      <span style="vertical-align: middle; display: inline-block;">${declined}</span>
                      <span style="display: inline-block; vertical-align: middle; margin-left: 4px; margin-top: -2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      </span>
                    </a>
                  </td>
                </tr>
              </table>
            `;
          }
          
          blockHtml = `
            <style>
              @media only screen and (max-width: 480px) {
                .rsvp-card-${block.id} {
                  padding: 16px !important;
                }
                .rsvp-meta-cell-${block.id} {
                  display: block !important;
                  width: 100% !important;
                  border-left: none !important;
                  padding-left: 0 !important;
                  padding-right: 0 !important;
                  padding-top: 12px !important;
                  padding-bottom: 12px !important;
                  border-top: 1px solid #f1f5f9 !important;
                }
                .rsvp-meta-cell-${block.id}:first-child {
                  border-top: none !important;
                  padding-top: 0 !important;
                }
              }
            </style>
            <div class="rsvp-card-${block.id}" style="background-color: ${s.backgroundColor || '#ffffff'}; padding: 24px; border-radius: ${s.borderRadius || '16px'}; border: ${s.borderWidth || '1px'} ${s.borderStyle || 'solid'} ${s.borderColor || '#e2e8f0'}; font-family: '${fontFam}', Helvetica, Arial, sans-serif; text-align: left; margin: 16px 0; box-sizing: border-box; box-shadow: 0 2px 12px rgba(0,0,0,0.04);">
              ${hasPillDesc ? `
                <!-- Pill Badge -->
                <div style="margin-bottom: 12px;">
                  <span style="display: inline-block; background-color: #eff6ff; color: #0052cc; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
                    ${pillTextVal}
                  </span>
                </div>
                
                <!-- Event Title -->
                <div style="font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.25; margin-bottom: 8px;">
                  ${title}
                </div>
                
                <!-- Event Description -->
                <div style="font-size: 14px; font-weight: 500; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
                  ${eventDescVal}
                </div>
                
                <!-- Horizontal Divider -->
                <div style="border-top: 1px solid #f1f5f9; margin-bottom: 16px;"></div>
              ` : ''}
              
              <!-- Metadata Columns -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <!-- Date Column -->
                  <td class="rsvp-meta-cell-${block.id}" style="width: 32%; vertical-align: top; padding-right: 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 10px; width: 36px;">
                          <div style="background-color: #eff6ff; padding: 8px; border-radius: 10px; display: inline-block; width: 20px; height: 20px; text-align: center;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0052cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </div>
                        </td>
                        <td style="vertical-align: middle; font-family: '${fontFam}', Helvetica, Arial, sans-serif; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">
                          <div style="font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase; line-height: 1.2;">${rsvpDateLabelVal}</div>
                          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; line-height: 1.2; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">${rsvpDate}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  
                  <!-- Time Column -->
                  <td class="rsvp-meta-cell-${block.id}" style="width: 32%; vertical-align: top; border-left: 1px solid #f1f5f9; padding-left: 16px; padding-right: 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 10px; width: 36px;">
                          <div style="background-color: #eff6ff; padding: 8px; border-radius: 10px; display: inline-block; width: 20px; height: 20px; text-align: center;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0052cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </div>
                        </td>
                        <td style="vertical-align: middle; font-family: '${fontFam}', Helvetica, Arial, sans-serif; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">
                          <div style="font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase; line-height: 1.2;">${rsvpTimeLabelVal}</div>
                          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; line-height: 1.2; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">${rsvpTime}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  
                  <!-- Type Column -->
                  <td class="rsvp-meta-cell-${block.id}" style="width: 32%; vertical-align: top; border-left: 1px solid #f1f5f9; padding-left: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 10px; width: 36px;">
                          <div style="background-color: #eff6ff; padding: 8px; border-radius: 10px; display: inline-block; width: 20px; height: 20px; text-align: center;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0052cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                          </div>
                        </td>
                        <td style="vertical-align: middle; font-family: '${fontFam}', Helvetica, Arial, sans-serif; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">
                          <div style="font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase; line-height: 1.2;">${rsvpLocationLabelVal}</div>
                          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; line-height: 1.2; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">${rsvpLocation}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <div style="border-top: 1px solid #f1f5f9; margin-bottom: 20px;"></div>
              
              ${buttonsHtml}
            </div>
          `;
        } else if (isDetailed) {
          const buttonsHtml = rsvpStyle === 'card_bento' ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding-bottom: 12px;">
                  <a href="${goingUrl}" style="background-color: #0062cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 14px; border: 1px solid #0062cc;">
                    <span style="display: inline-block; vertical-align: middle; margin-right: 6px; margin-top: -2px;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    <span style="vertical-align: middle; display: inline-block;">${going}</span>
                  </a>
                </td>
              </tr>
            </table>
            
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 49%; padding-right: 6px; vertical-align: middle;">
                  <a href="${declinedUrl}" style="background-color: #ffffff; color: #0062cc; padding: 11px 16px; text-decoration: none; border-radius: 9999px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 13px; border: 1.5px solid #cbd5e1;">
                    <span style="display: inline-block; vertical-align: middle; margin-right: 6px; margin-top: -2px;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0062cc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span style="vertical-align: middle; display: inline-block;">${declined}</span>
                  </a>
                </td>
                <td style="width: 49%; padding-left: 6px; vertical-align: middle;">
                  <a href="${laterUrl}" style="background-color: #ffffff; color: #0062cc; padding: 11px 16px; text-decoration: none; border-radius: 9999px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 13px; border: 1.5px solid #cbd5e1;">
                    <span style="display: inline-block; vertical-align: middle; margin-right: 6px; margin-top: -2px;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0062cc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 13"/></svg>
                    </span>
                    <span style="vertical-align: middle; display: inline-block;">${later}</span>
                  </a>
                </td>
              </tr>
            </table>
          ` : `
            <style>
              @media only screen and (max-width: 480px) {
                .rsvp-btn-going-${block.id} {
                  display: block !important;
                  width: 100% !important;
                  padding-bottom: 12px !important;
                  padding-right: 0 !important;
                }
                .rsvp-btn-sec-l-${block.id} {
                  display: inline-block !important;
                  width: 48% !important;
                  padding-right: 6px !important;
                  box-sizing: border-box !important;
                  padding-left: 0 !important;
                }
                .rsvp-btn-sec-r-${block.id} {
                  display: inline-block !important;
                  width: 48% !important;
                  padding-left: 6px !important;
                  box-sizing: border-box !important;
                  padding-right: 0 !important;
                }
                .rsvp-btn-sec-l-${block.id} a, .rsvp-btn-sec-r-${block.id} a {
                  padding: 11px 16px !important;
                  font-size: 13px !important;
                }
                .rsvp-btn-going-${block.id} a {
                  padding: 12px 24px !important;
                  font-size: 14px !important;
                }
              }
            </style>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td class="rsvp-btn-going-${block.id}" style="width: 32%; padding-right: 6px; vertical-align: middle;">
                  <a href="${goingUrl}" style="background-color: #0062cc; color: #ffffff; padding: 11px 8px; text-decoration: none; border-radius: 9999px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 12px; border: 1px solid #0062cc;">
                    <span style="display: inline-block; vertical-align: middle; margin-right: 4px; margin-top: -2px;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    <span style="vertical-align: middle; display: inline-block;">${going}</span>
                  </a>
                </td>
                <td class="rsvp-btn-sec-l-${block.id}" style="width: 32%; padding-left: 3px; padding-right: 3px; vertical-align: middle;">
                  <a href="${declinedUrl}" style="background-color: #ffffff; color: #0062cc; padding: 10px 8px; text-decoration: none; border-radius: 9999px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 12px; border: 1.5px solid #cbd5e1;">
                    <span style="display: inline-block; vertical-align: middle; margin-right: 4px; margin-top: -2px;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0062cc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span style="vertical-align: middle; display: inline-block;">${declined}</span>
                  </a>
                </td>
                <td class="rsvp-btn-sec-r-${block.id}" style="width: 32%; padding-left: 6px; vertical-align: middle;">
                  <a href="${laterUrl}" style="background-color: #ffffff; color: #0062cc; padding: 10px 8px; text-decoration: none; border-radius: 9999px; font-weight: 700; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: block; text-align: center; font-size: 12px; border: 1.5px solid #cbd5e1;">
                    <span style="display: inline-block; vertical-align: middle; margin-right: 4px; margin-top: -2px;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0062cc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 13"/></svg>
                    </span>
                    <span style="vertical-align: middle; display: inline-block;">${later}</span>
                  </a>
                </td>
              </tr>
            </table>
          `;

          blockHtml = `
            <style>
              @media only screen and (max-width: 480px) {
                .rsvp-card-${block.id} {
                  padding: 16px !important;
                }
              }
            </style>
            <div class="rsvp-card-${block.id}" style="background-color: ${s.backgroundColor || '#ffffff'}; padding: 24px; border-radius: ${s.borderRadius || '16px'}; border: ${s.borderWidth || '1px'} ${s.borderStyle || 'solid'} ${s.borderColor || '#cbd5e1'}; font-family: '${fontFam}', Helvetica, Arial, sans-serif; text-align: left; margin: 16px 0; box-sizing: border-box;">
              ${block.title ? `
                <div style="margin-bottom: 16px; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.3; font-family: '${fontFam}', Helvetica, Arial, sans-serif;">
                  ${title}
                </div>
              ` : ''}
              
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <!-- Date/Time Row -->
                <tr>
                  <td style="padding-bottom: 14px; vertical-align: top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px; padding-top: 2px; width: 22px;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0062cc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </td>
                        <td style="vertical-align: top; font-family: '${fontFam}', Helvetica, Arial, sans-serif; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">
                          <div style="font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.3; margin: 0; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">${rsvpDate}</div>
                          <div style="font-size: 13px; font-weight: 500; color: #64748b; margin: 2px 0 0 0; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">${rsvpTime}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Location Row -->
                <tr>
                  <td style="vertical-align: top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px; padding-top: 2px; width: 22px;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0062cc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                        </td>
                        <td style="vertical-align: top; font-family: '${fontFam}', Helvetica, Arial, sans-serif; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">
                          <div style="font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.3; margin: 0; word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;">${rsvpLocation}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${buttonsHtml}
            </div>
          `;
        } else {
          blockHtml = `
            <div style="${wrapperStyle}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="${align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'}" style="padding: 16px 0;">
                    <div style="margin-bottom: 16px; font-size: ${fontSizeVal || '18px'}; ${fontWeight || 'font-weight: 700;'} font-family: ${s.fontFamily || "'" + fontFam + "', Helvetica, Arial, sans-serif"}; ${fontColor}">
                      ${title}
                    </div>
                    
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display: inline-block; margin: 0 auto;">
                      <tr>
                        <td style="padding: 4px 8px; vertical-align: middle;">
                          <a href="${goingUrl}" style="background-color: #10b981; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: inline-block; font-size: 14px;">
                            ${going}
                          </a>
                        </td>
                        <td style="padding: 4px 8px; vertical-align: middle;">
                          <a href="${laterUrl}" style="background-color: #f59e0b; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: inline-block; font-size: 14px;">
                            ${later}
                          </a>
                        </td>
                        <td style="padding: 4px 8px; vertical-align: middle;">
                          <a href="${declinedUrl}" style="background-color: #ef4444; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-family: '${fontFam}', Helvetica, Arial, sans-serif; display: inline-block; font-size: 14px;">
                            ${declined}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>
          `;
        }
        break;
      }

      case 'columns': {
        const cols = block.columns || [];
        const colWidths = cols.map(c => c.width || `${Math.floor(100 / cols.length)}%`);
        
        const tableCells = cols.map((col, idx) => {
          const cellBlocksHtml = col.blocks.map(b => renderBlock(b, true)).join('\n');
          return `
            <td style="width: ${colWidths[idx]}; vertical-align: top; padding: 8px;">
              ${cellBlocksHtml}
            </td>
          `;
        }).join('');

        blockHtml = `
          <div style="${wrapperStyle}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <tr>
                ${tableCells}
              </tr>
            </table>
          </div>
        `;
        break;
      }

      default:
        blockHtml = '';
    }

    if (isNested) {
      return blockHtml;
    }
    return blockHtml + '\n' + metadata;
  };

  const contentHtml = blocks.map(b => renderBlock(b, false)).join('\n');

  let wrapperHtml = contentHtml;
  if (options?.wrapper && options.wrapper.includes('{{content}}')) {
    const resolvedWrapper = resolveVariables(options.wrapper, variables).replace('{{content}}', contentHtml);
    if (
      resolvedWrapper.toLowerCase().includes('<html') ||
      resolvedWrapper.toLowerCase().includes('<!doctype') ||
      resolvedWrapper.toLowerCase().includes('<body')
    ) {
      return resolvedWrapper;
    }
    wrapperHtml = resolvedWrapper;
  }

  let fontLink = '';
  const webSafeFonts = ['arial', 'helvetica', 'georgia', 'times new roman', 'courier', 'courier new', 'verdana', 'sans-serif', 'serif', 'monospace', 'system-ui', '-apple-system'];
  if (fontFam && fontFam !== 'Figtree') {
    const primaryFont = fontFam.split(',')[0].trim().replace(/['"]/g, '');
    if (!webSafeFonts.includes(primaryFont.toLowerCase())) {
        const formattedFont = primaryFont.replace(/\s+/g, '+');
        fontLink = `\n<link href="https://fonts.googleapis.com/css2?family=${formattedFont}:wght@400;500;700;800;900&display=swap" rel="stylesheet">`;
    }
  }

  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title></title>
<!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800;900&display=swap" rel="stylesheet">${fontLink}
<style type="text/css">
  #outlook a { padding:0; }
  body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
  table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
  img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
  p { display:block;margin:13px 0; line-height: 1.6; }
  body, table, td, p, a, h1, h2, h3, h4, h5, h6 { font-family: '${fontFam}', Helvetica, Arial, sans-serif; }
</style>
</head>
<body style="word-spacing:normal;background-color:${outerBg};padding: 40px 20px;">
  <div style="background-color:${outerBg};">
    <div style="margin:0px auto;max-width:${maxWidth};">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background-color: ${cardBg}; border-radius: ${cardRadius}; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
        <tbody>
          <tr>
            <td style="direction:ltr;font-size:0px;padding:48px 40px;text-align:center;font-family: '${fontFam}', sans-serif; color: ${textColor};">
              ${wrapperHtml}
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Footer -->
      <div style="margin-top: 32px; text-align: center;">
        <p style="font-family: '${fontFam}', sans-serif; font-size: 11px; font-weight: 700; color: ${footerTextColor}; text-transform: uppercase; letter-spacing: 0.1em;">
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

/**
 * Injects a hidden preheader div containing the preview text into the compiled HTML.
 * Uses the standard email spacing trick to prevent subsequent body text from leaking into the preview.
 */
export function injectPreviewTextIntoHtml(html: string, previewText: string): string {
  if (!previewText) return html;
  
  // Gmail/Outlook preview spacing trick
  const spacing = '&nbsp;&zwnj;'.repeat(150);
  const preheaderHtml = `<div style="display: none; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; font-family: sans-serif;">${previewText}${spacing}</div>`;

  // Inject right after opening <body> tag if it exists, else prepend to the start
  const bodyTagRegex = /<body[^>]*>/i;
  const match = html.match(bodyTagRegex);
  if (match && match.index !== undefined) {
    const insertIdx = match.index + match[0].length;
    return html.slice(0, insertIdx) + preheaderHtml + html.slice(insertIdx);
  }
  return preheaderHtml + html;
}

