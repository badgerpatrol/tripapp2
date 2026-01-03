"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  AvatarRow,
  PeopleCard,
  MoneyCard,
  DecisionsCard,
  TasksCard,
  KitCard,
  ActivityFeed,
  TripHealthChip,
  BottomTabs,
  styles,
} from "@/components/trip-home";
import type {
  TripHomeSummary,
  ActivityItem,
  ActionPrompt,
} from "@/components/trip-home/types";

export default function TripHomePage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const [summary, setSummary] = useState<TripHomeSummary | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [prompts, setPrompts] = useState<ActionPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tripId = params.id as string;

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch home summary and activity in parallel
      const [summaryRes, activityRes] = await Promise.all([
        fetch(`/api/trips/${tripId}/home`, { headers }),
        fetch(`/api/trips/${tripId}/activity?limit=5`, { headers }),
      ]);

      if (!summaryRes.ok) {
        const data = await summaryRes.json();
        throw new Error(data.error || "Failed to load trip home");
      }

      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivities(activityData.activities || []);
        setPrompts(activityData.prompts || []);
      }
    } catch (err: any) {
      console.error("Error fetching trip home:", err);
      setError(err.message || "Failed to load trip home");
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Navigation handlers
  const navigateToLegacy = () => router.push(`/trips/${tripId}`);
  const navigateToDecisions = () => router.push(`/trips/${tripId}?tab=choices`);
  const navigateToTasks = () => router.push(`/trips/${tripId}?tab=timeline`);
  const navigateToKit = () => router.push(`/trips/${tripId}?tab=checklists`);
  const navigateToSettle = () => router.push(`/trips/${tripId}?tab=settle`);

  const handlePromptClick = (prompt: ActionPrompt) => {
    if (prompt.actionUrl) {
      router.push(prompt.actionUrl);
    }
  };

  // Format date range
  const formatDateRange = (start: string | null, end: string | null): string => {
    if (!start && !end) return "";

    const formatDate = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);

      // Same month
      if (
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getFullYear() === endDate.getFullYear()
      ) {
        return `${startDate.toLocaleDateString("en-US", { month: "short" })} ${startDate.getDate()}–${endDate.getDate()}`;
      }

      return `${formatDate(start)} – ${formatDate(end)}`;
    }

    return start ? formatDate(start) : formatDate(end!);
  };

  // Background style for dark gradient
  const backgroundStyle = {
    background: `
      radial-gradient(1200px 900px at 20% -10%, rgba(79,124,255,.16), transparent 55%),
      radial-gradient(1200px 900px at 110% 10%, rgba(242,184,75,.10), transparent 50%),
      #0B0F16
    `,
    minHeight: '100dvh',
  };

  if (authLoading || loading) {
    return (
      <div style={backgroundStyle}>
        <main className={styles.container}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-zinc-400">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div style={backgroundStyle}>
        <main className={styles.container}>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="text-red-400">{error}</div>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-200 hover:bg-zinc-700"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={backgroundStyle}>
        <main className={styles.container}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-zinc-400">Trip not found</div>
          </div>
        </main>
      </div>
    );
  }

  const dateRange = formatDateRange(summary.trip.startDate, summary.trip.endDate);

  return (
    <div style={backgroundStyle}>
      <main className={styles.container} aria-label="Trip Home">
        {/* Top bar */}
        <section className={styles.topbar}>
          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.tripTitle}>{summary.trip.name}</h1>
              <p className={styles.subTitle}>
                {dateRange && `${dateRange} · `}
                {summary.people.total} people
              </p>
            </div>
            <TripHealthChip status={summary.health.status} />
          </div>
        </section>

        {/* Avatar row */}
        <AvatarRow
          participants={summary.people.participants}
          onAvatarClick={() => navigateToLegacy()}
        />

        {/* Dashboard grid */}
        <section className={styles.grid} aria-label="Trip dashboard">
          <PeopleCard
            accepted={summary.people.accepted}
            total={summary.people.total}
            pending={summary.people.pending}
            onClick={navigateToLegacy}
          />

          <MoneyCard
            userBalance={summary.money.userBalance}
            transfersNeeded={summary.money.transfersNeeded}
            baseCurrency={summary.money.baseCurrency}
            onClick={navigateToSettle}
          />

          <DecisionsCard
            openCount={summary.decisions.openCount}
            waitingForYou={summary.decisions.waitingForYou}
            topDecision={summary.decisions.topDecision}
            onClick={navigateToDecisions}
            onOpenDecisions={navigateToDecisions}
          />

          <TasksCard
            openCount={summary.tasks.openCount}
            topTasks={summary.tasks.topTasks}
            onClick={navigateToTasks}
          />

          <KitCard
            totalItems={summary.kit.totalItems}
            completedItems={summary.kit.completedItems}
            topIncomplete={summary.kit.topIncomplete}
            onClick={navigateToKit}
          />
        </section>

        {/* Activity feed */}
        <ActivityFeed
          activities={activities}
          prompts={prompts}
          onActivityClick={() => navigateToLegacy()}
          onPromptClick={handlePromptClick}
        />

        {/* Bottom tabs */}
        <BottomTabs tripId={tripId} activeTab="home" />
      </main>
    </div>
  );
}
