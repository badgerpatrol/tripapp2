import { PrismaClient } from '../../lib/generated/prisma/index.js';
import {
  TEST_PREFIX,
  DEFAULT_TEST_USER,
  ADMIN_TEST_USER,
  SUPERADMIN_TEST_USER,
  SECONDARY_TEST_USER,
  DEFAULT_TEST_TRIP,
  TEST_CATEGORIES,
} from '../config/test-constants';

/**
 * Database helper for test data management
 * Provides methods to create, query, and clean up test data
 */
export class DatabaseHelper {
  private static instance: DatabaseHelper;
  private prisma: PrismaClient;
  private initialized: boolean = false;

  private constructor() {
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  /**
   * Get singleton instance of DatabaseHelper
   */
  static async getInstance(): Promise<DatabaseHelper> {
    if (!DatabaseHelper.instance) {
      DatabaseHelper.instance = new DatabaseHelper();
      await DatabaseHelper.instance.connect();
    }
    return DatabaseHelper.instance;
  }

  /**
   * Get the Prisma client for direct queries
   */
  get client(): PrismaClient {
    return this.prisma;
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    if (!this.initialized) {
      await this.prisma.$connect();
      this.initialized = true;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.prisma.$disconnect();
      this.initialized = false;
    }
  }

  // ============================================================================
  // CLEANUP METHODS
  // ============================================================================

  /**
   * Clean all test data (items with test_ prefix)
   */
  async cleanTestData(): Promise<void> {
    // Delete in correct order to respect foreign key constraints
    await this.prisma.itemTick.deleteMany({
      where: { userId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.choiceSelectionLine.deleteMany({
      where: { selection: { userId: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.choiceSelection.deleteMany({
      where: { userId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.choiceActivity.deleteMany({
      where: { choice: { id: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.choiceItem.deleteMany({
      where: { choice: { id: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.choice.deleteMany({
      where: { id: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.payment.deleteMany({
      where: { settlement: { tripId: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.settlement.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.spendAssignment.deleteMany({
      where: { spend: { tripId: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.spendItem.deleteMany({
      where: { spend: { tripId: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.spend.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.checklistItem.deleteMany({
      where: { checklist: { tripId: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.checklist.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.timelineItem.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.invitation.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.transportOffer.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.transportRequirement.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.tripMember.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.featureFlag.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.notification.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.eventLog.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.todoItemTemplate.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.kitItemTemplate.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.listTemplate.deleteMany({
      where: { tripId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.trip.deleteMany({
      where: { id: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.groupMember.deleteMany({
      where: { group: { id: { startsWith: TEST_PREFIX } } },
    });
    await this.prisma.group.deleteMany({
      where: { id: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.passkey.deleteMany({
      where: { userId: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.category.deleteMany({
      where: { id: { startsWith: TEST_PREFIX } },
    });
    await this.prisma.user.deleteMany({
      where: { id: { startsWith: TEST_PREFIX } },
    });
  }

  // ============================================================================
  // SEED METHODS
  // ============================================================================

  /**
   * Seed base test data needed for most tests
   */
  async seedBaseTestData(): Promise<void> {
    // Create test users
    await this.createTestUser(DEFAULT_TEST_USER);
    await this.createTestUser(ADMIN_TEST_USER);
    await this.createTestUser(SUPERADMIN_TEST_USER);
    await this.createTestUser(SECONDARY_TEST_USER);

    // Create test categories
    for (const category of TEST_CATEGORIES) {
      await this.prisma.category.upsert({
        where: { id: category.id },
        update: {},
        create: {
          ...category,
          createdById: DEFAULT_TEST_USER.id,
        },
      });
    }
  }

  // ============================================================================
  // USER METHODS
  // ============================================================================

  /**
   * Create a test user
   */
  async createTestUser(userData: {
    id: string;
    email: string;
    displayName: string;
    role?: 'VIEWER' | 'USER' | 'ADMIN' | 'SUPERADMIN';
    userType?: 'FULL' | 'SYSTEM' | 'SIGNUP';
  }): Promise<any> {
    return this.prisma.user.upsert({
      where: { id: userData.id },
      update: {},
      create: {
        id: userData.id,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role || 'USER',
        userType: userData.userType || 'FULL',
      },
    });
  }

  /**
   * Get a user by ID
   */
  async getUser(userId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // ============================================================================
  // TRIP METHODS
  // ============================================================================

  /**
   * Create a test trip
   */
  async createTestTrip(tripData: {
    id?: string;
    name: string;
    description?: string;
    location?: string;
    baseCurrency?: string;
    status?: 'PLANNING' | 'ACTIVE' | 'FINALIZED' | 'SETTLED';
    createdById: string;
  }): Promise<any> {
    const id = tripData.id || `${TEST_PREFIX}trip_${Date.now()}`;
    return this.prisma.trip.create({
      data: {
        id,
        name: tripData.name,
        description: tripData.description,
        location: tripData.location,
        baseCurrency: tripData.baseCurrency || 'GBP',
        status: tripData.status || 'PLANNING',
        createdById: tripData.createdById,
        members: {
          create: {
            userId: tripData.createdById,
            role: 'OWNER',
            rsvpStatus: 'ACCEPTED',
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  /**
   * Get a trip by ID
   */
  async getTrip(tripId: string): Promise<any> {
    return this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: {
          include: { user: true },
        },
        spends: {
          include: {
            assignments: true,
            items: true,
          },
        },
        choices: {
          include: {
            items: true,
            selections: true,
          },
        },
        settlements: {
          include: { payments: true },
        },
      },
    });
  }

  /**
   * Add a member to a trip
   */
  async addTripMember(
    tripId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER'
  ): Promise<any> {
    return this.prisma.tripMember.create({
      data: {
        tripId,
        userId,
        role,
        rsvpStatus: 'ACCEPTED',
      },
    });
  }

  // ============================================================================
  // SPEND METHODS
  // ============================================================================

  /**
   * Create a test spend
   */
  async createTestSpend(spendData: {
    id?: string;
    tripId: string;
    description: string;
    amount: number;
    currency?: string;
    paidById: string;
    categoryId?: string;
    date?: Date;
  }): Promise<any> {
    const id = spendData.id || `${TEST_PREFIX}spend_${Date.now()}`;
    return this.prisma.spend.create({
      data: {
        id,
        tripId: spendData.tripId,
        description: spendData.description,
        amount: spendData.amount,
        currency: spendData.currency || 'GBP',
        fxRate: 1.0,
        normalizedAmount: spendData.amount,
        paidById: spendData.paidById,
        categoryId: spendData.categoryId,
        date: spendData.date || new Date(),
      },
    });
  }

  /**
   * Get a spend by ID
   */
  async getSpend(spendId: string): Promise<any> {
    return this.prisma.spend.findUnique({
      where: { id: spendId },
      include: {
        assignments: true,
        items: true,
        paidBy: true,
        category: true,
      },
    });
  }

  /**
   * Create a spend assignment
   */
  async createSpendAssignment(assignmentData: {
    spendId: string;
    userId: string;
    shareAmount: number;
    splitType?: 'EQUAL' | 'PERCENTAGE' | 'EXACT' | 'SHARE';
  }): Promise<any> {
    return this.prisma.spendAssignment.create({
      data: {
        spendId: assignmentData.spendId,
        userId: assignmentData.userId,
        shareAmount: assignmentData.shareAmount,
        normalizedShareAmount: assignmentData.shareAmount,
        splitType: assignmentData.splitType || 'EQUAL',
      },
    });
  }

  // ============================================================================
  // CHOICE METHODS
  // ============================================================================

  /**
   * Create a test choice (menu/voting item)
   */
  async createTestChoice(choiceData: {
    id?: string;
    tripId: string;
    name: string;
    description?: string;
    status?: 'OPEN' | 'CLOSED';
    createdById: string;
  }): Promise<any> {
    const id = choiceData.id || `${TEST_PREFIX}choice_${Date.now()}`;
    return this.prisma.choice.create({
      data: {
        id,
        tripId: choiceData.tripId,
        name: choiceData.name,
        description: choiceData.description,
        status: choiceData.status || 'OPEN',
        createdById: choiceData.createdById,
      },
    });
  }

  /**
   * Add an item to a choice
   */
  async addChoiceItem(itemData: {
    choiceId: string;
    name: string;
    description?: string;
    price?: number;
    course?: string;
  }): Promise<any> {
    return this.prisma.choiceItem.create({
      data: {
        choiceId: itemData.choiceId,
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        course: itemData.course,
      },
    });
  }

  /**
   * Get a choice by ID
   */
  async getChoice(choiceId: string): Promise<any> {
    return this.prisma.choice.findUnique({
      where: { id: choiceId },
      include: {
        items: true,
        selections: {
          include: { lines: true },
        },
      },
    });
  }

  // ============================================================================
  // SETTLEMENT METHODS
  // ============================================================================

  /**
   * Create a test settlement
   */
  async createTestSettlement(settlementData: {
    tripId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    status?: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'VERIFIED';
  }): Promise<any> {
    return this.prisma.settlement.create({
      data: {
        tripId: settlementData.tripId,
        fromUserId: settlementData.fromUserId,
        toUserId: settlementData.toUserId,
        amount: settlementData.amount,
        status: settlementData.status || 'PENDING',
      },
    });
  }

  /**
   * Record a payment
   */
  async recordPayment(paymentData: {
    settlementId: string;
    amount: number;
    recordedById: string;
  }): Promise<any> {
    return this.prisma.payment.create({
      data: {
        settlementId: paymentData.settlementId,
        amount: paymentData.amount,
        recordedById: paymentData.recordedById,
      },
    });
  }

  // ============================================================================
  // LIST METHODS
  // ============================================================================

  /**
   * Create a test list template
   */
  async createTestListTemplate(templateData: {
    id?: string;
    ownerId: string;
    title: string;
    description?: string;
    type: 'TODO' | 'KIT';
    visibility?: 'PRIVATE' | 'PUBLIC';
    tripId?: string;
  }): Promise<any> {
    const id = templateData.id || `${TEST_PREFIX}list_${Date.now()}`;
    return this.prisma.listTemplate.create({
      data: {
        id,
        ownerId: templateData.ownerId,
        title: templateData.title,
        description: templateData.description,
        type: templateData.type,
        visibility: templateData.visibility || 'PRIVATE',
        tripId: templateData.tripId,
      },
    });
  }

  // ============================================================================
  // GROUP METHODS
  // ============================================================================

  /**
   * Create a test group
   */
  async createTestGroup(groupData: {
    id?: string;
    name: string;
    description?: string;
    ownerId: string;
  }): Promise<any> {
    const id = groupData.id || `${TEST_PREFIX}group_${Date.now()}`;
    return this.prisma.group.create({
      data: {
        id,
        name: groupData.name,
        description: groupData.description,
        ownerId: groupData.ownerId,
      },
    });
  }

  // ============================================================================
  // QUERY HELPERS
  // ============================================================================

  /**
   * Get all trips for a user
   */
  async getUserTrips(userId: string): Promise<any[]> {
    return this.prisma.trip.findMany({
      where: {
        members: {
          some: { userId },
        },
        deletedAt: null,
      },
      include: {
        members: true,
      },
    });
  }

  /**
   * Get all spends for a trip
   */
  async getTripSpends(tripId: string): Promise<any[]> {
    return this.prisma.spend.findMany({
      where: {
        tripId,
        deletedAt: null,
      },
      include: {
        assignments: true,
        items: true,
      },
    });
  }

  /**
   * Get settlements for a trip
   */
  async getTripSettlements(tripId: string): Promise<any[]> {
    return this.prisma.settlement.findMany({
      where: {
        tripId,
        deletedAt: null,
      },
      include: {
        payments: true,
        fromUser: true,
        toUser: true,
      },
    });
  }

  /**
   * Get event logs for an entity
   */
  async getEventLogs(entity: string, entityId: string): Promise<any[]> {
    return this.prisma.eventLog.findMany({
      where: {
        entity,
        entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Execute a raw query (use with caution)
   */
  async rawQuery<T>(query: string): Promise<T> {
    return this.prisma.$queryRawUnsafe(query);
  }

  /**
   * Count records in a table with optional filter
   */
  async count(model: string, where?: any): Promise<number> {
    const modelClient = (this.prisma as any)[model];
    if (!modelClient) {
      throw new Error(`Unknown model: ${model}`);
    }
    return modelClient.count({ where });
  }
}
