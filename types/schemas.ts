import { z } from "zod";
import { UserRole, SubscriptionTier, SpendStatus } from "@/lib/generated/prisma";

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
  description: z.string().optional(),
  baseCurrency: z.string().length(3, "Currency must be a 3-letter code (e.g., USD)").optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  location: z.string().optional().nullable(),
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
  emails: z.array(z.string().email("Invalid email address")).min(1, "At least one email is required"),
});

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
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SignUpResponse = z.infer<typeof SignUpResponseSchema>;
export type SignInResponse = z.infer<typeof SignInResponseSchema>;
export type CreateTripInput = z.infer<typeof CreateTripSchema>;
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
export type PersonBalance = z.infer<typeof PersonBalanceSchema>;
export type SettlementTransfer = z.infer<typeof SettlementTransferSchema>;
export type TripBalanceSummary = z.infer<typeof TripBalanceSummarySchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type RecordPaymentResponse = z.infer<typeof RecordPaymentResponseSchema>;
