/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP API Keys Management Card
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Cryptographic Key Handling:
 *    - Plaintext key is displayed ONLY once after generation.
 * 2. Mobile Accessibility & Touch Targets:
 *    - All interactive targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Fully typed props and handlers.
 */

'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { McpApiKey, McpCategory } from '@/lib/mcp/types';

export interface McpApiKeysCardProps {
  apiKeys: McpApiKey[];
  onCreateKey: (params: {
    name: string;
    role: 'admin' | 'member' | 'agent';
    allowedCategories?: McpCategory[];
    expiresInDays?: number;
  }) => Promise<{ apiKey: McpApiKey; plaintextKey: string }>;
  onRevokeKey: (keyId: string) => Promise<void>;
  isLoading?: boolean;
}

export function McpApiKeysCard({
  apiKeys,
  onCreateKey,
  onRevokeKey,
  isLoading = false,
}: McpApiKeysCardProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [keyName, setKeyName] = React.useState('');
  const [keyRole, setKeyRole] = React.useState<'admin' | 'member' | 'agent'>('agent');
  const [expiryDays, setExpiryDays] = React.useState<number>(90);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // One-time key reveal state
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);
  const [hasCopied, setHasCopied] = React.useState(false);

  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const handleCreate = async () => {
    if (!keyName.trim()) return;
    setIsGenerating(true);
    try {
      const res = await onCreateKey({
        name: keyName.trim(),
        role: keyRole,
        expiresInDays: expiryDays > 0 ? expiryDays : undefined,
      });

      setRevealedKey(res.plaintextKey);
      setKeyName('');
      setIsCreateModalOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2500);
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this MCP API key? Any agents or IDE clients using it will immediately lose access.')) {
      return;
    }
    setRevokingId(keyId);
    try {
      await onRevokeKey(keyId);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" /> MCP API Keys
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Authenticate Cursor, Windsurf, Claude Desktop, or custom autonomous agents to this workspace.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg active:scale-[0.97] transition-transform"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Generate New Key
        </Button>
      </div>

      {/* One-Time Key Reveal Banner */}
      {revealedKey && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-amber-900">New MCP API Key Generated</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Copy this key now and store it in your environment variables or IDE configuration. For security, it will never be displayed again.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={revealedKey}
              className="flex-1 font-mono text-xs bg-white border border-amber-300 rounded-lg px-3 py-2.5 text-slate-900 select-all"
            />
            <Button
              onClick={handleCopy}
              className="min-h-[44px] px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs active:scale-[0.97] transition-transform shrink-0"
            >
              {hasCopied ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" /> Copy Key
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRevealedKey(null)}
              className="min-h-[44px] border-amber-300 text-amber-900 hover:bg-amber-100 text-xs active:scale-[0.97]"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Key Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Key Identifier</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Role</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Created</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Expires</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase text-slate-500">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-sm">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Key className="w-8 h-8 text-slate-300" />
                    <p className="font-medium text-slate-700">No MCP API keys created</p>
                    <p className="text-xs text-slate-400">Generate a key to connect external AI agents to SmartSapp.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              apiKeys.map((k) => (
                <TableRow key={k.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="py-3 font-semibold text-slate-900 text-xs">
                    {k.name}
                  </TableCell>

                  <TableCell className="py-3 font-mono text-xs text-slate-600">
                    {k.keyPrefix}
                  </TableCell>

                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-xs uppercase border-slate-200 bg-slate-50 text-slate-700">
                      {k.role}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-3 text-xs text-slate-500">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </TableCell>

                  <TableCell className="py-3 text-xs text-slate-500">
                    {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                  </TableCell>

                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={
                        k.revoked
                          ? 'border-rose-200 bg-rose-50 text-rose-700 text-xs'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 text-xs'
                      }
                    >
                      {k.revoked ? 'REVOKED' : 'ACTIVE'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right py-3">
                    {!k.revoked && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevoke(k.id)}
                        disabled={revokingId === k.id || isLoading}
                        className="min-h-[44px] text-xs text-rose-600 border-rose-200 hover:bg-rose-50 active:scale-[0.97] transition-transform"
                      >
                        {revokingId === k.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Creation Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Generate MCP API Key
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Create an authenticated credential scoped to this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="key-name" className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Key Label / Name
              </Label>
              <Input
                id="key-name"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Cursor Assistant or Support Agent"
                className="min-h-[44px] text-sm"
              />
            </div>

            <div>
              <Label htmlFor="key-role" className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Role Assignment
              </Label>
              <select
                id="key-role"
                value={keyRole}
                onChange={(e) => setKeyRole(e.target.value as 'admin' | 'member' | 'agent')}
                className="w-full min-h-[44px] border border-slate-200 rounded-lg px-3 text-sm bg-white text-slate-900"
              >
                <option value="agent">Autonomous Agent (Standard)</option>
                <option value="member">Workspace Member</option>
                <option value="admin">Workspace Administrator (All Tools)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="key-expiry" className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Key Expiration
              </Label>
              <select
                id="key-expiry"
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="w-full min-h-[44px] border border-slate-200 rounded-lg px-3 text-sm bg-white text-slate-900"
              >
                <option value={30}>30 Days</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days</option>
                <option value={365}>1 Year</option>
                <option value={0}>Never Expire</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              className="min-h-[44px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!keyName.trim() || isGenerating}
              className="min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold active:scale-[0.97] transition-transform"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                'Generate Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
