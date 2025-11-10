import { Metadata } from "next";
import TripTemplateCarousel from "@/components/TripTemplateCarousel";

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
            Start Something New
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Create a trip with a template or start from scratch
          </p>
        </div>

        {/* Trip template carousel */}
        <TripTemplateCarousel />
      </main>
    </div>
  );
}
