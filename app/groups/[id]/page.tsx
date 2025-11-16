"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { GroupMemberRole, UserRole } from "@/lib/generated/prisma";
import AddMembersDialog from "./AddMembersDialog";

interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
  };
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members?: GroupMember[];
}

function GroupDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
      return;
    }

    // Check if user is admin
    if (!authLoading && user && userProfile && userProfile.role !== UserRole.ADMIN) {
      setToast({ message: "Access denied. Groups feature is only available to admin users.", type: "error" });
      router.push("/");
    }
  }, [user, userProfile, authLoading, router]);

  useEffect(() => {
    if (user && groupId) {
      fetchGroup();
    }
  }, [user, groupId]);

  // Auto-open AddMembers dialog if addMembers parameter is present
  useEffect(() => {
    if (searchParams.get("addMembers") === "true" && group) {
      setShowAddMember(true);
      // Clean up the URL parameter
      router.replace(`/groups/${groupId}`, { scroll: false });
    }
  }, [searchParams, group, groupId, router]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchGroup = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/groups/${groupId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have access to this group");
        }
        throw new Error("Failed to fetch group");
      }

      const data = await response.json();
      setGroup(data.group);
      setEditName(data.group.name);
      setEditDescription(data.group.description || "");
    } catch (err: any) {
      console.error("Error fetching group:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!user || !group || !editName.trim()) return;

    setSaving(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update group");
      }

      setToast({ message: "Group updated successfully!", type: "success" });
      setIsEditing(false);
      fetchGroup();
    } catch (err: any) {
      console.error("Error updating group:", err);
      setToast({ message: err.message || "Failed to update group", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMembersDialogSuccess = () => {
    fetchGroup();
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!user) return;
    if (!confirm(`Remove ${memberName} from this group?`)) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove member");
      }

      setToast({ message: "Member removed successfully", type: "success" });
      fetchGroup();
    } catch (err: any) {
      console.error("Error removing member:", err);
      setToast({ message: err.message || "Failed to remove member", type: "error" });
    }
  };

  const isOwner = group && user && group.ownerId === user.uid;
  const isAdmin = group?.members?.some(
    (m) => m.userId === user?.uid && m.role === GroupMemberRole.ADMIN
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading group...</p>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Error Loading Group</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">{error || "Group not found"}</p>
          <Button onClick={() => router.push("/groups")}>
            Back to Groups
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push("/groups")}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-2 flex items-center gap-1"
          >
            ← Back to Groups
          </button>

          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-2xl font-bold px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                maxLength={100}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                placeholder="Description (optional)"
                rows={2}
                maxLength={500}
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(group.name);
                    setEditDescription(group.description || "");
                  }}
                  className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{group.name}</h1>
                {(isOwner || isAdmin) && (
                  <Button onClick={() => setIsEditing(true)} className="text-sm">
                    Edit
                  </Button>
                )}
              </div>
              {group.description && (
                <p className="text-zinc-600 dark:text-zinc-400">{group.description}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Members Section */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Members ({group.members?.length || 0})
            </h2>
            {(isOwner || isAdmin) && (
              <Button onClick={() => setShowAddMember(true)} className="text-sm">
                + Add Member
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {group.members && group.members.length > 0 ? (
              group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                      {member.user?.displayName?.[0] || member.user?.email?.[0] || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {member.user?.displayName || member.user?.email || "Unknown"}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {member.role === GroupMemberRole.ADMIN ? "Admin" : "Member"}
                        {member.userId === group.ownerId && " · Owner"}
                      </p>
                    </div>
                  </div>

                  {(isOwner || isAdmin) && member.userId !== group.ownerId && (
                    <button
                      onClick={() =>
                        handleRemoveMember(
                          member.userId,
                          member.user?.displayName || member.user?.email || "member"
                        )
                      }
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm px-2 py-1"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No members yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Add Members Dialog */}
      <AddMembersDialog
        groupId={groupId}
        groupName={group.name}
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSuccess={handleMembersDialogSuccess}
      />

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

export default function GroupDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <GroupDetailPageContent />
    </Suspense>
  );
}
