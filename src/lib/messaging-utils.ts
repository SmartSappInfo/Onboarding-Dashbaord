import type { MessageBlock } from './types';

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
 * Renders an array of MessageBlocks into a clean, high-compatibility HTML string.
 * Optimized for Outlook, Gmail, and Mobile clients using table-based layouts.
 */
export function renderBlocksToHtml(blocks: MessageBlock[], variables: Record<string, any>): string {
  if (!blocks || blocks.length === 0) return '';

  const renderBlock = (block: MessageBlock): string => {
    const align = block.style?.textAlign || 'left';
    const alignStyle = `text-align: ${align};`;
    const bgColor = block.style?.backgroundColor ? `background-color: ${block.style.backgroundColor};` : '';
    const padding = block.style?.padding || '10px 0';
    const borderRadius = block.style?.borderRadius ? `border-radius: ${block.style.borderRadius};` : '';
    
    const wrapperStyle = `padding: ${padding}; ${alignStyle} ${bgColor} ${borderRadius}`;

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
        const cols = (block.columns || []).map(col => {
          const colWidth = 100 / (block.columns?.length || 1);
          return `<td style="vertical-align: top; width: ${colWidth}%; padding: 0 10px;">${col.blocks.map(renderBlock).join('')}</td>`;
        }).join('');
        return `<table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;"><tr>${cols}</tr></table>`;
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

  return blocks.map(renderBlock).join('\n');
}
