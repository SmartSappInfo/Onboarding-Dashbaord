'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Plus, Trash2, Copy, Check, Terminal, Code, Database } from 'lucide-react';
import { generateApiKey, listApiKeys, revokeApiKey, type ApiKeyRecord } from '@/lib/api-key-actions';
import { useToast } from '@/hooks/use-toast';

interface WorkspaceInfo {
  id: string;
  name: string;
  organizationId: string;
}

export default function DeveloperClient({ workspaces }: { workspaces: WorkspaceInfo[] }) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Create state
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    const res = await listApiKeys();
    if (res.success && res.keys) {
      setKeys(res.keys);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load API keys' });
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newKeyName || !selectedWorkspace) return;
    
    const ws = workspaces.find(w => w.id === selectedWorkspace);
    if (!ws) return;

    // Use a fixed identity for the backoffice creator
    const res = await generateApiKey(ws.id, ws.organizationId, newKeyName, 'backoffice-admin');
    
    if (res.success && res.key && res.record) {
      toast({ title: 'Success', description: 'API Key generated successfully' });
      setGeneratedKey(res.key);
      setKeys(prev => [res.record!, ...prev]);
      setNewKeyName('');
      setSelectedWorkspace('');
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to generate key' });
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;
    
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

  return (
    <Tabs defaultValue="endpoints" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="endpoints"><Code className="w-4 h-4 mr-2" /> API Endpoints</TabsTrigger>
        <TabsTrigger value="keys"><Key className="w-4 h-4 mr-2" /> API Keys</TabsTrigger>
      </TabsList>

      {/* ENDPOINTS TAB */}
      <TabsContent value="endpoints" className="mt-6 space-y-6">
        <Card className="bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">POST</Badge>
              <CardTitle className="font-mono text-xl">/api/external/v1/entities</CardTitle>
            </div>
            <CardDescription className="mt-2">
              Creates a new entity (person, institution, or family) in the CRM. The workspace and organization are automatically derived from the provided API Key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                <Database className="w-4 h-4" /> Payload Schema
              </h4>
              <div className="rounded-xl border border-border bg-black/40 overflow-hidden text-sm">
                <pre className="p-4 overflow-x-auto text-emerald-400 font-mono leading-relaxed">
{`{
  "entityType": "institution" | "person" | "family", // REQUIRED
  "name": "string",                                  // REQUIRED
  
  // Basic Info
  "contacts": [
    { "type": "email", "value": "test@example.com", "isPrimary": true },
    { "type": "phone", "value": "+1234567890", "isPrimary": true }
  ],
  "globalTags": ["tag1", "tag2"],
  
  // Pipeline details (Optional)
  "pipelineId": "string",
  "stageId": "string",
  
  // Depending on entityType, include ONE of the following:
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

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                <Terminal className="w-4 h-4" /> cURL Example
              </h4>
              <div className="relative group">
                <div className="rounded-xl border border-border bg-black/40 overflow-hidden text-sm">
                  <pre className="p-4 overflow-x-auto text-muted-foreground font-mono leading-relaxed">
{`curl -X POST https://api.smartsapp.com/api/external/v1/entities \\
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
                  variant="ghost" 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white"
                  onClick={() => copyToClipboard(`curl -X POST https://api.smartsapp.com/api/external/v1/entities -H "Authorization: Bearer sk_live_YOUR_API_KEY" -H "Content-Type: application/json" -d '{"entityType": "person", "name": "Jane Doe", "contacts": [{"type": "email", "value": "jane@example.com", "isPrimary": true}], "personData": {"firstName": "Jane", "lastName": "Doe"}}'`)}
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>
      </TabsContent>

      {/* API KEYS TAB */}
      <TabsContent value="keys" className="mt-6 space-y-6">
        
        {/* Create Key Card */}
        <Card className="bg-card border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-lg">Generate New API Key</CardTitle>
            <CardDescription>Create a secure API key locked to a specific workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {generatedKey ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-4">
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Check className="w-5 h-5" />
                  Key Generated Successfully
                </div>
                <p className="text-sm text-muted-foreground">
                  Please copy this key now. For security reasons, you will <strong>never</strong> be able to see it again.
                </p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={generatedKey} className="font-mono bg-black/40 border-emerald-500/30" />
                  <Button variant="secondary" onClick={() => copyToClipboard(generatedKey)}>
                    {copiedKey ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copiedKey ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <Button variant="outline" className="w-full mt-2" onClick={() => setGeneratedKey(null)}>
                  I have copied the key securely
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input 
                    placeholder="Key Name (e.g., Zapier Integration)" 
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map(ws => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleCreate} 
                  disabled={!newKeyName || !selectedWorkspace}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" /> Generate Key
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* List Keys Card */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Active API Keys</CardTitle>
            <CardDescription>Manage keys that have access to the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground animate-pulse">Loading API Keys...</div>
            ) : keys.length === 0 ? (
              <div className="py-12 text-center border border-dashed rounded-xl border-border bg-muted/20">
                <Key className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No active API keys found</p>
                <p className="text-xs text-muted-foreground mt-1">Generate a key above to get started</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key Prefix</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded inline-block mt-2">
                          {key.keyPrefix}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">
                            {workspaces.find(w => w.id === key.workspaceId)?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
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
  );
}
