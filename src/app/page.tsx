"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Search, Calendar, Package } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types";
import {
  getStatusChartColor,
  getStatusPresentation,
} from "@/lib/constants";
import { formatCurrency, formatCompact, getCustomerInitials } from "@/lib/format";
import type { RetailCrmStatusMap } from "@/lib/retailCrm";
import { DashboardShell } from "@/components/DashboardShell";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";
import { TablePagination } from "@/components/TablePagination";

interface DailyData {
  date: string;
  revenue: number;
  count: number;
}

interface StatusChartItem {
  name: string;
  value: number;
  status: string;
}

interface OverviewResponse {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  completionRate: number;
  chartData: DailyData[];
  statusChartData: StatusChartItem[];
  statusMap: RetailCrmStatusMap;
  filteredCount: number;
  page: number;
  pageSize: number;
  orders: Order[];
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [chartData, setChartData] = useState<DailyData[]>([]);
  const [statusChartData, setStatusChartData] = useState<StatusChartItem[]>([]);
  const [statusMap, setStatusMap] = useState<RetailCrmStatusMap>({});
  const [filteredCount, setFilteredCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => setRefreshKey((k) => k + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchOverview() {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          search: searchQuery,
          page: String(tablePage),
          pageSize: String(tablePageSize),
        });
        const response = await fetch(`/api/orders/overview?${params.toString()}`);
        const data = (await response.json()) as OverviewResponse | { error: string };

        if (!response.ok) {
          throw new Error("error" in data ? data.error : "Failed to load overview");
        }
        if ("error" in data) {
          throw new Error(data.error);
        }

        if (cancelled) {
          return;
        }

        setOrders(data.orders);
        setTotalOrders(data.totalOrders);
        setTotalRevenue(data.totalRevenue);
        setAvgOrderValue(data.avgOrderValue);
        setCompletionRate(data.completionRate);
        setChartData(data.chartData);
        setStatusChartData(data.statusChartData);
        setStatusMap(data.statusMap);
        setFilteredCount(data.filteredCount);
        if (data.page !== tablePage) {
          setTablePage(data.page);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching overview:", error);
          setOrders([]);
          setFilteredCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchOverview();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, tablePage, tablePageSize, refreshKey]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <>
      <DashboardShell
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavToggle={() => setIsMobileNavOpen((open) => !open)}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
        searchSlot={
          <div className="hidden max-w-md sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <input
                className="w-full rounded-full bg-surface-container-lowest py-2 pl-10 pr-4 text-sm transition-all placeholder:text-outline/60 focus:ring-2 focus:ring-primary/20"
                placeholder="Search analytics..."
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setTablePage(1);
                }}
              />
            </div>
          </div>
        }
      >
        <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[2.75rem] font-black text-on-surface leading-tight tracking-tight">
                  Overview
                </h2>
                <LiveIndicator />
              </div>
              <p className="text-on-surface-variant font-medium mt-1">
                Order performance analytics synced from Supabase.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest text-primary text-sm font-semibold rounded-xl ring-1 ring-outline-variant/15">
                <Calendar className="w-4 h-4" />
                Last 30 Days
              </span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              label="Total Orders"
              value={totalOrders.toLocaleString()}
              change={null}
            />
            <KPICard
              label="Total Revenue"
              value={formatCurrency(totalRevenue)}
              change={null}
            />
            <KPICard
              label="Avg Order Value"
              value={formatCurrency(Math.round(avgOrderValue))}
              change={null}
            />
            <KPICard
              label="Completion Rate"
              value={`${completionRate}%`}
              change={null}
            />
          </div>

          {/* Bento Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Revenue Trend */}
            <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-xl shadow-ambient">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-lg font-bold text-on-surface tracking-tight">
                    Revenue Trend
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Daily gross revenue over the last 30 days
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Current
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-outline-variant">
                    <span className="w-2 h-2 rounded-full bg-outline-variant" />
                    Previous
                  </span>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="revenueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#00288e"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#00288e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(parseISO(d), "dd MMM")}
                      fontSize={10}
                      stroke="#757684"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCompact(v)}
                      fontSize={10}
                      stroke="#757684"
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "none",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        boxShadow: "0px 12px 32px rgba(13, 28, 47, 0.1)",
                        color: "#0d1c2f",
                      }}
                      itemStyle={{ color: "#0d1c2f", fontSize: 13 }}
                      labelStyle={{
                        color: "#444653",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Revenue",
                      ]}
                      labelFormatter={(label) =>
                        format(parseISO(label as string), "dd MMM yyyy")
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#00288e"
                      strokeWidth={2.5}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-ambient">
              <h3 className="text-lg font-bold text-on-surface tracking-tight mb-6">
                Status Distribution
              </h3>
              <div className="space-y-6">
                {statusChartData.map((item) => {
                  const pct =
                    totalOrders > 0
                      ? Math.round((item.value / totalOrders) * 100)
                      : 0;
                  const barColor = getStatusChartColor(item.status);
                  return (
                    <div key={item.status} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        <span>{item.name}</span>
                        <span>
                          {pct}% ({item.value})
                        </span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <section className="bg-surface-container-lowest rounded-xl shadow-ambient overflow-hidden">
            <div className="p-8 pb-4 border-b border-outline-variant/5">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-on-surface">
                  Recent Orders
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low text-[10px] font-black text-on-surface-variant uppercase tracking-[0.15em]">
                  <tr>
                    <th className="px-8 py-5">Order ID</th>
                    <th className="px-8 py-5">Customer</th>
                    <th className="px-8 py-5">Details</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Package className="h-10 w-10 text-outline" />
                          <p className="text-sm text-on-surface-variant">
                            No recent orders match your search
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const config = getStatusPresentation(
                        order.status,
                        statusMap
                      );
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-surface-container-highest/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td className="px-8 py-6 font-bold text-primary">
                            #{order.number}
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center">
                                <span className="text-primary font-bold text-xs">
                                  {getCustomerInitials(order.customer_name)}
                                </span>
                              </div>
                              <div>
                                <div className="font-bold text-on-surface">
                                  {order.customer_name}
                                </div>
                                <div className="text-[11px] text-on-surface-variant/60 font-medium leading-none mt-0.5">
                                  {order.email || order.phone || "No contact"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-on-surface font-medium truncate max-w-[240px]">
                              {order.items_summary || "No items"}
                            </div>
                            <div className="text-[11px] text-on-surface-variant/60">
                              {order.items_count || 0} Item
                              {(order.items_count || 0) !== 1 ? "s" : ""}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${config.bg} ${config.color}`}
                            >
                              {config.label}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right font-black text-on-surface">
                            {formatCurrency(Number(order.total_sum))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <TablePagination
              page={tablePage}
              pageSize={tablePageSize}
              totalItems={filteredCount}
              onPageChange={setTablePage}
              onPageSizeChange={(pageSize) => {
                setTablePageSize(pageSize);
                setTablePage(1);
              }}
              itemLabel="orders"
            />
          </section>
        </div>
      </DashboardShell>
      <OrderDetailDrawer
        order={selectedOrder}
        statusMap={statusMap}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}

/* ─── Live Indicator ─── */
function LiveIndicator() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 self-center">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Live
    </span>
  );
}

/* ─── KPI Card ─── */
function KPICard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: { value: number; up: boolean } | null;
}) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-low transition-colors shadow-ambient">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
      <div className="flex flex-col gap-1 relative">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          {label}
        </span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-4xl font-black text-primary">{value}</span>
          {change && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                change.up
                  ? "text-green-700 bg-green-50"
                  : "text-error bg-error-container/20"
              }`}
            >
              {change.up ? "+" : ""}
              {change.value}%
            </span>
          )}
        </div>
        <p className="text-[10px] text-on-surface-variant/60 font-medium mt-2">
          v.s. previous period
        </p>
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar skeleton */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-surface-container-low p-4 lg:block">
        <div className="flex items-center gap-3 px-2 py-4 mb-4">
          <div className="w-10 h-10 rounded-xl skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 rounded skeleton" />
            <div className="h-2 w-20 rounded skeleton" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg skeleton" />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="px-4 py-6 sm:px-6 lg:pl-[calc(var(--sidebar-width)+2rem)] lg:pr-8 lg:py-8">
        <div className="mb-8 space-y-2">
          <div className="h-12 w-48 rounded skeleton" />
          <div className="h-4 w-80 rounded skeleton" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest p-6 rounded-xl">
              <div className="h-3 w-20 rounded skeleton mb-4" />
              <div className="h-10 w-32 rounded skeleton mb-2" />
              <div className="h-2 w-24 rounded skeleton" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-xl">
            <div className="h-5 w-32 rounded skeleton mb-2" />
            <div className="h-3 w-48 rounded skeleton mb-10" />
            <div className="h-64 rounded-xl skeleton" />
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-xl">
            <div className="h-5 w-36 rounded skeleton mb-6" />
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-full rounded skeleton mb-2" />
                  <div className="h-2 w-full rounded skeleton" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="p-8 pb-4">
            <div className="h-6 w-32 rounded skeleton" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="px-8 py-6 flex gap-8"
            >
              <div className="h-4 w-20 rounded skeleton" />
              <div className="h-4 w-40 rounded skeleton" />
              <div className="h-4 w-48 rounded skeleton" />
              <div className="h-4 w-20 rounded skeleton" />
              <div className="h-4 w-24 rounded skeleton ml-auto" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
