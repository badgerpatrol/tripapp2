"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import CreateTripAdapter from "./adapters/CreateTripAdapter";
import InvitePeopleAdapter from "./adapters/InvitePeopleAdapter";
import SetDatesAdapter from "./adapters/SetDatesAdapter";
import CreateChoiceAdapter from "./adapters/CreateChoiceAdapter";
import AddChoiceItemsAdapter from "./adapters/AddChoiceItemsAdapter";
import AddChecklistAdapter from "./adapters/AddChecklistAdapter";
import CustomFormAdapter from "./adapters/CustomFormAdapter";

interface StepRunnerProps {
  run: any;
  next: {
    step: any;
    runStep: any;
  } | null;
}

export default function StepRunner({ run, next }: StepRunnerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [activating, setActivating] = useState(false);

  // Activate step on mount if not already active
  useEffect(() => {
    async function activate() {
      if (!next?.runStep || next.runStep.state === "ACTIVE" || !user) return;

      setActivating(true);
      try {
        const token = await user.getIdToken();
        await fetch(`/api/sequences/runs/${run.id}/steps/${next.runStep.id}/activate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.error("Failed to activate step:", err);
      } finally {
        setActivating(false);
      }
    }

    activate();
  }, [run.id, next?.runStep?.id, next?.runStep?.state, user]);

  const handleCancelFlow = async () => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      await fetch(`/api/sequences/runs/${run.id}/complete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      router.push("/trips");
    } catch (err) {
      console.error("Failed to cancel flow:", err);
    }
  };

  if (!next) {
    return null;
  }

  const totalSteps = run.sequence.steps.length;
  const currentStepIndex = run.sequence.steps.findIndex((s: any) => s.id === next.step.id);
  const stepNumber = currentStepIndex + 1;

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Step {stepNumber} of {totalSteps}
          </span>
          <button
            onClick={handleCancelFlow}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Cancel
          </button>
        </div>
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step adapter */}
      {activating ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-zinc-500">Loading step...</div>
        </div>
      ) : (
        <>
          {next.step.type === "CREATE_TRIP" && (
            <CreateTripAdapter run={run} step={next.step} runStep={next.runStep} />
          )}
          {next.step.type === "INVITE_PEOPLE" && (
            <InvitePeopleAdapter run={run} step={next.step} runStep={next.runStep} />
          )}
          {next.step.type === "SET_DATES" && (
            <SetDatesAdapter run={run} step={next.step} runStep={next.runStep} />
          )}
          {next.step.type === "CREATE_CHOICE" && (
            <CreateChoiceAdapter run={run} step={next.step} runStep={next.runStep} />
          )}
          {next.step.type === "ADD_CHOICE_ITEMS" && (
            <AddChoiceItemsAdapter run={run} step={next.step} runStep={next.runStep} />
          )}
          {next.step.type === "ADD_CHECKLIST" && (
            <AddChecklistAdapter run={run} step={next.step} runStep={next.runStep} />
          )}
          {next.step.type === "CUSTOM_FORM" && (
            <CustomFormAdapter run={run} step={next.step} runStep={next.runStep} />
          )}
        </>
      )}
    </div>
  );
}
