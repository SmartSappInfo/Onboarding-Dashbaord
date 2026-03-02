
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
 */
export function renderBlocksToHtml(blocks: MessageBlock[], variables: Record<string, any>): string {
  if (!blocks || blocks.length === 0) return '';

  const renderBlock = (block: MessageBlock): string => {
    const align = block.style?.textAlign || 'left';
    const alignStyle = `text-align: ${align};`;
    
    switch (block.type) {
      case 'heading': {
        const tag = block.variant || 'h2';
        const fontSize = tag === 'h1' ? '28px' : tag === 'h2' ? '22px' : '18px';
        const title = resolveVariables(block.title || '', variables);
        return `<${tag} style="font-family: sans-serif; color: #1e293b; margin: 20px 0 10px; ${alignStyle} font-size: ${fontSize}; font-weight: 800;">${title}</${tag}>`;
      }
      
      case 'text': {
        const content = resolveVariables(block.content || '', variables);
        return `<p style="font-family: sans-serif; color: #475569; font-size: 16px; line-height: 1.6; margin: 10px 0; ${alignStyle}">${content}</p>`;
      }

      case 'logo': {
        const url = resolveVariables(block.url || '{{school_logo}}', variables);
        return `<div style="padding: 20px 0; ${alignStyle}"><img src="${url}" style="height: 40px; width: auto;" alt="Logo" /></div>`;
      }

      case 'image': {
        const url = resolveVariables(block.url || '', variables);
        if (!url) return '';
        return `<div style="margin: 20px 0; ${alignStyle}"><img src="${url}" style="max-width: 100%; border-radius: 12px;" alt="Image" /></div>`;
      }

      case 'button': {
        const title = resolveVariables(block.title || 'Click Here', variables);
        const link = resolveVariables(block.link || '#', variables);
        return `
          <div style="margin: 30px 0; ${alignStyle}">
            <a href="${link}" style="background-color: #3B5FFF; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 800; font-family: sans-serif; display: inline-block;">
              ${title}
            </a>
          </div>
        `;
      }

      case 'quote': {
        const content = resolveVariables(block.content || '', variables);
        return `
          <div style="margin: 20px 0; padding: 20px; border-left: 4px solid #3B5FFF; background-color: #f8fafc; font-family: sans-serif; font-style: italic; color: #1e293b; font-size: 18px;">
            ${content}
          </div>
        `;
      }

      case 'list': {
        const tag = block.listStyle === 'ordered' ? 'ol' : 'ul';
        const items = (block.items || []).map(item => `<li>${resolveVariables(item, variables)}</li>`).join('');
        return `<${tag} style="font-family: sans-serif; color: #475569; font-size: 16px; line-height: 1.6; margin: 10px 0; padding-left: 20px;">${items}</${tag}>`;
      }

      case 'divider':
        return `<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />`;

      case 'columns': {
        const cols = (block.columns || []).map(col => {
          return `<td style="vertical-align: top; width: ${100 / (block.columns?.length || 1)}%;">${col.blocks.map(renderBlock).join('')}</td>`;
        }).join('');
        return `<table width="100%" cellpadding="0" cellspacing="0"><tr>${cols}</tr></table>`;
      }

      case 'header':
      case 'footer': {
        const content = resolveVariables(block.content || '', variables);
        const bgColor = block.type === 'header' ? 'transparent' : '#f1f5f9';
        const padding = block.type === 'header' ? '10px 0' : '30px 20px';
        const color = block.type === 'header' ? '#1e293b' : '#64748b';
        return `
          <div style="background-color: ${bgColor}; padding: ${padding}; border-radius: 12px; margin: 20px 0; ${alignStyle}">
            <div style="font-family: sans-serif; color: ${color}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
              ${content || block.type}
            </div>
          </div>
        `;
      }

      default:
        return '';
    }
  };

  return blocks.map(renderBlock).join('\n');
}
