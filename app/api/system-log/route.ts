import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { createSystemLog } from "@/server/systemLog";
import { LogSeverity } from "@/lib/generated/prisma";

interface SystemLogRequest {
  severity: LogSeverity;
  feature: string;
  eventName: string;
  eventText: string;
  metadata?: Record<string, any>;
}

/**
 * POST /api/system-log
 * Creates a system log entry
 * Requires authentication
 */
export async function POST(request: NextRequest) {
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

    // 2. Parse and validate request body
    const body = (await request.json()) as SystemLogRequest;
    const { severity, feature, eventName, eventText, metadata } = body;

    if (!severity || !feature || !eventName || !eventText) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: severity, feature, eventName, eventText",
        },
        { status: 400 }
      );
    }

    // 3. Create system log
    await createSystemLog(severity, feature, eventName, eventText, metadata);

    // 4. Return success
    return NextResponse.json(
      {
        success: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating system log:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create system log. Please try again.",
      },
      { status: 500 }
    );
  }
}
