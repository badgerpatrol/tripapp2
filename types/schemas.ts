import { z } from "zod";
import { UserRole, SubscriptionTier, SpendStatus, ChoiceStatus, ChoiceVisibility, Visibility, ListType, TodoActionType, GroupMemberRole } from "@/lib/generated/prisma";

// ============================================================================
// Auth Schemas
// ============================================================================

export const SignUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().optional(),
});

export const SignInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const AuthTokenSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  role: z.nativeEnum(UserRole),
  subscription: z.nativeEnum(SubscriptionTier),
  timezone: z.string(),
  language: z.string(),
  defaultCurrency: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const SignUpResponseSchema = z.object({
  success: z.boolean(),
  user: UserProfileSchema.optional(),
  error: z.string().optional(),
});

export const SignInResponseSchema = z.object({
  success: z.boolean(),
  user: UserProfileSchema.optional(),
  error: z.string().optional(),
});

// ============================================================================
// Trip Schemas
// ============================================================================

export const CreateTripSchema = z.object({
  name: z.string().min(1, "Trip name is required").max(200, "Trip name is too long"),
  description: z.string().optional(),
  baseCurrency: z.string().length(3, "Currency must be a 3-letter code (e.g., USD)").default("USD"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  location: z.string().optional(),
  signUpMode: z.boolean().optional().default(false),
  signUpPassword: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(6, "Password must be at least 6 characters").optional()
  ),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

export const UpdateTripSchema = z.object({
  name: z.string().min(1, "Trip name is required").max(200, "Trip name is too long").optional(),
  description: z.string().nullable().optional(),
  baseCurrency: z.string().length(3, "Currency must be a 3-letter code (e.g., USD)").optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  location: z.string().nullable().optional(),
  signUpMode: z.boolean().optional(),
  signUpPassword: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(6, "Password must be at least 6 characters").nullable().optional()
  ),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

export const TripResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  baseCurrency: z.string(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  status: z.string(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateTripResponseSchema = z.object({
  success: z.boolean(),
  trip: TripResponseSchema.optional(),
  error: z.string().optional(),
});

export const UserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
});

export const TripMemberSummarySchema = z.object({
  id: z.string(),
  role: z.string(),
  rsvpStatus: z.string(),
  joinedAt: z.coerce.date(),
  user: UserSummarySchema,
});

export const TimelineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  date: z.coerce.date().nullable(),
  isCompleted: z.boolean(),
  completedAt: z.coerce.date().nullable(),
  order: z.number(),
});

export const SpendSummarySchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number(),
  currency: z.string(),
  normalizedAmount: z.number(),
  date: z.coerce.date(),
  status: z.nativeEnum(SpendStatus),
  paidBy: UserSummarySchema,
  category: z.object({
    id: z.string(),
    name: z.string(),
  }).nullable(),
});

export const SpendAssignmentSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  shareAmount: z.number(),
  normalizedShareAmount: z.number(),
  splitType: z.string(),
});

// Trip overview for invitees (minimal info)
export const TripOverviewInviteeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  baseCurrency: z.string(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  status: z.string(),
  rsvpStatus: z.string(),
  createdAt: z.coerce.date(),
  organizer: UserSummarySchema,
  participants: z.array(TripMemberSummarySchema),
  userRole: z.string().nullable(),
  userRsvpStatus: z.string().nullable(),
});

// Trip overview for accepted members (full info)
export const TripOverviewMemberSchema = TripOverviewInviteeSchema.extend({
  timeline: z.array(TimelineItemSchema),
  spends: z.array(SpendSummarySchema),
  userAssignments: z.array(SpendAssignmentSummarySchema),
  totalSpent: z.number(),
  userOwes: z.number(),
  userIsOwed: z.number(),
});

// ============================================================================
// Invitation Schemas
// ============================================================================

export const InviteUsersSchema = z.object({
  emails: z.array(z.string().email("Invalid email address")).optional(),
  userIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(), // Groups used for filtering
}).refine(
  (data) => {
    // At least one of emails or userIds must be provided
    return (
      (data.emails && data.emails.length > 0) ||
      (data.userIds && data.userIds.length > 0)
    );
  },
  {
    message: "At least one email or userId is required",
  }
);

export const UpdateRsvpSchema = z.object({
  rsvpStatus: z.enum(["ACCEPTED", "DECLINED", "MAYBE"]),
});

export const InvitationResponseSchema = z.object({
  success: z.boolean(),
  invited: z.array(z.object({
    email: z.string(),
    userId: z.string(),
    status: z.literal("invited"),
  })),
  alreadyMembers: z.array(z.object({
    email: z.string(),
    userId: z.string(),
    status: z.literal("already_member"),
  })),
  notFound: z.array(z.object({
    email: z.string(),
    status: z.literal("not_found"),
  })),
  error: z.string().optional(),
});

// ============================================================================
// Spend Schemas
// ============================================================================

export const CreateSpendSchema = z.object({
  tripId: z.string().uuid("Valid trip ID required"),
  description: z.string().min(1, "Description is required").max(500, "Description is too long"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3, "Currency must be a 3-letter code (e.g., USD)"),
  fxRate: z.number().positive("FX rate must be positive").default(1.0),
  date: z.coerce.date().optional(),
  notes: z.string().max(2000, "Notes are too long").optional(),
  categoryId: z.string().uuid().optional(),
  receiptImageData: z.string().optional(), // Base64 encoded receipt image
});

export const CreateSpendResponseSchema = z.object({
  success: z.boolean(),
  spend: z.object({
    id: z.string(),
    tripId: z.string(),
    description: z.string(),
    amount: z.number(),
    currency: z.string(),
    fxRate: z.number(),
    normalizedAmount: z.number(),
    date: z.coerce.date(),
    status: z.nativeEnum(SpendStatus),
    notes: z.string().nullable(),
    paidById: z.string(),
    categoryId: z.string().nullable(),
  }).optional(),
  error: z.string().optional(),
});

export const UpdateSpendSchema = z.object({
  description: z.string().min(1, "Description is required").max(500, "Description is too long").optional(),
  amount: z.number().positive("Amount must be positive").optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code (e.g., USD)").optional(),
  fxRate: z.number().positive("FX rate must be positive").optional(),
  date: z.coerce.date().optional(),
  status: z.nativeEnum(SpendStatus).optional(),
  notes: z.string().max(2000, "Notes are too long").optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
});

export const CloseSpendSchema = z.object({
  force: z.boolean().optional().default(false), // Force close even if assignments don't equal 100%
});

export const GetSpendsQuerySchema = z.object({
  tripId: z.string().uuid("Valid trip ID required"),
  status: z.nativeEnum(SpendStatus).optional(),
  paidById: z.string().uuid().optional(),
  sortBy: z.enum(["date", "amount", "description"]).optional().default("date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// ============================================================================
// Spend Item Schemas
// ============================================================================

export const CreateSpendItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(80, "Item name is too long"),
  description: z.string().max(280, "Item description is too long").optional(),
  cost: z.number().nonnegative("Item cost must be non-negative"),
  userId: z.string().uuid("Valid user ID required").optional(), // Optional user assignment
});

export const UpdateSpendItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(80, "Item name is too long").optional(),
  description: z.string().max(280, "Item description is too long").optional().nullable(),
  cost: z.number().nonnegative("Item cost must be non-negative").optional(),
  userId: z.string().uuid("Valid user ID required").optional().nullable(), // Can be set to null to unassign
});

export const SpendItemResponseSchema = z.object({
  id: z.string(),
  spendId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  cost: z.number(),
  assignedUserId: z.string().nullable(),
  assignedUser: UserSummarySchema.nullable().optional(),
  createdById: z.string(),
  createdBy: UserSummarySchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateSpendItemResponseSchema = z.object({
  success: z.boolean(),
  item: SpendItemResponseSchema.optional(),
  error: z.string().optional(),
});

export const UpdateSpendItemResponseSchema = z.object({
  success: z.boolean(),
  item: SpendItemResponseSchema.optional(),
  error: z.string().optional(),
});

export const GetSpendItemsResponseSchema = z.object({
  success: z.boolean(),
  items: z.array(SpendItemResponseSchema),
  total: z.number(), // Sum of all item costs
  spendTotal: z.number(), // Total amount of the spend
  difference: z.number(), // spendTotal - itemsTotal
  percentAssigned: z.number(), // Percentage of spend amount assigned (from assignments)
  error: z.string().optional(),
});

// ============================================================================
// Settlement & Balance Schemas
// ============================================================================

export const PersonBalanceSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  userPhotoURL: z.string().nullable(),
  totalPaid: z.number(),
  totalOwed: z.number(),
  netBalance: z.number(), // Positive = owed money, Negative = owes money
});

export const SettlementTransferSchema = z.object({
  fromUserId: z.string(),
  fromUserName: z.string(),
  toUserId: z.string(),
  toUserName: z.string(),
  amount: z.number(),
  oldestDebtDate: z.coerce.date().nullable(),
});

export const TripBalanceSummarySchema = z.object({
  tripId: z.string(),
  baseCurrency: z.string(),
  totalSpent: z.number(),
  balances: z.array(PersonBalanceSchema),
  settlements: z.array(SettlementTransferSchema),
  calculatedAt: z.coerce.date(),
});

export const RecordPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paidAt: z.coerce.date(),
  paymentMethod: z.string().max(100, "Payment method is too long").optional(),
  paymentReference: z.string().max(200, "Payment reference is too long").optional(),
  notes: z.string().max(2000, "Notes are too long").optional(),
});

export const RecordPaymentResponseSchema = z.object({
  success: z.boolean(),
  payment: z.object({
    id: z.string(),
    settlementId: z.string(),
    amount: z.number(),
    paidAt: z.coerce.date(),
    paymentMethod: z.string().nullable(),
    paymentReference: z.string().nullable(),
    notes: z.string().nullable(),
    recordedById: z.string(),
    createdAt: z.coerce.date(),
  }).optional(),
  settlement: z.object({
    id: z.string(),
    status: z.string(),
    amount: z.number(),
    totalPaid: z.number(),
    remainingAmount: z.number(),
  }).optional(),
  error: z.string().optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
// ============================================================================
// Choice Schemas
// ============================================================================

export const CreateChoiceSchema = z.object({
  name: z.string().min(1, "Choice name is required").max(200, "Choice name is too long"),
  description: z.string().optional(),
  datetime: z.coerce.date().optional(),
  place: z.string().optional(),
  visibility: z.nativeEnum(ChoiceVisibility).default("TRIP"),
});

export const UpdateChoiceSchema = z.object({
  name: z.string().min(1, "Choice name is required").max(200, "Choice name is too long").optional(),
  description: z.string().optional().nullable(),
  datetime: z.coerce.date().optional().nullable(),
  place: z.string().optional().nullable(),
  visibility: z.nativeEnum(ChoiceVisibility).optional(),
});

export const UpdateChoiceStatusSchema = z.object({
  status: z.nativeEnum(ChoiceStatus),
  deadline: z.coerce.date().optional().nullable(),
});

export const ChoiceResponseSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  datetime: z.coerce.date().nullable(),
  place: z.string().nullable(),
  visibility: z.nativeEnum(ChoiceVisibility),
  status: z.nativeEnum(ChoiceStatus),
  deadline: z.coerce.date().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().nullable(),
});

export const CreateChoiceItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200, "Item name is too long"),
  description: z.string().optional(),
  price: z.number().optional(),
  tags: z.array(z.string()).optional(),
  maxPerUser: z.number().int().positive().optional(),
  maxTotal: z.number().int().positive().optional(),
  allergens: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export const UpdateChoiceItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200, "Item name is too long").optional(),
  description: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  maxPerUser: z.number().int().positive().optional().nullable(),
  maxTotal: z.number().int().positive().optional().nullable(),
  allergens: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const ChoiceItemResponseSchema = z.object({
  id: z.string(),
  choiceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nullable(),
  tags: z.array(z.string()).nullable(),
  maxPerUser: z.number().nullable(),
  maxTotal: z.number().nullable(),
  allergens: z.array(z.string()).nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const SelectionLineSchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().positive("Quantity must be positive"),
  note: z.string().optional(),
});

export const CreateSelectionSchema = z.object({
  lines: z.array(SelectionLineSchema).min(1, "At least one item must be selected"),
});

export const UpdateSelectionNoteSchema = z.object({
  note: z.string().optional(),
});

export const ChoiceSelectionLineResponseSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  quantity: z.number(),
  note: z.string().nullable(),
  item: ChoiceItemResponseSchema.optional(),
});

export const ChoiceSelectionResponseSchema = z.object({
  id: z.string(),
  choiceId: z.string(),
  userId: z.string(),
  note: z.string().nullable(),
  lines: z.array(ChoiceSelectionLineResponseSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ChoiceDetailResponseSchema = z.object({
  choice: ChoiceResponseSchema,
  items: z.array(ChoiceItemResponseSchema),
  mySelections: z.array(ChoiceSelectionLineResponseSchema).optional(),
  myTotal: z.number().optional(),
});

export const RespondentsResponseSchema = z.object({
  respondedUserIds: z.array(z.string()),
  pendingUserIds: z.array(z.string()),
});

export const ItemReportSchema = z.object({
  itemId: z.string(),
  name: z.string(),
  qtyTotal: z.number(),
  totalPrice: z.number().nullable(),
  distinctUsers: z.number(),
});

export const ItemsReportResponseSchema = z.object({
  items: z.array(ItemReportSchema),
  grandTotalPrice: z.number().nullable(),
});

export const UserSelectionLineSchema = z.object({
  itemName: z.string(),
  quantity: z.number(),
  linePrice: z.number().nullable(),
  note: z.string().nullable(),
});

export const UserReportSchema = z.object({
  userId: z.string(),
  displayName: z.string().nullable(),
  note: z.string().nullable(),
  lines: z.array(UserSelectionLineSchema),
  userTotalPrice: z.number().nullable(),
});

export const UsersReportResponseSchema = z.object({
  users: z.array(UserReportSchema),
  grandTotalPrice: z.number().nullable(),
});

export const ChoiceActivityResponseSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  payload: z.any().nullable(),
  createdAt: z.coerce.date(),
});

export const CreateSpendFromChoiceSchema = z.object({
  mode: z.enum(["byItem", "byUser"]),
});

export const GetChoicesQuerySchema = z.object({
  includeClosed: z.coerce.boolean().default(false),
  includeArchived: z.coerce.boolean().default(false),
});

// ============================================================================
// Type exports
// ============================================================================

export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SignUpResponse = z.infer<typeof SignUpResponseSchema>;
export type SignInResponse = z.infer<typeof SignInResponseSchema>;
export type CreateTripInput = {
  name: string;
  description?: string;
  baseCurrency?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  signUpMode?: boolean;
  signUpPassword?: string;
};
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;
export type TripResponse = z.infer<typeof TripResponseSchema>;
export type CreateTripResponse = z.infer<typeof CreateTripResponseSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type TripMemberSummary = z.infer<typeof TripMemberSummarySchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type SpendSummary = z.infer<typeof SpendSummarySchema>;
export type SpendAssignmentSummary = z.infer<typeof SpendAssignmentSummarySchema>;
export type TripOverviewInvitee = z.infer<typeof TripOverviewInviteeSchema>;
export type TripOverviewMember = z.infer<typeof TripOverviewMemberSchema>;
export type InviteUsersInput = z.infer<typeof InviteUsersSchema>;
export type UpdateRsvpInput = z.infer<typeof UpdateRsvpSchema>;
export type InvitationResponse = z.infer<typeof InvitationResponseSchema>;
export type CreateSpendInput = z.infer<typeof CreateSpendSchema>;
export type CreateSpendResponse = z.infer<typeof CreateSpendResponseSchema>;
export type UpdateSpendInput = z.infer<typeof UpdateSpendSchema>;
export type CloseSpendInput = z.infer<typeof CloseSpendSchema>;
export type GetSpendsQuery = z.infer<typeof GetSpendsQuerySchema>;
export type CreateSpendItemInput = z.infer<typeof CreateSpendItemSchema>;
export type UpdateSpendItemInput = z.infer<typeof UpdateSpendItemSchema>;
export type SpendItemResponse = z.infer<typeof SpendItemResponseSchema>;
export type CreateSpendItemResponse = z.infer<typeof CreateSpendItemResponseSchema>;
export type UpdateSpendItemResponse = z.infer<typeof UpdateSpendItemResponseSchema>;
export type GetSpendItemsResponse = z.infer<typeof GetSpendItemsResponseSchema>;
export type PersonBalance = z.infer<typeof PersonBalanceSchema>;
export type SettlementTransfer = z.infer<typeof SettlementTransferSchema>;
export type TripBalanceSummary = z.infer<typeof TripBalanceSummarySchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type RecordPaymentResponse = z.infer<typeof RecordPaymentResponseSchema>;
export type CreateChoiceInput = z.infer<typeof CreateChoiceSchema>;
export type UpdateChoiceInput = z.infer<typeof UpdateChoiceSchema>;
export type UpdateChoiceStatusInput = z.infer<typeof UpdateChoiceStatusSchema>;
export type ChoiceResponse = z.infer<typeof ChoiceResponseSchema>;
export type CreateChoiceItemInput = z.infer<typeof CreateChoiceItemSchema>;
export type UpdateChoiceItemInput = z.infer<typeof UpdateChoiceItemSchema>;
export type ChoiceItemResponse = z.infer<typeof ChoiceItemResponseSchema>;
export type SelectionLine = z.infer<typeof SelectionLineSchema>;
export type CreateSelectionInput = z.infer<typeof CreateSelectionSchema>;
export type UpdateSelectionNoteInput = z.infer<typeof UpdateSelectionNoteSchema>;
export type ChoiceSelectionLineResponse = z.infer<typeof ChoiceSelectionLineResponseSchema>;
export type ChoiceSelectionResponse = z.infer<typeof ChoiceSelectionResponseSchema>;
export type ChoiceDetailResponse = z.infer<typeof ChoiceDetailResponseSchema>;
export type RespondentsResponse = z.infer<typeof RespondentsResponseSchema>;
export type ItemReport = z.infer<typeof ItemReportSchema>;
export type ItemsReportResponse = z.infer<typeof ItemsReportResponseSchema>;
export type UserSelectionLine = z.infer<typeof UserSelectionLineSchema>;
export type UserReport = z.infer<typeof UserReportSchema>;
export type UsersReportResponse = z.infer<typeof UsersReportResponseSchema>;
export type ChoiceActivityResponse = z.infer<typeof ChoiceActivityResponseSchema>;
export type CreateSpendFromChoiceInput = z.infer<typeof CreateSpendFromChoiceSchema>;
export type GetChoicesQuery = z.infer<typeof GetChoicesQuerySchema>;

// ============================================================================
// Lists Platform Schemas
// ============================================================================

// Re-export enums as Zod schemas for validation
export const VisibilitySchema = z.nativeEnum(Visibility);
export const ListTypeSchema = z.nativeEnum(ListType);
export const TodoActionTypeSchema = z.nativeEnum(TodoActionType);

export const TodoItemTemplateInput = z.object({
  label: z.string().min(1, "Label is required"),
  notes: z.string().optional(),
  actionType: TodoActionTypeSchema.optional(),
  actionData: z.any().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  orderIndex: z.number().int().nonnegative().default(0)
}).strict();

export const KitItemTemplateInput = z.object({
  label: z.string().min(1, "Label is required"),
  notes: z.string().optional(),
  quantity: z.number().positive().default(1),
  perPerson: z.boolean().default(false),
  required: z.boolean().default(true),
  weightGrams: z.number().int().positive().optional(),
  category: z.string().optional(),
  cost: z.number().positive().optional(),
  url: z.string().optional().or(z.literal("")),
  orderIndex: z.number().int().nonnegative().default(0),
  // Inventory-specific fields
  date: z.coerce.date().optional(),
  needsRepair: z.boolean().default(false),
  conditionNotes: z.string().optional(),
  lost: z.boolean().default(false),
  lastSeenText: z.string().optional(),
  lastSeenDate: z.coerce.date().optional()
}).strict();

export const ListTemplateCreate = z.object({
  type: ListTypeSchema,
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  visibility: VisibilitySchema.default("PRIVATE"),
  tags: z.array(z.string()).max(12).optional(),
  isTripTemplate: z.boolean().default(false),
  inventory: z.boolean().default(false),
  // Discriminated items by type:
  todoItems: z.array(TodoItemTemplateInput).optional(),
  kitItems: z.array(KitItemTemplateInput).optional()
})
.refine(v => (v.type==="TODO" && v.todoItems) || (v.type==="KIT" && v.kitItems), {
  message: "Provide items for the selected list type."
})
.strict();

// For updating, allow id in item schemas
export const TodoItemTemplateUpdateInput = TodoItemTemplateInput.extend({
  id: z.string().optional(), // If provided, update existing; if not, create new
}).strict();

export const KitItemTemplateUpdateInput = KitItemTemplateInput.extend({
  id: z.string().optional(),
}).strict();

export const ListTemplateUpdate = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  visibility: VisibilitySchema.optional(),
  tags: z.array(z.string()).max(12).optional(),
  isTripTemplate: z.boolean().optional(),
  inventory: z.boolean().optional(),
  // When updating items, we replace all items
  todoItems: z.array(TodoItemTemplateUpdateInput).optional(),
  kitItems: z.array(KitItemTemplateUpdateInput).optional()
}).strict();

export const TodoMergeMode = z.enum(["REPLACE","MERGE_ADD","MERGE_ADD_ALLOW_DUPES"]);

export const CopyToTripSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
  mode: z.enum(["REPLACE","MERGE_ADD","MERGE_ADD_ALLOW_DUPES","NEW_INSTANCE"]).default("NEW_INSTANCE")
});

export const ForkTemplateSchema = z.object({
  newTitle: z.string().min(1, "New title is required").optional()
});

export const PublishTemplateSchema = z.object({
  visibility: VisibilitySchema,
  tags: z.array(z.string()).max(12).optional()
});

export const CreateAdHocListSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
  type: ListTypeSchema,
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  inventory: z.boolean().default(false),
  todoItems: z.array(TodoItemTemplateInput).optional(),
  kitItems: z.array(KitItemTemplateInput).optional()
})
.refine(v => (v.type==="TODO" && v.todoItems) || (v.type==="KIT" && v.kitItems), {
  message: "Provide items for the selected list type."
})
.strict();

export const ToggleItemStateSchema = z.object({
  state: z.boolean()
});

export const BrowsePublicTemplatesQuerySchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  type: ListTypeSchema.optional()
});

export const ListTripInstancesQuerySchema = z.object({
  type: ListTypeSchema.optional(),
  completionStatus: z.enum(["all", "open", "done"]).optional()
});

// ============================================================================
// Type exports for Lists
// ============================================================================

export type TodoItemTemplateInputType = z.infer<typeof TodoItemTemplateInput>;
export type KitItemTemplateInputType = z.infer<typeof KitItemTemplateInput>;
export type ListTemplateCreateInput = z.infer<typeof ListTemplateCreate>;
export type ListTemplateUpdateInput = z.infer<typeof ListTemplateUpdate>;
export type TodoMergeModeType = z.infer<typeof TodoMergeMode>;
export type CopyToTripInput = z.infer<typeof CopyToTripSchema>;
export type ForkTemplateInput = z.infer<typeof ForkTemplateSchema>;
export type PublishTemplateInput = z.infer<typeof PublishTemplateSchema>;
export type CreateAdHocListInput = z.infer<typeof CreateAdHocListSchema>;
export type ToggleItemStateInput = z.infer<typeof ToggleItemStateSchema>;
export type BrowsePublicTemplatesQuery = z.infer<typeof BrowsePublicTemplatesQuerySchema>;
export type ListTripInstancesQuery = z.infer<typeof ListTripInstancesQuerySchema>;

// ============================================================================
// Group Schemas
// ============================================================================

export const GroupCreateSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100, "Group name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

export const GroupUpdateSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100, "Group name is too long").optional(),
  description: z.string().max(500, "Description is too long").optional().nullable(),
});

export const GroupMemberCreateSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.nativeEnum(GroupMemberRole).optional().default("MEMBER"),
});

export const DiscoverableUsersQuerySchema = z.object({
  groupIds: z.array(z.string()).min(1, "At least one group ID is required"),
  tripId: z.string().optional(), // To exclude existing trip members
});

export const DiscoverableUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
});

export const GroupResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string(),
  memberCount: z.number().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const GroupMemberResponseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  userId: z.string(),
  role: z.nativeEnum(GroupMemberRole),
  joinedAt: z.coerce.date(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string().nullable(),
    photoURL: z.string().nullable(),
  }).optional(),
});

export const GroupDetailResponseSchema = GroupResponseSchema.extend({
  members: z.array(GroupMemberResponseSchema).optional(),
});

export const CreateGroupResponseSchema = z.object({
  success: z.boolean(),
  group: GroupResponseSchema,
});

export const UpdateGroupResponseSchema = z.object({
  success: z.boolean(),
  group: GroupResponseSchema,
});

export const DeleteGroupResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const ListGroupsResponseSchema = z.object({
  success: z.boolean(),
  groups: z.array(GroupResponseSchema),
});

export const GetGroupResponseSchema = z.object({
  success: z.boolean(),
  group: GroupDetailResponseSchema,
});

export const ListGroupMembersResponseSchema = z.object({
  success: z.boolean(),
  members: z.array(GroupMemberResponseSchema),
});

export const AddGroupMemberResponseSchema = z.object({
  success: z.boolean(),
  member: GroupMemberResponseSchema,
});

export const RemoveGroupMemberResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const DiscoverableUsersResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(DiscoverableUserSchema),
});

// Type exports
export type GroupCreate = z.infer<typeof GroupCreateSchema>;
export type GroupUpdate = z.infer<typeof GroupUpdateSchema>;
export type GroupMemberCreate = z.infer<typeof GroupMemberCreateSchema>;
export type DiscoverableUsersQuery = z.infer<typeof DiscoverableUsersQuerySchema>;
export type DiscoverableUser = z.infer<typeof DiscoverableUserSchema>;
export type GroupResponse = z.infer<typeof GroupResponseSchema>;
export type GroupMemberResponse = z.infer<typeof GroupMemberResponseSchema>;
export type GroupDetailResponse = z.infer<typeof GroupDetailResponseSchema>;

// ============================================================================
// Admin User Management Schemas
// ============================================================================

export const UserRoleSchema = z.nativeEnum(UserRole);

export const UserRoleUpdateSchema = z.object({
  role: UserRoleSchema,
});

export const UserInfoUpdateSchema = z.object({
  displayName: z.string().min(1, "Display name is required").optional(),
  phoneNumber: z.string().optional().nullable(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  defaultCurrency: z.string().length(3, "Currency must be a 3-letter code").optional(),
});

export const PasswordResetSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters long"),
});

export const PasswordResetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const AdminUserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  photoURL: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  role: z.nativeEnum(UserRole),
  subscription: z.nativeEnum(SubscriptionTier),
  timezone: z.string(),
  language: z.string(),
  defaultCurrency: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  tripCount: z.number(),
  groupCount: z.number(),
});

export const AdminUserDetailResponseSchema = AdminUserResponseSchema.extend({
  createdTripCount: z.number(),
  ownedGroupCount: z.number(),
  deletedAt: z.coerce.date().nullable(),
});

export const ListUsersResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(AdminUserResponseSchema),
});

export const GetUserResponseSchema = z.object({
  success: z.boolean(),
  user: AdminUserDetailResponseSchema,
});

export const UpdateUserRoleResponseSchema = z.object({
  success: z.boolean(),
  user: AdminUserResponseSchema,
});

export const UpdateUserInfoResponseSchema = z.object({
  success: z.boolean(),
  user: AdminUserResponseSchema,
});

export const DeactivateUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const SearchUsersQuerySchema = z.object({
  query: z.string().min(1, "Search query is required"),
});

export const SearchUsersResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string().nullable(),
    photoURL: z.string().nullable(),
    role: z.nativeEnum(UserRole),
    subscription: z.nativeEnum(SubscriptionTier),
    createdAt: z.coerce.date(),
  })),
});

// Type exports
export type UserRoleUpdate = z.infer<typeof UserRoleUpdateSchema>;
export type UserInfoUpdate = z.infer<typeof UserInfoUpdateSchema>;
export type PasswordReset = z.infer<typeof PasswordResetSchema>;
export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;
export type AdminUserDetailResponse = z.infer<typeof AdminUserDetailResponseSchema>;
export type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;

// ============================================================================
// Guards and Utility Functions
// ============================================================================

export type DeepLink = { route: string; params: Record<string, string> };

export function canViewTemplate(userId: string, tpl: { ownerId: string; visibility: "PRIVATE" | "PUBLIC" }) {
  return tpl.visibility === "PUBLIC" || tpl.ownerId === userId;
}

export function canEditTemplate(userId: string, tpl: { ownerId: string }) {
  return tpl.ownerId === userId;
}
