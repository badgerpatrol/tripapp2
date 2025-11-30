"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { GroupMemberRole } from "@/lib/generated/prisma";

interface AvailableUser {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

interface GroupMember {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
}

interface AddMembersDialogProps {
  groupId: string;
  groupName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMembersDialog({
  groupId,
  groupName,
  isOpen,
  onClose,
  onSuccess,
}: AddMembersDialogProps) {
  const { user } = useAuth();
  const [currentMembers, setCurrentMembers] = useState<GroupMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasDeletedMembers, setHasDeletedMembers] = useState(false);

  // Fetch members and available users when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      fetchCurrentMembers();
      fetchAvailableUsers();
    }
  }, [isOpen, user]);

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchCurrentMembers = async () => {
    if (!user) return;

    setIsLoadingMembers(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/groups/${groupId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch group members");
      }

      const data = await response.json();
      const members = data.group.members?.map((m: any) => ({
        id: m.id,
        role: m.role,
        user: {
          id: m.user?.id || m.userId,
          email: m.user?.email || "",
          displayName: m.user?.displayName || null,
        },
      })) || [];
      setCurrentMembers(members);
    } catch (err) {
      console.error("Error fetching current members:", err);
      setError("Failed to load current members. Please try again.");
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const fetchAvailableUsers = async () => {
    if (!user) return;

    setIsLoadingUsers(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/groups/${groupId}/available-users`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch available users");
      }

      const data = await response.json();
      setAvailableUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching available users:", err);
      setError("Failed to load available users. Please try again.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    const filtered = getFilteredUsers();
    const filteredIds = filtered.map(u => u.id);
    const allSelected = filteredIds.every(id => selectedUserIds.includes(id));

    if (allSelected) {
      // Deselect all filtered users
      setSelectedUserIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered users
      setSelectedUserIds(prev => {
        const newSet = new Set([...prev, ...filteredIds]);
        return Array.from(newSet);
      });
    }
  };

  const getFilteredUsers = () => {
    if (!searchQuery.trim()) {
      return availableUsers;
    }

    const query = searchQuery.toLowerCase();
    return availableUsers.filter(u =>
      u.email.toLowerCase().includes(query) ||
      (u.displayName && u.displayName.toLowerCase().includes(query))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // If no users selected to add
    if (selectedUserIds.length === 0) {
      // If members were deleted, just close the dialog (changes already saved)
      if (hasDeletedMembers) {
        onClose();
        return;
      }
      // Otherwise, show error
      setError("Please select at least one user to add");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to add members");
      }

      const idToken = await user.getIdToken();
      let successCount = 0;
      let errorCount = 0;

      // Add members one by one
      for (const userId of selectedUserIds) {
        try {
          const response = await fetch(`/api/groups/${groupId}/members`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              userId,
              role: GroupMemberRole.MEMBER,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`Error adding user ${userId}:`, err);
          errorCount++;
        }
      }

      // Show success message
      if (successCount > 0) {
        setSuccessMessage(
          `Successfully added ${successCount} member${successCount !== 1 ? 's' : ''}${
            errorCount > 0 ? `. ${errorCount} failed.` : ''
          }`
        );
      }

      if (errorCount > 0 && successCount === 0) {
        setError("Failed to add members. Please try again.");
      }

      // Refresh the group data
      onSuccess();

      // Clear the selected users
      setSelectedUserIds([]);

      // Refresh the available users list
      await fetchAvailableUsers();

      // Close the form after successful save
      if (successCount > 0) {
        setTimeout(() => {
          onClose();
        }, 1000); // Small delay to show success message
      }
    } catch (err) {
      console.error("Error adding members:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add members. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${userName} from this group?`
    );

    if (!confirmed) return;

    setRemovingUserId(userId);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
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

      // Success - update only the member panes, not the whole page
      setSuccessMessage(`${userName} has been removed from the group`);

      // Remove member from local state
      setCurrentMembers(prev => prev.filter(m => m.user.id !== userId));

      // Track that a member was deleted
      setHasDeletedMembers(true);

      // Refresh the available users list to show the removed user
      await fetchAvailableUsers();
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

  const handleClose = () => {
    if (!isSubmitting) {
      // Refresh parent page with latest data
      onSuccess();
      onClose();
      // Reset state after closing
      setTimeout(() => {
        setCurrentMembers([]);
        setAvailableUsers([]);
        setSelectedUserIds([]);
        setSearchQuery("");
        setError(null);
        setSuccessMessage(null);
        setRemovingUserId(null);
        setHasDeletedMembers(false);
      }, 300);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = getFilteredUsers();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Manage Members
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Add or remove members from {groupName}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              disabled={isSubmitting}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Members Section */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-700 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-5 h-5 text-zinc-600 dark:text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Current Members ({currentMembers.length})
                </label>
              </div>
              <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 max-h-48 overflow-y-auto bg-white dark:bg-zinc-800">
                {isLoadingMembers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-zinc-300 border-t-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {currentMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {(member.user.displayName ?? "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {member.user.displayName ?? "Unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                          {member.role}
                        </span>
                        {member.role !== "OWNER" && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.user.id, member.user.displayName ?? "Unknown")}
                            disabled={removingUserId === member.user.id}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove member"
                          >
                            {removingUserId === member.user.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-300 dark:border-zinc-600"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Add members
                </span>
              </div>
            </div>

            {/* Search Box */}
            <div>
              <label
                htmlFor="search"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Search Users
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  disabled={isSubmitting || isLoadingUsers}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Available Users List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Available Users ({filteredUsers.length})
                </label>
                {filteredUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    disabled={isSubmitting}
                  >
                    {filteredUsers.every(u => selectedUserIds.includes(u.id)) ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {isLoadingUsers ? (
                <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center bg-white dark:bg-zinc-900">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-zinc-300 border-t-blue-600"></div>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center bg-white dark:bg-zinc-900">
                  <svg
                    className="w-12 h-12 mx-auto text-zinc-400 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {searchQuery ? 'No users found matching your search' : 'No users available to add'}
                  </p>
                </div>
              ) : (
                <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg max-h-96 overflow-y-auto bg-white dark:bg-zinc-900">
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {filteredUsers.map((availableUser) => {
                      const isSelected = selectedUserIds.includes(availableUser.id);
                      return (
                        <label
                          key={availableUser.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleUser(availableUser.id)}
                            disabled={isSubmitting}
                            className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
                          />
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-white">
                              {(availableUser.displayName ?? "?")[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {availableUser.displayName ?? "Unknown"}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || (selectedUserIds.length === 0 && !hasDeletedMembers)}
                className="tap-target w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
