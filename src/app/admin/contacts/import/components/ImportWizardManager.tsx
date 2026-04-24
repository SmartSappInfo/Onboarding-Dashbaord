'use client';

import React, { useState, useEffect } from 'react';
import { ImportState, INITIAL_IMPORT_STATE, ImportWizardStep } from '../types';
import { UploadStep } from './steps/UploadStep';
import { MappingStep } from './steps/MappingStep';
import { ConfigurationStep } from './steps/ConfigurationStep';
import { ValidationStep } from './steps/ValidationStep';
import { ExecutionStep } from './steps/ExecutionStep';
import { ReviewStep } from './steps/ReviewStep';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';

const stepsOrder: ImportWizardStep[] = ['upload', 'map', 'configure', 'validate', 'execute', 'review'];

const stepTitles: Record<ImportWizardStep, string> = {
  upload: 'Upload CSV',
  map: 'Map Data Fields',
  configure: 'Enrichment & Tags',
  validate: 'Validate & Preview',
  execute: 'Import Processing',
  review: 'Review Results',
};

export function ImportWizardManager() {
  const [state, setState] = useState<ImportState>(INITIAL_IMPORT_STATE);
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();

  // Inject tenant context into state whenever it resolves
  useEffect(() => {
    if (activeWorkspaceId || activeOrganizationId || user?.uid) {
      setState((prev) => ({
        ...prev,
        workspaceId: activeWorkspaceId || prev.workspaceId,
        organizationId: activeOrganizationId || prev.organizationId,
        userId: user?.uid || prev.userId,
      }));
    }
  }, [activeWorkspaceId, activeOrganizationId, user?.uid]);

  const updateState = (updates: Partial<ImportState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const goToNextStep = () => {
    const currentIndex = stepsOrder.indexOf(state.step);
    if (currentIndex < stepsOrder.length - 1) {
      updateState({ step: stepsOrder[currentIndex + 1] });
    }
  };

  const goToPrevStep = () => {
    const currentIndex = stepsOrder.indexOf(state.step);
    if (currentIndex > 0) {
      updateState({ step: stepsOrder[currentIndex - 1] });
    }
  };

  const renderCurrentStep = () => {
    switch (state.step) {
      case 'upload':
        return <UploadStep state={state} updateState={updateState} onNext={goToNextStep} />;
      case 'map':
        return <MappingStep state={state} updateState={updateState} onNext={goToNextStep} onBack={goToPrevStep} />;
      case 'configure':
        return <ConfigurationStep state={state} updateState={updateState} onNext={goToNextStep} onBack={goToPrevStep} />;
      case 'validate':
        return <ValidationStep state={state} updateState={updateState} onNext={goToNextStep} onBack={goToPrevStep} />;
      case 'execute':
        return <ExecutionStep state={state} updateState={updateState} onNext={goToNextStep} />;
      case 'review':
        return <ReviewStep state={state} onReset={() => setState({ ...INITIAL_IMPORT_STATE, workspaceId: activeWorkspaceId, organizationId: activeOrganizationId, userId: user?.uid })} />;
      default:
        return null;
    }
  };

  return (
    <Card className="flex flex-col flex-1 w-full border border-border/40 bg-background/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden min-h-[600px]">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center space-x-3">
           <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
             Step {stepsOrder.indexOf(state.step) + 1} of {stepsOrder.length}
           </span>
           <h2 className="text-xl font-semibold text-foreground/90 tracking-tight transition-all">
             {stepTitles[state.step]}
           </h2>
        </div>
        
        {/* Progress Dots */}
        <div className="flex space-x-2">
          {stepsOrder.map((s, i) => (
            <div 
              key={s} 
              className={`h-2 rounded-full transition-all duration-300 ${
                stepsOrder.indexOf(state.step) >= i 
                  ? 'w-6 bg-primary' 
                  : 'w-2 bg-primary/20'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 relative overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute inset-0 p-8"
          >
            {renderCurrentStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}
