import { Metadata } from "next";
import SequenceCarousel from "@/components/SequenceCarousel";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Start Something New | TripPlanner",
  description: "Choose what you want to do with friends",
};

export default function StartPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {/* Hero section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            What do you want to do?
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            From planning holidays to organizing dinners, we make it easy to arrange anything with friends.
          </p>
        </div>

        {/* Sequence carousel */}
        <SequenceCarousel />
      </main>
    </div>
  );
}
