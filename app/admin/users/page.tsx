"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { UserRole, UserType } from "@/lib/generated/prisma";

interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phoneNumber: string | null;
  role: UserRole;
  userType: UserType;
  subscription: string;
  timezone: string;
  language: string;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
  tripCount: number;
  groupCount: number;
  deletedAt?: string | null;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [editRole, setEditRole] = useState<UserRole>(UserRole.USER);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editSuspended, setEditSuspended] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUsers, setDeletingUsers] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showSystemUsers, setShowSystemUsers] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
      return;
    }

    // Check if user is admin
    if (!authLoading && user && userProfile && userProfile.role !== UserRole.ADMIN) {
      setToast({ message: "Access denied. User management is only available to admin users.", type: "error" });
      router.push("/");
    }
  }, [user, userProfile, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchUsers = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditDisplayName(user.displayName || "");
    setEditPhoneNumber(user.phoneNumber || "");
    setEditSuspended(!!user.deletedAt);
    setNewPassword("");
    setShowPasswordSection(false);
    setShowEditModal(true);
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.size === filteredUsers.filter(u => u.id !== user?.uid).length) {
      setSelectedUserIds(new Set());
    } else {
      const allIds = new Set(filteredUsers.filter(u => u.id !== user?.uid).map(u => u.id));
      setSelectedUserIds(allIds);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser) return;

    setSavingUser(true);

    try {
      const token = await user.getIdToken();

      // Determine what changed
      const roleChanged = editRole !== selectedUser.role;
      const infoChanged =
        editDisplayName !== (selectedUser.displayName || "") ||
        editPhoneNumber !== (selectedUser.phoneNumber || "");
      const suspendedChanged = editSuspended !== !!selectedUser.deletedAt;

      // Update role if changed
      if (roleChanged) {
        const roleResponse = await fetch(`/api/admin/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: editRole,
          }),
        });

        if (!roleResponse.ok) {
          const errorData = await roleResponse.json();
          throw new Error(errorData.error || "Failed to update user role");
        }
      }

      // Update info if changed
      if (infoChanged) {
        const infoResponse = await fetch(`/api/admin/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            displayName: editDisplayName || undefined,
            phoneNumber: editPhoneNumber || null,
          }),
        });

        if (!infoResponse.ok) {
          const errorData = await infoResponse.json();
          throw new Error(errorData.error || "Failed to update user info");
        }
      }

      // Handle suspend/unsuspend
      if (suspendedChanged) {
        if (editSuspended) {
          // Suspend user
          const suspendResponse = await fetch(`/api/admin/users/${selectedUser.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!suspendResponse.ok) {
            const errorData = await suspendResponse.json();
            throw new Error(errorData.error || "Failed to suspend user");
          }
        } else {
          // Reactivate user
          const reactivateResponse = await fetch(`/api/admin/users/${selectedUser.id}?action=reactivate`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!reactivateResponse.ok) {
            const errorData = await reactivateResponse.json();
            throw new Error(errorData.error || "Failed to reactivate user");
          }
        }
      }

      // Handle password reset if provided
      if (newPassword.trim().length > 0) {
        const passwordResponse = await fetch(`/api/admin/users/${selectedUser.id}/password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            newPassword: newPassword,
          }),
        });

        if (!passwordResponse.ok) {
          const errorData = await passwordResponse.json();
          throw new Error(errorData.error || "Failed to reset password");
        }
      }

      setToast({ message: "User updated successfully!", type: "success" });
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error("Error updating user:", err);
      setToast({ message: err.message || "Failed to update user", type: "error" });
    } finally {
      setSavingUser(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreatingUser(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserDisplayName || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create user");
      }

      setToast({ message: "User created successfully!", type: "success" });
      setShowCreateModal(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserDisplayName("");
      fetchUsers();
    } catch (err: any) {
      console.error("Error creating user:", err);
      setToast({ message: err.message || "Failed to create user", type: "error" });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedUserIds.size === 0) return;

    const count = selectedUserIds.size;
    if (!confirm(`Are you sure you want to delete ${count} selected user${count > 1 ? 's' : ''}? This will permanently remove them from the system.`)) {
      return;
    }

    setDeletingUsers(true);

    try {
      const token = await user.getIdToken();
      const errors: string[] = [];

      // Delete users one by one
      for (const userId of Array.from(selectedUserIds)) {
        try {
          const response = await fetch(`/api/admin/users/${userId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            const userName = users.find(u => u.id === userId)?.displayName || 'Unknown';
            errors.push(`${userName}: ${errorData.error}`);
          }
        } catch (err: any) {
          const userName = users.find(u => u.id === userId)?.displayName || 'Unknown';
          errors.push(`${userName}: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        setToast({
          message: `Failed to delete some users: ${errors.join(', ')}`,
          type: "error"
        });
      } else {
        setToast({
          message: `Successfully deleted ${count} user${count > 1 ? 's' : ''}`,
          type: "success"
        });
      }

      setSelectedUserIds(new Set());
      fetchUsers();
    } catch (err: any) {
      console.error("Error deleting users:", err);
      setToast({ message: err.message || "Failed to delete users", type: "error" });
    } finally {
      setDeletingUsers(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.VIEWER:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case UserRole.ADMIN:
        return "bg-purple-100 text-purple-800 border-purple-200";
      case UserRole.SUPERADMIN:
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-zinc-100 text-zinc-800 border-zinc-200";
    }
  };

  const filteredUsers = users.filter((u) => {
    // Filter by search query
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter out non-FULL users unless showSystemUsers is enabled
    // SYSTEM = viewer accounts created by the system
    // SIGNUP = accounts created during trip sign-up
    if (!showSystemUsers && u.userType !== UserType.FULL) {
      return false;
    }

    return matchesSearch;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">User Management</h1>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add New User
              </Button>
              {selectedUserIds.size > 0 && (
                <Button
                  onClick={handleDeleteSelected}
                  disabled={deletingUsers}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deletingUsers ? "Deleting..." : `Delete Selected (${selectedUserIds.size})`}
                </Button>
              )}
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Total Users: {users.length}
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={showSystemUsers}
                onChange={(e) => setShowSystemUsers(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              Show system users
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-white">
              {searchQuery ? "No users found" : "No users yet"}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              {searchQuery
                ? "Try a different search term"
                : "Users will appear here when they sign up"}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.size === filteredUsers.filter(u => u.id !== user?.uid).length && filteredUsers.length > 0}
                      onChange={toggleAllUsers}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      {u.id !== user?.uid && (
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => toggleUserSelection(u.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-semibold">
                            {u.displayName?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">
                            {u.displayName || "No name"}
                          </div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRoleBadgeColor(
                          u.role
                        )}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${
                          u.deletedAt
                            ? "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
                            : "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
                        }`}
                      >
                        {u.deletedAt ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        {u.tripCount} trips, {u.groupCount} groups
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEditUser(u)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-3 py-1 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Add New User</h2>

            <form onSubmit={handleCreateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-zinc-900 dark:text-white">Email *</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-zinc-900 dark:text-white">Display Name</label>
                <input
                  type="text"
                  value={newUserDisplayName}
                  onChange={(e) => setNewUserDisplayName(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  placeholder="John Doe"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-zinc-900 dark:text-white">Password *</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Password must be at least 6 characters long
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewUserEmail("");
                    setNewUserPassword("");
                    setNewUserDisplayName("");
                  }}
                  className="flex-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                  disabled={creatingUser}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={creatingUser}
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Edit User</h2>

            <form onSubmit={handleSaveUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-zinc-900 dark:text-white">Email</label>
                <input
                  type="text"
                  value={selectedUser.email}
                  disabled
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Email cannot be changed</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-zinc-900 dark:text-white">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  placeholder="User's display name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-zinc-900 dark:text-white">Phone Number</label>
                <input
                  type="text"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  placeholder="User's phone number"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-zinc-900 dark:text-white">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  disabled={selectedUser.id === user?.uid}
                >
                  <option value={UserRole.VIEWER}>Viewer (Read-only)</option>
                  <option value={UserRole.USER}>User</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.SUPERADMIN}>Super Admin</option>
                </select>
                {selectedUser.id === user?.uid && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">You cannot change your own role</p>
                )}
              </div>

              {/* Account Status - only for other users, not yourself */}
              {selectedUser.id !== user?.uid && (
                <div className="mb-4 p-4 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-900 dark:text-white">Account Status</label>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {editSuspended
                          ? "User is suspended and cannot log in"
                          : "User can log in normally"}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSuspended}
                        onChange={(e) => setEditSuspended(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-zinc-300 dark:peer-focus:ring-zinc-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      <span className="ml-3 text-sm font-medium text-zinc-900 dark:text-white">
                        {editSuspended ? "Suspended" : "Active"}
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Password Reset - available for all users except yourself */}
              {selectedUser.id !== user?.uid && (
                <div className="mb-6 p-4 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setShowPasswordSection(!showPasswordSection)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-900 dark:text-white">Password Reset</label>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {showPasswordSection
                          ? "Enter a new password for this user"
                          : "Click to reset user's password"}
                      </p>
                    </div>
                    <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                      {showPasswordSection ? "Hide" : "Show"}
                    </span>
                  </button>
                  {showPasswordSection && (
                    <div className="mt-4">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        placeholder="Enter new password (min 6 characters)"
                        minLength={6}
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                        Leave blank to keep current password unchanged
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                  disabled={savingUser}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={savingUser}
                >
                  {savingUser ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-28 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
