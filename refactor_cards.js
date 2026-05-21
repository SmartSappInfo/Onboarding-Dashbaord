const fs = require('fs');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Refactor Card components to use bg-card/50
    content = content.replace(/<Card className="[^"]*bg-card[^"]*"/g, (match) => {
        return match.replace('bg-card', 'bg-card/50').replace('border-border', 'border-border/50');
    });

    // Replace CardHeader blocks
    // We want to match: <CardHeader ...> ... </CardHeader>
    // Since it's multiline, we can use a regex with [\s\S]*?
    const headerRegex = /<CardHeader className="[^"]*">([\s\S]*?)<\/CardHeader>/g;
    
    content = content.replace(headerRegex, (match, innerContent) => {
        // Extract Icon
        // Find the first lucide icon. It usually looks like <IconName className="... text-primary" />
        // or <IconName className="..." />
        // In the original, it was wrapped in a div. 
        // e.g. <div className="p-2 ..."><Layout className="h-5 w-5 text-primary" /></div>
        
        let iconName = '';
        const iconMatch = innerContent.match(/<([A-Z][a-zA-Z0-9]+)\s+className="[^"]*(?:h-[0-9]\s+w-[0-9]|w-[0-9]\s+h-[0-9])[^"]*"/);
        if (iconMatch) {
            iconName = iconMatch[1];
        } else {
            // fallback if it doesn't match standard size
            const backupMatch = innerContent.match(/<([A-Z][a-zA-Z0-9]+)\s+className="[^"]*text-primary[^"]*"/);
            if (backupMatch) iconName = backupMatch[1];
        }
        
        // Extract Title
        let titleText = '';
        const titleMatch = innerContent.match(/<CardTitle[^>]*>([\s\S]*?)<\/CardTitle>/);
        if (titleMatch) {
            titleText = titleMatch[1].trim();
        }

        if (!titleText) {
            // If no title, just return original
            return match;
        }
        
        let newHeader = ` <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
 <div className="flex items-center gap-2 text-left">`;
        
        if (iconName && iconName !== 'CardTitle' && iconName !== 'div') {
            // Check for specific icon color in the original string, else default to text-muted-foreground or text-primary
            let iconColor = "text-muted-foreground";
            if (innerContent.includes('text-amber-600')) iconColor = 'text-amber-600';
            else if (innerContent.includes('text-primary')) iconColor = 'text-primary';
            
            newHeader += `\n <${iconName} className="h-4 w-4 ${iconColor}" />`;
        }
        
        newHeader += `\n <CardTitle className="text-sm font-semibold tracking-tight">${titleText}</CardTitle>
 </div>
 </CardHeader>`;

        return newHeader;
    });

    // Make inputs stand out
    // Replace: bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20
    // With: bg-background border border-border focus:ring-1 focus:ring-primary/20 shadow-sm
    content = content.replace(/bg-background\/50 border-none shadow-none focus:ring-1 focus:ring-primary\/20/g, 
        'bg-background border border-border/60 focus:ring-1 focus:ring-primary/20 shadow-sm transition-all hover:border-border');
    
    // Replace similar inputs
    content = content.replace(/bg-background\/50 border-none focus-visible:ring-1 focus-visible:ring-primary\/20/g,
        'bg-background border border-border/60 focus-visible:ring-1 focus-visible:ring-primary/20 shadow-sm transition-all hover:border-border');

    // Also the text area
    content = content.replace(/bg-background\/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary\/20/g,
        'bg-background border border-border/60 focus-visible:ring-1 focus-visible:ring-primary/20 shadow-sm transition-all hover:border-border');


    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Processed', filePath);
}

processFile('src/app/admin/entities/new/page.tsx');
processFile('src/app/admin/entities/[id]/edit/page.tsx');

