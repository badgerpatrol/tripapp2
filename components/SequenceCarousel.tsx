"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

interface Sequence {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  imageUrl: string | null;
  position: number;
}

export default function SequenceCarousel() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function loadSequences() {
      try {
        const response = await fetch("/api/sequences");
        if (!response.ok) {
          throw new Error("Failed to load sequences");
        }
        const data = await response.json();
        setSequences(data.sequences || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sequences");
      } finally {
        setLoading(false);
      }
    }

    loadSequences();
  }, []);

  const handleStartSequence = async (sequenceId: string) => {
    try {
      if (!user) {
        throw new Error("You must be logged in");
      }
      const token = await user.getIdToken();
      const response = await fetch("/api/sequences/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sequenceId }),
      });

      if (!response.ok) {
        throw new Error("Failed to start sequence");
      }

      const data = await response.json();
      if (data.success && data.run) {
        router.push(`/start/run/${data.run.id}`);
      }
    } catch (err) {
      console.error("Error starting sequence:", err);
      setError(err instanceof Error ? err.message : "Failed to start sequence");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (sequences.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-zinc-500">No sequences available</div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      {/* Horizontal scroll container */}
      <div
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 pb-4"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {sequences.map((sequence) => (
          <button
            key={sequence.id}
            onClick={() => handleStartSequence(sequence.id)}
            className="flex-shrink-0 w-[280px] sm:w-[320px] snap-center group"
          >
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-zinc-200 dark:border-zinc-700 h-full min-h-[180px] flex flex-col justify-between">
              {/* Icon */}
              {sequence.icon && (
                <div className="text-4xl mb-3">{sequence.icon}</div>
              )}

              {/* Title */}
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 text-left group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {sequence.title}
              </h3>

              {/* Subtitle */}
              {sequence.subtitle && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-left">
                  {sequence.subtitle}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Scroll hint gradient on edges */}
      <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-zinc-900 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-zinc-900 to-transparent pointer-events-none" />
    </div>
  );
}
