
import type { MessageBlock, MessageBlockRule } from './types';

/**
 * Resolves variables in a text string using {{variable_name}} syntax.
 */
export function resolveVariables(text: string, variables: Record<string, any>): string {
  if (!text) return '';
  return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const cleanKey = key.trim();
    const value = variables[cleanKey];
    return value !== undefined ? String(value) : match;
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

    switch (rule.operator) {
      case 'isEqualTo': return strValue === target;
      case 'isNotEqualTo': return strValue !== target;
      case 'contains': return strValue.toLowerCase().includes(target.toLowerCase());
      case 'doesNotContain': return !strValue.toLowerCase().includes(target.toLowerCase());
      case 'isGreaterThan': return Number(strValue) > Number(target);
      case 'isLessThan': return Number(strValue) < Number(target);
      case 'isEmpty': return strValue === '';
      case 'isNotEmpty': return strValue !== '';
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
 * Optimized for Outlook, Gmail, and Mobile clients using table-based layouts.
 * Includes block-level visibility filtering and responsive columns.
 */
export function renderBlocksToHtml(blocks: MessageBlock[], variables: Record<string, any>, options?: { width?: string, backgroundColor?: string }): string {
  if (!blocks || blocks.length === 0) return '';

  const maxWidth = options?.width || '600px';
  const bgColor = options?.backgroundColor || '#ffffff';

  const renderBlock = (block: MessageBlock): string => {
    if (!shouldShowBlock(block, variables)) {
      return '';
    }

    const align = block.style?.textAlign || 'left';
    const alignStyle = `text-align: ${align};`;
    const blockBgColor = block.style?.backgroundColor ? `background-color: ${block.style.backgroundColor};` : '';
    const padding = block.style?.padding || '10px 0';
    const borderRadius = block.style?.borderRadius ? `border-radius: ${block.style.borderRadius};` : '';
    
    const wrapperStyle = `padding: ${padding}; ${alignStyle} ${blockBgColor} ${borderRadius}`;

    switch (block.type) {
      case 'heading': {
        const tag = block.variant || 'h2';
        const fontSize = tag === 'h1' ? '28px' : tag === 'h2' ? '22px' : '18px';
        const title = resolveVariables(block.title || '', variables);
        return `<div style="${wrapperStyle}"><${tag} style="font-family: sans-serif; color: #1e293b; margin: 0; font-size: ${fontSize}; font-weight: 800; line-height: 1.2;">${title}</${tag}></div>`;
      }
      
      case 'text': {
        const content = resolveVariables(block.content || '', variables);
        return `<div style="${wrapperStyle}"><p style="font-family: sans-serif; color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">${content}</p></div>`;
      }

      case 'logo': {
        const url = resolveVariables(block.url || '{{school_logo}}', variables);
        return `<div style="${wrapperStyle}"><img src="${url}" style="height: 40px; width: auto; display: block; ${align === 'center' ? 'margin: 0 auto;' : align === 'right' ? 'margin-left: auto;' : ''}" alt="Logo" /></div>`;
      }

      case 'image': {
        const url = resolveVariables(block.url || '', variables);
        if (!url) return '';
        return `<div style="${wrapperStyle}"><img src="${url}" style="max-width: 100%; height: auto; border-radius: 12px; display: block; ${align === 'center' ? 'margin: 0 auto;' : align === 'right' ? 'margin-left: auto;' : ''}" alt="Image" /></div>`;
      }

      case 'button': {
        const title = resolveVariables(block.title || 'Click Here', variables);
        const link = resolveVariables(block.link || '#', variables);
        return `
          <div style="${wrapperStyle} margin: 20px 0;">
            <a href="${link}" style="background-color: #3B5FFF; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 800; font-family: sans-serif; display: inline-block;">
              ${title}
            </a>
          </div>
        `;
      }

      case 'quote': {
        const content = resolveVariables(block.content || '', variables);
        return `
          <div style="margin: 20px 0; padding: 20px; border-left: 4px solid #3B5FFF; background-color: #f8fafc; font-family: sans-serif; font-style: italic; color: #1e293b; font-size: 18px; ${alignStyle}">
            ${content}
          </div>
        `;
      }

      case 'list': {
        const tag = block.listStyle === 'ordered' ? 'ol' : 'ul';
        const items = (block.items || []).map(item => `<li style="margin-bottom: 8px;">${resolveVariables(item, variables)}</li>`).join('');
        return `<div style="${wrapperStyle}"><${tag} style="font-family: sans-serif; color: #475569; font-size: 16px; line-height: 1.6; margin: 0; padding-left: 20px; text-align: left;">${items}</${tag}></div>`;
      }

      case 'divider':
        return `<div style="padding: 20px 0;"><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 0;" /></div>`;

      case 'columns': {
        const columnCount = block.columns?.length || 1;
        const colWidth = 100 / columnCount;
        
        const cols = (block.columns || []).map(col => {
          const innerHtml = col.blocks.map(renderBlock).join('');
          return `
            <!--[if mso | IE]>
            <td align="left" vertical-align="top" style="width:${colWidth}%;">
            <![endif]-->
            <div style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                <tr>
                  <td align="left" style="font-size:0px;padding:10px 10px;word-break:break-word;">
                    ${innerHtml}
                  </td>
                </tr>
              </table>
            </div>
            <!--[if mso | IE]>
            </td>
            <![endif]-->
          `;
        }).join('');

        return `
          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
            <tbody>
              <tr>
                <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;">
                  <!--[if mso | IE]>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                  <![endif]-->
                  ${cols}
                  <!--[if mso | IE]>
                    </tr>
                  </table>
                  <![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        `;
      }

      case 'header': {
        const content = resolveVariables(block.content || '', variables);
        return `
          <div style="padding: 20px 0; border-bottom: 1px solid #f1f5f9; ${alignStyle}">
            <div style="font-family: sans-serif; color: #1e293b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.6;">
              ${content || 'Organization Header'}
            </div>
          </div>
        `;
      }

      case 'footer': {
        const content = resolveVariables(block.content || '', variables);
        return `
          <div style="background-color: #f8fafc; padding: 40px 20px; border-radius: 16px; margin-top: 40px; text-align: center; border: 1px solid #f1f5f9;">
            <div style="font-family: sans-serif; color: #64748b; font-size: 12px; font-weight: 500; line-height: 1.8;">
              ${content || '© ' + new Date().getFullYear() + ' SmartSapp. All rights reserved.'}
              <br />
              You are receiving this because you are part of an onboarding school.
            </div>
          </div>
        `;
      }

      case 'score-card': {
        const score = variables.score || 0;
        const maxScore = variables.max_score || 100;
        return `
          <div style="background-color: #3B5FFF; color: #ffffff; padding: 40px; border-radius: 24px; text-align: center; margin: 30px 0; font-family: sans-serif;">
            <div style="text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 2px; margin-bottom: 15px; opacity: 0.8;">Assessment Result</div>
            <div style="font-size: 64px; font-weight: 900; line-height: 1;">${score}</div>
            <div style="font-size: 14px; font-weight: 700; opacity: 0.6; margin-top: 5px;">OUT OF ${maxScore} POINTS</div>
          </div>
        `;
      }

      default:
        return '';
    }
  };

  const contentHtml = blocks.map(renderBlock).join('\n');

  return `
    <!doctype html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <title></title>
        <!--[if !mso]><!-->
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <!--<![endif]-->
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style type="text/css">
          #outlook a { padding:0; }
          body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
          table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
          img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
          p { display:block;margin:13px 0; }
        </style>
        <!--[if mso]>
        <noscript>
        <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch(96)/>
        </o:OfficeDocumentSettings>
        </xml>
        </noscript>
        <![endif]-->
        <style type="text/css">
          @media only screen and (min-width:480px) {
            .mj-column-per-100 { width:100% !important; max-width: 100%; }
            .mj-column-per-50 { width:50% !important; max-width: 50%; }
            .mj-column-per-33 { width:33.333333333333336% !important; max-width: 33.333333333333336%; }
          }
        </style>
      </head>
      <body style="word-spacing:normal;background-color:${bgColor};">
        <div style="background-color:${bgColor};">
          <!--[if mso | IE]>
          <table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:${maxWidth};" width="${maxWidth}" >
            <tr>
              <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
          <![endif]-->
          <div style="margin:0px auto;max-width:${maxWidth};">
            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
              <tbody>
                <tr>
                  <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;">
                    ${contentHtml}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!--[if mso | IE]>
              </td>
            </tr>
          </table>
          <![endif]-->
        </div>
      </body>
    </html>
  `;
}
