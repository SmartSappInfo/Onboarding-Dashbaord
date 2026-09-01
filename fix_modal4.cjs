const fs = require('fs');
const file = 'src/components/call-centre/CallNowModal.tsx';
let content = fs.readFileSync(file, 'utf-8');

// The call is currently:
/*
      const varRes = await getVariableValuesMapAction({
        workspaceId,
        entityId: params.entityId,

        contactId: res.queueItem.contactId,
        organizationId
      });
      if (varRes.success && varRes.data) {
        setVariablesMap(new Map(Object.entries(varRes.data)));
      }
*/

content = content.replace(/const varRes = await getVariableValuesMapAction\(\{[\s\S]*?\}\);/g, `const varRes = await getVariableValuesMapAction({
        workspaceId,
        entityId: params.entityId
      });`);
      
content = content.replace(/if \(varRes\.success && varRes\.data\) \{[\s\S]*?\}/g, `if (varRes) {
        setVariablesMap(new Map(Object.entries(varRes)));
      }`);
      
// Wait, I also need to make sure `InteractiveScriptView` expects `ok` or `success` from `onTriggerOutcome`.
// In InteractiveScriptView it doesn't even await the return result from `onTriggerOutcome` properly, or if it does, it expects it not to throw.

fs.writeFileSync(file, content);
