"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { SpendStatus } from "@/lib/generated/prisma";
import { styles, UserAvatarMenu } from "@/components/trip-home";
import SettlementPlanSection from "@/components/SettlementPlanSection";

interface Spend {
  id: string;
  description: string;
  amount: number;
  currency: string;
  normalizedAmount: number;
  date: string;
  status: SpendStatus;
  paidBy: {
    id: string;
    displayName: string | null;
  };
  category: {
    name: string;
  } | null;
  assignedPercentage?: number;
}

interface TripDetail {
  id: string;
  name: string;
  baseCurrency: string;
  spendStatus: SpendStatus;
  userRole: string | null;
  totalSpent?: number;
  totalUnassigned?: number;
  spends?: Spend[];
}

export default function SpendPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costsTab, setCostsTab] = useState<"spends" | "settlement">("spends");

  const tripId = params.id as string;

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const tripRes = await fetch(`/api/trips/${tripId}`, { headers });
      if (!tripRes.ok) throw new Error("Failed to load trip");
      const tripData = await tripRes.json();
      setTrip(tripData.trip);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load spend data");
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user, fetchData]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [authLoading, user, router]);

  const navigateBack = () => router.push(`/trips/${tripId}/home`);
  const navigateToLegacy = () => router.push(`/trips/${tripId}?tab=costs`);
  const canManage = trip?.userRole === "OWNER" || trip?.userRole === "ADMIN";

  const backgroundStyle = {
    background: `radial-gradient(1200px 900px at 20% -10%, rgba(79,124,255,.16), transparent 55%),
      radial-gradient(1200px 900px at 110% 10%, rgba(242,184,75,.10), transparent 50%), #0B0F16`,
    minHeight: "100dvh",
  };

  if (authLoading || loading) {
    return (
      <div style={backgroundStyle}>
        <main className={styles.pageContainer}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-zinc-400 text-[12px]">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={backgroundStyle}>
        <main className={styles.pageContainer}>
          <div className="flex flex-col items-center justify-center min-h-screen gap-3">
            <div className="text-red-400 text-[12px]">{error || "Trip not found"}</div>
            <button onClick={fetchData} className={styles.secondaryButton}>Retry</button>
          </div>
        </main>
      </div>
    );
  }

  const userPaid = trip.spends?.filter((s) => s.paidBy.id === user?.uid).reduce((sum, spend) => sum + spend.normalizedAmount, 0) || 0;

  return (
    <div style={backgroundStyle}>
      <main className={styles.pageContainer}>
        {/* Header */}
        <header className={styles.pageHeader}>
          <button onClick={navigateBack} className={styles.pageBackButton} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>Money</h1>
          {canManage && trip.spendStatus === SpendStatus.OPEN && (
            <button onClick={navigateToLegacy} className={styles.primaryButton}>+ Add</button>
          )}
          <UserAvatarMenu
            displayName={user?.displayName || null}
            photoURL={user?.photoURL || null}
          />
        </header>

        {/* Content */}
        <div className={styles.pageContent}>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            <div className={`${styles.summaryCard} bg-purple-900/30 border-purple-700/50`}>
              <p className={`${styles.summaryCardLabel} text-purple-400`}>You Paid</p>
              <p className={`${styles.summaryCardValue} text-purple-300`}>{trip.baseCurrency} {userPaid.toFixed(2)}</p>
            </div>
            <div className={`${styles.summaryCard} bg-blue-900/30 border-blue-700/50`}>
              <p className={`${styles.summaryCardLabel} text-blue-400`}>Total</p>
              <p className={`${styles.summaryCardValue} text-blue-300`}>{trip.baseCurrency} {(trip.totalSpent || 0).toFixed(2)}</p>
            </div>
            <div className={`${styles.summaryCard} ${(trip.totalUnassigned || 0) < 0.01 ? "bg-emerald-900/30 border-emerald-700/50" : "bg-amber-900/30 border-amber-700/50"}`}>
              <p className={`${styles.summaryCardLabel} ${(trip.totalUnassigned || 0) < 0.01 ? "text-emerald-400" : "text-amber-400"}`}>Unassigned</p>
              <p className={`${styles.summaryCardValue} ${(trip.totalUnassigned || 0) < 0.01 ? "text-emerald-300" : "text-amber-300"}`}>{trip.baseCurrency} {(trip.totalUnassigned || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className={styles.tabSwitcher}>
            <button onClick={() => setCostsTab("spends")} className={styles.tabButton(costsTab === "spends")}>Spends</button>
            <button onClick={() => setCostsTab("settlement")} className={styles.tabButton(costsTab === "settlement")}>Settlement</button>
          </div>

          {costsTab === "spends" && (
            <>
              {!trip.spends || trip.spends.length === 0 ? (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionEmptyState}>
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-medium text-zinc-300 text-[13px]">No spends yet</p>
                    {canManage && <p className="text-[11px] mt-0.5">Add a spend to track expenses</p>}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {trip.spends.map((spend) => (
                    <div key={spend.id} className={styles.listItem} onClick={navigateToLegacy}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className={styles.listItemTitle}>{spend.description}</h3>
                          <p className={styles.listItemMeta}>
                            Paid by {spend.paidBy.displayName || "Unknown"}{spend.category && ` · ${spend.category.name}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={styles.listItemBadge(spend.status === SpendStatus.CLOSED ? "closed" : "open")}>{spend.status}</span>
                            {spend.assignedPercentage !== undefined && (
                              <span className="text-[9px] text-zinc-500">{Math.round(spend.assignedPercentage)}% assigned</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[14px] font-bold text-zinc-100">{spend.currency} {spend.amount.toFixed(2)}</p>
                          {spend.currency !== trip.baseCurrency && (
                            <p className="text-[10px] text-zinc-500">{trip.baseCurrency} {spend.normalizedAmount.toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={navigateToLegacy} className={styles.linkButton}>Manage spends in full view</button>
            </>
          )}

          {costsTab === "settlement" && (
            <div>
              <SettlementPlanSection tripId={tripId} baseCurrency={trip.baseCurrency} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
