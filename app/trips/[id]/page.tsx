"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { SpendStatus, UserRole } from "@/lib/generated/prisma";
import { useTripPasswordStore } from "@/lib/stores/tripPasswordStore";
import Header from "@/components/Header";
import TripPasswordLogin from "@/components/TripPasswordLogin";
import { JoinTripDialog } from "@/components/JoinTripDialog";
import EditTripDialog from "./EditTripDialog";
import InviteUsersDialog from "./InviteUsersDialog";
import AddSpendDialog from "./AddSpendDialog";
import EditSpendDialog from "./EditSpendDialog";
import ViewSpendDialog from "./ViewSpendDialog";
import AssignSpendDialog from "./AssignSpendDialog";
import SelfAssignDialog from "./SelfAssignDialog";
import SplitRemainderDialog from "./SplitRemainderDialog";
import EditAssignmentDialog from "./EditAssignmentDialog";
import EditItemAssignmentDialog from "./EditItemAssignmentDialog";
import BalancesDialog from "./BalancesDialog";
import ItemsDialog from "./ItemsDialog";
import CreateChoiceDialog from "./CreateChoiceDialog";
import ChoiceDetailDialog from "./ChoiceDetailDialog";
import ManageChoiceDialog from "./ManageChoiceDialog";
import ChoiceReportsDialog from "./ChoiceReportsDialog";
import { SpendListView } from "@/components/SpendListView";
import { SpendFilters } from "@/components/SpendFilters";
import SettlementPlanSection from "@/components/SettlementPlanSection";
import { TripListsPanel } from "@/components/lists/TripListsPanel";
import { ListWorkflowModal } from "@/components/lists/ListWorkflowModal";
import { AddListDialog } from "@/components/lists/AddListDialog";
import TransportSection from "./TransportSection";
import AddMilestoneDialog from "./AddMilestoneDialog";

interface TripDetail {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  spendStatus: SpendStatus;
  rsvpStatus: string;
  headerImageData?: string | null;
  createdAt: string;
  organizer: {
    id: string;
    email: string;
    displayName: string | null;
  };
  participants: Array<{
    id: string;
    role: string;
    rsvpStatus: string;
    joinedAt: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
  userRole: string | null;
  userRsvpStatus: string | null;
  timeline?: Array<{
    id: string;
    title: string;
    description: string | null;
    date: string | null;
    isCompleted: boolean;
    completedAt: string | null;
    triggerType: string | null;
    order: number;
  }>;
  spends?: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    fxRate: number;
    normalizedAmount: number;
    date: string;
    status: SpendStatus;
    notes: string | null;
    paidBy: {
      id: string;
      email: string;
      displayName: string | null;
    };
    category: {
      id: string;
      name: string;
    } | null;
    assignedPercentage?: number;
    assignments?: Array<{
      id: string;
      userId: string;
      shareAmount: number;
      normalizedShareAmount: number;
      user: {
        id: string;
        email: string;
        displayName: string | null;
      };
    }>;
  }>;
  userAssignments?: Array<{
    id: string;
    userId: string;
    shareAmount: number;
    normalizedShareAmount: number;
    splitType: string;
  }>;
  totalSpent?: number;
  userOwes?: number;
  userIsOwed?: number;
  totalUnassigned?: number;
  signInMode?: boolean;
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { clearTripPassword } = useTripPasswordStore();
  const isViewer = userProfile?.role === UserRole.VIEWER;
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Public trip info (fetched before login for display)
  const [publicTripInfo, setPublicTripInfo] = useState<{
    tripName: string;
    signUpEnabled: boolean;
    signInEnabled: boolean;
    passwordRequired: boolean;
    participants: Array<{
      id: string;
      role: string;
      user: {
        id: string;
        email: string;
        displayName: string | null;
        userType: "FULL" | "SIGNUP" | "SYSTEM";
        emailHint: string | null;
      };
    }>;
  } | null>(null);

  // State to track if we should show sign-up dialog after password entry
  const [showSignUpAfterPassword, setShowSignUpAfterPassword] = useState(false);

  // Join trip dialog state (for participating in the trip)
  const [isJoinTripDialogOpen, setIsJoinTripDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isAddSpendDialogOpen, setIsAddSpendDialogOpen] = useState(false);
  const [isViewSpendDialogOpen, setIsViewSpendDialogOpen] = useState(false);
  const [isEditSpendDialogOpen, setIsEditSpendDialogOpen] = useState(false);
  const [isAssignSpendDialogOpen, setIsAssignSpendDialogOpen] = useState(false);
  const [isSelfAssignDialogOpen, setIsSelfAssignDialogOpen] = useState(false);
  const [isSplitRemainderDialogOpen, setIsSplitRemainderDialogOpen] = useState(false);
  const [isEditAssignmentDialogOpen, setIsEditAssignmentDialogOpen] = useState(false);
  const [isEditItemAssignmentDialogOpen, setIsEditItemAssignmentDialogOpen] = useState(false);
  const [isBalancesDialogOpen, setIsBalancesDialogOpen] = useState(false);
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [selectedSpendId, setSelectedSpendId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [loadingAssignmentId, setLoadingAssignmentId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [isDeletingSpend, setIsDeletingSpend] = useState(false);
  const [editingTimelineItemId, setEditingTimelineItemId] = useState<string | null>(null);
  const [editingTimelineDate, setEditingTimelineDate] = useState<string>("");
  const [deletingTimelineItemId, setDeletingTimelineItemId] = useState<string | null>(null);
  const [togglingTimelineItemId, setTogglingTimelineItemId] = useState<string | null>(null);
  const [isRsvpResponding, setIsRsvpResponding] = useState<"ACCEPTED" | "DECLINED" | "MAYBE" | null>(null);
  const [isTogglingRsvpStatus, setIsTogglingRsvpStatus] = useState(false);
  const [isTogglingSpendStatus, setIsTogglingSpendStatus] = useState(false);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  // Choices state
  const [choices, setChoices] = useState<any[]>([]);
  const [isCreateChoiceDialogOpen, setIsCreateChoiceDialogOpen] = useState(false);
  const [isChoiceDetailDialogOpen, setIsChoiceDetailDialogOpen] = useState(false);
  const [isManageChoiceDialogOpen, setIsManageChoiceDialogOpen] = useState(false);
  const [isChoiceReportsDialogOpen, setIsChoiceReportsDialogOpen] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [manageChoiceInitialTab, setManageChoiceInitialTab] = useState<"details" | "items">("details");
  const [createChoiceInitialName, setCreateChoiceInitialName] = useState("");

  // List workflow modal state
  const [isListWorkflowModalOpen, setIsListWorkflowModalOpen] = useState(false);
  const [listWorkflowTitle, setListWorkflowTitle] = useState("");
  const [listWorkflowDescription, setListWorkflowDescription] = useState("");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listsRefreshKey, setListsRefreshKey] = useState(0);
  const [checklistsCount, setChecklistsCount] = useState<number | null>(null); // null = not yet loaded
  const [kitListsCount, setKitListsCount] = useState<number | null>(null); // null = not yet loaded
  const [isAddChecklistDialogOpen, setIsAddChecklistDialogOpen] = useState(false);
  const [isAddKitListDialogOpen, setIsAddKitListDialogOpen] = useState(false);
  const [checklistIds, setChecklistIds] = useState<string[]>([]);
  const [checklistSourceTemplateIds, setChecklistSourceTemplateIds] = useState<string[]>([]);
  const [kitListIds, setKitListIds] = useState<string[]>([]);
  const [kitListSourceTemplateIds, setKitListSourceTemplateIds] = useState<string[]>([]);

  // Toggle state for showing spends when spending is closed
  const [costsTab, setCostsTab] = useState<"spends" | "settlement">("spends");

  // Spend filtering and sorting state
  const [statusFilter, setStatusFilter] = useState<SpendStatus | "all">("all");
  const [involvementFilter, setInvolvementFilter] = useState<"all" | "own" | "involved" | "not-involved">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "description">("description");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Member filtering state - default to 'ACCEPTED' when RSVP is closed, 'all' when open
  const [memberRsvpFilter, setMemberRsvpFilter] = useState<"all" | "PENDING" | "ACCEPTED" | "DECLINED" | "MAYBE">("all");

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState<{
    rsvp: boolean;
    balance: boolean;
    choices: boolean;
    costs: boolean;
    members: boolean;
    timeline: boolean;
    checklists: boolean;
    kitLists: boolean;
    transport: boolean;
  }>({
    rsvp: false,
    balance: false,
    choices: false,
    costs: false,
    members: false,
    timeline: false,
    checklists: false,
    kitLists: false,
    transport: false,
  });

  // Filters collapse state
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Track if we've set the initial RSVP collapse state
  const hasInitializedRsvpCollapse = useRef(false);

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const expandAllSections = () => {
    setCollapsedSections({
      rsvp: false,
      balance: false,
      choices: false,
      costs: false,
      members: false,
      timeline: false,
      checklists: false,
      kitLists: false,
      transport: false,
    });
  };

  const collapseAllSections = () => {
    setCollapsedSections({
      rsvp: true,
      balance: true,
      choices: true,
      costs: true,
      members: true,
      timeline: true,
      checklists: true,
      kitLists: true,
      transport: true,
    });
  };

  const tripId = params.id as string;

  // Fetch public trip info (for login screen display)
  const fetchPublicInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/public`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPublicTripInfo({
          tripName: data.tripName,
          signUpEnabled: data.signUpEnabled,
          signInEnabled: data.signInEnabled,
          passwordRequired: data.passwordRequired,
          participants: data.participants || [],
        });
      }
    } catch (err) {
      console.error("Error fetching public trip info:", err);
    }
  }, [tripId]);

  // Fetch public info on mount and when user changes
  useEffect(() => {
    fetchPublicInfo();
  }, [fetchPublicInfo, user]);

  // Open join dialog after password entry if sign-up was requested
  useEffect(() => {
    if (showSignUpAfterPassword && user && !authLoading) {
      setIsJoinTripDialogOpen(true);
      setShowSignUpAfterPassword(false);
    }
  }, [showSignUpAfterPassword, user, authLoading]);

  // Set default filter to "all" regardless of RSVP status
  useEffect(() => {
    if (trip) {
      setMemberRsvpFilter("all");
    }
  }, [trip?.rsvpStatus]);

  // Auto-collapse RSVP section if user has accepted or RSVP is closed (only on initial load)
  useEffect(() => {
    if (trip && !hasInitializedRsvpCollapse.current) {
      const shouldCollapseRsvp =
        trip.userRsvpStatus === "ACCEPTED" ||
        trip.userRsvpStatus === "DECLINED" ||
        trip.userRsvpStatus === "MAYBE" ||
        trip.rsvpStatus === "CLOSED";

      setCollapsedSections(prev => ({
        ...prev,
        rsvp: shouldCollapseRsvp,
      }));

      hasInitializedRsvpCollapse.current = true;
    }
  }, [trip]);

  const fetchChoices = useCallback(async () => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/choices`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChoices(data || []);
      }
    } catch (err) {
      console.error("Error fetching choices:", err);
    }
  }, [user, tripId]);

  const fetchTrip = useCallback(async () => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("API Error:", response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch trip (${response.status})`);
      }

      const data = await response.json();
      console.log("Trip data received:", data);

      // Calculate total unassigned spend
      const tripData = data.trip;
      if (tripData.spends && tripData.spends.length > 0) {
        const totalUnassigned = tripData.spends.reduce((sum: number, spend: any) => {
          const assignedPercentage = spend.assignedPercentage || 0;
          const unassignedPercentage = 100 - assignedPercentage;
          const unassignedAmount = (spend.normalizedAmount * unassignedPercentage) / 100;
          return sum + unassignedAmount;
        }, 0);
        tripData.totalUnassigned = totalUnassigned;
      } else {
        tripData.totalUnassigned = 0;
      }

      // Sort timeline items by date in ascending order
      if (tripData.timeline && tripData.timeline.length > 0) {
        tripData.timeline.sort((a: any, b: any) => {
          // Items with no date go to the end
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;

          // Compare dates in ascending order
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
      }

      setTrip(tripData);

      // Set initial costs tab based on spend status
      if (tripData.spendStatus === SpendStatus.CLOSED) {
        setCostsTab("settlement");
      }
    } catch (err) {
      console.error("Error fetching trip:", err);
      setError(err instanceof Error ? err.message : "Failed to load trip. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTrip();
      fetchChoices();
    }
    // Don't redirect - show password login for unauthenticated users
  }, [user, authLoading, fetchTrip, fetchChoices]);

  // Show loading if auth is loading OR if we have a user but no trip yet (and no error)
  if (authLoading || (user && !trip && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading trip...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return (
      <TripPasswordLogin
        tripId={tripId}
        tripName={publicTripInfo?.tripName}
        onFullAccountLogin={() => {
          // Redirect to main login with return URL
          router.push(`/?returnTo=/trips/${tripId}`);
        }}
        onSignUp={() => {
          // This will open the join dialog after user logs in as viewer
          setShowSignUpAfterPassword(true);
        }}
      />
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <a
            href="/trips"
            className="tap-target inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Trips
          </a>
        </div>
      </div>
    );
  }

  // Show trip not found (only if we have a user, no error, and no trip)
  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Trip not found</p>
          <a
            href="/trips"
            className="tap-target inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Trips
          </a>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Helper function to calculate unassigned spend
  const calculateUnassignedSpend = (tripData: TripDetail): number => {
    if (!tripData.spends || tripData.spends.length === 0) {
      return 0;
    }
    return tripData.spends.reduce((sum, spend) => {
      const assignedPercentage = spend.assignedPercentage || 0;
      const unassignedPercentage = 100 - assignedPercentage;
      const unassignedAmount = (spend.normalizedAmount * unassignedPercentage) / 100;
      return sum + unassignedAmount;
    }, 0);
  };

  // Calculate unassigned spend if not already calculated
  if (trip && trip.totalUnassigned === undefined) {
    trip.totalUnassigned = calculateUnassignedSpend(trip);
  }

  const handleEditSuccess = () => {
    // Refetch the trip data after successful edit
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    fetchTrip();
  };

  const handleInviteSuccess = () => {
    // Refetch the trip data after successful invitations
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    fetchTrip();
  };

  const handleAddSpendSuccess = (spendId: string) => {
    // Refetch the trip data after successful spend creation
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);

          // Close the Add Spend dialog
          setIsAddSpendDialogOpen(false);

          // Open the View Spend dialog with the newly created spend
          setSelectedSpendId(spendId);
          setIsViewSpendDialogOpen(true);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    fetchTrip();
  };

  const handleAssignSpendSuccess = () => {
    // Refetch the trip data after successful assignment update
    // Keep the current dialog states (ViewSpendDialog remains open)
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    fetchTrip();
  };

  const handleAddSpendWithPeople = async (spendId: string) => {
    // Refetch the trip data to get the newly created spend
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);

          // Open the assign dialog with the newly created spend
          setSelectedSpendId(spendId);
          setIsAssignSpendDialogOpen(true);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    await fetchTrip();
  };

  // Filter and sort spends
  const getFilteredAndSortedSpends = () => {
    if (!trip?.spends) return [];

    let filteredSpends = [...trip.spends];

    // Apply status filter
    if (statusFilter !== "all") {
      filteredSpends = filteredSpends.filter((spend) => spend.status === statusFilter);
    }

    // Apply involvement filter
    if (involvementFilter !== "all" && user) {
      filteredSpends = filteredSpends.filter((spend) => {
        const isOwner = spend.paidBy.id === user.uid;
        const isInvolved = spend.assignments?.some((assignment) => assignment.userId === user.uid) || false;

        switch (involvementFilter) {
          case "own":
            return isOwner;
          case "involved":
            return isInvolved;
          case "not-involved":
            return !isOwner && !isInvolved;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filteredSpends.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          comparison = a.normalizedAmount - b.normalizedAmount;
          break;
        case "description":
          comparison = a.description.localeCompare(b.description);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filteredSpends;
  };

  // Spend action handlers
  const handleViewSpend = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsViewSpendDialogOpen(true);
  };

  const handleEditSpend = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsEditSpendDialogOpen(true);
  };

  const handleAssignSpend = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsAssignSpendDialogOpen(true);
  };

  const handleSelfAssignSpend = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsSelfAssignDialogOpen(true);
  };

  const handleSplitRemainderSpend = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsSplitRemainderDialogOpen(true);
  };

  const handleClearAssignments = async (spendId: string) => {
    if (!user || !trip) return;

    const spend = trip.spends?.find((s) => s.id === spendId);
    if (!spend || !spend.assignments || spend.assignments.length === 0) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear all assignment amounts? The people will remain on the spend but their amounts will be set to zero."
    );
    if (!confirmed) return;

    try {
      const idToken = await user.getIdToken();

      // Set all existing assignments to zero
      const zeroedAssignments = spend.assignments.map((a) => ({
        userId: a.userId,
        shareAmount: 0,
        normalizedShareAmount: 0,
        splitType: "AMOUNT" as const,
      }));

      const response = await fetch(`/api/spends/${spendId}/assignments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignments: zeroedAssignments,
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to clear assignments");
      }

      // Refresh trip data
      await fetchTrip();
    } catch (err) {
      console.error("Error clearing assignments:", err);
      alert(err instanceof Error ? err.message : "Failed to clear assignments");
    }
  };

  const handleEditAssignment = async (assignmentId: string) => {
    if (!user) return;

    setSelectedAssignmentId(assignmentId);
    setLoadingAssignmentId(assignmentId);

    // Find the spend for this assignment
    let spend: any = null;
    for (const s of trip?.spends || []) {
      if (s.assignments?.some(a => a.id === assignmentId)) {
        spend = s;
        break;
      }
    }

    if (!spend) {
      setLoadingAssignmentId(null);
      setIsEditAssignmentDialogOpen(true);
      return;
    }

    // Check if spend has items
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/spends/${spend.id}/items`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const hasItems = data.items && data.items.length > 0;

        if (hasItems) {
          setIsEditItemAssignmentDialogOpen(true);
        } else {
          setIsEditAssignmentDialogOpen(true);
        }
      } else {
        // Default to regular assignment dialog on error
        setIsEditAssignmentDialogOpen(true);
      }
    } catch (err) {
      console.error("Error checking for items:", err);
      // Default to regular assignment dialog on error
      setIsEditAssignmentDialogOpen(true);
    } finally {
      setLoadingAssignmentId(null);
    }
  };

  const handleViewItems = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsItemsDialogOpen(true);
  };

  const handleEditAssignmentSubmit = async (amount: number) => {
    if (!user || !trip || !selectedAssignmentId) return;

    try {
      const idToken = await user.getIdToken();

      // Find the assignment and its spend
      let assignment: any = null;
      let spend: any = null;

      for (const s of trip.spends || []) {
        const found = s.assignments?.find(a => a.id === selectedAssignmentId);
        if (found) {
          assignment = found;
          spend = s;
          break;
        }
      }

      if (!assignment || !spend) {
        throw new Error("Assignment not found");
      }

      // Calculate normalized amount
      const normalizedAmount = amount * spend.fxRate;

      // Update the assignment via API
      const response = await fetch(`/api/spends/${spend.id}/assignments/${selectedAssignmentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          shareAmount: amount,
          normalizedShareAmount: normalizedAmount,
          splitType: "EXACT",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update assignment");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }

      setIsEditAssignmentDialogOpen(false);
    } catch (err) {
      console.error("Error updating assignment:", err);
      throw err;
    }
  };

  const handleEditItemAssignmentSubmit = async (selectedItemIds: string[], customAmount?: number) => {
    if (!user || !trip || !selectedAssignmentId) return;

    try {
      const idToken = await user.getIdToken();

      // Find the assignment and its spend
      let assignment: any = null;
      let spend: any = null;

      for (const s of trip.spends || []) {
        const found = s.assignments?.find(a => a.id === selectedAssignmentId);
        if (found) {
          assignment = found;
          spend = s;
          break;
        }
      }

      if (!assignment || !spend) {
        throw new Error("Assignment not found");
      }

      // Use custom amount if provided, otherwise calculate from items
      let totalAmount: number;
      if (customAmount !== undefined) {
        totalAmount = customAmount;
      } else {
        // Fetch items to calculate total
        const itemsResponse = await fetch(`/api/spends/${spend.id}/items`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!itemsResponse.ok) {
          throw new Error("Failed to fetch items");
        }

        const itemsData = await itemsResponse.json();
        const items = itemsData.items || [];

        // Calculate the total amount from selected items
        totalAmount = items
          .filter((item: any) => selectedItemIds.includes(item.id))
          .reduce((sum: number, item: any) => sum + item.cost, 0);
      }

      // Calculate normalized amount
      const normalizedAmount = totalAmount * spend.fxRate;

      // Update the assignment via API
      const response = await fetch(`/api/spends/${spend.id}/assignments/${selectedAssignmentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          shareAmount: totalAmount,
          normalizedShareAmount: normalizedAmount,
          splitType: "EXACT",
          itemIds: selectedItemIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update assignment");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }

      setIsEditItemAssignmentDialogOpen(false);
    } catch (err) {
      console.error("Error updating item assignment:", err);
      throw err;
    }
  };

  const handleRemoveAssignment = async () => {
    if (!user || !trip || !selectedAssignmentId) return;

    try {
      const idToken = await user.getIdToken();

      // Find the assignment's spend
      let spend: any = null;
      for (const s of trip.spends || []) {
        if (s.assignments?.some(a => a.id === selectedAssignmentId)) {
          spend = s;
          break;
        }
      }

      if (!spend) {
        throw new Error("Spend not found for assignment");
      }

      // Delete the assignment via API
      const response = await fetch(`/api/spends/${spend.id}/assignments/${selectedAssignmentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to remove assignment");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }

      setIsEditAssignmentDialogOpen(false);
      setIsEditItemAssignmentDialogOpen(false);
    } catch (err) {
      console.error("Error removing assignment:", err);
      throw err;
    }
  };

  const handleSelfAssignSubmit = async (amount: number) => {
    if (!user || !trip || !selectedSpendId) return;

    try {
      const idToken = await user.getIdToken();
      const spend = trip.spends?.find((s) => s.id === selectedSpendId);

      if (!spend) return;

      // Calculate normalized amount (convert to base currency)
      const normalizedAmount = amount * spend.fxRate;

      // Get ALL assignments from the spend including shareAmount data
      // We need to fetch the full spend data with assignment details
      const spendResponse = await fetch(`/api/spends/${selectedSpendId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!spendResponse.ok) {
        throw new Error("Failed to fetch spend details");
      }

      const spendData = await spendResponse.json();
      const fullAssignments = spendData.spend?.assignments || [];

      // Create new assignments array, preserving others and updating current user
      const newAssignments = fullAssignments
        .filter((a: any) => a.userId !== user.uid)
        .map((a: any) => ({
          userId: a.userId,
          shareAmount: a.shareAmount,
          normalizedShareAmount: a.normalizedShareAmount,
          splitType: a.splitType,
        }));

      // Add/update current user's assignment
      newAssignments.push({
        userId: user.uid,
        shareAmount: amount,
        normalizedShareAmount: normalizedAmount,
        splitType: "EXACT" as const,
      });

      const response = await fetch(`/api/spends/${selectedSpendId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assignments: newAssignments,
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to assign amount");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }

      setIsSelfAssignDialogOpen(false);
    } catch (err) {
      console.error("Error assigning amount:", err);
      throw err; // Re-throw so the dialog can handle it
    }
  };

  const handleSplitRemainderSubmit = async (assignments: any[]) => {
    if (!user || !trip || !selectedSpendId) return;

    try {
      const idToken = await user.getIdToken();

      // Submit the new assignments
      const response = await fetch(`/api/spends/${selectedSpendId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assignments: assignments.map(a => ({
            userId: a.userId,
            shareAmount: a.shareAmount,
            normalizedShareAmount: a.normalizedShareAmount,
            splitType: "EXACT" as const,
          })),
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to split remainder");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }

      setIsSplitRemainderDialogOpen(false);
    } catch (err) {
      console.error("Error splitting remainder:", err);
      throw err; // Re-throw so the dialog can handle it
    }
  };

  const handleJoinSpend = async (spendId: string) => {
    if (!user || !trip) return;

    try {
      const idToken = await user.getIdToken();
      const spend = trip.spends?.find((s) => s.id === spendId);

      if (!spend) return;

      // Get existing assignments
      const existingAssignments = spend.assignments || [];

      // Check if user is already involved
      if (existingAssignments.some(a => a.userId === user.uid)) {
        alert("You are already involved in this spend");
        return;
      }

      // Add current user to the assignments
      const newAssignments = [
        ...existingAssignments.map(a => ({
          userId: a.userId,
          shareAmount: 0,
          normalizedShareAmount: 0,
          splitType: "EQUAL" as const,
        })),
        {
          userId: user.uid,
          shareAmount: 0,
          normalizedShareAmount: 0,
          splitType: "EQUAL" as const,
        }
      ];

      const response = await fetch(`/api/spends/${spendId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assignments: newAssignments,
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to join spend");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }
    } catch (err) {
      console.error("Error joining spend:", err);
      alert(err instanceof Error ? err.message : "Failed to join spend");
    }
  };

  const handleLeaveSpend = async (spendId: string) => {
    if (!user || !trip) return;

    try {
      const idToken = await user.getIdToken();
      const spend = trip.spends?.find((s) => s.id === spendId);

      if (!spend) return;

      // Get existing assignments
      const existingAssignments = spend.assignments || [];

      // Check if user is the spender
      if (spend.paidBy.id === user.uid) {
        alert("You cannot leave a spend you created. Delete it instead.");
        return;
      }

      // Check if user is involved
      if (!existingAssignments.some(a => a.userId === user.uid)) {
        alert("You are not involved in this spend");
        return;
      }

      // Remove current user from the assignments
      const newAssignments = existingAssignments
        .filter(a => a.userId !== user.uid)
        .map(a => ({
          userId: a.userId,
          shareAmount: 0,
          normalizedShareAmount: 0,
          splitType: "EQUAL" as const,
        }));

      const response = await fetch(`/api/spends/${spendId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assignments: newAssignments,
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to leave spend");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }
    } catch (err) {
      console.error("Error leaving spend:", err);
      alert(err instanceof Error ? err.message : "Failed to leave spend");
    }
  };

  const handleFinalizeSpend = async (spendId: string) => {
    if (!user || !trip) return;

    try {
      const idToken = await user.getIdToken();
      const spend = trip.spends?.find((s) => s.id === spendId);

      if (!spend) return;

      // If already closed, reopen it using the reopen endpoint
      if (spend.status === "CLOSED") {
        
        const response = await fetch(`/api/spends/${spendId}/reopen`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          // Refetch trip data
          const tripResponse = await fetch(`/api/trips/${tripId}`, {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (tripResponse.ok) {
            const data = await tripResponse.json();
            setTrip(data.trip);
          }
        } else {
          alert("Failed to reopen spend");
        }
      } else {
        // Check if assignments are 100% before closing
        const assignedPercentage = spend.assignedPercentage || 0;
        const isFullyAssigned = Math.abs(assignedPercentage - 100) < 0.1;

        if (!isFullyAssigned) {
          const shouldForce = confirm(
            `This spend is only ${assignedPercentage.toFixed(1)}% assigned. ` +
            `Close anyway?`
          );
          if (!shouldForce) return;
        } 

        // Close the spend
        const response = await fetch(`/api/spends/${spendId}/finalize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ force: !isFullyAssigned }),
        });

        if (response.ok) {
          // Refetch trip data
          const tripResponse = await fetch(`/api/trips/${tripId}`, {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (tripResponse.ok) {
            const data = await tripResponse.json();
            setTrip(data.trip);
          }
        } else {
          const errorData = await response.json();
          alert(`Failed to close spend: ${errorData.error}`);
        }
      }
    } catch (err) {
      console.error("Error closing/reopening spend:", err);
      alert("Failed to close/reopen spend");
    }
  };

  const handleDeleteSpend = async (spendId: string) => {
    if (!user) return;

    const confirmed = window.confirm("Are you sure you want to delete this spend?");
    if (!confirmed) return;

    setIsDeletingSpend(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/spends/${spendId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        // Close the view dialog after successful deletion
        setIsViewSpendDialogOpen(false);
        setSelectedSpendId(null);

        // Refetch trip data
        const tripResponse = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (tripResponse.ok) {
          const data = await tripResponse.json();
          setTrip(data.trip);
        }
      } else {
        alert("Failed to delete spend");
      }
    } catch (err) {
      console.error("Error deleting spend:", err);
      alert("Failed to delete spend");
    } finally {
      setIsDeletingSpend(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${userName} from this trip?`
    );

    if (!confirmed) return;

    setRemovingUserId(userId);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/trips/${tripId}/members/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Failed to remove member (${response.status})`
        );
      }

      // Success - refresh the trip data
      handleInviteSuccess();
    } catch (err) {
      console.error("Error removing member:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove member. Please try again."
      );
    } finally {
      setRemovingUserId(null);
    }
  };

  const isOwner = trip?.userRole === "OWNER";
  const isGlobalAdmin = userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.SUPERADMIN;
  const canInvite = isOwner || isGlobalAdmin;

  // Get filtered participants based on RSVP status
  const getFilteredParticipants = () => {
    if (!trip?.participants) return [];

    // Always exclude viewer accounts (used for sign-up mode access)
    const nonViewerParticipants = trip.participants.filter((p) => p.role !== "VIEWER");

    // Filter by selected RSVP status
    if (memberRsvpFilter !== "all") {
      return nonViewerParticipants.filter((p) => p.rsvpStatus === memberRsvpFilter);
    }

    return nonViewerParticipants;
  };

  // Check if current user can finalize (close/reopen) a specific spend
  const canUserFinalizeSpend = (spend: { paidBy: { id: string } }) => {
    if (!user || isViewer) return false;

    // User can finalize if they are:
    // 1. The spender (person who paid for the spend)
    // 2. The trip organizer (OWNER or ADMIN role)
    const isSpender = spend.paidBy.id === user.uid;
    const isOrganizer = canInvite;

    return isSpender || isOrganizer;
  };

  // Check if current user can delete a specific spend
  const canUserDeleteSpend = (spend: { paidBy: { id: string } }) => {
    if (!user || isViewer) return false;

    // User can delete if they are:
    // 1. The spender (person who paid for the spend)
    // 2. The trip organizer (OWNER or ADMIN role)
    const isSpender = spend.paidBy.id === user.uid;
    const isOrganizer = canInvite;

    return isSpender || isOrganizer;
  };

  const handleToggleTripSpendStatus = async (confirmClearSettlements = false) => {
    if (!user || !trip) return;

    // Default to OPEN if spendStatus is undefined (for backwards compatibility)
    const currentStatus = trip.spendStatus || SpendStatus.OPEN;
    const isClosing = currentStatus === SpendStatus.OPEN;

    // Check if trying to close with unassigned spend
    if (isClosing && (trip.totalUnassigned || 0) > 0.01) {
      const unassignedAmount = trip.totalUnassigned || 0;
      const shouldProceed = window.confirm(
        `⚠️ WARNING: You have ${trip.baseCurrency} ${unassignedAmount.toFixed(2)} in unassigned spend.\n\n` +
        `You can close spending but not everything gets paid.\n\n` +
        `Do you want to close spending anyway?`
      );
      if (!shouldProceed) {
        return; // User cancelled, so exit without closing spending
      }
    }

    console.log("Toggle spend status:", { currentStatus, isClosing, tripSpendStatus: trip.spendStatus, confirmClearSettlements });

    setIsTogglingSpendStatus(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/spend-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmClearSettlements,
        }),
      });

      const data = await response.json();

      // Check if confirmation is required
      if (data.requiresConfirmation && !confirmClearSettlements) {
        setIsTogglingSpendStatus(false);
        const confirmed = window.confirm(
          `⚠️ WARNING: ${data.message}\n\nThis action cannot be undone. All payment records will be permanently deleted.`
        );

        if (confirmed) {
          // Retry with confirmation
          await handleToggleTripSpendStatus(true);
        }
        return;
      }

      if (data.success) {
        // Refetch trip data
        const tripResponse = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (tripResponse.ok) {
          const tripData = await tripResponse.json();
          setTrip(tripData.trip);

          // Switch to appropriate tab based on new status
          setCostsTab(isClosing ? "settlement" : "spends");

          // Show success message
          if (data.message) {
            alert(data.message);
          }
        } else {
          alert("Failed to refresh trip data after status change");
        }
      } else {
        alert(`Failed to ${isClosing ? "close" : "open"} spending: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error toggling trip spend status:", err);
      alert(`Failed to toggle spending status: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTogglingSpendStatus(false);
    }
  };

  const handleRsvpResponse = async (status: "ACCEPTED" | "DECLINED" | "MAYBE") => {
    if (!user) return;

    setIsRsvpResponding(status);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/members/${user.uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ rsvpStatus: status }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to update RSVP (${response.status})`);
      }

      // Success - refresh the trip data
      handleEditSuccess();
    } catch (err) {
      console.error("Error updating RSVP:", err);
      setError(err instanceof Error ? err.message : "Failed to update RSVP. Please try again.");
    } finally {
      setIsRsvpResponding(null);
    }
  };

  const handleToggleRsvpStatus = async () => {
    if (!user || !trip) return;

    const currentStatus = trip.rsvpStatus || "OPEN";
    const isClosing = currentStatus === "OPEN";

    console.log("Current RSVP status:", currentStatus, "isClosing:", isClosing);

    setIsTogglingRsvpStatus(true);
    try {
      const idToken = await user.getIdToken();
      console.log("Sending request to toggle RSVP status");

      const response = await fetch(`/api/trips/${tripId}/rsvp-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // Send empty body to trigger toggle behavior
      });

      const data = await response.json();
      console.log("API Response:", data);

      if (data.success) {
        console.log("Success! New status:", data.trip?.rsvpStatus);

        // Refetch trip data
        const tripResponse = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (tripResponse.ok) {
          const tripData = await tripResponse.json();
          console.log("Refreshed trip data:", tripData.trip?.rsvpStatus);
          setTrip(tripData.trip);
        } else {
          alert("Failed to refresh trip data after status change");
        }
      } else {
        alert(`Failed to ${isClosing ? "close" : "open"} RSVP: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error toggling RSVP status:", err);
      alert(`Failed to toggle RSVP status: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTogglingRsvpStatus(false);
    }
  };

  const handleEditTimelineDate = async (itemId: string, newDate: string | null) => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/timeline/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          date: newDate ? new Date(newDate).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to update milestone date");
      }

      // Success - refresh the trip data
      handleEditSuccess();
      setEditingTimelineItemId(null);
      setEditingTimelineDate("");
    } catch (err) {
      console.error("Error updating timeline date:", err);
      alert(err instanceof Error ? err.message : "Failed to update milestone date");
    }
  };

  const handleToggleTimelineItem = async (itemId: string) => {
    if (!user) return;

    try {
      setTogglingTimelineItemId(itemId);
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/timeline/${itemId}/toggle`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to toggle milestone");
      }

      // Success - refresh the trip data
      handleEditSuccess();
    } catch (error) {
      console.error("Error toggling milestone:", error);
      alert(error instanceof Error ? error.message : "Failed to toggle milestone");
    } finally {
      setTogglingTimelineItemId(null);
    }
  };

  const handleDeleteTimelineItem = async (itemId: string) => {
    if (!user) return;

    try {
      setDeletingTimelineItemId(itemId);
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/timeline/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to delete milestone");
      }

      // Success - refresh the trip data
      handleEditSuccess();
    } catch (err) {
      console.error("Error deleting timeline item:", err);
      alert(err instanceof Error ? err.message : "Failed to delete milestone");
    } finally {
      setDeletingTimelineItemId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">

        {/* Trip Header */}
        <div className="rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 mb-6 overflow-hidden">
          {/* Header Image Background */}
          {trip.headerImageData ? (
            <div className="relative">
              <div className="h-48 md:h-64 w-full">
                <img
                  src={trip.headerImageData}
                  alt={trip.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </div>
              {/* Title overlay on image */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <div className="flex justify-between items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl font-bold text-white break-words drop-shadow-lg">
                      {trip.name}
                    </h1>
                    <span
                      className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${
                        trip.status === "PLANNING"
                          ? "bg-blue-500/80 text-white"
                          : trip.status === "ACTIVE"
                          ? "bg-green-500/80 text-white"
                          : "bg-zinc-500/80 text-white"
                      }`}
                    >
                      {trip.status}
                    </span>
                  </div>
                  {isOwner && !isViewer && (
                    <button
                      onClick={() => setIsEditDialogOpen(true)}
                      className="tap-target px-4 py-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Content section */}
          <div className="bg-white dark:bg-zinc-800 p-6 md:p-8">
            {/* Show title here only if no header image */}
            {!trip.headerImageData && (
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 break-words">
                      {trip.name}
                    </h1>
                  </div>
                  {isOwner && !isViewer && (
                    <button
                      onClick={() => setIsEditDialogOpen(true)}
                      className="tap-target px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium transition-colors flex items-center gap-2 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-full flex-shrink-0 self-start ${
                      trip.status === "PLANNING"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : trip.status === "ACTIVE"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {trip.status}
                  </span>
                </div>
              </div>
            )}

            {trip.description && (
              <p className={`text-zinc-600 dark:text-zinc-400 ${trip.headerImageData ? 'mb-4' : 'mb-4'}`}>{trip.description}</p>
            )}

            <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
              Organized by {trip.organizer.displayName ?? "Unknown"}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {(() => {
                      const nonViewerCount = trip.participants.filter(p => p.role !== "VIEWER").length;
                      return nonViewerCount === 0
                        ? "no-one"
                        : nonViewerCount === 1
                        ? "1 person"
                        : `${nonViewerCount} people`;
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current RSVP Status (for users who have responded) */}
        {(trip.userRsvpStatus === "ACCEPTED" || trip.userRsvpStatus === "DECLINED" || trip.userRsvpStatus === "MAYBE") && (
          <div className={`rounded-xl shadow-sm border p-6 mb-6 relative ${
            trip.userRsvpStatus === "ACCEPTED"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : trip.userRsvpStatus === "DECLINED"
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          }`}>
            {/* Toggle button - absolute positioned top right */}
            <button
              onClick={() => toggleSection('rsvp')}
              className={`absolute top-2 right-2 tap-target p-2 rounded-lg transition-colors ${
                trip.userRsvpStatus === "ACCEPTED"
                  ? "hover:bg-green-100 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400"
                  : trip.userRsvpStatus === "DECLINED"
                  ? "hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400"
                  : "hover:bg-yellow-100 dark:hover:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400"
              }`}
              aria-label={collapsedSections.rsvp ? "Expand section" : "Collapse section"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {collapsedSections.rsvp ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                )}
              </svg>
            </button>
            <div className="flex items-center gap-4 pr-10">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                trip.userRsvpStatus === "ACCEPTED"
                  ? "bg-green-100 dark:bg-green-900/50"
                  : trip.userRsvpStatus === "DECLINED"
                  ? "bg-red-100 dark:bg-red-900/50"
                  : "bg-yellow-100 dark:bg-yellow-900/50"
              }`}>
                <svg className={`w-6 h-6 ${
                  trip.userRsvpStatus === "ACCEPTED"
                    ? "text-green-600 dark:text-green-400"
                    : trip.userRsvpStatus === "DECLINED"
                    ? "text-red-600 dark:text-red-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {trip.userRsvpStatus === "ACCEPTED" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : trip.userRsvpStatus === "DECLINED" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </div>
              <div>
                <h3 className={`text-lg font-bold ${
                  trip.userRsvpStatus === "ACCEPTED"
                    ? "text-green-900 dark:text-green-100"
                    : trip.userRsvpStatus === "DECLINED"
                    ? "text-red-900 dark:text-red-100"
                    : "text-yellow-900 dark:text-yellow-100"
                }`}>
                  {trip.userRsvpStatus === "ACCEPTED" && "Accepted"}
                  {trip.userRsvpStatus === "DECLINED" && "Declined"}
                  {trip.userRsvpStatus === "MAYBE" && "Faffing"}
                </h3>
              </div>
            </div>

            {!collapsedSections.rsvp && (
              <>
                {/* Quick change buttons */}
                {(!trip.rsvpStatus || trip.rsvpStatus === "OPEN") ? (
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-current/20">
                    <button
                      onClick={() => handleRsvpResponse("ACCEPTED")}
                      disabled={trip.userRsvpStatus === "ACCEPTED" || isRsvpResponding !== null}
                      className="tap-target px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isRsvpResponding === "ACCEPTED" ? "Working..." : "Accept"}
                    </button>
                    <button
                      onClick={() => handleRsvpResponse("MAYBE")}
                      disabled={trip.userRsvpStatus === "MAYBE" || isRsvpResponding !== null}
                      className="tap-target px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {isRsvpResponding === "MAYBE" ? "Working..." : "Maybe"}
                    </button>
                    <button
                      onClick={() => handleRsvpResponse("DECLINED")}
                      disabled={trip.userRsvpStatus === "DECLINED" || isRsvpResponding !== null}
                      className="tap-target px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isRsvpResponding === "DECLINED" ? "Working..." : "Decline"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-current/20">
                    <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                        RSVP is closed. Contact the organizer if you need to change your response.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Checklists Section (for accepted members) - only show for organizers or when checklists exist */}
        {trip.userRsvpStatus === "ACCEPTED" && (canInvite || (checklistsCount !== null && checklistsCount > 0)) ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 px-4 sm:px-6 md:px-8 pt-2 pb-4 sm:pb-6 md:pb-8 mb-6">
            {/* Header row with title, +Add button, and toggle */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Checklists</h2>
              <div className="flex items-center gap-2">
                {!collapsedSections.checklists && canInvite && !isViewer && (
                  <button
                    onClick={() => setIsAddChecklistDialogOpen(true)}
                    className="tap-target px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
                  >
                    + Add
                  </button>
                )}
                <button
                  onClick={() => toggleSection('checklists')}
                  className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                  aria-label={collapsedSections.checklists ? "Expand section" : "Collapse section"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {collapsedSections.checklists ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Checklists content - only show when not collapsed */}
            {!collapsedSections.checklists && (
              <div className="mt-3">
                <TripListsPanel
                  key={`checklists-${listsRefreshKey}`}
                  tripId={trip.id}
                  isOrganizer={canInvite && !isViewer}
                  hideContainer={true}
                  listTypeFilter="TODO"
                  hideAddButton={true}
                  onOpenInviteDialog={() => setIsInviteDialogOpen(true)}
                  onOpenCreateChoice={(choiceName) => {
                    setIsCreateChoiceDialogOpen(true);
                    if (choiceName) {
                      setCreateChoiceInitialName(choiceName);
                    }
                  }}
                  onOpenList={(listId, listTitle) => {
                    setSelectedListId(listId);
                    setListWorkflowTitle("Get things done");
                    setListWorkflowDescription(`Complete tasks in ${listTitle}`);
                    setIsListWorkflowModalOpen(true);
                  }}
                  onListsLoaded={setChecklistsCount}
                  onListsData={(ids, sourceIds) => {
                    setChecklistIds(ids);
                    setChecklistSourceTemplateIds(sourceIds);
                  }}
                />
              </div>
            )}
          </div>
        ) : trip.userRsvpStatus === "ACCEPTED" && !canInvite && checklistsCount === null ? (
          /* Hidden TripListsPanel to fetch checklist count for non-organizers */
          <div className="hidden">
            <TripListsPanel
              key={`checklists-hidden-${listsRefreshKey}`}
              tripId={trip.id}
              isOrganizer={false}
              hideContainer={true}
              listTypeFilter="TODO"
              onListsLoaded={setChecklistsCount}
            />
          </div>
        ) : null}

        {/* Participate CTA for viewers */}
        {userProfile?.role === "VIEWER" && publicTripInfo?.signUpEnabled && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-sm border-2 border-green-200 dark:border-green-800 p-6 md:p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                  Want to take part?
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Add your name or sign back in if you've been here before
                </p>
              </div>
              <button
                onClick={() => setIsJoinTripDialogOpen(true)}
                className="tap-target px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center gap-2 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Join in
              </button>
            </div>
          </div>
        )}

        {/* Kit Lists Section (for accepted members) - only show for organizers or when kit lists exist */}
        {trip.userRsvpStatus === "ACCEPTED" && (canInvite || (kitListsCount !== null && kitListsCount > 0)) ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 px-4 sm:px-6 md:px-8 pt-2 pb-4 sm:pb-6 md:pb-8 mb-6">
            {/* Header row with title, +Add button, and toggle */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Kit Lists</h2>
              <div className="flex items-center gap-2">
                {!collapsedSections.kitLists && canInvite && !isViewer && (
                  <button
                    onClick={() => setIsAddKitListDialogOpen(true)}
                    className="tap-target px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
                  >
                    + Add
                  </button>
                )}
                <button
                  onClick={() => toggleSection('kitLists')}
                  className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                  aria-label={collapsedSections.kitLists ? "Expand section" : "Collapse section"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {collapsedSections.kitLists ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Kit Lists content - only show when not collapsed */}
            {!collapsedSections.kitLists && (
              <div className="mt-3">
                <TripListsPanel
                  key={`kitlists-${listsRefreshKey}`}
                  tripId={trip.id}
                  isOrganizer={canInvite && !isViewer}
                  hideContainer={true}
                  listTypeFilter="KIT"
                  hideAddButton={true}
                  onOpenInviteDialog={() => setIsInviteDialogOpen(true)}
                  onOpenCreateChoice={(choiceName) => {
                    setIsCreateChoiceDialogOpen(true);
                    if (choiceName) {
                      setCreateChoiceInitialName(choiceName);
                    }
                  }}
                  onOpenList={(listId, listTitle) => {
                    setSelectedListId(listId);
                    setListWorkflowTitle("Pack your kit");
                    setListWorkflowDescription(`Pack items in ${listTitle}`);
                    setIsListWorkflowModalOpen(true);
                  }}
                  onListsLoaded={setKitListsCount}
                  onListsData={(ids, sourceIds) => {
                    setKitListIds(ids);
                    setKitListSourceTemplateIds(sourceIds);
                  }}
                />
              </div>
            )}
          </div>
        ) : trip.userRsvpStatus === "ACCEPTED" && !canInvite && kitListsCount === null ? (
          /* Hidden TripListsPanel to fetch kit list count for non-organizers */
          <div className="hidden">
            <TripListsPanel
              key={`kitlists-hidden-${listsRefreshKey}`}
              tripId={trip.id}
              isOrganizer={false}
              hideContainer={true}
              listTypeFilter="KIT"
              onListsLoaded={setKitListsCount}
            />
          </div>
        ) : null}
        
        {/*
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={expandAllSections}
              className="tap-target flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Expand All
            </button>
            <button
              onClick={collapseAllSections}
              className="tap-target flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              Hide All
            </button>
          </div>
        </div>
        */}

        {/* RSVP Response Card (for invitees) */}
        {trip.userRsvpStatus === "PENDING" && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-sm border-2 border-blue-200 dark:border-blue-800 p-6 md:p-8 mb-6 relative">
            {/* Toggle button - absolute positioned top right */}
            <button
              onClick={() => toggleSection('rsvp')}
              className="absolute top-2 right-2 tap-target p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
              aria-label={collapsedSections.rsvp ? "Expand section" : "Collapse section"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {collapsedSections.rsvp ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                )}
              </svg>
            </button>
            <div className="flex items-start gap-4 mb-6 pr-10">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  You've been invited to {trip.name}!
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {trip.organizer.displayName ?? "Someone"} has invited you to join this trip.
                  {trip.rsvpStatus === "CLOSED"
                    ? " However, RSVP has been closed by the organizer."
                    : " Please respond to let them know if you can make it."}
                </p>
              </div>
            </div>

            {!collapsedSections.rsvp && (
              <>
                {(!trip.rsvpStatus || trip.rsvpStatus === "OPEN") ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleRsvpResponse("ACCEPTED")}
                      disabled={isRsvpResponding !== null}
                      className="tap-target flex-1 min-w-[140px] px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isRsvpResponding === "ACCEPTED" ? "Working..." : "Accept"}
                    </button>
                    <button
                      onClick={() => handleRsvpResponse("MAYBE")}
                      disabled={isRsvpResponding !== null}
                      className="tap-target flex-1 min-w-[140px] px-6 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {isRsvpResponding === "MAYBE" ? "Working..." : "Maybe"}
                    </button>
                    <button
                      onClick={() => handleRsvpResponse("DECLINED")}
                      disabled={isRsvpResponding !== null}
                      className="tap-target flex-1 min-w-[140px] px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {isRsvpResponding === "DECLINED" ? "Working..." : "Decline"}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                      RSVP is closed. Please contact the trip organizer if you need to respond.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Members */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 px-4 sm:px-6 md:px-8 pt-2 pb-4 sm:pb-6 md:pb-8 mb-6">
          {/* Header row with title, +Add button, and toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Members</h2>
              {trip.rsvpStatus === "CLOSED" && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 whitespace-nowrap">
                  RSVP Closed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!collapsedSections.members && canInvite && !isViewer && (!trip.rsvpStatus || trip.rsvpStatus === "OPEN") && (
                <button
                  onClick={() => setIsInviteDialogOpen(true)}
                  className="tap-target px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
                >
                  + Add
                </button>
              )}
              <button
                onClick={() => toggleSection('members')}
                className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                aria-label={collapsedSections.members ? "Expand section" : "Collapse section"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {collapsedSections.members ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Action buttons row */}
          {!collapsedSections.members && canInvite && !isViewer && (
            <div className="flex items-center gap-2 flex-wrap mt-3 mb-4">
              <button
                onClick={handleToggleRsvpStatus}
                disabled={isTogglingRsvpStatus}
                className={`tap-target px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                  trip.rsvpStatus === "CLOSED"
                    ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400"
                }`}
              >
                {isTogglingRsvpStatus ? "Working..." : `${trip.rsvpStatus === "CLOSED" ? "Reopen" : "Close"} RSVP`}
              </button>
            </div>
          )}

          {!collapsedSections.members && (
            <div className={`${!canInvite || isViewer ? 'mt-3' : ''}`}>
              {/* RSVP Filter Dropdown */}
              <div className="mb-4">
                <label htmlFor="member-filter" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Filter by RSVP Status
                </label>
                <select
                  id="member-filter"
                  value={memberRsvpFilter}
                  onChange={(e) => setMemberRsvpFilter(e.target.value as typeof memberRsvpFilter)}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="all">All Members</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="PENDING">Pending</option>
                  <option value="MAYBE">Maybe</option>
                  <option value="DECLINED">Declined</option>
                </select>
              </div>

              <div className="space-y-3">
            {getFilteredParticipants().map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2 p-3 sm:p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">
                      {(member.user.displayName ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {member.user.displayName ?? "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                  {member.role === "OWNER" && (
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                      {member.role}
                    </span>
                  )}
                  <span
                    className={`px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${
                      member.rsvpStatus === "ACCEPTED"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : member.rsvpStatus === "DECLINED"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : member.rsvpStatus === "MAYBE"
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    {member.rsvpStatus}
                  </span>
                  {member.role !== "OWNER" && canInvite && !isViewer && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.user.id, member.user.displayName ?? "Unknown")}
                      disabled={removingUserId === member.user.id}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove member"
                    >
                      {removingUserId === member.user.id ? (
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
              </div>
            </div>
          )}
        </div>
        


        {/* Assign Tasks (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && user && (() => {
          // Find all spends where the current user is involved but has shareAmount = 0 (pending assignment)
          const pendingAssignments = trip.spends
            ?.filter((spend) => {
              const userAssignment = spend.assignments?.find((a) => a.userId === user.uid);
              return userAssignment !== undefined; // User is tagged as involved
            })
            .map((spend) => {
              const userAssignment = spend.assignments?.find((a) => a.userId === user.uid);
              return {
                spend,
                assignment: userAssignment,
              };
            }) || [];

          // TODO: Implement pending assignments display
          return null;
        })()}

        {/* Choices Section (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && (canInvite || choices.length > 0) && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 px-4 sm:px-6 md:px-8 pt-2 pb-4 sm:pb-6 md:pb-8 mb-6">
            {/* Header row with title, +Add button, and toggle */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Choices</h2>
              <div className="flex items-center gap-2">
                {!collapsedSections.choices && canInvite && !isViewer && (
                  <button
                    onClick={() => setIsCreateChoiceDialogOpen(true)}
                    className="tap-target px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
                  >
                    + Add
                  </button>
                )}
                <button
                  onClick={() => toggleSection('choices')}
                  className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                  aria-label={collapsedSections.choices ? "Expand section" : "Collapse section"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {collapsedSections.choices ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {!collapsedSections.choices && (
              <div className="mt-3">
                {/* Choices display */}
                {choices.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <p className="font-medium">No choices yet</p>
                    {canInvite && (
                      <p className="text-sm mt-1">Create a choice to gather group preferences</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {choices.map((choice) => (
                      <div
                        key={choice.id}
                        className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedChoiceId(choice.id);
                          setIsChoiceDetailDialogOpen(true);
                        }}
                      >
                        <div className="flex gap-3 mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{choice.name}</h3>
                            {choice.datetime && (
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                {new Date(choice.datetime).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            )}
                            {choice.place && (
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">{choice.place}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                choice.status === 'OPEN'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                              }`}>
                                {choice.status}
                              </span>
                            </div>
                          </div>
                          {canInvite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedChoiceId(choice.id);
                                setIsManageChoiceDialogOpen(true);
                              }}
                              className="tap-target px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium transition-colors text-xs sm:text-sm whitespace-nowrap flex-shrink-0 self-start"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedChoiceId(choice.id);
                              setIsChoiceDetailDialogOpen(true);
                            }}
                            className="tap-target px-4 py-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold transition-colors text-xs sm:text-sm whitespace-nowrap"
                          >
                            Choose
                          </button>
                          <button
                            onClick={() => {
                              setSelectedChoiceId(choice.id);
                              setIsChoiceReportsDialogOpen(true);
                            }}
                            className="tap-target px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
                          >
                            What did everyone ask for?
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transport / Lift Share Section (hidden for non-admins while in development) */}
        {trip.userRsvpStatus === "ACCEPTED" && isGlobalAdmin && (
          <TransportSection
            tripId={tripId}
            tripStartDate={trip.startDate || new Date().toISOString()}
            tripEndDate={trip.endDate || new Date().toISOString()}
            collapsed={collapsedSections.transport}
            onToggle={() => toggleSection('transport')}
            isViewer={isViewer}
          />
        )}

        {/* Balance Summary (for accepted members) - Hidden for now */}
        {false && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 px-4 sm:px-6 md:px-8 pt-2 pb-4 sm:pb-6 md:pb-8 mb-6">
            {/* Header row with title and toggle */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Balance Summary</h2>
              <button
                onClick={() => toggleSection('balance')}
                className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                aria-label={collapsedSections.balance ? "Expand section" : "Collapse section"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {collapsedSections.balance ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  )}
                </svg>
              </button>
            </div>

            {!collapsedSections.balance && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Trip Spend - Always show */}
              {trip?.totalSpent !== undefined && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Total Trip Spend</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {trip?.baseCurrency} {trip?.totalSpent?.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Your Spend - Calculate from spends where user is the payer */}
              {trip?.spends !== undefined && user && (
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">Your Spend</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {trip?.baseCurrency} {trip?.spends?.filter(s => s.paidBy.id === user?.uid).reduce((sum, spend) => sum + spend.normalizedAmount, 0).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Show You Owe / You Are Owed only when spend is CLOSED */}
              {trip?.spendStatus === SpendStatus.CLOSED && (trip?.userOwes ?? 0) > 0 && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">You Owe</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {trip?.baseCurrency} {trip?.userOwes?.toFixed(2)}
                  </p>
                </div>
              )}

              {trip?.spendStatus === SpendStatus.CLOSED && (trip?.userIsOwed ?? 0) > 0 && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">You Are Owed</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {trip?.baseCurrency} {trip?.userIsOwed?.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Unassigned Spend - Show when spend is OPEN */}
              {trip?.spendStatus === SpendStatus.OPEN && trip?.totalUnassigned !== undefined && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-1">Unassigned Spend</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {trip?.baseCurrency} {trip?.totalUnassigned?.toFixed(2)}
                  </p>
                </div>
              )}
              </div>
            )}
          </div>
        )}

        {/* Costs Section (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 px-4 sm:px-6 md:px-8 pt-2 pb-4 sm:pb-6 md:pb-8 mb-6">
            {/* Header row with title, close/reopen button, and collapse toggle */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Costs</h2>
              <div className="flex items-center gap-2">
                {/* Close/Reopen Spending button */}
                {canInvite && !isViewer && !collapsedSections.costs && (
                  <button
                    onClick={() => handleToggleTripSpendStatus()}
                    disabled={isTogglingSpendStatus}
                    className="tap-target px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTogglingSpendStatus ? "Working..." : `${(trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED ? "Reopen" : "Close"} Spending`}
                  </button>
                )}
                {/* Collapse toggle */}
                <button
                  onClick={() => toggleSection('costs')}
                  className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                  aria-label={collapsedSections.costs ? "Expand section" : "Collapse section"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {collapsedSections.costs ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {!collapsedSections.costs && (
              <>
                {/* User Cost Summary */}
                {trip.spends && user && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">You Paid</p>
                      <p className="text-sm sm:text-lg font-bold text-purple-700 dark:text-purple-300">
                        {trip?.baseCurrency} {trip?.spends?.filter(s => s.paidBy.id === user?.uid).reduce((sum, spend) => sum + spend.normalizedAmount, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-2 sm:p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Your Share</p>
                      <p className="text-sm sm:text-lg font-bold text-blue-700 dark:text-blue-300">
                        {trip.baseCurrency} {trip.spends.reduce((sum, spend) => {
                          const userAssignment = spend.assignments?.find(a => a.userId === user.uid);
                          return sum + (userAssignment?.normalizedShareAmount || 0);
                        }, 0).toFixed(2)}
                      </p>
                    </div>
                    {(() => {
                      const unassigned = trip.totalUnassigned || 0;
                      const totalSpent = trip.totalSpent || 0;
                      const isFullyAssigned = unassigned < 0.01;
                      const isPartiallyAssigned = !isFullyAssigned && totalSpent > 0 && unassigned < totalSpent;
                      // Green if fully assigned, amber if partially assigned, red if nothing assigned
                      const colorClasses = isFullyAssigned
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : isPartiallyAssigned
                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
                      const textColorClasses = isFullyAssigned
                        ? "text-green-600 dark:text-green-400"
                        : isPartiallyAssigned
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400";
                      const valueColorClasses = isFullyAssigned
                        ? "text-green-700 dark:text-green-300"
                        : isPartiallyAssigned
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-red-700 dark:text-red-300";
                      return (
                        <div className={`p-2 sm:p-3 rounded-lg border ${colorClasses}`}>
                          <p className={`text-xs font-medium ${textColorClasses}`}>Unassigned</p>
                          <p className={`text-sm sm:text-lg font-bold ${valueColorClasses}`}>
                            {trip.baseCurrency} {unassigned.toFixed(2)}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Tabs */}
                <div className="mt-3 flex border-b border-zinc-200 dark:border-zinc-700">
                  <button
                    onClick={() => setCostsTab("spends")}
                    className={`tap-target px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      costsTab === "spends"
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Spends
                  </button>
                  <button
                    onClick={() => (trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED && setCostsTab("settlement")}
                    disabled={(trip.spendStatus || SpendStatus.OPEN) !== SpendStatus.CLOSED}
                    className={`tap-target px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      costsTab === "settlement"
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : (trip.spendStatus || SpendStatus.OPEN) !== SpendStatus.CLOSED
                        ? "border-transparent text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                        : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Settlement
                  </button>
                </div>

                {/* Tab Content */}
                <div className="mt-4">
                  {costsTab === "spends" ? (
                    <>
                      {/* Header row with Add button and Filters toggle */}
                      <div className="flex items-center justify-between mb-3">
                        {/* Add button for spends */}
                        {(trip.spendStatus || SpendStatus.OPEN) === SpendStatus.OPEN && !isViewer ? (
                          <button
                            onClick={() => setIsAddSpendDialogOpen(true)}
                            className="tap-target px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
                          >
                            + Add
                          </button>
                        ) : (
                          <div />
                        )}

                        {/* Filters toggle - only show if there are spends */}
                        {trip.spends && trip.spends.length > 0 && (
                          <button
                            onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                            className="tap-target flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors text-xs"
                            aria-label={filtersCollapsed ? "Expand filters" : "Collapse filters"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            <span>Filters</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {filtersCollapsed ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              )}
                            </svg>
                          </button>
                        )}
                      </div>

                      {trip.spends && trip.spends.length > 0 ? (
                        <>
                          {/* Filters panel */}
                          {!filtersCollapsed && (
                            <div className="mb-3">
                              <SpendFilters
                                statusFilter={statusFilter}
                                onStatusFilterChange={setStatusFilter}
                                involvementFilter={involvementFilter}
                                onInvolvementFilterChange={setInvolvementFilter}
                                sortBy={sortBy}
                                onSortByChange={setSortBy}
                                sortOrder={sortOrder}
                                onSortOrderChange={setSortOrder}
                              />
                            </div>
                          )}

                          {/* Spend List */}
                          <SpendListView
                            spends={getFilteredAndSortedSpends().map((spend) => ({
                              ...spend,
                              date: new Date(spend.date),
                            }))}
                            currentUserId={user?.uid}
                            tripSpendingClosed={(trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED}
                            canUserFinalize={canUserFinalizeSpend}
                            canUserDelete={canUserDeleteSpend}
                            canUserEdit={canUserDeleteSpend}
                            onView={handleViewSpend}
                            onEdit={handleEditSpend}
                            onAssign={handleAssignSpend}
                            onSelfAssign={handleSelfAssignSpend}
                            onJoin={handleJoinSpend}
                            onLeave={handleLeaveSpend}
                            onFinalize={handleFinalizeSpend}
                            onDelete={handleDeleteSpend}
                          />
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-zinc-600 dark:text-zinc-400">No spends recorded yet</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">Click "+ Add Spend" to record your first expense</p>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Settlement Tab */
                    <SettlementPlanSection
                      tripId={trip.id}
                      baseCurrency={trip.baseCurrency}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}



        {/* Timeline (if available) */}
        {trip.timeline && trip.timeline.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 px-4 sm:px-6 md:px-8 pt-2 pb-4 sm:pb-6 md:pb-8 mb-6">
            {/* Header row with title, +Add button, and toggle */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Timeline</h2>
              <div className="flex items-center gap-2">
                {!collapsedSections.timeline && canInvite && !isViewer && (
                  <button
                    onClick={() => setIsAddingMilestone(true)}
                    className="tap-target px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
                  >
                    + Add
                  </button>
                )}
                <button
                  onClick={() => toggleSection('timeline')}
                  className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                  aria-label={collapsedSections.timeline ? "Expand section" : "Collapse section"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {collapsedSections.timeline ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {!collapsedSections.timeline && (
              <div className="mt-3">
                <div className="space-y-3">
              {trip.timeline.map((item) => {
                const isEditing = editingTimelineItemId === item.id;
                const canEdit = canInvite && !isViewer && item.title !== "Event Created";
                // System milestones that cannot be deleted
                const isSystemMilestone = [
                  "Event Created"
                ].includes(item.title);

                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 rounded-lg border ${
                      item.isCompleted
                        ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                        : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        {canInvite && !isViewer ? (
                          <button
                            onClick={() => handleToggleTimelineItem(item.id)}
                            disabled={togglingTimelineItemId === item.id}
                            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              item.isCompleted
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500"
                            }`}
                            title={item.isCompleted ? "Mark as incomplete" : "Mark as complete"}
                          >
                            {togglingTimelineItemId === item.id ? (
                              <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : item.isCompleted ? (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </button>
                        ) : (
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              item.isCompleted
                                ? "bg-green-500 text-white"
                                : "bg-zinc-300 dark:bg-zinc-600"
                            }`}
                          >
                            {item.isCompleted && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {!isEditing ? (
                          <>
                            {/* Title row with actions */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-medium text-sm ${item.isCompleted ? "text-green-800 dark:text-green-200" : "text-zinc-900 dark:text-zinc-100"}`}>
                                  {item.title}
                                </span>
                                {item.isCompleted && item.triggerType && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300">
                                    {item.triggerType === 'MANUAL' ? 'manual' : 'auto'}
                                  </span>
                                )}
                              </div>
                              {/* Actions - inline with title */}
                              {canEdit && (
                                <div className="flex gap-0.5 flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingTimelineItemId(item.id);
                                      if (item.date) {
                                        const d = new Date(item.date);
                                        const year = d.getFullYear();
                                        const month = String(d.getMonth() + 1).padStart(2, '0');
                                        const day = String(d.getDate()).padStart(2, '0');
                                        const hours = String(d.getHours()).padStart(2, '0');
                                        const minutes = String(d.getMinutes()).padStart(2, '0');
                                        setEditingTimelineDate(`${year}-${month}-${day}T${hours}:${minutes}`);
                                      } else {
                                        setEditingTimelineDate("");
                                      }
                                    }}
                                    className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                    title="Edit milestone date"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  {!isSystemMilestone && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete the milestone "${item.title}"?`)) {
                                          handleDeleteTimelineItem(item.id);
                                        }
                                      }}
                                      disabled={deletingTimelineItemId === item.id}
                                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete milestone"
                                    >
                                      {deletingTimelineItemId === item.id ? (
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                      ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Description row */}
                            {item.description && (
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                                {item.description}
                              </p>
                            )}
                            {/* Date row */}
                            {item.date && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                {formatDate(item.date)}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="datetime-local"
                              value={editingTimelineDate}
                              onChange={(e) => setEditingTimelineDate(e.target.value)}
                              className="w-full max-w-[220px] px-2 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditTimelineDate(item.id, editingTimelineDate)}
                                className="tap-target px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTimelineItemId(null);
                                  setEditingTimelineDate("");
                                }}
                                className="tap-target px-3 py-1.5 text-sm rounded bg-zinc-200 dark:bg-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-500 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
                </div>
              </div>
            )}
          </div>
        )}


        </div>
      </div>

      {/* Edit Trip Dialog */}
      {trip && (
        <EditTripDialog
          trip={trip}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Invite Users Dialog */}
      {trip && (
        <InviteUsersDialog
          tripId={trip.id}
          tripName={trip.name}
          isOpen={isInviteDialogOpen}
          onClose={() => setIsInviteDialogOpen(false)}
          onSuccess={handleInviteSuccess}
          currentMembers={trip.participants}
          signInMode={trip.signInMode}
        />
      )}

      {/* Add Spend Dialog */}
      {trip && (
        <AddSpendDialog
          trip={{ id: trip.id, baseCurrency: trip.baseCurrency }}
          isOpen={isAddSpendDialogOpen}
          onClose={() => setIsAddSpendDialogOpen(false)}
          onSuccess={handleAddSpendSuccess}
          onSuccessWithAddPeople={handleAddSpendWithPeople}
        />
      )}

      {/* View Spend Dialog */}
      {trip && selectedSpendId && (
        <ViewSpendDialog
          spend={trip.spends?.find((s) => s.id === selectedSpendId) || null}
          trip={{ id: trip.id, baseCurrency: trip.baseCurrency, spendStatus: trip.spendStatus }}
          currentUserId={user?.uid}
          isOpen={isViewSpendDialogOpen}
          onClose={() => {
            setIsViewSpendDialogOpen(false);
            setSelectedSpendId(null);
          }}
          canUserFinalize={canUserFinalizeSpend}
          canUserDelete={canUserDeleteSpend}
          canUserEdit={canUserDeleteSpend}
          onEdit={handleEditSpend}
          onAssign={handleAssignSpend}
          onSelfAssign={handleSelfAssignSpend}
          onSplitRemainder={handleSplitRemainderSpend}
          onClearAssignments={handleClearAssignments}
          onEditAssignment={handleEditAssignment}
          onJoin={handleJoinSpend}
          onLeave={handleLeaveSpend}
          onFinalize={handleFinalizeSpend}
          onDelete={handleDeleteSpend}
          onViewItems={handleViewItems}
          isDeletingSpend={isDeletingSpend}
        />
      )}

      {/* Edit Spend Dialog */}
      {trip && selectedSpendId && (
        <EditSpendDialog
          spend={trip.spends?.find((s) => s.id === selectedSpendId) || null}
          trip={{ id: trip.id, baseCurrency: trip.baseCurrency }}
          isOpen={isEditSpendDialogOpen}
          onClose={() => {
            // Just close the edit dialog, keep view dialog open and selectedSpendId
            setIsEditSpendDialogOpen(false);
          }}
          onSuccess={handleAddSpendSuccess}
          onManageItems={() => {
            // Close edit dialog and open items dialog
            setIsEditSpendDialogOpen(false);
            setIsItemsDialogOpen(true);
          }}
        />
      )}

      {/* Assign Spend Dialog */}
      {trip && selectedSpendId && (
        <AssignSpendDialog
          spend={
            trip.spends?.find((s) => s.id === selectedSpendId) || {
              id: selectedSpendId,
              description: "",
              amount: 0,
              currency: trip.baseCurrency,
            }
          }
          participants={trip.participants}
          tripId={trip.id}
          tripRsvpStatus={trip.rsvpStatus}
          isOpen={isAssignSpendDialogOpen}
          onClose={() => {
            // Just close the assign dialog, keep view dialog open and selectedSpendId
            setIsAssignSpendDialogOpen(false);
          }}
          onSuccess={handleAssignSpendSuccess}
        />
      )}

      {/* Self Assign Dialog */}
      {trip && selectedSpendId && user && (() => {
        const selectedSpend = trip.spends?.find((s) => s.id === selectedSpendId);
        const userAssignment = trip.userAssignments?.find(
          (a) => a.userId === user.uid &&
          // We need to match this assignment to the spend, but userAssignments doesn't have spendId
          // For now, we'll check if user is in the spend's assignments
          selectedSpend?.assignments?.some(sa => sa.userId === user.uid && sa.id === a.id)
        );

        return (
          <SelfAssignDialog
            spend={
              selectedSpend || {
                id: selectedSpendId,
                description: "",
                amount: 0,
                currency: trip.baseCurrency,
                normalizedAmount: 0,
              }
            }
            trip={{ baseCurrency: trip.baseCurrency }}
            currentUserId={user.uid}
            existingAssignment={
              userAssignment
                ? {
                    id: userAssignment.id,
                    shareAmount: userAssignment.shareAmount,
                    normalizedShareAmount: userAssignment.normalizedShareAmount,
                  }
                : undefined
            }
            assignedPercentage={selectedSpend?.assignedPercentage || 0}
            isOpen={isSelfAssignDialogOpen}
            onClose={() => {
              setIsSelfAssignDialogOpen(false);
            }}
            onAssign={handleSelfAssignSubmit}
          />
        );
      })()}

      {/* Split Remainder Dialog */}
      {trip && selectedSpendId && user && (() => {
        const selectedSpend = trip.spends?.find((s) => s.id === selectedSpendId);
        // Filter out VIEWER users - they cannot be assigned to spends
        const allParticipants = trip.participants
          .filter(p => p.role !== "VIEWER")
          .map(p => ({
            id: p.user.id,
            email: p.user.email,
            displayName: p.user.displayName,
          }));

        return (
          <SplitRemainderDialog
            spend={
              selectedSpend || {
                id: selectedSpendId,
                description: "",
                amount: 0,
                currency: trip.baseCurrency,
                normalizedAmount: 0,
                fxRate: 1,
              }
            }
            trip={{ baseCurrency: trip.baseCurrency }}
            currentUserId={user.uid}
            existingAssignments={selectedSpend?.assignments || []}
            allParticipants={allParticipants}
            isOpen={isSplitRemainderDialogOpen}
            onClose={() => {
              setIsSplitRemainderDialogOpen(false);
            }}
            onApply={handleSplitRemainderSubmit}
          />
        );
      })()}

      {/* Edit Assignment Dialog */}
      {trip && selectedAssignmentId && user && (() => {
        // Find the assignment and its spend
        let assignment: any = null;
        let spend: any = null;

        for (const s of trip.spends || []) {
          const found = s.assignments?.find(a => a.id === selectedAssignmentId);
          if (found) {
            assignment = found;
            spend = s;
            break;
          }
        }

        if (!assignment || !spend) return null;

        return (
          <EditAssignmentDialog
            assignment={assignment}
            spend={spend}
            currentUserId={user.uid}
            assignedPercentage={spend.assignedPercentage || 0}
            isOpen={isEditAssignmentDialogOpen}
            onClose={() => {
              setIsEditAssignmentDialogOpen(false);
              setSelectedAssignmentId(null);
            }}
            onUpdate={handleEditAssignmentSubmit}
            onRemove={handleRemoveAssignment}
          />
        );
      })()}

      {/* Edit Item Assignment Dialog */}
      {trip && selectedAssignmentId && user && (() => {
        // Find the assignment and its spend
        let assignment: any = null;
        let spend: any = null;

        for (const s of trip.spends || []) {
          const found = s.assignments?.find(a => a.id === selectedAssignmentId);
          if (found) {
            assignment = found;
            spend = s;
            break;
          }
        }

        if (!assignment || !spend) return null;

        return (
          <EditItemAssignmentDialog
            assignment={assignment}
            spend={spend}
            currentUserId={user.uid}
            assignedPercentage={spend.assignedPercentage || 0}
            isOpen={isEditItemAssignmentDialogOpen}
            onClose={() => {
              setIsEditItemAssignmentDialogOpen(false);
              setSelectedAssignmentId(null);
            }}
            onUpdate={handleEditItemAssignmentSubmit}
            onRemove={handleRemoveAssignment}
          />
        );
      })()}

      {/* Balances Dialog */}
      <BalancesDialog
        tripId={trip.id}
        baseCurrency={trip.baseCurrency}
        isOpen={isBalancesDialogOpen}
        onClose={() => setIsBalancesDialogOpen(false)}
      />

      {/* Items Dialog */}
      {trip && selectedSpendId && (
        <ItemsDialog
          spend={trip.spends?.find((s) => s.id === selectedSpendId) || null}
          trip={{ id: trip.id, baseCurrency: trip.baseCurrency, spendStatus: trip.spendStatus }}
          currentUserId={user?.uid}
          isOpen={isItemsDialogOpen}
          onClose={() => {
            setIsItemsDialogOpen(false);
            // Refresh trip data to update spend amounts
            handleAssignSpendSuccess();
            // Keep selectedSpendId so ViewSpendDialog can stay open if needed
          }}
          onRefreshTrip={handleAssignSpendSuccess}
          canUserEdit={selectedSpendId ? canUserDeleteSpend(trip.spends?.find((s) => s.id === selectedSpendId) || null as any) : false}
        />
      )}

      {/* Create Choice Dialog */}
      <CreateChoiceDialog
        tripId={trip.id}
        isOpen={isCreateChoiceDialogOpen}
        onClose={() => {
          setIsCreateChoiceDialogOpen(false);
          setCreateChoiceInitialName(""); // Reset initial name
        }}
        initialName={createChoiceInitialName}
        onSuccess={(newChoiceId: string) => {
          fetchChoices();
          setSelectedChoiceId(newChoiceId);
          setManageChoiceInitialTab("items");
          setIsManageChoiceDialogOpen(true);
          setCreateChoiceInitialName(""); // Reset initial name
        }}
      />

      {/* Choice Detail Dialog */}
      {selectedChoiceId && user && (
        <ChoiceDetailDialog
          choiceId={selectedChoiceId}
          userId={user.uid}
          canManage={canInvite}
          isOpen={isChoiceDetailDialogOpen}
          onClose={() => {
            setIsChoiceDetailDialogOpen(false);
            setSelectedChoiceId(null);
          }}
          onManage={() => {
            setIsChoiceDetailDialogOpen(false);
            setIsManageChoiceDialogOpen(true);
          }}
        />
      )}

      {/* Manage Choice Dialog */}
      {selectedChoiceId && trip && (
        <ManageChoiceDialog
          choiceId={selectedChoiceId}
          tripId={trip.id}
          tripCurrency={trip.baseCurrency}
          isOpen={isManageChoiceDialogOpen}
          initialTab={manageChoiceInitialTab}
          onClose={() => {
            setIsManageChoiceDialogOpen(false);
            setSelectedChoiceId(null);
            setManageChoiceInitialTab("details");
            fetchChoices();
          }}
          onSuccess={() => {
            fetchChoices();
            fetchTrip(); // Refresh timeline to show updated/new milestones
          }}
        />
      )}

      {/* Choice Reports Dialog */}
      {selectedChoiceId && (
        <ChoiceReportsDialog
          choiceId={selectedChoiceId}
          choiceName={choices.find(c => c.id === selectedChoiceId)?.name || "Choice"}
          choiceStatus={choices.find(c => c.id === selectedChoiceId)?.status || "OPEN"}
          tripId={trip?.id || ""}
          isOpen={isChoiceReportsDialogOpen}
          onClose={() => {
            setIsChoiceReportsDialogOpen(false);
            setSelectedChoiceId(null);
          }}
          onOpenSpend={async (spendId) => {
            // Refetch trip data to ensure the spend is loaded
            if (!user) return;

            try {
              const idToken = await user.getIdToken();
              const response = await fetch(`/api/trips/${tripId}`, {
                headers: {
                  Authorization: `Bearer ${idToken}`,
                },
              });

              if (response.ok) {
                const data = await response.json();
                setTrip(data.trip);

                // Open the View Spend dialog with the spend
                setSelectedSpendId(spendId);
                setIsViewSpendDialogOpen(true);
              }
            } catch (err) {
              console.error("Error refetching trip:", err);
            }
          }}
        />
      )}

      {/* List Workflow Modal */}
      <ListWorkflowModal
        tripId={trip?.id || ""}
        tripName={trip?.name || ""}
        isOpen={isListWorkflowModalOpen}
        onClose={() => {
          setIsListWorkflowModalOpen(false);
          setSelectedListId(null);
          // Refresh the main lists panel to show updated counts/progress
          setListsRefreshKey(prev => prev + 1);
        }}
        onMilestoneCreated={handleEditSuccess}
        onChoiceCreated={fetchChoices}
        title={listWorkflowTitle}
        description={listWorkflowDescription}
        selectedListId={selectedListId || undefined}
        currentMembers={trip?.participants || []}
      />

      {/* Join Trip Dialog (for viewers to participate) */}
      {publicTripInfo?.signUpEnabled && (
        <JoinTripDialog
          isOpen={isJoinTripDialogOpen}
          onClose={() => setIsJoinTripDialogOpen(false)}
          tripId={tripId}
          tripName={trip?.name || publicTripInfo?.tripName || "Trip"}
          participants={publicTripInfo?.participants?.map(p => ({
            ...p,
            role: "MEMBER",
          })) || []}
          onLoginRequired={(email) => {
            console.log("Login required for:", email);
          }}
          onParticipantCreated={fetchPublicInfo}
        />
      )}

      {/* Add Milestone Dialog */}
      <AddMilestoneDialog
        isOpen={isAddingMilestone}
        onClose={() => setIsAddingMilestone(false)}
        tripId={tripId}
        user={user}
        onSuccess={handleEditSuccess}
        existingMilestones={trip?.timeline?.map((t) => ({ id: t.id, title: t.title })) || []}
      />

      {/* Add Checklist Dialog */}
      <AddListDialog
        isOpen={isAddChecklistDialogOpen}
        onClose={() => setIsAddChecklistDialogOpen(false)}
        tripId={tripId}
        onSuccess={() => {
          setIsAddChecklistDialogOpen(false);
          setListsRefreshKey(prev => prev + 1);
        }}
        listTypeFilter="TODO"
        existingListIds={checklistIds}
        existingSourceTemplateIds={checklistSourceTemplateIds}
      />

      {/* Add Kit List Dialog */}
      <AddListDialog
        isOpen={isAddKitListDialogOpen}
        onClose={() => setIsAddKitListDialogOpen(false)}
        tripId={tripId}
        onSuccess={() => {
          setIsAddKitListDialogOpen(false);
          setListsRefreshKey(prev => prev + 1);
        }}
        listTypeFilter="KIT"
        existingListIds={kitListIds}
        existingSourceTemplateIds={kitListSourceTemplateIds}
      />
    </div>
  );
}
