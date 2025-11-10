import { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Sequence Run | TripPlanner",
  description: "Complete your sequence steps",
};

interface PageProps {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tripId?: string }>;
}

export default async function SequenceRunPage({ params, searchParams }: PageProps) {
  // Temporarily disabled - sequence feature not yet implemented
  notFound();
}
