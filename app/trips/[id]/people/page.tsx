"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { styles, getAvatarColor, getInitials, UserAvatarMenu } from "@/components/trip-home";
import InviteUsersDialog from "../InviteUsersDialog";

interface Participant {
  id: string;
  role: string;
  rsvpStatus: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    photoURL?: string | null;
  };
}

interface TripInfo {
  id: string;
  name: string;
  rsvpStatus: string;
  userRole: string | null;
  participants: Participant[];
  signInMode?: boolean;
}

export default function PeoplePage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpFilter, setRsvpFilter] = useState<"all" | "PENDING" | "ACCEPTED" | "DECLINED" | "MAYBE">("all");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

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
      setTripInfo({
        id: tripData.trip.id,
        name: tripData.trip.name,
        rsvpStatus: tripData.trip.rsvpStatus || "OPEN",
        userRole: tripData.trip.userRole,
        participants: tripData.trip.participants,
        signInMode: tripData.trip.signInMode,
      });
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load people");
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
  const canInvite = tripInfo?.userRole === "OWNER" || tripInfo?.userRole === "ADMIN";

  const getFilteredParticipants = () => {
    if (!tripInfo?.participants) return [];
    let filtered = tripInfo.participants.filter((p) => p.role !== "VIEWER");
    if (rsvpFilter !== "all") filtered = filtered.filter((p) => p.rsvpStatus === rsvpFilter);
    return filtered;
  };

  const getRsvpBadgeVariant = (status: string): "accepted" | "pending" | "declined" | "open" | "closed" => {
    switch (status) {
      case "ACCEPTED": return "accepted";
      case "DECLINED": return "declined";
      case "PENDING":
      case "MAYBE":
      default: return "pending";
    }
  };

  const getRsvpStatusLabel = (status: string): string => {
    switch (status) {
      case "ACCEPTED": return "Going";
      case "DECLINED": return "Not going";
      case "MAYBE": return "Maybe";
      case "PENDING":
      default: return "Pending";
    }
  };

  const getCounts = () => {
    const participants = tripInfo?.participants.filter((p) => p.role !== "VIEWER") || [];
    return {
      total: participants.length,
      accepted: participants.filter((p) => p.rsvpStatus === "ACCEPTED").length,
      pending: participants.filter((p) => p.rsvpStatus === "PENDING").length,
      declined: participants.filter((p) => p.rsvpStatus === "DECLINED").length,
      maybe: participants.filter((p) => p.rsvpStatus === "MAYBE").length,
    };
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

  const counts = getCounts();
  const filteredParticipants = getFilteredParticipants();

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
          <h1 className={styles.pageTitle}>People</h1>
          {canInvite && <button onClick={() => setIsInviteDialogOpen(true)} className={styles.primaryButton}>+ Invite</button>}
          <UserAvatarMenu
            displayName={user?.displayName || null}
            photoURL={user?.photoURL || null}
          />
        </header>

        {/* Content */}
        <div className={styles.pageContent}>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            <button
              onClick={() => setRsvpFilter("all")}
              className={`${styles.summaryCard} transition-colors ${rsvpFilter === "all" ? "bg-blue-900/40 border-blue-600" : "bg-zinc-800/50 border-zinc-700/50"}`}
            >
              <p className={`${styles.summaryCardValue} text-zinc-100`}>{counts.total}</p>
              <p className={styles.summaryCardLabel}>Total</p>
            </button>
            <button
              onClick={() => setRsvpFilter("ACCEPTED")}
              className={`${styles.summaryCard} transition-colors ${rsvpFilter === "ACCEPTED" ? "bg-emerald-900/40 border-emerald-600" : "bg-zinc-800/50 border-zinc-700/50"}`}
            >
              <p className={`${styles.summaryCardValue} text-emerald-400`}>{counts.accepted}</p>
              <p className={styles.summaryCardLabel}>Going</p>
            </button>
            <button
              onClick={() => setRsvpFilter("PENDING")}
              className={`${styles.summaryCard} transition-colors ${rsvpFilter === "PENDING" ? "bg-amber-900/40 border-amber-600" : "bg-zinc-800/50 border-zinc-700/50"}`}
            >
              <p className={`${styles.summaryCardValue} text-amber-400`}>{counts.pending}</p>
              <p className={styles.summaryCardLabel}>Pending</p>
            </button>
            <button
              onClick={() => setRsvpFilter("DECLINED")}
              className={`${styles.summaryCard} transition-colors ${rsvpFilter === "DECLINED" ? "bg-red-900/40 border-red-600" : "bg-zinc-800/50 border-zinc-700/50"}`}
            >
              <p className={`${styles.summaryCardValue} text-red-400`}>{counts.declined}</p>
              <p className={styles.summaryCardLabel}>No</p>
            </button>
          </div>

          {/* Participant List */}
          {filteredParticipants.length === 0 ? (
            <div className={styles.sectionCard}>
              <div className={styles.sectionEmptyState}>
                <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-medium text-zinc-300 text-[13px]">No people found</p>
                <p className="text-[11px] mt-0.5">{rsvpFilter !== "all" ? "Try a different filter" : "Invite people to your trip"}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredParticipants.map((participant, index) => (
                <div key={participant.id} className={styles.listItem}>
                  <div className="flex items-center gap-2">
                    {/* Avatar */}
                    {participant.user.photoURL ? (
                      <img src={participant.user.photoURL} alt={participant.user.displayName || "User"} className={styles.personAvatarImage} />
                    ) : (
                      <div className={`${styles.personAvatar} ${getAvatarColor(index)}`}>{getInitials(participant.user.displayName)}</div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className={styles.listItemTitle}>
                        {participant.user.displayName || participant.user.email}
                        {participant.user.id === user?.uid && <span className="text-zinc-500 font-normal text-[10px] ml-1">(you)</span>}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={styles.listItemBadge(getRsvpBadgeVariant(participant.rsvpStatus))}>{getRsvpStatusLabel(participant.rsvpStatus)}</span>
                        {participant.role === "OWNER" && <span className="text-[9px] text-zinc-500">Organizer</span>}
                        {participant.role === "ADMIN" && <span className="text-[9px] text-zinc-500">Admin</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Dialog */}
        <InviteUsersDialog
          tripId={tripInfo.id}
          tripName={tripInfo.name}
          isOpen={isInviteDialogOpen}
          onClose={() => setIsInviteDialogOpen(false)}
          onSuccess={() => { setIsInviteDialogOpen(false); fetchData(); }}
          currentMembers={tripInfo.participants}
          signInMode={tripInfo.signInMode}
        />
      </main>
    </div>
  );
}
