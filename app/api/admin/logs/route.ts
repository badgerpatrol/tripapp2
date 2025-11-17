import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireUserRole } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { UserRole, LogSeverity } from "@/lib/generated/prisma";

/**
 * GET /api/admin/logs
 * Fetches system logs with filtering and pagination.
 * Admin-only endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    // Require ADMIN role to access logs
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const severity = searchParams.get("severity") as LogSeverity | null;
    const feature = searchParams.get("feature") || "";
    const eventName = searchParams.get("eventName") || "";
    const eventText = searchParams.get("eventText") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {};

    if (severity) {
      where.severity = severity;
    }

    if (feature) {
      where.feature = {
        contains: feature,
        mode: "insensitive",
      };
    }

    if (eventName) {
      where.eventName = {
        contains: eventName,
        mode: "insensitive",
      };
    }

    if (eventText) {
      where.eventText = {
        contains: eventText,
        mode: "insensitive",
      };
    }

    if (startDate || endDate) {
      where.datetime = {};
      if (startDate) {
        where.datetime.gte = new Date(startDate);
      }
      if (endDate) {
        where.datetime.lte = new Date(endDate);
      }
    }

    // 3. Fetch logs with pagination
    const skip = (page - 1) * limit;

    const [logs, totalCount] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: {
          datetime: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.systemLog.count({ where }),
    ]);

    // 4. Return response
    const response = {
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        datetime: log.datetime.toISOString(),
        severity: log.severity,
        feature: log.feature,
        eventName: log.eventName,
        eventText: log.eventText,
        metadata: log.metadata,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching logs:", error);

    // Handle authorization errors
    if (error.message?.includes("Forbidden") || error.message?.includes("role required")) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied. Admin privileges required.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch logs. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/logs
 * Deletes system logs (either all or by IDs).
 * Admin-only endpoint.
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    // Require ADMIN role to delete logs
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Parse request body
    const body = await request.json();
    const { ids, deleteAll } = body;

    // 3. Delete logs
    let deletedCount = 0;

    if (deleteAll === true) {
      // Delete all logs
      const result = await prisma.systemLog.deleteMany({});
      deletedCount = result.count;
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific logs by ID
      const result = await prisma.systemLog.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
      deletedCount = result.count;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Either 'deleteAll' must be true or 'ids' array must be provided",
        },
        { status: 400 }
      );
    }

    // 4. Return response
    return NextResponse.json(
      {
        success: true,
        deletedCount,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting logs:", error);

    // Handle authorization errors
    if (error.message?.includes("Forbidden") || error.message?.includes("role required")) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied. Admin privileges required.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete logs. Please try again.",
      },
      { status: 500 }
    );
  }
}
