const fs = require('fs');

let content = fs.readFileSync('src/app/admin/messaging/components/quick-template-dialog.tsx', 'utf8');

// Update onCreated signature
content = content.replace(/onCreated: \(templateId: string\) => void;/, 'onCreated: (template: any) => void;');

// Add new imports for icons
content = content.replace(/import \{/, 'import {\n    ArrowRight,\n    ArrowLeft,\n    ChevronRight,\n    Edit3,');

// Add state for step and contentMode
content = content.replace(/const \[existingTemplateType, setExistingTemplateType\] = React.useState<string \| undefined>\(undefined\);/, `const [existingTemplateType, setExistingTemplateType] = React.useState<string | undefined>(undefined);
    const [step, setStep] = React.useState(1);
    const [contentMode, setContentMode] = React.useState<any>('rich_builder');`);

// Update the loadTemplate to also set contentMode
content = content.replace(/setExistingTemplateType\(data\.templateType\);/, `setExistingTemplateType(data.templateType);
                        if (data.contentMode) setContentMode(data.contentMode);`);

// Update reset function
content = content.replace(/setAiPrompt\(''\);/, `setAiPrompt('');
        setStep(1);`);

// Update handleCommit body to use the new contentMode and onCreated signature
content = content.replace(/contentMode: channel === 'sms' \? 'plain_text' : 'rich_builder',/, `contentMode: channel === 'sms' ? 'plain_text' : contentMode,`);

content = content.replace(/onCreated\(templateId\);/, "onCreated({ id: templateId, ...templateData });");
content = content.replace(/onCreated\(docRef\.id\);/, "onCreated({ id: docRef.id, ...templateData });");

// The DialogContent class: make it full screen
content = content.replace(/className="max-w-5xl h-\[85vh\] flex flex-col p-0 overflow-hidden rounded-\[2\.5rem\] border-none shadow-2xl"/, 'className="w-screen h-screen max-w-none m-0 rounded-none flex flex-col p-0 overflow-hidden border-none"');

fs.writeFileSync('src/app/admin/messaging/components/quick-template-dialog.tsx', content);
