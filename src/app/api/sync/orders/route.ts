import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapCRMOrdersToRows, type CRMOrder } from "@/lib/orderSync";

export const dynamic = "force-dynamic";

const TELEGRAM_THRESHOLD = 50_000;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendTelegramAlert(order: CRMOrder) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const customerName =
    [order.firstName, order.lastName].filter(Boolean).join(" ") || "Unknown";
  const text = [
    `<b>New High-Value Order!</b>`,
    `Order: #${escapeHtml(order.number)}`,
    `Customer: ${escapeHtml(customerName)}`,
    `Amount: ${new Intl.NumberFormat("ru-RU").format(order.totalSumm)} KZT`,
  ].join("\n");

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    }
  );

  if (!res.ok) {
    console.error("Telegram notification failed:", await res.text());
  }
}

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
    return NextResponse.json({ synced: 0, notified: 0 });
  }

  const rows = mapCRMOrdersToRows(allOrders);

  // Find which external_ids already exist in Supabase
  const externalIds = rows.map((r) => r.external_id);
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("external_id")
    .in("external_id", externalIds);

  const existingIds = new Set((existing ?? []).map((r) => r.external_id));
  const newOrders = allOrders.filter(
    (o) => !existingIds.has(o.externalId || String(o.id))
  );

  // Upsert all orders
  const { error } = await supabaseAdmin
    .from("orders")
    .upsert(rows, { onConflict: "external_id" });

  if (error) {
    console.error("Sync upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify Telegram for new high-value orders
  const highValueNew = newOrders.filter((o) => o.totalSumm > TELEGRAM_THRESHOLD);
  await Promise.all(highValueNew.map(sendTelegramAlert));

  return NextResponse.json({
    synced: rows.length,
    notified: highValueNew.length,
  });
}
