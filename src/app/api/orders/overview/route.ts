import { NextRequest, NextResponse } from "next/server";

import { getStatusPresentation } from "@/lib/constants";
import { fetchRetailCrmStatusMap, type RetailCrmStatusMap } from "@/lib/retailCrm";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ORDER_COLUMNS = [
  "id",
  "external_id",
  "number",
  "total_sum",
  "created_at",
  "status",
  "customer_name",
  "phone",
  "email",
  "city",
  "delivery_address",
  "items_count",
  "items_summary",
].join(", ");

interface OverviewOrder {
  id: number;
  external_id: string;
  number: string;
  total_sum: number;
  created_at: string;
  status: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  delivery_address: string | null;
  items_count: number | null;
  items_summary: string | null;
}

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const searchQuery = request.nextUrl.searchParams.get("search")?.trim() || "";
    const page = toPositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(
      50,
      toPositiveInt(request.nextUrl.searchParams.get("pageSize"), 10)
    );

    const [{ data: summaryOrders, error: summaryError }, statusMapResult] =
      await Promise.all([
        supabaseAdmin.from("orders").select("total_sum, created_at, status"),
        fetchRetailCrmStatusMap().catch(() => ({} as RetailCrmStatusMap)),
      ]);

    if (summaryError) {
      throw summaryError;
    }

    let countQuery = supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true });
    let tableQuery = supabaseAdmin
      .from("orders")
      .select(ORDER_COLUMNS)
      .order("created_at", { ascending: false });

    if (searchQuery) {
      const escapedSearch = searchQuery.replaceAll(",", "\\,");
      const searchFilter = [
        `number.ilike.%${escapedSearch}%`,
        `customer_name.ilike.%${escapedSearch}%`,
        `phone.ilike.%${escapedSearch}%`,
        `email.ilike.%${escapedSearch}%`,
        `city.ilike.%${escapedSearch}%`,
        `items_summary.ilike.%${escapedSearch}%`,
      ].join(",");
      countQuery = countQuery.or(searchFilter);
      tableQuery = tableQuery.or(searchFilter);
    }

    const { count: filteredCount, error: countError } = await countQuery;

    if (countError) {
      throw countError;
    }

    const totalFilteredPages = Math.max(
      1,
      Math.ceil((filteredCount ?? 0) / pageSize)
    );
    const currentPage = Math.min(page, totalFilteredPages);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: pagedOrders, error: tableError } = await tableQuery.range(
      from,
      to
    );

    if (tableError) {
      throw tableError;
    }

    const totalOrders = summaryOrders?.length ?? 0;
    const totalRevenue = (summaryOrders ?? []).reduce(
      (sum, order) => sum + Number(order.total_sum),
      0
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const completedOrders = (summaryOrders ?? []).filter(
      (order) => order.status === "complete"
    );
    const completionRate =
      totalOrders > 0
        ? Math.round((completedOrders.length / totalOrders) * 100)
        : 0;

    const dailyMap = new Map<string, { revenue: number; count: number }>();
    (summaryOrders ?? []).forEach((order) => {
      const day = String(order.created_at).slice(0, 10);
      const existing = dailyMap.get(day) || { revenue: 0, count: 0 };
      existing.revenue += Number(order.total_sum);
      existing.count += 1;
      dailyMap.set(day, existing);
    });

    const chartData = Array.from(dailyMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const statusCounts = (summaryOrders ?? []).reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const statusChartData = Object.entries(statusCounts).map(
      ([status, count]) => ({
        name: getStatusPresentation(status, statusMapResult).label,
        value: count,
        status,
      })
    );
    const orders = ((pagedOrders ?? []) as unknown) as OverviewOrder[];

    return NextResponse.json({
      totalOrders,
      totalRevenue,
      avgOrderValue,
      completionRate,
      chartData,
      statusChartData,
      statusMap: statusMapResult,
      filteredCount: filteredCount ?? 0,
      page: currentPage,
      pageSize,
      orders,
    });
  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load overview data",
      },
      { status: 500 }
    );
  }
}
