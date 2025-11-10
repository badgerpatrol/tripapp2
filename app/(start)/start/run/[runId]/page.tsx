import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import StepRunner from "@/components/sequence/StepRunner";
import { getRun, getNextPendingStep } from "@/server/services/sequence";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sequence Run | TripPlanner",
  description: "Complete your sequence steps",
};

interface PageProps {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tripId?: string }>;
}

export default async function SequenceRunPage({ params, searchParams }: PageProps) {
  const { runId } = await params;
  const { tripId } = await searchParams;

  const run = await getRun(runId);

  if (!run) {
    notFound();
  }

  // If tripId is in search params and CREATE_TRIP step exists, complete it
  if (tripId && run.status === "IN_PROGRESS") {
    const nextStep = getNextPendingStep(run);
    if (nextStep?.step.type === "CREATE_TRIP") {
      // Import the service functions at the top level
      const { updateRunPayload, completeStep } = await import("@/server/services/sequence");

      await updateRunPayload(run.id, { tripId });
      if (nextStep.runStep) {
        await completeStep((nextStep.runStep as { id: string }).id, { tripId });
      }

      // Redirect to clean URL
      redirect(`/start/run/${runId}`);
    }
  }

  const nextStep = getNextPendingStep(run);

  // If run is completed or has no more steps
  if (run.status === "COMPLETED" || !nextStep) {
    const tripId = (run.payload as any)?.tripId;

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header showBackButton />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-sm border border-zinc-200 dark:border-zinc-700 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              All Done!
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
              You've completed all the steps in this sequence.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {tripId && (
                <Link href={`/trips/${tripId}`}>
                  <Button variant="primary" size="lg">
                    Go to Trip
                  </Button>
                </Link>
              )}
              <Link href="/trips">
                <Button variant="secondary" size="lg">
                  View All Trips
                </Button>
              </Link>
              <Link href="/start">
                <Button variant="secondary" size="lg">
                  Start Another
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header showBackButton />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            {run.sequence.title}
          </h1>
          {run.sequence.subtitle && (
            <p className="text-zinc-600 dark:text-zinc-400">
              {run.sequence.subtitle}
            </p>
          )}
        </div>

        <StepRunner run={run} next={nextStep} />
      </main>
    </div>
  );
}
