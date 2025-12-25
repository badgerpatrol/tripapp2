"use client";

import { Button } from "@/components/ui/button";
import type { WizardStep } from "./types";

interface WizardFooterNavProps {
  currentStep: WizardStep;
  totalSteps: number;
  tripCreated: boolean;
  isLoading: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onFinish: () => void;
  nextLabel?: string;
}

export default function WizardFooterNav({
  currentStep,
  totalSteps,
  tripCreated,
  isLoading,
  isLastStep,
  canProceed,
  onBack,
  onSkip,
  onNext,
  onCancel,
  onDelete,
  onFinish,
  nextLabel,
}: WizardFooterNavProps) {
  const showBack = currentStep > 1;
  const showSkip = currentStep > 1 && !isLastStep;
  const isStep1 = currentStep === 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 px-4 pb-[env(safe-area-inset-bottom,16px)] pt-3 z-50">
      {/* Progress indicator */}
      <div className="flex justify-center gap-1.5 mb-3">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i + 1 === currentStep
                ? "w-6 bg-blue-600"
                : i + 1 < currentStep
                ? "w-1.5 bg-blue-400"
                : "w-1.5 bg-zinc-300 dark:bg-zinc-600"
            }`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
        {/* Left side: Cancel or Delete */}
        <div className="w-20">
          {isStep1 && !tripCreated ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isLoading}
              className="text-zinc-500 dark:text-zinc-400"
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isLoading}
              className="text-red-600 dark:text-red-400"
            >
              Delete
            </Button>
          )}
        </div>

        {/* Center: Back and Skip */}
        <div className="flex items-center gap-2">
          {showBack && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onBack}
              disabled={isLoading}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              }
            >
              Back
            </Button>
          )}
          {showSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              disabled={isLoading}
              className="text-zinc-500 dark:text-zinc-400"
            >
              Skip
            </Button>
          )}
        </div>

        {/* Right side: Next or Finish */}
        <div className="w-24 flex justify-end">
          {isLastStep ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onFinish}
              disabled={isLoading}
              loading={isLoading}
            >
              Finish
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onNext}
              disabled={!canProceed || isLoading}
              loading={isLoading}
              rightIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              }
            >
              {nextLabel || "Next"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
