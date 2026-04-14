import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapCRMOrdersToRows, type CRMOrder } from "@/lib/orderSync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retailCrmUrl = process.env.RETAILCRM_URL;
  const apiKey = process.env.RETAILCRM_API_KEY;

  if (!retailCrmUrl || !apiKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  // Fetch orders updated in the last 2 minutes (overlap avoids gaps between runs)
  const since = new Date(Date.now() - 2 * 60 * 1000)
    .toISOString()
    .slice(0, 19);

  const allOrders: CRMOrder[] = [];
  let page = 1;

  while (true) {
    const url = new URL("/api/v5/orders", retailCrmUrl);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("limit", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("filter[updatedAtFrom]", since);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) break;

    const data = (await res.json()) as {
      success: boolean;
      orders: CRMOrder[];
      pagination: { totalPageCount: number };
    };

    if (!data.success) break;

    allOrders.push(...data.orders);
    if (page >= data.pagination.totalPageCount) break;
    page++;
  }

  if (allOrders.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  const rows = mapCRMOrdersToRows(allOrders);
  const { error } = await supabaseAdmin
    .from("orders")
    .upsert(rows, { onConflict: "external_id" });

  if (error) {
    console.error("Sync upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: rows.length });
}
