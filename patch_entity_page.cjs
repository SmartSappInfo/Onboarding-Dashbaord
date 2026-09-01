const fs = require('fs');
const file = 'src/app/admin/entities/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('useCallModal')) {
  content = content.replace(
    "import { useUser } from '@/firebase';",
    "import { useUser } from '@/firebase';\nimport { useCallModal } from '@/context/CallModalContext';"
  );
  
  content = content.replace(
    "const [activeTab, setActiveTab] = React.useState('overview');",
    "const [activeTab, setActiveTab] = React.useState('overview');\n    const { openCallModal } = useCallModal();"
  );
  
  const btn = `
                        <Button variant="outline" className="flex-1 md:flex-none rounded-xl font-bold h-11 bg-card/50 backdrop-blur-sm shadow-sm gap-2 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors" onClick={() => openCallModal({ entityId: params.id })}>
                            <PhoneCall className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Call Now
                        </Button>`;
                        
  content = content.replace(
    '<PhoneCall className="h-4 w-4 text-indigo-500" /> Call Campaign\n                        </Button>',
    '<PhoneCall className="h-4 w-4 text-indigo-500" /> Call Campaign\n                        </Button>' + btn
  );
  
  fs.writeFileSync(file, content);
}
