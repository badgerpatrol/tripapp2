"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import TripWizardStep2 from "@/components/TripWizardStep2";
import { Suspense } from "react";

function Step2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const tripId = searchParams.get("tripId");

  // Show loading state while checking auth
  if (loading) {
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

  // If no tripId, redirect to step 1
  if (!tripId) {
    router.push("/trips/new");
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Step 2 of 2
            </span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Add More Details
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Customize your trip with additional options
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8">
          <TripWizardStep2
            tripId={tripId}
            onBack={() => router.push(`/trips/new?tripId=${tripId}`)}
          />
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            All fields are optional
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Templates help you get started with pre-made checklists</li>
            <li>• Access settings control who can view and join your trip</li>
            <li>• You can update any of these settings later</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Step2Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
          <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
        </div>
      }
    >
      <Step2Content />
    </Suspense>
  );
}
