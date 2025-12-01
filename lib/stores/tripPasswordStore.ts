import { create } from "zustand";

/**
 * In-memory store for trip passwords.
 *
 * This store holds the trip password ONLY in memory for the current browser tab.
 * The password is:
 * - Never persisted to localStorage, sessionStorage, or cookies
 * - Lost when the tab is closed or refreshed
 * - Used only for re-authentication within the same session (e.g., switching from viewer to participant)
 */
interface TripPasswordStore {
  password: string | null;
  tripId: string | null;
  setTripPassword: (tripId: string, password: string) => void;
  getTripPassword: (tripId: string) => string | null;
  clearTripPassword: () => void;
}

export const useTripPasswordStore = create<TripPasswordStore>((set, get) => ({
  password: null,
  tripId: null,

  setTripPassword: (tripId: string, password: string) => {
    set({ tripId, password });
  },

  getTripPassword: (tripId: string) => {
    const state = get();
    // Only return password if it matches the requested trip
    if (state.tripId === tripId) {
      return state.password;
    }
    return null;
  },

  clearTripPassword: () => {
    set({ password: null, tripId: null });
  },
}));
