"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import CreateTransportOfferDialog from "./CreateTransportOfferDialog";
import CreateTransportRequirementDialog from "./CreateTransportRequirementDialog";

interface TransportOffer {
  id: string;
  tripId: string;
  fromLocation: string;
  toLocation: string;
  departureTime: string | null;
  maxPeople: number | null;
  maxGearDescription: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string | null;
    photoURL: string | null;
  };
}

interface TransportRequirement {
  id: string;
  tripId: string;
  fromLocation: string;
  toLocation: string;
  earliestTime: string | null;
  latestTime: string | null;
  peopleCount: number;
  gearDescription: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string | null;
    photoURL: string | null;
  };
}

interface TransportSectionProps {
  tripId: string;
  collapsed: boolean;
  onToggle: () => void;
  isViewer?: boolean;
}

export default function TransportSection({
  tripId,
  collapsed,
  onToggle,
  isViewer = false,
}: TransportSectionProps) {
  const { user } = useAuth();
  const [offers, setOffers] = useState<TransportOffer[]>([]);
  const [requirements, setRequirements] = useState<TransportRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [isRequirementDialogOpen, setIsRequirementDialogOpen] = useState(false);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);
  const [deletingRequirementId, setDeletingRequirementId] = useState<string | null>(null);

  const fetchTransport = useCallback(async () => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/transport`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOffers(data.offers || []);
        setRequirements(data.requirements || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch transport data");
      }
    } catch (err) {
      console.error("Error fetching transport:", err);
      setError("Failed to load transport data");
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => {
    fetchTransport();
  }, [fetchTransport]);

  const handleDeleteOffer = async (offerId: string) => {
    if (!user) return;
    setDeletingOfferId(offerId);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/transport/offers/${offerId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        setOffers((prev) => prev.filter((o) => o.id !== offerId));
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to delete offer");
      }
    } catch (err) {
      console.error("Error deleting offer:", err);
      alert("Failed to delete offer");
    } finally {
      setDeletingOfferId(null);
    }
  };

  const handleDeleteRequirement = async (requirementId: string) => {
    if (!user) return;
    setDeletingRequirementId(requirementId);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/transport/requirements/${requirementId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        setRequirements((prev) => prev.filter((r) => r.id !== requirementId));
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to delete requirement");
      }
    } catch (err) {
      console.error("Error deleting requirement:", err);
      alert("Failed to delete requirement");
    } finally {
      setDeletingRequirementId(null);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatTimeRange = (earliest: string | null, latest: string | null) => {
    if (!earliest && !latest) return null;
    const e = earliest ? formatDateTime(earliest) : "Any";
    const l = latest ? formatDateTime(latest) : "Any";
    if (earliest && latest) return `${e} - ${l}`;
    if (earliest) return `From ${e}`;
    return `Until ${l}`;
  };

  const totalCount = offers.length + requirements.length;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6 md:p-8 mb-6">
      {/* Header row with title and toggle */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Transport / Lift Share
          </h2>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
              {totalCount}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors flex-shrink-0"
          aria-label={collapsed ? "Expand section" : "Collapse section"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            )}
          </svg>
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Action buttons */}
          {!isViewer && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <button
                onClick={() => setIsOfferDialogOpen(true)}
                className="tap-target px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
              >
                Offer a Lift
              </button>
              <button
                onClick={() => setIsRequirementDialogOpen(true)}
                className="tap-target px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
              >
                I Need a Lift
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
              Loading transport data...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500 dark:text-red-400">{error}</div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              <p className="font-medium">No transport offers or needs yet</p>
              <p className="text-sm mt-1">Add a lift offer or request to help coordinate travel</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Offers Column */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Lift Offers ({offers.length})
                </h3>
                {offers.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">No offers yet</p>
                ) : (
                  <div className="space-y-3">
                    {offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-900/10"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {offer.fromLocation} → {offer.toLocation}
                            </p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                              by {offer.createdBy.displayName || "Unknown"}
                            </p>
                          </div>
                          {user?.uid === offer.createdBy.id && !isViewer && (
                            <button
                              onClick={() => handleDeleteOffer(offer.id)}
                              disabled={deletingOfferId === offer.id}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded transition-colors disabled:opacity-50"
                              title="Delete offer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                          {offer.departureTime && (
                            <p>
                              <span className="font-medium">Departs:</span> {formatDateTime(offer.departureTime)}
                            </p>
                          )}
                          {offer.maxPeople && (
                            <p>
                              <span className="font-medium">Seats:</span> ~{offer.maxPeople} people
                            </p>
                          )}
                          {offer.maxGearDescription && (
                            <p>
                              <span className="font-medium">Gear space:</span> {offer.maxGearDescription}
                            </p>
                          )}
                          {offer.notes && (
                            <p className="text-zinc-500 dark:text-zinc-500 italic">{offer.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Requirements Column */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Lift Needed ({requirements.length})
                </h3>
                {requirements.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">No requests yet</p>
                ) : (
                  <div className="space-y-3">
                    {requirements.map((req) => (
                      <div
                        key={req.id}
                        className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50/50 dark:bg-green-900/10"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {req.fromLocation} → {req.toLocation}
                            </p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                              by {req.createdBy.displayName || "Unknown"}
                            </p>
                          </div>
                          {user?.uid === req.createdBy.id && !isViewer && (
                            <button
                              onClick={() => handleDeleteRequirement(req.id)}
                              disabled={deletingRequirementId === req.id}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded transition-colors disabled:opacity-50"
                              title="Delete request"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                          {(req.earliestTime || req.latestTime) && (
                            <p>
                              <span className="font-medium">When:</span>{" "}
                              {formatTimeRange(req.earliestTime, req.latestTime)}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">People:</span> {req.peopleCount}
                          </p>
                          {req.gearDescription && (
                            <p>
                              <span className="font-medium">Gear:</span> {req.gearDescription}
                            </p>
                          )}
                          {req.notes && (
                            <p className="text-zinc-500 dark:text-zinc-500 italic">{req.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <CreateTransportOfferDialog
        isOpen={isOfferDialogOpen}
        onClose={() => setIsOfferDialogOpen(false)}
        tripId={tripId}
        onSuccess={fetchTransport}
      />
      <CreateTransportRequirementDialog
        isOpen={isRequirementDialogOpen}
        onClose={() => setIsRequirementDialogOpen(false)}
        tripId={tripId}
        onSuccess={fetchTransport}
      />
    </div>
  );
}
