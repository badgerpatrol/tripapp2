"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { styles, UserAvatarMenu } from "@/components/trip-home";
import CreateChoiceDialog from "../CreateChoiceDialog";
import ChoiceDetailDialog from "../ChoiceDetailDialog";
import ManageChoiceDialog from "../ManageChoiceDialog";
import ChoiceReportsDialog from "../ChoiceReportsDialog";

interface Choice {
  id: string;
  name: string;
  datetime: string | null;
  place: string | null;
  status: "OPEN" | "CLOSED";
  deadline: string | null;
  _count: { items: number; selections: number };
}

interface TripInfo {
  id: string;
  name: string;
  userRole: string | null;
  baseCurrency: string;
}

export default function DecisionsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const [choices, setChoices] = useState<Choice[]>([]);
  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isCreateChoiceDialogOpen, setIsCreateChoiceDialogOpen] = useState(false);
  const [isChoiceDetailDialogOpen, setIsChoiceDetailDialogOpen] = useState(false);
  const [isManageChoiceDialogOpen, setIsManageChoiceDialogOpen] = useState(false);
  const [isChoiceReportsDialogOpen, setIsChoiceReportsDialogOpen] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

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

      // Fetch trip info and choices in parallel
      const [tripRes, choicesRes] = await Promise.all([
        fetch(`/api/trips/${tripId}`, { headers }),
        fetch(`/api/trips/${tripId}/choices`, { headers }),
      ]);

      if (!tripRes.ok) {
        throw new Error("Failed to load trip");
      }

      const tripData = await tripRes.json();
      setTripInfo({
        id: tripData.trip.id,
        name: tripData.trip.name,
        userRole: tripData.trip.userRole,
        baseCurrency: tripData.trip.baseCurrency,
      });

      if (choicesRes.ok) {
        const choicesData = await choicesRes.json();
        setChoices(choicesData || []);
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const navigateBack = () => router.push(`/trips/${tripId}/home`);

  const handleChoiceClick = (choiceId: string) => {
    setSelectedChoiceId(choiceId);
    setIsChoiceDetailDialogOpen(true);
  };

  const handleEditChoice = (choiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedChoiceId(choiceId);
    setIsManageChoiceDialogOpen(true);
  };

  const handleViewReports = (choiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedChoiceId(choiceId);
    setIsChoiceReportsDialogOpen(true);
  };

  const canManage = tripInfo?.userRole === "OWNER" || tripInfo?.userRole === "ADMIN";

  const backgroundStyle = {
    background: `
      radial-gradient(1200px 900px at 20% -10%, rgba(79,124,255,.16), transparent 55%),
      radial-gradient(1200px 900px at 110% 10%, rgba(242,184,75,.10), transparent 50%),
      #0B0F16
    `,
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

  if (error) {
    return (
      <div style={backgroundStyle}>
        <main className={styles.pageContainer}>
          <div className="flex flex-col items-center justify-center min-h-screen gap-3">
            <div className="text-red-400 text-[12px]">{error}</div>
            <button onClick={fetchData} className={styles.secondaryButton}>Retry</button>
          </div>
        </main>
      </div>
    );
  }

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
          <h1 className={styles.pageTitle}>Decisions</h1>
          {canManage && (
            <button
              onClick={() => setIsCreateChoiceDialogOpen(true)}
              className={styles.primaryButton}
            >
              + Add
            </button>
          )}
          <UserAvatarMenu
            displayName={user?.displayName || null}
            photoURL={user?.photoURL || null}
          />
        </header>

        {/* Content */}
        <div className={styles.pageContent}>
          {choices.length === 0 ? (
            <div className={styles.sectionCard}>
              <div className={styles.sectionEmptyState}>
                <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="font-medium text-zinc-300 text-[13px]">No decisions yet</p>
                {canManage && <p className="text-[11px] mt-0.5">Create a decision to gather group preferences</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {choices.map((choice) => (
                <div key={choice.id} className={styles.listItem} onClick={() => handleChoiceClick(choice.id)}>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className={styles.listItemTitle}>{choice.name}</h3>
                      {choice.place && <p className={styles.listItemMeta}>{choice.place}</p>}
                      {choice.datetime && (
                        <p className={styles.listItemMeta}>
                          {new Date(choice.datetime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={styles.listItemBadge(choice.status === "OPEN" ? "open" : "closed")}>{choice.status}</span>
                        <span className="text-[9px] text-zinc-500">{choice._count.selections} chosen</span>
                      </div>
                    </div>
                    {canManage && (
                      <button onClick={(e) => handleEditChoice(choice.id, e)} className={styles.secondaryButton}>Edit</button>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={(e) => { e.stopPropagation(); handleChoiceClick(choice.id); }} className={styles.primaryButton}>Choose</button>
                    <button onClick={(e) => handleViewReports(choice.id, e)} className={styles.secondaryButton}>Results</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dialogs */}
        <CreateChoiceDialog
          isOpen={isCreateChoiceDialogOpen}
          onClose={() => setIsCreateChoiceDialogOpen(false)}
          tripId={tripId}
          onSuccess={() => {
            setIsCreateChoiceDialogOpen(false);
            fetchData();
          }}
        />

        {selectedChoiceId && tripInfo && user && (
          <>
            <ChoiceDetailDialog
              isOpen={isChoiceDetailDialogOpen}
              onClose={() => setIsChoiceDetailDialogOpen(false)}
              choiceId={selectedChoiceId}
              userId={user.uid}
              canManage={canManage}
              onManage={() => {
                setIsChoiceDetailDialogOpen(false);
                setIsManageChoiceDialogOpen(true);
              }}
            />

            <ManageChoiceDialog
              isOpen={isManageChoiceDialogOpen}
              onClose={() => setIsManageChoiceDialogOpen(false)}
              tripId={tripId}
              choiceId={selectedChoiceId}
              tripCurrency={tripInfo.baseCurrency}
              onSuccess={() => {
                setIsManageChoiceDialogOpen(false);
                fetchData();
              }}
            />

            <ChoiceReportsDialog
              isOpen={isChoiceReportsDialogOpen}
              onClose={() => setIsChoiceReportsDialogOpen(false)}
              tripId={tripId}
              choiceId={selectedChoiceId}
              choiceName={choices.find(c => c.id === selectedChoiceId)?.name || ""}
              choiceStatus={choices.find(c => c.id === selectedChoiceId)?.status || "OPEN"}
              onOpenSpend={() => {}}
            />
          </>
        )}
      </main>
    </div>
  );
}
