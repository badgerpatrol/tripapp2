"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Link from "next/link";
import WizardFooterNav from "./WizardFooterNav";
import Step1Basics from "./steps/Step1Basics";
import Step2Details from "./steps/Step2Details";
import Step3InviteOptions from "./steps/Step3InviteOptions";
import Step4InviteSelection from "./steps/Step4InviteSelection";
import Step5Share from "./steps/Step5Share";
import Step6Choices from "./steps/Step6Choices";
import Step7CoverImage from "./steps/Step7CoverImage";
import {
  INITIAL_WIZARD_STATE,
  STEP_TITLES,
  type WizardState,
  type WizardStep,
  type StepProps,
} from "./types";

function WizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Parse step and tripId from URL
  const stepParam = searchParams.get("step");
  const tripIdParam = searchParams.get("tripId");

  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_WIZARD_STATE,
    tripId: tripIdParam,
  }));
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    const parsed = parseInt(stepParam || "1", 10);
    return (parsed >= 1 && parsed <= 7 ? parsed : 1) as WizardStep;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [hideFooter, setHideFooter] = useState(false);

  // Sync URL with step and tripId
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("step", currentStep.toString());
    if (state.tripId) params.set("tripId", state.tripId);
    router.replace(`/trips/new-v2?${params.toString()}`, { scroll: false });
  }, [currentStep, state.tripId, router]);

  // Update state helper
  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Determine which steps to show
  const shouldShowStep5 = state.allowNamedPeople || state.allowSignup;
  const totalSteps = 7;

  // Get the actual step index (accounting for skipped steps)
  const getVisibleStep = (step: WizardStep): WizardStep => {
    if (step === 5 && !shouldShowStep5) return 6;
    return step;
  };

  // Navigation handlers
  const goToStep = (step: WizardStep) => {
    setError(null);
    setCurrentStep(getVisibleStep(step));
  };

  const handleNext = async () => {
    setError(null);

    if (currentStep === 1) {
      await createTrip();
    } else if (currentStep === 2) {
      await updateTripDetails();
    } else if (currentStep === 3) {
      await updateInviteOptions();
    } else if (currentStep === 4) {
      await saveInvites();
    } else if (currentStep === 5) {
      goToStep(6);
    } else if (currentStep === 6) {
      goToStep(7);
    }
  };

  const handleBack = () => {
    if (currentStep === 6 && !shouldShowStep5) {
      goToStep(4);
    } else if (currentStep > 1) {
      goToStep((currentStep - 1) as WizardStep);
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // Save cover image if present
      if (state.headerImageData) {
        await saveCoverImage();
      }
      // Navigate to trip page
      if (state.tripId) {
        router.push(`/trips/${state.tripId}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/");
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    if (!state.tripId || !user) return;

    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/trips/${state.tripId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to delete trip");
      }

      router.push("/");
    } catch (err) {
      console.error("Error deleting trip:", err);
      setError("Failed to delete trip. Please try again.");
    } finally {
      setIsLoading(false);
      setDeleteConfirm(false);
    }
  };

  // API calls
  const createTrip = async () => {
    if (!user) return;

    // Validate
    if (!state.name.trim() || state.name.trim().length < 2) {
      setError("Trip name must be at least 2 characters");
      return;
    }
    if (!state.startDate || !state.endDate) {
      setError("Start and end dates are required");
      return;
    }
    if (state.endDate < state.startDate) {
      setError("End date must be on or after start date");
      return;
    }

    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: state.name.trim(),
          startDate: new Date(state.startDate),
          endDate: new Date(state.endDate),
          description: state.description.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create trip");
      }

      updateState({ tripId: data.trip.id });
      goToStep(2);
    } catch (err) {
      console.error("Error creating trip:", err);
      setError(err instanceof Error ? err.message : "Failed to create trip");
    } finally {
      setIsLoading(false);
    }
  };

  const updateTripDetails = async () => {
    if (!user || !state.tripId) return;

    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/trips/${state.tripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          location: state.location.trim() || null,
          baseCurrency: state.baseCurrency,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update trip");
      }

      goToStep(3);
    } catch (err) {
      console.error("Error updating trip:", err);
      setError(err instanceof Error ? err.message : "Failed to update trip");
    } finally {
      setIsLoading(false);
    }
  };

  const updateInviteOptions = async () => {
    if (!user || !state.tripId) return;

    setIsLoading(true);
    try {
      const token = await user.getIdToken();

      // If either option is enabled, ensure a join code/password exists first
      // This is required for adding named invitees
      if (state.allowNamedPeople || state.allowSignup) {
        const codeRes = await fetch(`/api/trips/${state.tripId}/ensure-join-code`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (codeRes.ok) {
          const codeData = await codeRes.json();
          updateState({ tripJoinCode: codeData.joinCode });
        }
      }

      const res = await fetch(`/api/trips/${state.tripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          signUpMode: state.allowSignup,
          signInMode: state.allowNamedPeople,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update invite options");
      }

      goToStep(4);
    } catch (err) {
      console.error("Error updating invite options:", err);
      setError(err instanceof Error ? err.message : "Failed to update invite options");
    } finally {
      setIsLoading(false);
    }
  };

  const saveInvites = async () => {
    if (!user || !state.tripId) return;

    const hasInvites = state.selectedUserIds.length > 0 || state.namedInvitees.length > 0;

    if (hasInvites) {
      setIsLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/trips/${state.tripId}/invitations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userIds: state.selectedUserIds.length > 0 ? state.selectedUserIds : undefined,
            nonUserNames: state.namedInvitees.length > 0 ? state.namedInvitees : undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to send invites");
        }
      } catch (err) {
        console.error("Error sending invites:", err);
        setError(err instanceof Error ? err.message : "Failed to send invites");
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    // Navigate to next step
    if (shouldShowStep5) {
      goToStep(5);
    } else {
      goToStep(6); // Go to Choices step
    }
  };

  const saveCoverImage = async () => {
    if (!user || !state.tripId || !state.headerImageData) return;

    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/trips/${state.tripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          headerImageData: state.headerImageData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save cover image");
      }
    } catch (err) {
      console.error("Error saving cover image:", err);
      // Don't block finish, just log the error
    } finally {
      setIsLoading(false);
    }
  };

  // Build step props
  const stepProps: StepProps = {
    state,
    updateState,
    onNext: handleNext,
    onBack: handleBack,
    onFinish: handleFinish,
    onCancel: handleCancel,
    onDelete: handleDelete,
    isLoading,
    setIsLoading,
    error,
    setError,
    setHideFooter,
  };

  // Validation for proceed button
  const canProceed: boolean = (() => {
    switch (currentStep) {
      case 1:
        return state.name.trim().length >= 2 && !!state.startDate && !!state.endDate;
      case 2:
        return !!state.baseCurrency;
      default:
        return true;
    }
  })();

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.push("/");
    return null;
  }

  const isLastStep = currentStep === 7;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Create Trip
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Step {currentStep}: {STEP_TITLES[currentStep]}
            </p>
          </div>
          
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Delete Trip?
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              This will permanently delete the trip and all associated data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50"
              >
                {isLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {currentStep === 1 && <Step1Basics {...stepProps} />}
        {currentStep === 2 && <Step2Details {...stepProps} />}
        {currentStep === 3 && <Step3InviteOptions {...stepProps} />}
        {currentStep === 4 && <Step4InviteSelection {...stepProps} />}
        {currentStep === 5 && <Step5Share {...stepProps} />}
        {currentStep === 6 && <Step6Choices {...stepProps} />}
        {currentStep === 7 && <Step7CoverImage {...stepProps} />}
      </div>

      {/* Footer navigation - hidden when modal is open */}
      {!hideFooter && (
        <WizardFooterNav
          currentStep={currentStep}
          totalSteps={totalSteps}
          tripCreated={!!state.tripId}
          isLoading={isLoading}
          isLastStep={isLastStep}
          canProceed={canProceed}
          onBack={handleBack}
          onNext={handleNext}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onFinish={handleFinish}
          nextLabel={currentStep === 1 ? "Create" : undefined}
        />
      )}
    </div>
  );
}

export default function NewTripV2Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    }>
      <WizardContent />
    </Suspense>
  );
}
