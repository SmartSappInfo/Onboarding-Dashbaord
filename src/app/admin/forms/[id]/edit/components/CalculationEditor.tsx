'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calculator, PlusCircle, Trash2, Hash, Sparkles } from 'lucide-react';
import type { FormFieldInstance, AppField } from '@/lib/types';
import type { FormCalculationRule } from '@/lib/forms/form-logic-types';
import { evaluateSafeFormula } from '@/lib/forms/logic-engine';

interface CalculationEditorProps {
  fields: FormFieldInstance[];
  getAppField: (appFieldId: string) => AppField | undefined;
  calculations: FormCalculationRule[];
  onCalculationsChange: (calculations: FormCalculationRule[]) => void;
}

export default function CalculationEditor({
  fields,
  getAppField,
  calculations = [],
  onCalculationsChange,
}: CalculationEditorProps) {
  const [selectedCalcId, setSelectedCalcId] = React.useState<string | null>(calculations[0]?.id || null);
  const [testValues, setTestValues] = React.useState<Record<string, string>>({});

  const selectedCalc = React.useMemo(() =>
    calculations.find(c => c.id === selectedCalcId) || null,
  [calculations, selectedCalcId]);

  // Test evaluation preview
  const previewResult = React.useMemo(() => {
    if (!selectedCalc || !selectedCalc.formula) return null;
    return evaluateSafeFormula(selectedCalc.formula, testValues, selectedCalc.precision || 2);
  }, [selectedCalc, testValues]);

  const handleAddCalculation = () => {
    const newId = `calc_${Date.now().toString(36)}`;
    const newRule: FormCalculationRule = {
      id: newId,
      name: `Formula ${calculations.length + 1}`,
      targetFieldId: fields[0]?.id || '',
      formula: '',
      precision: 2,
      roundingMode: 'round',
      enabled: true,
    };
    onCalculationsChange([...calculations, newRule]);
    setSelectedCalcId(newId);
  };

  const handleUpdate = (updated: FormCalculationRule) => {
    onCalculationsChange(calculations.map(c => (c.id === updated.id ? updated : c)));
  };

  const handleDelete = (id: string) => {
    const filtered = calculations.filter(c => c.id !== id);
    onCalculationsChange(filtered);
    if (selectedCalcId === id) {
      setSelectedCalcId(filtered[0]?.id || null);
    }
  };

  const insertVariable = (varName: string) => {
    if (!selectedCalc) return;
    const token = `{{${varName}}}`;
    const newFormula = selectedCalc.formula ? `${selectedCalc.formula} ${token}` : token;
    handleUpdate({ ...selectedCalc, formula: newFormula });
  };

  const insertOperator = (op: string) => {
    if (!selectedCalc) return;
    const newFormula = selectedCalc.formula ? `${selectedCalc.formula} ${op} ` : `${op} `;
    handleUpdate({ ...selectedCalc, formula: newFormula });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Calculation Rules List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" /> Calculation Formulas
              </h3>
              <p className="text-[10px] text-muted-foreground">Dynamic arithmetic and totals</p>
            </div>
            <Button
              size="sm"
              onClick={handleAddCalculation}
              className="h-8 rounded-xl font-bold gap-1 text-[10px]"
            >
              <PlusCircle className="h-3 w-3" /> New Formula
            </Button>
          </div>

          <div className="space-y-2">
            {calculations.length === 0 ? (
              <div className="p-8 border border-dashed rounded-2xl text-center space-y-2 opacity-50">
                <Calculator className="h-8 w-8 mx-auto" />
                <p className="text-xs font-semibold">No calculation formulas yet</p>
              </div>
            ) : (
              calculations.map(calc => (
                <div
                  key={calc.id}
                  onClick={() => setSelectedCalcId(calc.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedCalcId === calc.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/60 hover:bg-accent/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Switch
                      checked={calc.enabled}
                      onCheckedChange={checked => handleUpdate({ ...calc, enabled: checked })}
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="text-xs font-bold truncate">{calc.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={e => {
                      e.stopPropagation();
                      handleDelete(calc.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Formula Editor */}
        <div className="lg:col-span-8">
          {selectedCalc ? (
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Input
                      value={selectedCalc.name}
                      onChange={e => handleUpdate({ ...selectedCalc, name: e.target.value })}
                      className="text-sm font-bold h-8 border-none p-0 focus-visible:ring-0 bg-transparent"
                    />
                    <CardDescription className="text-xs">
                      Calculate a field value automatically using arithmetic operations.
                    </CardDescription>
                  </div>
                  <Badge variant={selectedCalc.enabled ? 'default' : 'secondary'} className="text-[10px]">
                    {selectedCalc.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Target Field */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Store Result In Field
                  </Label>
                  <Select
                    value={selectedCalc.targetFieldId}
                    onValueChange={v => handleUpdate({ ...selectedCalc, targetFieldId: v })}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select target field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map(f => {
                        const af = getAppField(f.appFieldId);
                        return (
                          <SelectItem key={f.id} value={f.id}>
                            {f.labelOverride || af?.label || f.appFieldId}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Variable Token Insert Bar */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Insert Field Variables
                  </Label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted/20 rounded-xl border">
                    {fields.map(f => {
                      const af = getAppField(f.appFieldId);
                      const varName = af?.variableName || f.id;
                      return (
                        <Button
                          key={f.id}
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable(varName)}
                          className="h-7 text-[10px] font-mono rounded-lg hover:border-primary"
                        >
                          <Hash className="h-3 w-3 mr-1 text-primary" />
                          {f.labelOverride || af?.label || varName}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Math Operator Toolbar */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Math Operators
                  </Label>
                  <div className="flex gap-2">
                    {['+', '-', '*', '/', '(', ')', '%'].map(op => (
                      <Button
                        key={op}
                        variant="secondary"
                        size="sm"
                        onClick={() => insertOperator(op)}
                        className="h-8 w-9 font-bold text-xs rounded-lg font-mono"
                      >
                        {op}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Formula Text Area */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Formula Expression
                  </Label>
                  <Input
                    value={selectedCalc.formula}
                    onChange={e => handleUpdate({ ...selectedCalc, formula: e.target.value })}
                    placeholder="e.g. {{quantity}} * {{unit_price}} * (1 - {{discount}} / 100)"
                    className="font-mono text-xs h-10 rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use double curly braces <code className="bg-muted px-1 py-0.5 rounded">{"{{field_name}}"}</code> to reference other numeric fields.
                  </p>
                </div>

                {/* Precision & Formatting */}
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Decimal Places</Label>
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      value={selectedCalc.precision ?? 2}
                      onChange={e => handleUpdate({ ...selectedCalc, precision: parseInt(e.target.value) || 0 })}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Prefix (e.g. $)</Label>
                    <Input
                      value={selectedCalc.prefix || ''}
                      onChange={e => handleUpdate({ ...selectedCalc, prefix: e.target.value })}
                      placeholder="$"
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Suffix (e.g. USD)</Label>
                    <Input
                      value={selectedCalc.suffix || ''}
                      onChange={e => handleUpdate({ ...selectedCalc, suffix: e.target.value })}
                      placeholder="USD"
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                </div>

                {/* Test Evaluation Sandbox */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Test Formula Preview
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      Result: {previewResult !== null ? `${selectedCalc.prefix || ''}${previewResult}${selectedCalc.suffix || ''}` : '---'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {fields.slice(0, 4).map(f => {
                      const af = getAppField(f.appFieldId);
                      const varName = af?.variableName || f.id;
                      return (
                        <div key={f.id} className="space-y-1">
                          <span className="text-[10px] text-muted-foreground truncate block">{varName}:</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={testValues[varName] || ''}
                            onChange={e => setTestValues({ ...testValues, [varName]: e.target.value })}
                            className="h-7 text-xs bg-background rounded-md"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 border border-dashed rounded-3xl text-center space-y-3 opacity-40">
              <Calculator className="h-10 w-10 mx-auto" />
              <p className="text-sm font-semibold">Select or create a calculation formula</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
