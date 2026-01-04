"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { styles, UserAvatarMenu } from "@/components/trip-home";
import { TripListsPanel } from "@/components/lists/TripListsPanel";
import { ListWorkflowModal } from "@/components/lists/ListWorkflowModal";
import { AddListDialog } from "@/components/lists/AddListDialog";

interface TripInfo {
  id: string;
  name: string;
  userRole: string | null;
}

export default function TasksPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isListWorkflowModalOpen, setIsListWorkflowModalOpen] = useState(false);
  const [listWorkflowListTitle, setListWorkflowListTitle] = useState("");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listsRefreshKey, setListsRefreshKey] = useState(0);
  const [isAddListDialogOpen, setIsAddListDialogOpen] = useState(false);

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
      setTripInfo({ id: tripData.trip.id, name: tripData.trip.name, userRole: tripData.trip.userRole });
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load tasks");
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
  const canManage = tripInfo?.userRole === "OWNER" || tripInfo?.userRole === "ADMIN";

  const handleOpenListWorkflow = (listId: string, listTitle: string) => {
    setSelectedListId(listId);
    setListWorkflowListTitle(listTitle);
    setIsListWorkflowModalOpen(true);
  };

  const handleListWorkflowClose = () => {
    setIsListWorkflowModalOpen(false);
    setSelectedListId(null);
    setListWorkflowListTitle("");
    setListsRefreshKey((k) => k + 1);
  };

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

  if (error || !tripInfo) {
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
          <h1 className={styles.pageTitle}>Tasks</h1>
          {canManage && <button onClick={() => setIsAddListDialogOpen(true)} className={styles.primaryButton}>+ Add</button>}
          <UserAvatarMenu
            displayName={user?.displayName || null}
            photoURL={user?.photoURL || null}
          />
        </header>

        {/* Content */}
        <div className={styles.pageContent}>
          <div>
            <TripListsPanel
              key={listsRefreshKey}
              tripId={tripId}
              listTypeFilter="TODO"
              onOpenList={handleOpenListWorkflow}
              onListsLoaded={() => {}}
            />
          </div>
        </div>

        {/* List Workflow Modal */}
        {selectedListId && (
          <ListWorkflowModal
            isOpen={isListWorkflowModalOpen}
            onClose={handleListWorkflowClose}
            tripId={tripId}
            tripName={tripInfo.name}
            selectedListId={selectedListId}
            listTitle={listWorkflowListTitle}
            selectedListType="TODO"
          />
        )}

        {/* Add List Dialog */}
        <AddListDialog
          isOpen={isAddListDialogOpen}
          onClose={() => setIsAddListDialogOpen(false)}
          tripId={tripId}
          listTypeFilter="TODO"
          onSuccess={() => { setIsAddListDialogOpen(false); setListsRefreshKey((k) => k + 1); }}
        />
      </main>
    </div>
  );
}
