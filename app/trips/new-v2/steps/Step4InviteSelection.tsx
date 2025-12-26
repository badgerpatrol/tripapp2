"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { StepProps } from "../types";

interface AvailableUser {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

interface Group {
  id: string;
  name: string;
  memberCount: number;
}

export default function Step4InviteSelection({
  state,
  updateState,
  error,
}: StepProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newName, setNewName] = useState("");

  // Load user's groups and auto-select all by default
  useEffect(() => {
    const loadGroups = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/groups", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const loadedGroups = data.groups || [];
          setGroups(loadedGroups);
          // Auto-select all groups by default to show all members
          if (loadedGroups.length > 0) {
            setSelectedGroupIds(loadedGroups.map((g: Group) => g.id));
          }
        }
      } catch (err) {
        console.error("Failed to load groups:", err);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, [user]);

  // Load users when groups are selected
  useEffect(() => {
    const loadUsers = async () => {
      if (!user || selectedGroupIds.length === 0) {
        setAvailableUsers([]);
        return;
      }
      setLoadingUsers(true);
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams();
        selectedGroupIds.forEach((id) => params.append("groupIds", id));
        if (state.tripId) params.append("tripId", state.tripId);

        const res = await fetch(`/api/groups/discoverable-users?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableUsers(data.users || []);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, [user, selectedGroupIds, state.tripId]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleUser = (userId: string) => {
    updateState({
      selectedUserIds: state.selectedUserIds.includes(userId)
        ? state.selectedUserIds.filter((id) => id !== userId)
        : [...state.selectedUserIds, userId],
    });
  };

  const addNamedPerson = () => {
    const trimmed = newName.trim();
    if (!trimmed || state.namedInvitees.includes(trimmed)) return;
    updateState({ namedInvitees: [...state.namedInvitees, trimmed] });
    setNewName("");
  };

  const removeName = (name: string) => {
    updateState({
      namedInvitees: state.namedInvitees.filter((n) => n !== name),
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Account users section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Invite people with accounts
        </h3>

        {/* Group selector */}
        {loadingGroups ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            No groups yet. Create groups to easily invite people.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  selectedGroupIds.includes(group.id)
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {group.name} ({group.memberCount})
              </button>
            ))}
          </div>
        )}

        {/* User list */}
        {selectedGroupIds.length > 0 && (
          <div className="max-h-32 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
            {loadingUsers ? (
              <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400">Loading users...</div>
            ) : availableUsers.length === 0 ? (
              <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400">No users available</div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`w-full p-2 flex items-center gap-2 text-left ${
                      state.selectedUserIds.includes(u.id)
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        state.selectedUserIds.includes(u.id)
                          ? "bg-blue-600 border-blue-600"
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}
                    >
                      {state.selectedUserIds.includes(u.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {u.displayName || u.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected count */}
        {state.selectedUserIds.length > 0 && (
          <div className="text-sm text-blue-600 dark:text-blue-400">
            {state.selectedUserIds.length} user{state.selectedUserIds.length !== 1 ? "s" : ""} selected
          </div>
        )}
      </div>

      {/* Named people section - only if allowNamedPeople is true */}
      {state.allowNamedPeople && (
        <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Add people by name
          </h3>

          <div className="flex gap-2">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter name"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNamedPerson())}
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={addNamedPerson}
              disabled={!newName.trim()}
            >
              Add
            </Button>
          </div>

          {/* Named invitees list */}
          {state.namedInvitees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.namedInvitees.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeName(name)}
                    className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
