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
  onNext,
  onCancel,
  onDelete,
  onFinish,
  nextLabel,
}: WizardFooterNavProps) {
  const showBack = currentStep > 1;
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

      {/* Navigation buttons - fixed 3-column layout */}
      <div className="grid grid-cols-3 items-center max-w-lg mx-auto">
        {/* Left side: Cancel or Delete */}
        <div className="flex justify-start">
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

        {/* Center: Back */}
        <div className="flex items-center justify-center">
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
        </div>

        {/* Right side: Next or Finish - fixed width for consistent positioning */}
        <div className="flex justify-end">
          {isLastStep ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onFinish}
              disabled={isLoading}
              loading={isLoading}
              className="w-20"
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
              className="w-20"
            >
              {nextLabel || "Next >"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
