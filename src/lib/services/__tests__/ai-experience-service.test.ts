import { describe, it, expect } from 'vitest';
import { AiExperienceService } from '../ai-experience-service';

describe('AiExperienceService Unit Logic', () => {
  it('generates a complete structured curriculum blueprint with modules and lessons', async () => {
    const curriculum = await AiExperienceService.generateCurriculumStructure({
      organizationId: 'test-org',
      portalId: 'test-portal',
      topicPrompt: 'School Budgeting & Fee Collection',
      durationDays: 30,
    });

    expect(curriculum.courseTitle).toBe('School Budgeting & Fee Collection');
    expect(curriculum.modules.length).toBeGreaterThanOrEqual(3);
    expect(curriculum.estimatedHours).toBe(45); // 30 * 1.5

    const firstModule = curriculum.modules[0];
    expect(firstModule.title).toContain('Module 1');
    expect(firstModule.lessons.length).toBeGreaterThanOrEqual(2);
    expect(firstModule.lessons[0].contentType).toBe('video');
    expect(firstModule.lessons[0].objectives.length).toBeGreaterThanOrEqual(1);
  });

  it('generates high-yield multiple-choice questions with answer explanations', async () => {
    const questions = await AiExperienceService.generateQuizQuestions({
      organizationId: 'test-org',
      portalId: 'test-portal',
      lessonId: 'lesson-123',
      lessonTitle: 'Strategic School Fee Collection',
      questionCount: 5,
    });

    expect(questions.length).toBe(5);
    questions.forEach(q => {
      expect(q.questionText).toBeTruthy();
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.some(opt => opt.isCorrect)).toBe(true);
      expect(q.explanation).toBeTruthy();
      expect(q.points).toBe(20);
    });
  });

  it('generates domain-aware portal scaffolding with branding, courses, and onboarding steps', async () => {
    const scaffold = await AiExperienceService.generatePortalScaffold({
      organizationId: 'test-org',
      portalName: 'Ghana School Leaders Academy',
      audienceDescription: 'Private school owners and bursars',
      industry: 'Education',
      primaryGoal: 'Enrollment & Finance',
    });

    expect(scaffold.portalName).toBe('Ghana School Leaders Academy');
    expect(scaffold.primaryColor).toBe('#2563eb');
    expect(scaffold.suggestedCourses.length).toBe(2);
    expect(scaffold.suggestedSpaces.length).toBe(3);
    expect(scaffold.suggestedOnboardingSteps.length).toBe(3);
  });
});
