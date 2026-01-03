/**
 * Types for Trip Home Dashboard Components
 */

export interface TripHomeSummary {
  trip: {
    id: string;
    name: string;
    description: string | null;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    baseCurrency: string;
    headerImageData: string | null;
  };

  people: {
    total: number;
    accepted: number;
    pending: number;
    declined: number;
    maybe: number;
    participants: Participant[];
  };

  money: {
    userBalance: number;
    transfersNeeded: number;
    topTransfer: {
      amount: number;
      toUserName: string;
    } | null;
    baseCurrency: string;
  };

  decisions: {
    openCount: number;
    waitingForYou: number;
    topDecision: {
      id: string;
      name: string;
      place: string | null;
      deadline: string | null;
      votedCount: number;
      totalParticipants: number;
      userHasVoted: boolean;
    } | null;
  };

  tasks: {
    openCount: number;
    completedCount: number;
    topTasks: string[];
  };

  kit: {
    totalItems: number;
    completedItems: number;
    topIncomplete: string[];
  };

  health: {
    status: "on_track" | "needs_attention" | "blocked";
    issues: string[];
  };

  currentUser: {
    role: string;
    rsvpStatus: string;
  };
}

export interface Participant {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  rsvpStatus: string;
  role: string;
  isCurrentUser: boolean;
}

export interface ActivityItem {
  id: string;
  eventType: string;
  action: string;
  actorId: string;
  actorName: string | null;
  actorPhotoURL: string | null;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ActionPrompt {
  type: string;
  message: string;
  actionUrl?: string;
}
