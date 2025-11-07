import { Decimal } from "@prisma/client/runtime/library";

/**
 * Assignment Math Utilities
 * Pure functions for calculating spend assignment percentages and totals
 */

/**
 * Convert Prisma Decimal to number for calculations
 */
export function decimalToNumber(decimal: Decimal | number): number {
  if (typeof decimal === "number") return decimal;
  return Number(decimal.toString());
}

/**
 * Calculate the sum of item costs
 */
export function calculateItemsTotal(items: Array<{ cost: Decimal | number }>): number {
  return items.reduce((sum, item) => sum + decimalToNumber(item.cost), 0);
}

/**
 * Calculate the total assigned amount from assignments
 */
export function calculateAssignmentsTotal(
  assignments: Array<{ shareAmount: Decimal | number }>
): number {
  return assignments.reduce((sum, assignment) => sum + decimalToNumber(assignment.shareAmount), 0);
}

/**
 * Calculate the percentage of spend amount that has been assigned
 * @param spendAmount - Total spend amount
 * @param assignedAmount - Total amount assigned to users
 * @returns Percentage (0-100) with 2 decimal places
 */
export function calculatePercentAssigned(
  spendAmount: number | Decimal,
  assignedAmount: number | Decimal
): number {
  const spend = decimalToNumber(spendAmount);
  const assigned = decimalToNumber(assignedAmount);

  if (spend === 0) return 0;

  const percent = (assigned / spend) * 100;
  return Math.round(percent * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate the difference between spend total and items total
 * @param spendAmount - Total spend amount
 * @param itemsTotal - Sum of all item costs
 * @returns Difference (spendAmount - itemsTotal)
 */
export function calculateDifference(
  spendAmount: number | Decimal,
  itemsTotal: number | Decimal
): number {
  const spend = decimalToNumber(spendAmount);
  const items = decimalToNumber(itemsTotal);
  return Math.round((spend - items) * 100) / 100; // Round to 2 decimal places
}

/**
 * Check if assignments total equals 100% of spend amount
 * Uses epsilon comparison to handle floating point precision issues
 */
export function isFullyAssigned(
  spendAmount: number | Decimal,
  assignedAmount: number | Decimal,
  epsilon: number = 0.01 // Allow 1 cent difference
): boolean {
  const spend = decimalToNumber(spendAmount);
  const assigned = decimalToNumber(assignedAmount);

  return Math.abs(spend - assigned) <= epsilon;
}

/**
 * Validate that item costs don't exceed spend amount
 */
export function validateItemsTotal(
  spendAmount: number | Decimal,
  itemsTotal: number | Decimal
): { valid: boolean; message?: string } {
  const spend = decimalToNumber(spendAmount);
  const items = decimalToNumber(itemsTotal);

  if (items > spend) {
    return {
      valid: false,
      message: `Items total (${items.toFixed(2)}) exceeds spend amount (${spend.toFixed(2)})`,
    };
  }

  return { valid: true };
}

/**
 * Calculate spend summary statistics
 */
export interface SpendSummary {
  spendTotal: number;
  itemsTotal: number;
  assignedTotal: number;
  difference: number;
  percentAssigned: number;
  isFullyAssigned: boolean;
}

export function calculateSpendSummary(
  spendAmount: number | Decimal,
  items: Array<{ cost: Decimal | number }>,
  assignments: Array<{ shareAmount: Decimal | number }>
): SpendSummary {
  const spendTotal = decimalToNumber(spendAmount);
  const itemsTotal = calculateItemsTotal(items);
  const assignedTotal = calculateAssignmentsTotal(assignments);
  const difference = calculateDifference(spendTotal, itemsTotal);
  const percentAssigned = calculatePercentAssigned(spendTotal, assignedTotal);
  const fullyAssigned = isFullyAssigned(spendTotal, assignedTotal);

  return {
    spendTotal,
    itemsTotal,
    assignedTotal,
    difference,
    percentAssigned,
    isFullyAssigned: fullyAssigned,
  };
}
