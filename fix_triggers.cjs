const fs = require('fs');

const typesFile = 'src/lib/call-action-types.ts';
let typesContent = fs.readFileSync(typesFile, 'utf-8');

if (!typesContent.includes("['ADD_TO_CALL_CAMPAIGN'")) {
  typesContent = typesContent.replace(
    "['TRANSFER_CALL', {",
    "['ADD_TO_CALL_CAMPAIGN', {\n    label: 'Add to Call Campaign',\n    icon: Globe,\n    colorClass: 'bg-emerald-600',\n    badgeLabel: '+ Add to Campaign',\n    defaultParams: () => ({ campaignId: '', contactScope: 'primary' }),\n  }],\n  ['TRANSFER_CALL', {"
  );
  fs.writeFileSync(typesFile, typesContent);
}

const serviceFile = 'src/lib/services/call-centre-service.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf-8');

if (!serviceContent.includes("case 'TRANSFER_CALL':")) {
  serviceContent = serviceContent.replace(
    "case 'UPDATE_CONTACT': {",
    `case 'TRANSFER_CALL': {
          await logActivity({
            organizationId,
            workspaceId,
            entityId,
            userId,
            type: 'system',
            source: 'system',
            description: \`Call Transfer Initiated to \${params.transferTarget || 'Unknown'} via \${params.transferMode || 'phone'}\`,
          });
          return { success: true };
        }

        case 'UPDATE_CONTACT': {`
  );
  fs.writeFileSync(serviceFile, serviceContent);
}

