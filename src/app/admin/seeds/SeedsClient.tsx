'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, ShieldCheck } from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedNativeFieldsAction } from '@/lib/fields-actions';
import { useTenant } from '@/context/TenantContext';

export default function SeedsClient() {
    const { user } = useUser();
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId } = useTenant();
    const [isSeeding, setIsSeeding] = React.useState(false);

    const handleSeed = async () => {
        if (!activeWorkspaceId || !activeOrganizationId || !user?.uid) return;
        setIsSeeding(true);
        const result = await seedNativeFieldsAction(activeWorkspaceId, activeOrganizationId, user.uid);
        if (result.success) {
            toast({ title: 'Registry Seeded', description: `Added ${result.seededGroups} groups and ${result.seededFields} fields.` });
        } else {
            toast({ variant: 'destructive', title: 'Seeding Failed', description: result.error });
        }
        setIsSeeding(false);
    };
    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-12 pb-32 w-full max-w-4xl">
            
                {/* Header */}
                <div className="flex flex-col items-start text-left">
                    <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1 ring-1 ring-primary/20">System Governance</Badge>
                    <h1 className="text-3xl font-bold mb-2 text-foreground">Infrastructure Seeding</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Execute core schema enrichments and cross-workspace mappings
                    </p>
                </div>

                {/* New seeding sections will be added here */}
                <div className="grid gap-6">
                    <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShieldCheck className="h-24 w-24 text-indigo-600" />
                        </div>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">System Registry</span>
                            </div>
                            <CardTitle className="text-xl text-indigo-950">Native Registry Sync</CardTitle>
                            <CardDescription className="max-w-2xl text-indigo-900/70">
                                Keep your workspace synchronized with the global SmartSapp variable registry. 
                                Seeding adds all platform-standard fields (meetings, surveys, forms) and industry-specific 
                                attributes without affecting your existing custom fields.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Platform Identity</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Meetings & Forms</Badge>
                                    <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Industry Pack</Badge>
                                </div>
                                <Button 
                                    onClick={handleSeed} 
                                    disabled={isSeeding}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 border-none min-w-[160px]"
                                >
                                    {isSeeding ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Zap className="h-4 w-4 mr-2 fill-white" />
                                    )}
                                    {isSeeding ? 'Syncing...' : 'Seed Registry'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}

