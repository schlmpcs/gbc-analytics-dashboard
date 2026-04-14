import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapCRMOrdersToRows, type CRMOrder } from "@/lib/orderSync";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const retailCrmUrl = process.env.RETAILCRM_URL;
  const apiKey = process.env.RETAILCRM_API_KEY;

  if (!retailCrmUrl || !apiKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  // RetailCRM v5 does not expose a modification-date filter on the orders endpoint.
  // Fetch the first page (100 most-recent orders) on every poll; the upsert is
  // idempotent so re-syncing unchanged rows is safe.
  const allOrders: CRMOrder[] = [];

  const url = new URL("/api/v5/orders", retailCrmUrl);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("limit", "100");
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (res.ok) {
    const data = (await res.json()) as {
      success: boolean;
      orders: CRMOrder[];
    };
    if (data.success) {
      allOrders.push(...data.orders);
    }
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
