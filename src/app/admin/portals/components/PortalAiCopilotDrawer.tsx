'use client';

/**
 * {{Org_name}} Experience Platform — Admin AI Studio Copilot Drawer
 *
 * Universal AI assistant inside Portal Studio for generating full curriculums,
 * assessment questions, and diagnosing student drop-off bottlenecks.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  generateCurriculumAction,
  generateQuizAction,
  getCoursePedagogyDiagnosticAction,
} from '@/app/actions/ai-experience-actions';
import { createCourseAction } from '@/app/actions/learning-actions';
import type { GeneratedCurriculum, AiPedagogyDiagnostic } from '@/lib/types/ai-experience';
import type { AssessmentQuestion } from '@/lib/types/learning';
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  TrendingDown,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Layers,
  Loader2,
  Copy,
} from 'lucide-react';

interface PortalAiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  portalId: string;
  portalSlug: string;
  organizationId: string;
}

export function PortalAiCopilotDrawer({
  isOpen,
  onClose,
  portalId,
  portalSlug,
  organizationId,
}: PortalAiCopilotDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('curriculum');

  // Tab 1: Curriculum Generator State
  const [topicPrompt, setTopicPrompt] = React.useState('');
  const [targetAudience, setTargetAudience] = React.useState('');
  const [isGeneratingCurriculum, setIsGeneratingCurriculum] = React.useState(false);
  const [generatedCurriculum, setGeneratedCurriculum] = React.useState<GeneratedCurriculum | null>(null);
  const [isApplyingCurriculum, setIsApplyingCurriculum] = React.useState(false);

  // Tab 2: Quiz Generator State
  const [lessonTitle, setLessonTitle] = React.useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = React.useState(false);
  const [generatedQuestions, setGeneratedQuestions] = React.useState<AssessmentQuestion[] | null>(null);

  // Tab 3: Pedagogy Diagnostic State
  const [isDiagnosing, setIsDiagnosing] = React.useState(false);
  const [diagnostic, setDiagnostic] = React.useState<AiPedagogyDiagnostic | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerateCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicPrompt.trim()) return;

    setIsGeneratingCurriculum(true);
    try {
      const res = await generateCurriculumAction({
        organizationId,
        portalId,
        topicPrompt: topicPrompt.trim(),
        targetAudience: targetAudience.trim() || undefined,
        durationDays: 30,
      });

      if (!res.success) throw new Error(res.error);
      setGeneratedCurriculum(res.data || null);
      toast({ title: 'Curriculum Generated! ✨', description: 'Review the modules and lessons below.' });
    } catch (err: any) {
      toast({ title: 'Generation Failed', description: err?.message });
    } finally {
      setIsGeneratingCurriculum(false);
    }
  };

  const handleApplyCurriculumToDatabase = async () => {
    if (!generatedCurriculum) return;
    setIsApplyingCurriculum(true);
    try {
      const res = await createCourseAction(
        {
          organizationId,
          portalId,
          workspaceIds: ['onboarding'],
          title: generatedCurriculum.courseTitle,
          description: generatedCurriculum.description,
          status: 'draft',
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);

      toast({
        title: 'Course Created! 🎓',
        description: `"${generatedCurriculum.courseTitle}" is saved in Courses Studio.`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err?.message });
    } finally {
      setIsApplyingCurriculum(false);
    }
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;

    setIsGeneratingQuiz(true);
    try {
      const res = await generateQuizAction({
        organizationId,
        portalId,
        lessonId: `lesson_${Date.now()}`,
        lessonTitle: lessonTitle.trim(),
        questionCount: 5,
      });

      if (!res.success) throw new Error(res.error);
      setGeneratedQuestions(res.data || null);
      toast({ title: '5 Questions Generated! 📝', description: 'High-yield assessment items ready.' });
    } catch (err: any) {
      toast({ title: 'Quiz Generation Failed', description: err?.message });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    try {
      const res = await getCoursePedagogyDiagnosticAction(
        portalId,
        'course_school_bursar',
        'Strategic School Budgeting & Fee Collection'
      );
      if (!res.success) throw new Error(res.error);
      setDiagnostic(res.data || null);
      toast({ title: 'Pedagogy Audit Complete! 📊', description: 'Identified drop-off bottlenecks.' });
    } catch (err: any) {
      toast({ title: 'Diagnostic Failed', description: err?.message });
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> AI Studio Intelligence Copilot
          </div>
          <DialogTitle className="text-xl font-bold">What would you like to build?</DialogTitle>
          <DialogDescription className="text-xs">
            Generate courses, high-yield quiz items, and diagnose student learning metrics in seconds.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-10 p-1 bg-muted/60 rounded-2xl grid grid-cols-3">
            <TabsTrigger value="curriculum" className="rounded-xl text-xs font-bold gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> AI Curriculum
            </TabsTrigger>
            <TabsTrigger value="quiz" className="rounded-xl text-xs font-bold gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> AI Quizzes
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="rounded-xl text-xs font-bold gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Drop-Off Audit
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: AI Curriculum Generator ─────────────────────────── */}
          <TabsContent value="curriculum" className="space-y-4 mt-4">
            <form onSubmit={handleGenerateCurriculum} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Course Topic / Learning Pathway</Label>
                <Input
                  placeholder="e.g. Strategic School Budgeting & Parent Fee Collection"
                  value={topicPrompt}
                  onChange={e => setTopicPrompt(e.target.value)}
                  className="h-10 text-xs rounded-xl font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Target Student Profile (Optional)</Label>
                <Input
                  placeholder="e.g. Private school owners, bursars, and head teachers"
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={isGeneratingCurriculum}
                className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isGeneratingCurriculum ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Structuring 30-Day Curriculum...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate Curriculum Blueprint
                  </>
                )}
              </Button>
            </form>

            {generatedCurriculum && (
              <div className="space-y-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground">{generatedCurriculum.courseTitle}</h4>
                    <p className="text-xs text-muted-foreground">{generatedCurriculum.modules.length} Modules • ~{generatedCurriculum.estimatedHours} Hours</p>
                  </div>

                  <Button
                    onClick={handleApplyCurriculumToDatabase}
                    disabled={isApplyingCurriculum}
                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1"
                  >
                    {isApplyingCurriculum ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Save to Courses
                  </Button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {generatedCurriculum.modules.map((mod, idx) => (
                    <Card key={idx} className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-2">
                      <span className="font-bold text-xs text-foreground block">{mod.title}</span>
                      <div className="space-y-1 pl-2 border-l-2 border-primary/40">
                        {mod.lessons.map((les, lIdx) => (
                          <div key={lIdx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{les.title}</span>
                            <Badge variant="outline" className="text-[9px] py-0 capitalize">
                              {les.contentType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: AI Quiz Generator ───────────────────────────────── */}
          <TabsContent value="quiz" className="space-y-4 mt-4">
            <form onSubmit={handleGenerateQuiz} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Lesson Title / Concept</Label>
                <Input
                  placeholder="e.g. Audit Spreadsheets & Reconciliation Procedures"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  className="h-10 text-xs rounded-xl font-bold"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isGeneratingQuiz}
                className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isGeneratingQuiz ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Formulating 5 Assessment Questions...
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-4 h-4" /> Generate 5 Questions
                  </>
                )}
              </Button>
            </form>

            {generatedQuestions && (
              <div className="space-y-3 pt-3 border-t border-border max-h-60 overflow-y-auto pr-1">
                {generatedQuestions.map((q, idx) => (
                  <Card key={idx} className="p-3.5 rounded-2xl border border-border bg-card space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-foreground">
                        {idx + 1}. {q.questionText}
                      </span>
                      <Badge className="bg-primary/10 text-primary text-[9px] py-0 shrink-0">
                        {q.points} Pts
                      </Badge>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {q.options?.map((opt, optIdx) => (
                        <div
                          key={opt.id || optIdx}
                          className={`p-1.5 rounded-lg ${
                            opt.isCorrect
                              ? 'bg-emerald-500/10 font-semibold text-emerald-700'
                              : ''
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}) {opt.text} {opt.isCorrect && '✓'}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 3: Pedagogy & Drop-Off Diagnostics ──────────────────── */}
          <TabsContent value="diagnostics" className="space-y-4 mt-4">
            {!diagnostic ? (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl space-y-3 bg-muted/10">
                <TrendingDown className="w-10 h-10 mx-auto text-amber-500/80" />
                <h4 className="font-bold text-sm">Analyze Student Drop-off Rates</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  AI scans lesson completion drop-offs and quiz fail rates to suggest targeted curriculum fixes.
                </p>
                <Button
                  onClick={handleRunDiagnostic}
                  disabled={isDiagnosing}
                  className="rounded-xl font-bold text-xs bg-primary text-white"
                >
                  {isDiagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Run Pedagogy Audit'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <Card className="p-4 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" /> Drop-off Alert Detected
                  </div>
                  <p className="text-xs text-foreground font-medium leading-relaxed">
                    {diagnostic.diagnosis}
                  </p>
                </Card>

                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-primary" /> Actionable Recommendations
                  </h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {diagnostic.actionableRecommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
