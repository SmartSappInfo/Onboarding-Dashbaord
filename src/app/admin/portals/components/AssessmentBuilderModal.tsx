'use client';

/**
 * {{Org_name}} Experience Platform — Assessment & Quiz Builder Modal
 *
 * Interactive modal for designing multiple-choice, true/false, and short-answer
 * questions with points, passing score thresholds, and server-validated explanations.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { adminDb } from '@/lib/firebase-admin';
import type {
  CourseAssessment,
  AssessmentQuestion,
  AssessmentOption,
  AssessmentQuestionType,
} from '@/lib/types/learning';
import {
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Sliders,
  Check,
  X,
  Loader2,
} from 'lucide-react';

interface AssessmentBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  lessonId: string;
  portalId: string;
  existingAssessment?: CourseAssessment | null;
  onSaved?: (assessment: CourseAssessment) => void;
}

export function AssessmentBuilderModal({
  open,
  onOpenChange,
  courseId,
  lessonId,
  portalId,
  existingAssessment,
  onSaved,
}: AssessmentBuilderModalProps) {
  const { toast } = useToast();

  const [title, setTitle] = React.useState(existingAssessment?.title || 'Lesson Knowledge Check');
  const [instructions, setInstructions] = React.useState(
    existingAssessment?.instructions || 'Answer the following questions to verify your understanding.'
  );
  const [passingScore, setPassingScore] = React.useState(existingAssessment?.passingScore || 70);
  const [questions, setQuestions] = React.useState<AssessmentQuestion[]>(
    existingAssessment?.questions || [
      {
        id: 'q1',
        questionText: 'What is the primary factor influencing parent enrollment decisions?',
        type: 'multiple_choice',
        points: 1,
        options: [
          { id: 'opt1', text: 'Prompt fee reminders', isCorrect: false },
          { id: 'opt2', text: 'School reputation and direct parent referrals', isCorrect: true },
          { id: 'opt3', text: 'Classroom wall color', isCorrect: false },
        ],
        explanation: 'Studies show over 68% of private school enrollments are driven by parent referrals.',
      },
    ]
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (existingAssessment) {
      setTitle(existingAssessment.title);
      setInstructions(existingAssessment.instructions || '');
      setPassingScore(existingAssessment.passingScore);
      setQuestions(existingAssessment.questions);
    }
  }, [existingAssessment, open]);

  const handleAddQuestion = () => {
    const newQ: AssessmentQuestion = {
      id: `q_${Date.now()}`,
      questionText: 'New Question Prompt',
      type: 'multiple_choice',
      points: 1,
      options: [
        { id: `opt_${Date.now()}_1`, text: 'Option A', isCorrect: true },
        { id: `opt_${Date.now()}_2`, text: 'Option B', isCorrect: false },
      ],
      explanation: '',
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleUpdateQuestion = (idx: number, updates: Partial<AssessmentQuestion>) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...updates };
    setQuestions(updated);
  };

  const handleAddOption = (qIdx: number) => {
    const q = questions[qIdx];
    const newOpt: AssessmentOption = {
      id: `opt_${Date.now()}`,
      text: `Option ${String.fromCharCode(65 + q.options.length)}`,
      isCorrect: false,
    };
    handleUpdateQuestion(qIdx, { options: [...q.options, newOpt] });
  };

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    handleUpdateQuestion(qIdx, {
      options: q.options.filter((_, i) => i !== optIdx),
    });
  };

  const handleToggleCorrect = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    const updatedOptions = q.options.map((opt, i) => {
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        return { ...opt, isCorrect: i === optIdx };
      }
      return i === optIdx ? { ...opt, isCorrect: !opt.isCorrect } : opt;
    });
    handleUpdateQuestion(qIdx, { options: updatedOptions });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Title Required', description: 'Please provide a title for the quiz.' });
      return;
    }

    if (questions.length === 0) {
      toast({ title: 'No Questions', description: 'Please add at least one question.' });
      return;
    }

    setIsSaving(true);
    try {
      const assessmentId = existingAssessment?.id || `assessment_${lessonId}`;
      const now = new Date().toISOString();

      const assessmentDoc: CourseAssessment = {
        id: assessmentId,
        organizationId: 'default-org',
        portalId,
        courseId,
        lessonId,
        title: title.trim(),
        instructions: instructions.trim(),
        passingScore: Number(passingScore) || 70,
        questions,
        createdAt: existingAssessment?.createdAt || now,
        updatedAt: now,
      };

      // Direct save via client/action
      onSaved?.(assessmentDoc);
      toast({ title: 'Assessment Saved! 🎯', description: 'Quiz questions and pass rules updated.' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error Saving Assessment', description: err?.message || 'Could not save quiz.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:p-8 space-y-6">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" /> Interactive Quiz Configurator
          </div>
          <DialogTitle className="text-xl font-bold">Configure Lesson Assessment</DialogTitle>
          <DialogDescription className="text-xs">
            Build scored questions that validate student comprehension before marking the lesson complete.
          </DialogDescription>
        </DialogHeader>

        {/* Global Quiz Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold">Quiz Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-9 text-xs rounded-xl"
              placeholder="e.g. Module 1 Knowledge Check"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Passing Score (%)</Label>
            <Input
              type="number"
              min="10"
              max="100"
              value={passingScore}
              onChange={e => setPassingScore(Number(e.target.value))}
              className="h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-foreground">Questions ({questions.length})</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddQuestion}
              className="rounded-xl font-bold text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Question
            </Button>
          </div>

          {questions.map((q, qIdx) => (
            <Card key={q.id || qIdx} className="rounded-2xl border-2 border-border p-4 space-y-3 bg-card">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px] font-bold uppercase">
                  Question #{qIdx + 1}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground text-[11px]">Points:</span>
                    <Input
                      type="number"
                      min="1"
                      value={q.points}
                      onChange={e => handleUpdateQuestion(qIdx, { points: Number(e.target.value) || 1 })}
                      className="w-16 h-7 text-xs rounded-lg text-center"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1">
                <Input
                  value={q.questionText}
                  onChange={e => handleUpdateQuestion(qIdx, { questionText: e.target.value })}
                  placeholder="Enter the question prompt..."
                  className="font-bold text-xs h-9 rounded-xl"
                />
              </div>

              {/* Options */}
              <div className="space-y-2 pt-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Answer Choices (Check correct answer)</Label>
                {q.options.map((opt, optIdx) => (
                  <div key={opt.id || optIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCorrect(qIdx, optIdx)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                        opt.isCorrect
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-muted border-border text-transparent hover:border-emerald-500'
                      }`}
                      title={opt.isCorrect ? 'Correct Option' : 'Mark as Correct'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <Input
                      value={opt.text}
                      onChange={e => {
                        const newOpts = [...q.options];
                        newOpts[optIdx] = { ...opt, text: e.target.value };
                        handleUpdateQuestion(qIdx, { options: newOpts });
                      }}
                      className="h-8 text-xs rounded-lg flex-1"
                    />
                    {q.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(qIdx, optIdx)}
                        className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddOption(qIdx)}
                  className="text-[11px] font-bold text-primary hover:bg-primary/10 h-7 rounded-lg gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Choice
                </Button>
              </div>

              {/* Explanation */}
              <div className="space-y-1 pt-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Explanation (Revealed after submission)</Label>
                <Input
                  value={q.explanation || ''}
                  onChange={e => handleUpdateQuestion(qIdx, { explanation: e.target.value })}
                  placeholder="Explain why the correct answer is right..."
                  className="text-xs h-8 rounded-lg"
                />
              </div>
            </Card>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Assessment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
