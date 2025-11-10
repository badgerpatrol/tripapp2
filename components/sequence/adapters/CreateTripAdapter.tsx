"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CreateTripAdapterProps {
  run: any;
  step: any;
  runStep: any;
}

export default function CreateTripAdapter({ run, step }: CreateTripAdapterProps) {
  const router = useRouter();

  const handleCreateTrip = () => {
    // Navigate to create trip page with runId to redirect back
    router.push(`/trips/new?runId=${run.id}`);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
        Create a Trip
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Let's start by creating a new trip. Give it a name and you can add more details later.
      </p>
      <Button onClick={handleCreateTrip} variant="primary" size="lg" className="w-full sm:w-auto">
        Create Trip
      </Button>
    </div>
  );
}
