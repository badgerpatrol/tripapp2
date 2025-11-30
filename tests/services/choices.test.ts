/**
 * Tests for Choice Service
 * Covers the test scenarios from the specification
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createChoice,
  createChoiceItem,
  updateChoice,
  updateChoiceStatus,
  archiveChoice,
  restoreChoice,
  getTripChoices,
  getChoiceDetail,
  createOrUpdateSelection,
  deleteSelection,
  getChoiceRespondents,
  getItemsReport,
  getUsersReport,
  deactivateChoiceItem,
  ensureNoParticipationItem,
} from "@/server/services/choices";

const TEST_USER_1 = "test-user-choice-1";
const TEST_USER_2 = "test-user-choice-2";
const TEST_USER_3 = "test-user-choice-3";
const TEST_TRIP_ID = "test-trip-choice";

describe("Choice Service Tests", () => {
  beforeEach(async () => {
    // Create test users
    await prisma.user.createMany({
      data: [
        {
          id: TEST_USER_1,
          email: "choice-user1@test.com",
          displayName: "Choice User 1",
          role: "USER",
        },
        {
          id: TEST_USER_2,
          email: "choice-user2@test.com",
          displayName: "Choice User 2",
          role: "USER",
        },
        {
          id: TEST_USER_3,
          email: "choice-user3@test.com",
          displayName: "Choice User 3",
          role: "USER",
        },
      ],
      skipDuplicates: true,
    });

    // Create test trip
    await prisma.trip.create({
      data: {
        id: TEST_TRIP_ID,
        name: "Test Trip for Choices",
        createdById: TEST_USER_1,
        members: {
          create: [
            {
              userId: TEST_USER_1,
              role: "OWNER",
              rsvpStatus: "ACCEPTED",
            },
            {
              userId: TEST_USER_2,
              role: "MEMBER",
              rsvpStatus: "ACCEPTED",
            },
            {
              userId: TEST_USER_3,
              role: "MEMBER",
              rsvpStatus: "ACCEPTED",
            },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    await prisma.choiceSelectionLine.deleteMany({});
    await prisma.choiceSelection.deleteMany({});
    await prisma.choiceActivity.deleteMany({});
    await prisma.choiceItem.deleteMany({});
    await prisma.choice.deleteMany({});
    await prisma.tripMember.deleteMany({ where: { tripId: TEST_TRIP_ID } });
    await prisma.trip.deleteMany({ where: { id: TEST_TRIP_ID } });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_1, TEST_USER_2, TEST_USER_3] } },
    });
  });

  // Test Scenario: create_choice_success
  it("should create a choice with defaults set and visible to participants", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Lunch Restaurant Choice",
      description: "Where should we eat?",
    });

    expect(choice.id).toBeDefined();
    expect(choice.name).toBe("Lunch Restaurant Choice");
    expect(choice.status).toBe("OPEN");
    expect(choice.visibility).toBe("TRIP");
    expect(choice.createdById).toBe(TEST_USER_1);
    expect(choice.archivedAt).toBeNull();
  });

  // Test Scenario: add_items_and_list
  it("should add items with allergens/tags and list them in stable order", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu Choice",
    });

    const item1 = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Margherita Pizza",
      price: 12.50,
      allergens: ["gluten", "dairy"],
      tags: ["vegetarian"],
    });

    const item2 = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Caesar Salad",
      price: 8.00,
      allergens: ["dairy"],
      tags: ["salad"],
    });

    const detail = await getChoiceDetail(choice.id, TEST_USER_1);

    expect(detail.items).toHaveLength(2);
    expect(detail.items[0].name).toBe("Margherita Pizza");
    expect(detail.items[0].allergens).toContain("gluten");
    expect(detail.items[0].allergens).toContain("dairy");
    expect(detail.items[1].name).toBe("Caesar Salad");
  });

  // Test Scenario: select_within_caps
  it("should allow user to add selections within maxPerUser and maxTotal", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Limited Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Limited Item",
      maxPerUser: 2,
      maxTotal: 5,
    });

    // User 1 selects 2 (within cap)
    const result = await createOrUpdateSelection(choice.id, TEST_USER_1, {
      lines: [
        { itemId: item.id, quantity: 2 },
      ],
    });

    expect(result.mySelections).toHaveLength(1);
    expect(result.mySelections[0].quantity).toBe(2);
  });

  // Test Scenario: select_exceeds_caps
  it("should return error when selection exceeds caps", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Limited Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Limited Item",
      maxPerUser: 2,
      maxTotal: 5,
    });

    // Try to exceed maxPerUser
    await expect(
      createOrUpdateSelection(choice.id, TEST_USER_1, {
        lines: [{ itemId: item.id, quantity: 3 }],
      })
    ).rejects.toThrow(/exceeds per-user limit/);

    // User 1 selects 2
    await createOrUpdateSelection(choice.id, TEST_USER_1, {
      lines: [{ itemId: item.id, quantity: 2 }],
    });

    // User 2 selects 2
    await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: item.id, quantity: 2 }],
    });

    // User 3 tries to select 2 (would exceed maxTotal of 5)
    await expect(
      createOrUpdateSelection(choice.id, TEST_USER_3, {
        lines: [{ itemId: item.id, quantity: 2 }],
      })
    ).rejects.toThrow(/would exceed total stock limit/);
  });

  // Test Scenario: edit_selection_atomic
  it("should handle selection updates atomically", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item1 = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Item 1",
    });

    const item2 = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Item 2",
      maxTotal: 1,
    });

    // Initial selection
    await createOrUpdateSelection(choice.id, TEST_USER_1, {
      lines: [{ itemId: item1.id, quantity: 1 }],
    });

    // User 2 takes the limited item
    await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: item2.id, quantity: 1 }],
    });

    // User 1 tries to update to include the limited item (should fail)
    await expect(
      createOrUpdateSelection(choice.id, TEST_USER_1, {
        lines: [
          { itemId: item1.id, quantity: 1 },
          { itemId: item2.id, quantity: 1 },
        ],
      })
    ).rejects.toThrow(/would exceed total stock limit/);

    // Original selection should still be intact
    const detail = await getChoiceDetail(choice.id, TEST_USER_1);
    expect(detail.mySelections).toHaveLength(1);
    expect(detail.mySelections[0].item?.name).toBe("Item 1");
  });

  // Test Scenario: close_choice_readonly
  it("should prevent modifications after close, allow organiser to reopen", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Item",
    });

    // Close the choice
    await updateChoiceStatus(choice.id, TEST_USER_1, "CLOSED");

    // Try to create selection (should fail)
    await expect(
      createOrUpdateSelection(choice.id, TEST_USER_2, {
        lines: [{ itemId: item.id, quantity: 1 }],
      })
    ).rejects.toThrow(/closed/);

    // Reopen as organiser
    await updateChoiceStatus(choice.id, TEST_USER_1, "OPEN");

    // Now selection should work
    const result = await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: item.id, quantity: 1 }],
    });

    expect(result.mySelections).toHaveLength(1);
  });

  // Test Scenario: respondents_breakdown
  it("should correctly identify responded and pending users", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Item",
    });

    // Only user 2 responds
    await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: item.id, quantity: 1 }],
    });

    const respondents = await getChoiceRespondents(choice.id, TEST_TRIP_ID);

    expect(respondents.respondedUserIds).toContain(TEST_USER_2);
    expect(respondents.respondedUserIds).toHaveLength(1);
    expect(respondents.pendingUserIds).toContain(TEST_USER_1);
    expect(respondents.pendingUserIds).toContain(TEST_USER_3);
    expect(respondents.pendingUserIds).toHaveLength(2);

    // Check user details are included
    expect(respondents.respondedUsers).toBeDefined();
    expect(respondents.respondedUsers).toHaveLength(1);
    expect(respondents.respondedUsers[0]).toMatchObject({
      userId: TEST_USER_2,
      displayName: "Choice User 2",
      email: "choice-user2@test.com",
    });

    expect(respondents.pendingUsers).toBeDefined();
    expect(respondents.pendingUsers).toHaveLength(2);
    const pendingUserIds = respondents.pendingUsers.map((u: any) => u.userId);
    expect(pendingUserIds).toContain(TEST_USER_1);
    expect(pendingUserIds).toContain(TEST_USER_3);

    // Verify user details are present
    const user1 = respondents.pendingUsers.find((u: any) => u.userId === TEST_USER_1);
    expect(user1).toMatchObject({
      displayName: "Choice User 1",
      email: "choice-user1@test.com",
    });
  });

  // Test Scenario: item_deactivated_visibility
  it("should hide deactivated items for new picks but keep in reports", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Item to Deactivate",
      price: 10,
    });

    // User selects the item
    await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: item.id, quantity: 2 }],
    });

    // Deactivate the item
    await deactivateChoiceItem(item.id, TEST_USER_1);

    // Check detail view (should not show in active items)
    const detail = await getChoiceDetail(choice.id, TEST_USER_1);
    expect(detail.items).toHaveLength(0); // No active items

    // Check report (should still show in reports)
    const report = await getItemsReport(choice.id);
    expect(report.items).toHaveLength(1);
    expect(report.items[0].name).toBe("Item to Deactivate");
    expect(report.items[0].qtyTotal).toBe(2);
  });

  // Test Scenario: reports_totals_correct
  it("should aggregate reports correctly with exact money sums", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item1 = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Pizza",
      price: 12.50,
    });

    const item2 = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Salad",
      price: 8.00,
    });

    // User 1: 2 pizzas
    await createOrUpdateSelection(choice.id, TEST_USER_1, {
      lines: [{ itemId: item1.id, quantity: 2 }],
    });

    // User 2: 1 pizza, 1 salad
    await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [
        { itemId: item1.id, quantity: 1 },
        { itemId: item2.id, quantity: 1 },
      ],
    });

    // Item report
    const itemReport = await getItemsReport(choice.id);
    expect(itemReport.items).toHaveLength(2);

    const pizzaItem = itemReport.items.find(i => i.name === "Pizza");
    expect(pizzaItem?.qtyTotal).toBe(3);
    expect(pizzaItem?.totalPrice).toBe(37.50);
    expect(pizzaItem?.distinctUsers).toBe(2);

    const saladItem = itemReport.items.find(i => i.name === "Salad");
    expect(saladItem?.qtyTotal).toBe(1);
    expect(saladItem?.totalPrice).toBe(8.00);

    expect(itemReport.grandTotalPrice).toBe(45.50);

    // User report
    const userReport = await getUsersReport(choice.id);
    expect(userReport.users).toHaveLength(2);

    const user1Report = userReport.users.find(u => u.userId === TEST_USER_1);
    expect(user1Report?.userTotalPrice).toBe(25.00);

    const user2Report = userReport.users.find(u => u.userId === TEST_USER_2);
    expect(user2Report?.userTotalPrice).toBe(20.50);

    expect(userReport.grandTotalPrice).toBe(45.50);
  });

  // Test Scenario: archive_and_restore
  it("should hide archived choice from list and allow restore", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Old Menu",
    });

    // Archive the choice
    await archiveChoice(choice.id, TEST_USER_1);

    // Should not appear in default list
    const choices = await getTripChoices(TEST_TRIP_ID, {
      includeArchived: false,
    });
    expect(choices).toHaveLength(0);

    // Should appear when includeArchived is true
    const allChoices = await getTripChoices(TEST_TRIP_ID, {
      includeArchived: true,
    });
    expect(allChoices).toHaveLength(1);
    expect(allChoices[0].archivedAt).not.toBeNull();

    // Restore
    await restoreChoice(choice.id, TEST_USER_1);

    // Should now appear in default list
    const restoredChoices = await getTripChoices(TEST_TRIP_ID, {
      includeArchived: false,
    });
    expect(restoredChoices).toHaveLength(1);
    expect(restoredChoices[0].archivedAt).toBeNull();
  });

  // Additional test: Deadline enforcement
  it("should prevent selections after deadline has passed", async () => {
    const pastDeadline = new Date(Date.now() - 3600 * 1000); // 1 hour ago

    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu with Deadline",
    });

    // Set deadline in the past
    await updateChoiceStatus(choice.id, TEST_USER_1, "OPEN", pastDeadline);

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Item",
    });

    // Try to create selection (should fail due to deadline)
    await expect(
      createOrUpdateSelection(choice.id, TEST_USER_2, {
        lines: [{ itemId: item.id, quantity: 1 }],
      })
    ).rejects.toThrow(/deadline has passed/);
  });

  // NO_PARTICIPATION Tests

  // Test Scenario: create_no_participation_item
  it("should create a NO_PARTICIPATION item for a choice", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu with Opt-out",
    });

    const noParticipationItem = await ensureNoParticipationItem(choice.id, TEST_USER_1);

    expect(noParticipationItem.type).toBe("NO_PARTICIPATION");
    expect(noParticipationItem.name).toBe("Not participating");
    expect(noParticipationItem.price).toBeNull();
  });

  // Test Scenario: no_participation_exclusivity
  it("should prevent selecting NO_PARTICIPATION with other items", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Pizza",
      price: 12.50,
    });

    const noParticipationItem = await ensureNoParticipationItem(choice.id, TEST_USER_1);

    // Try to select both NO_PARTICIPATION and a regular item
    await expect(
      createOrUpdateSelection(choice.id, TEST_USER_2, {
        lines: [
          { itemId: item.id, quantity: 1 },
          { itemId: noParticipationItem.id, quantity: 1 },
        ],
      })
    ).rejects.toThrow(/Cannot select NO_PARTICIPATION together with other items/);
  });

  // Test Scenario: select_only_no_participation
  it("should allow selecting only NO_PARTICIPATION", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Pizza",
      price: 12.50,
    });

    const noParticipationItem = await ensureNoParticipationItem(choice.id, TEST_USER_1);

    // Select NO_PARTICIPATION only
    const result = await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: noParticipationItem.id, quantity: 1 }],
    });

    expect(result.mySelections).toHaveLength(1);
    expect(result.myTotal).toBe(0); // NO_PARTICIPATION has no price
  });

  // Test Scenario: respondents_with_no_participation
  it("should correctly identify NO_PARTICIPATION users separately", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Pizza",
      price: 12.50,
    });

    const noParticipationItem = await ensureNoParticipationItem(choice.id, TEST_USER_1);

    // User 1 selects pizza
    await createOrUpdateSelection(choice.id, TEST_USER_1, {
      lines: [{ itemId: item.id, quantity: 1 }],
    });

    // User 2 selects NO_PARTICIPATION
    await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: noParticipationItem.id, quantity: 1 }],
    });

    // User 3 has not responded
    const respondents = await getChoiceRespondents(choice.id, TEST_TRIP_ID);

    expect(respondents.respondedUserIds).toContain(TEST_USER_1);
    expect(respondents.respondedUserIds).toHaveLength(1);
    expect(respondents.noParticipationUserIds).toContain(TEST_USER_2);
    expect(respondents.noParticipationUserIds).toHaveLength(1);
    expect(respondents.pendingUserIds).toContain(TEST_USER_3);
    expect(respondents.pendingUserIds).toHaveLength(1);
  });

  // Test Scenario: reports_exclude_no_participation_from_totals
  it("should exclude NO_PARTICIPATION from grand totals in reports", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    const item = await createChoiceItem(choice.id, TEST_USER_1, {
      name: "Pizza",
      price: 10.00,
    });

    const noParticipationItem = await ensureNoParticipationItem(choice.id, TEST_USER_1);

    // User 1 selects pizza
    await createOrUpdateSelection(choice.id, TEST_USER_1, {
      lines: [{ itemId: item.id, quantity: 2 }],
    });

    // User 2 selects NO_PARTICIPATION
    await createOrUpdateSelection(choice.id, TEST_USER_2, {
      lines: [{ itemId: noParticipationItem.id, quantity: 1 }],
    });

    const itemReport = await getItemsReport(choice.id);

    // Should have 2 items in report
    expect(itemReport.items).toHaveLength(2);

    // Grand total should only count pizza
    expect(itemReport.grandTotalPrice).toBe(20.00);

    const userReport = await getUsersReport(choice.id);

    // Should have 2 users
    expect(userReport.users).toHaveLength(2);

    // User 2 should be marked as NO_PARTICIPATION
    const user2Report = userReport.users.find((u: any) => u.userId === TEST_USER_2);
    expect(user2Report?.isNoParticipation).toBe(true);
    expect(user2Report?.lines).toHaveLength(0); // NO_PARTICIPATION lines are filtered out

    // Grand total should only count user 1
    expect(userReport.grandTotalPrice).toBe(20.00);
  });

  // Test Scenario: duplicate_no_participation_prevention
  it("should prevent creating duplicate NO_PARTICIPATION items", async () => {
    const choice = await createChoice(TEST_USER_1, TEST_TRIP_ID, {
      name: "Menu",
    });

    // Create first NO_PARTICIPATION item
    await ensureNoParticipationItem(choice.id, TEST_USER_1);

    // Try to create another NO_PARTICIPATION item directly
    await expect(
      createChoiceItem(choice.id, TEST_USER_1, {
        name: "Another No Participation",
        type: "NO_PARTICIPATION",
      })
    ).rejects.toThrow(/NO_PARTICIPATION item already exists/);

    // ensureNoParticipationItem should just return the existing one
    const existingItem = await ensureNoParticipationItem(choice.id, TEST_USER_1);
    expect(existingItem.name).toBe("Not participating");
  });
});
