import { NextResponse } from "next/server";

import { fetchRetailCrmStatusMap } from "@/lib/retailCrm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const statusMap = await fetchRetailCrmStatusMap();
    return NextResponse.json({ statusMap });
  } catch (error) {
    console.error("RetailCRM statuses API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load RetailCRM statuses",
        statusMap: {},
      },
      { status: 500 }
    );
  }
}
