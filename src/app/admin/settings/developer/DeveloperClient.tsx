'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Plus, Trash2, Copy, Check, Terminal, Code, Database, AlertCircle } from 'lucide-react';
import { generateApiKey, listApiKeys, revokeApiKey, type ApiKeyRecord } from '@/lib/api-key-actions';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { useTerminology } from '@/hooks/use-terminology';

export default function DeveloperClient() {
  const { activeWorkspaceId, activeWorkspace } = useTenant();
  const { user } = useUser();
  const { singular, plural } = useTerminology();

  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create state
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const res = await listApiKeys(activeWorkspaceId);
    if (res.success && res.keys) {
      setKeys(res.keys);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load API keys' });
    }
    setLoading(false);
  }, [activeWorkspaceId, toast]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName || !activeWorkspaceId || !activeWorkspace?.organizationId || !user) return;
    
    const res = await generateApiKey(
      activeWorkspaceId, 
      activeWorkspace.organizationId, 
      newKeyName, 
      user.uid
    );
    
    if (res.success && res.key && res.record) {
      toast({ title: 'Success', description: 'API Key generated successfully' });
      setGeneratedKey(res.key);
      setKeys(prev => [res.record!, ...prev]);
      setNewKeyName('');
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to generate key' });
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Any applications using it will immediately lose access.')) return;
    
    const res = await revokeApiKey(id);
    if (res.success) {
      toast({ title: 'Success', description: 'Key revoked successfully' });
      setKeys(prev => prev.filter(k => k.id !== id));
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to revoke key' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (!activeWorkspaceId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border rounded-2xl bg-muted/10 border-dashed">
        <AlertCircle className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-xl font-semibold">No Active Workspace</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          You must have an active workspace selected to manage API keys and view documentation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32 w-full">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Developer API Hub
          </h1>
          <p className="text-muted-foreground font-medium text-sm mt-1">
            Manage programmatic access and integration endpoints
          </p>
        </div>
      </div>

      <Tabs defaultValue="endpoints" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
        <TabsTrigger value="endpoints"><Code className="w-4 h-4 mr-2" /> API Endpoints</TabsTrigger>
        <TabsTrigger value="keys"><Key className="w-4 h-4 mr-2" /> API Keys</TabsTrigger>
      </TabsList>

      {/* ENDPOINTS TAB */}
      <TabsContent value="endpoints" className="space-y-6">
        <Card className="bg-card shadow-lg shadow-black/5 border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider">POST</Badge>
              <CardTitle className="font-mono text-xl text-foreground">/api/external/v1/entities</CardTitle>
            </div>
            <CardDescription className="mt-2 text-base">
              Programmatically create new {plural.toLowerCase()} (e.g. individuals, families, organizations) directly into this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            
            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                <Database className="w-4 h-4 text-primary" /> Payload Schema
              </h4>
              <div className="rounded-2xl border border-border bg-black/5 dark:bg-black/40 overflow-hidden shadow-inner">
                <pre className="p-6 overflow-x-auto text-primary/90 font-mono text-sm leading-relaxed">
{`{
  "entityType": "institution" | "person" | "family", // REQUIRED
  "name": "string",                                  // REQUIRED
  
  // Basic Contact Info
  "contacts": [
    { "type": "email", "value": "test@example.com", "isPrimary": true },
    { "type": "phone", "value": "+1234567890", "isPrimary": true }
  ],
  "globalTags": ["tag1", "tag2"],
  
  // Pipeline Routing (Optional)
  "pipelineId": "string",
  "stageId": "string",
  
  // Depending on entityType, include ONE of the following objects:
  "personData": {
    "firstName": "string",
    "lastName": "string",
    "gender": "male" | "female" | "other",
    "dateOfBirth": "YYYY-MM-DD"
  },
  "institutionData": {
    "type": "School" | "University" | "Company",
    "industry": "Education",
    "website": "https://example.com"
  },
  "familyData": {
    "headOfHousehold": "string"
  }
}`}
                </pre>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                <Terminal className="w-4 h-4 text-primary" /> cURL Example
              </h4>
              <div className="relative group">
                <div className="rounded-2xl border border-border bg-black/5 dark:bg-black/40 overflow-hidden shadow-inner">
                  <pre className="p-6 overflow-x-auto text-muted-foreground font-mono text-sm leading-relaxed">
{`curl -X POST https://app.smartsapp.com/api/external/v1/entities \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "entityType": "person",
    "name": "Jane Doe",
    "contacts": [
      { "type": "email", "value": "jane@example.com", "isPrimary": true }
    ],
    "personData": {
      "firstName": "Jane",
      "lastName": "Doe"
    }
  }'`}
                  </pre>
                </div>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all shadow-md"
                  onClick={() => copyToClipboard(`curl -X POST https://app.smartsapp.com/api/external/v1/entities -H "Authorization: Bearer sk_live_YOUR_API_KEY" -H "Content-Type: application/json" -d '{"entityType": "person", "name": "Jane Doe", "contacts": [{"type": "email", "value": "jane@example.com", "isPrimary": true}], "personData": {"firstName": "Jane", "lastName": "Doe"}}'`)}
                >
                  {copiedKey ? <><Check className="w-4 h-4 mr-2" /> Copied</> : <><Copy className="w-4 h-4 mr-2" /> Copy cURL</>}
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>
      </TabsContent>

      {/* API KEYS TAB */}
      <TabsContent value="keys" className="space-y-6">
        
        {/* Create Key Card */}
        <Card className="bg-card shadow-lg shadow-black/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" /> Generate New API Key
            </CardTitle>
            <CardDescription className="text-base">
              Create a secure API key locked specifically to <strong>{activeWorkspace?.name || 'this workspace'}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generatedKey ? (
              <div className="p-6 bg-primary/10 border border-primary/20 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 text-primary font-bold text-lg">
                  <Check className="w-6 h-6" />
                  Key Generated Successfully
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed max-w-2xl">
                  Please copy this key and store it securely now. For security reasons, <strong>we cannot show it to you again</strong>. If you lose it, you will need to revoke it and generate a new one.
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <Input readOnly value={generatedKey} className="font-mono bg-background border-primary/30 h-12 text-lg shadow-inner" />
                  <Button size="lg" variant="default" className="shadow-lg px-8" onClick={() => copyToClipboard(generatedKey)}>
                    {copiedKey ? <Check className="w-5 h-5 mr-2" /> : <Copy className="w-5 h-5 mr-2" />}
                    {copiedKey ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <Button variant="outline" className="w-full mt-4 h-12 font-semibold" onClick={() => setGeneratedKey(null)}>
                  I have safely stored this key
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input 
                    placeholder="Key Name (e.g., Zapier Integration, Custom Portal)" 
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <Button 
                  size="lg"
                  onClick={handleCreate} 
                  disabled={!newKeyName}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg px-8 h-12"
                >
                  <Plus className="w-5 h-5 mr-2" /> Generate Key
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* List Keys Card */}
        <Card className="bg-card shadow-lg shadow-black/5 border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Active Workspace Keys</CardTitle>
            <CardDescription className="text-base">Manage keys that have programmatic access to your data.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground animate-pulse font-medium">Loading API Keys...</div>
            ) : keys.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed rounded-2xl border-border/60 bg-muted/5">
                <Key className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-semibold text-lg">No active API keys found</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Generate a key above to enable external integrations for this workspace.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 overflow-hidden shadow-inner bg-background">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-muted-foreground">Key Name</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Prefix</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Created</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Last Used</TableHead>
                      <TableHead className="text-right font-semibold text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((key) => (
                      <TableRow key={key.id} className="group">
                        <TableCell className="font-semibold">{key.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs font-normal tracking-wider">
                            {key.keyPrefix}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(key.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never used'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRevoke(key.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </TabsContent>
    </Tabs>
    </div>
  );
}
