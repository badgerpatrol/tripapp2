import type { DeepLink } from "@/types/schemas";
import { TodoActionType } from "@/lib/generated/prisma";

/**
 * Convert a TODO action type and data into a deep link
 * @param actionType - The type of action to perform
 * @param data - Action-specific data
 * @param ctx - Context (tripId, etc.)
 * @returns A deep link with route and params
 */
export function actionToDeepLink(
  actionType: TodoActionType,
  data: any,
  ctx: { tripId: string }
): DeepLink {
  switch (actionType) {
    case "CREATE_CHOICE":
      return {
        route: `/trips/${ctx.tripId}/choices/new`,
        params: {},
      };

    case "SET_MILESTONE":
      return {
        route: `/trips/${ctx.tripId}/timeline/new`,
        params: {
          label: data?.label ?? "",
          due: data?.dueDate ?? "",
        },
      };

    case "INVITE_USERS":
      return {
        route: `/trips/${ctx.tripId}/invitations`,
        params: {
          prefill: (data?.usernames ?? []).join(","),
        },
      };

    default:
      // Fallback to trip overview
      return {
        route: `/trips/${ctx.tripId}`,
        params: {},
      };
  }
}
