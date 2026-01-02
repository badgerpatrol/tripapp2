import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createGroup,
  getGroup,
  listUserGroups,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  listGroupMembers,
  getDiscoverableUsers,
} from "@/server/services/groups";
import { GroupMemberRole } from "@/lib/generated/prisma";

describe("Groups Service", () => {
  const testUser1Id = "test-user-1";
  const testUser2Id = "test-user-2";
  const testUser3Id = "test-user-3";
  let groupId: string;

  beforeEach(async () => {
    // Clean up any leftover data from previous failed runs
    await prisma.groupMember.deleteMany({
      where: { userId: { in: [testUser1Id, testUser2Id, testUser3Id] } },
    });
    await prisma.group.deleteMany({
      where: { ownerId: { in: [testUser1Id, testUser2Id, testUser3Id] } },
    });
    await prisma.eventLog.deleteMany({
      where: { byUser: { in: [testUser1Id, testUser2Id, testUser3Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUser1Id, testUser2Id, testUser3Id] } },
    });

    // Create test users
    await prisma.user.createMany({
      data: [
        {
          id: testUser1Id,
          email: "user1@test.com",
          displayName: "User One",
        },
        {
          id: testUser2Id,
          email: "user2@test.com",
          displayName: "User Two",
        },
        {
          id: testUser3Id,
          email: "user3@test.com",
          displayName: "User Three",
        },
      ],
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await prisma.groupMember.deleteMany({
      where: {
        userId: {
          in: [testUser1Id, testUser2Id, testUser3Id],
        },
      },
    });
    await prisma.group.deleteMany({
      where: {
        ownerId: {
          in: [testUser1Id, testUser2Id, testUser3Id],
        },
      },
    });
    // Delete event logs before users (foreign key constraint)
    await prisma.eventLog.deleteMany({
      where: {
        byUser: {
          in: [testUser1Id, testUser2Id, testUser3Id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUser1Id, testUser2Id, testUser3Id],
        },
      },
    });
  });

  describe("createGroup", () => {
    it("should create a new group with owner as admin member", async () => {
      const group = await createGroup(testUser1Id, {
        name: "Test Group",
        description: "A test group",
      });

      expect(group).toBeDefined();
      expect(group.name).toBe("Test Group");
      expect(group.description).toBe("A test group");
      expect(group.ownerId).toBe(testUser1Id);

      // Verify owner is added as admin member
      const members = await prisma.groupMember.findMany({
        where: { groupId: group.id },
      });

      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(testUser1Id);
      expect(members[0].role).toBe(GroupMemberRole.ADMIN);

      groupId = group.id;
    });
  });

  describe("getGroup", () => {
    beforeEach(async () => {
      const group = await createGroup(testUser1Id, {
        name: "Test Group",
      });
      groupId = group.id;
    });

    it("should get a group without members", async () => {
      const group = await getGroup(groupId, false);

      expect(group).toBeDefined();
      expect(group.id).toBe(groupId);
      expect(group.name).toBe("Test Group");
      expect(group.members).toBeUndefined();
    });

    it("should get a group with members", async () => {
      // Add another member
      await addGroupMember(groupId, testUser1Id, {
        userId: testUser2Id,
        role: GroupMemberRole.MEMBER,
      });

      const group = await getGroup(groupId, true);

      expect(group).toBeDefined();
      expect(group.members).toBeDefined();
      expect(group.members).toHaveLength(2); // Owner + added member
    });

    it("should throw error for non-existent group", async () => {
      await expect(
        getGroup("non-existent-id", false)
      ).rejects.toThrow("Group not found");
    });
  });

  describe("listUserGroups", () => {
    it("should list groups where user is owner", async () => {
      const group = await createGroup(testUser1Id, { name: "Owner Group" });
      groupId = group.id;

      const groups = await listUserGroups(testUser1Id);

      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe("Owner Group");
      expect(groups[0].memberCount).toBeGreaterThan(0);
    });

    it("should list groups where user is a member", async () => {
      const group = await createGroup(testUser1Id, { name: "Member Group" });
      groupId = group.id;

      await addGroupMember(groupId, testUser1Id, {
        userId: testUser2Id,
        role: GroupMemberRole.MEMBER,
      });

      const groups = await listUserGroups(testUser2Id);

      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe("Member Group");
    });

    it("should return empty array if user has no groups", async () => {
      const groups = await listUserGroups(testUser3Id);
      expect(groups).toHaveLength(0);
    });
  });

  describe("updateGroup", () => {
    beforeEach(async () => {
      const group = await createGroup(testUser1Id, { name: "Old Name" });
      groupId = group.id;
    });

    it("should update group name", async () => {
      const updated = await updateGroup(groupId, testUser1Id, {
        name: "New Name",
      });

      expect(updated.name).toBe("New Name");
    });

    it("should update group description", async () => {
      const updated = await updateGroup(groupId, testUser1Id, {
        description: "Updated description",
      });

      expect(updated.description).toBe("Updated description");
    });
  });

  describe("deleteGroup", () => {
    beforeEach(async () => {
      const group = await createGroup(testUser1Id, { name: "To Delete" });
      groupId = group.id;
    });

    it("should delete group as owner", async () => {
      const result = await deleteGroup(groupId, testUser1Id);

      expect(result.success).toBe(true);

      // Verify group is deleted
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });
      expect(group).toBeNull();
    });

    it("should throw error if non-owner tries to delete", async () => {
      await expect(
        deleteGroup(groupId, testUser2Id)
      ).rejects.toThrow("Only the group owner can delete");
    });
  });

  describe("addGroupMember", () => {
    beforeEach(async () => {
      const group = await createGroup(testUser1Id, { name: "Test Group" });
      groupId = group.id;
    });

    it("should add a member to the group", async () => {
      const member = await addGroupMember(groupId, testUser1Id, {
        userId: testUser2Id,
        role: GroupMemberRole.MEMBER,
      });

      expect(member).toBeDefined();
      expect(member.userId).toBe(testUser2Id);
      expect(member.role).toBe(GroupMemberRole.MEMBER);
      expect(member.user).toBeDefined();
      expect(member.user?.displayName).toBe("User Two");
    });

    it("should prevent duplicate memberships", async () => {
      await addGroupMember(groupId, testUser1Id, {
        userId: testUser2Id,
      });

      await expect(
        addGroupMember(groupId, testUser1Id, { userId: testUser2Id })
      ).rejects.toThrow("already a member");
    });

    it("should throw error for non-existent user", async () => {
      await expect(
        addGroupMember(groupId, testUser1Id, {
          userId: "non-existent-user",
        })
      ).rejects.toThrow("User not found");
    });
  });

  describe("removeGroupMember", () => {
    beforeEach(async () => {
      const group = await createGroup(testUser1Id, { name: "Test Group" });
      groupId = group.id;

      await addGroupMember(groupId, testUser1Id, {
        userId: testUser2Id,
      });
    });

    it("should remove a member from the group", async () => {
      const result = await removeGroupMember(groupId, testUser2Id, testUser1Id);

      expect(result.success).toBe(true);

      // Verify member is removed
      const member = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: testUser2Id,
          },
        },
      });
      expect(member).toBeNull();
    });

    it("should prevent removing the group owner", async () => {
      await expect(
        removeGroupMember(groupId, testUser1Id, testUser1Id)
      ).rejects.toThrow("Cannot remove the group owner");
    });

    it("should throw error for non-member", async () => {
      await expect(
        removeGroupMember(groupId, testUser3Id, testUser1Id)
      ).rejects.toThrow("not a member");
    });
  });

  describe("listGroupMembers", () => {
    beforeEach(async () => {
      const group = await createGroup(testUser1Id, { name: "Test Group" });
      groupId = group.id;

      await addGroupMember(groupId, testUser1Id, {
        userId: testUser2Id,
        role: GroupMemberRole.MEMBER,
      });
      await addGroupMember(groupId, testUser1Id, {
        userId: testUser3Id,
        role: GroupMemberRole.ADMIN,
      });
    });

    it("should list all group members with user details", async () => {
      const members = await listGroupMembers(groupId);

      expect(members).toHaveLength(3); // Owner + 2 added members
      expect(members[0].user).toBeDefined();

      // Verify sorting (admins first)
      const adminCount = members.filter(
        (m) => m.role === GroupMemberRole.ADMIN
      ).length;
      expect(adminCount).toBe(2); // Owner and user3
    });
  });

  describe("getDiscoverableUsers", () => {
    let group1Id: string;
    let group2Id: string;

    beforeEach(async () => {
      // Create two groups with overlapping members
      const group1 = await createGroup(testUser1Id, {
        name: "Group 1",
      });
      group1Id = group1.id;

      const group2 = await createGroup(testUser1Id, {
        name: "Group 2",
      });
      group2Id = group2.id;

      // Group 1: user1 (owner), user2
      await addGroupMember(group1Id, testUser1Id, {
        userId: testUser2Id,
      });

      // Group 2: user1 (owner), user3
      await addGroupMember(group2Id, testUser1Id, {
        userId: testUser3Id,
      });
    });

    afterEach(async () => {
      await prisma.groupMember.deleteMany({
        where: {
          groupId: {
            in: [group1Id, group2Id],
          },
        },
      });
      await prisma.group.deleteMany({
        where: {
          id: {
            in: [group1Id, group2Id],
          },
        },
      });
    });

    it("should return members from a single group", async () => {
      const users = await getDiscoverableUsers(testUser1Id, [group1Id]);

      expect(users).toHaveLength(2); // user1 and user2
      const userIds = users.map((u) => u.id);
      expect(userIds).toContain(testUser1Id);
      expect(userIds).toContain(testUser2Id);
    });

    it("should return union of members from multiple groups (de-duplicated)", async () => {
      const users = await getDiscoverableUsers(testUser1Id, [
        group1Id,
        group2Id,
      ]);

      expect(users).toHaveLength(3); // user1, user2, user3 (de-duplicated)
      const userIds = users.map((u) => u.id);
      expect(userIds).toContain(testUser1Id);
      expect(userIds).toContain(testUser2Id);
      expect(userIds).toContain(testUser3Id);
    });

    it("should exclude existing trip members when tripId provided", async () => {
      // Create a test trip and add user2 as member
      const trip = await prisma.trip.create({
        data: {
          name: "Test Trip",
          baseCurrency: "USD",
          createdById: testUser1Id,
        },
      });

      await prisma.tripMember.create({
        data: {
          tripId: trip.id,
          userId: testUser2Id,
          role: "MEMBER",
          rsvpStatus: "PENDING",
        },
      });

      const users = await getDiscoverableUsers(
        testUser1Id,
        [group1Id],
        trip.id
      );

      expect(users).toHaveLength(1); // Only user1 (user2 excluded)
      expect(users[0].id).toBe(testUser1Id);

      // Cleanup
      await prisma.tripMember.deleteMany({ where: { tripId: trip.id } });
      await prisma.trip.delete({ where: { id: trip.id } });
    });

    it("should throw error if caller is not a member of selected group", async () => {
      await expect(
        getDiscoverableUsers(testUser2Id, [group2Id]) // user2 is not in group2
      ).rejects.toThrow("not a member");
    });

    it("should return empty array for empty groupIds", async () => {
      const users = await getDiscoverableUsers(testUser1Id, []);
      expect(users).toHaveLength(0);
    });
  });
});
