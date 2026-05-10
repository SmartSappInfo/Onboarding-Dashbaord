import fs from 'fs';

function replaceExact(content, search, replaceStr) {
  return content.split(search).join(replaceStr);
}

function processFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // QuickTemplateDialog.tsx replacements
  if (path.includes('quick-template-dialog.tsx')) {
    content = replaceExact(content, "{badge && <Badge", "{badge ? <Badge");
    content = replaceExact(content, ">{badge}</Badge>}", ">{badge}</Badge> : null}");
    content = replaceExact(content, "{isLoadingTemplate && (", "{isLoadingTemplate ? (");
    content = replaceExact(content, "{channel === 'email' && (", "{channel === 'email' ? (");
    content = replaceExact(content, "{!templateId && (", "{!templateId ? (");
    content = replaceExact(content, "{step === 2 && (", "{step === 2 ? (");
    content = replaceExact(content, "{!fixedSourceId && category === 'surveys' && (", "{!fixedSourceId && category === 'surveys' ? (");
    content = replaceExact(content, "{category === 'surveys' && (", "{category === 'surveys' ? (");
    content = replaceExact(content, "{category === 'surveys' && groupedVariables.survey.length === 0 && !selectedSurveyId && (", "{category === 'surveys' && groupedVariables.survey.length === 0 && !selectedSurveyId ? (");
    content = replaceExact(content, "{templateId && (", "{templateId ? (");
    // Replace the trailing )} with ) : null} for the block-level elements
    // This is trickier since we don't know which )} belongs to what. We'll do a regex replacement for simple )} that are at the end of a line or indentation.
    // Instead of regex for closing brackets, let's use a simpler approach: we just replace specific ones manually or we use a basic stack parser.
  }

  fs.writeFileSync(path, content);
}

// Write a generic JSX conditional && replacer
function genericJsxReplacer(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // We want to replace `{ condition && (` with `{ condition ? (`
    // and matching `)` followed by `}` with `) : null }`.
    
    let result = '';
    let i = 0;
    let inConditional = []; // stack of depths
    
    while (i < code.length) {
        // Look for `{ ... && (`
        let match = code.substring(i).match(/^\{([\s\S]*?)&&\s*\(/);
        if (match && match.index === 0 && !match[1].includes('\n') && !match[1].includes('{') && !match[1].includes('}')) {
            result += '{' + match[1] + '? (';
            i += match[0].length;
            inConditional.push(1); // Track bracket depth starting at 1 for the `(`
            continue;
        }
        
        if (inConditional.length > 0) {
            if (code[i] === '(') {
                inConditional[inConditional.length - 1]++;
            } else if (code[i] === ')') {
                inConditional[inConditional.length - 1]--;
                if (inConditional[inConditional.length - 1] === 0) {
                    // Check if next char is }
                    let j = i + 1;
                    while (j < code.length && /\s/.test(code[j])) j++;
                    if (code[j] === '}') {
                        result += ') : null}';
                        i = j + 1;
                        inConditional.pop();
                        continue;
                    }
                }
            }
        }
        
        result += code[i];
        i++;
    }
    
    fs.writeFileSync(filePath, result);
}

genericJsxReplacer('src/app/admin/messaging/components/quick-template-dialog.tsx');
genericJsxReplacer('src/app/admin/messaging/campaigns/components/campaign-wizard.tsx');

// Also do dynamic import for CampaignWizard
let wizard = fs.readFileSync('src/app/admin/messaging/campaigns/components/campaign-wizard.tsx', 'utf8');
wizard = wizard.replace(
  "import QuickTemplateDialog from '../../components/quick-template-dialog';",
  "import dynamic from 'next/dynamic';\nconst QuickTemplateDialog = dynamic(() => import('../../components/quick-template-dialog'), { ssr: false });"
);
fs.writeFileSync('src/app/admin/messaging/campaigns/components/campaign-wizard.tsx', wizard);

console.log('Done');
