import type { ListTypeHandler } from "./base";
import { todoHandler } from "./todo";
import { kitHandler } from "./kit";
import { listHandler } from "./list";
import { ListType } from "@/lib/generated/prisma";

/**
 * Registry of list type handlers
 * Maps each ListType to its corresponding handler implementation
 */
const registry: Record<ListType, ListTypeHandler> = {
  TODO: todoHandler,
  KIT: kitHandler,
  LIST: listHandler,
};

/**
 * Get the handler for a specific list type
 * @param type - The list type (TODO, KIT, etc.)
 * @returns The handler implementation for that type
 */
export function getHandler(type: ListType): ListTypeHandler {
  const handler = registry[type];
  if (!handler) {
    throw new Error(`No handler registered for list type: ${type}`);
  }
  return handler;
}
