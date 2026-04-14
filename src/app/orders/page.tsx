"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { format, parseISO } from "date-fns";
import {
  Search,
  ChevronUp,
  ChevronDown,
  Package,
  RotateCcw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types";
import {
  getStatusFilterOptions,
  getStatusPresentation,
} from "@/lib/constants";
import { formatCurrency, getCustomerInitials } from "@/lib/format";
import type { RetailCrmStatusMap } from "@/lib/retailCrm";
import { DashboardShell } from "@/components/DashboardShell";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";
import { TablePagination } from "@/components/TablePagination";

type SortColumn = "number" | "created_at" | "customer_name" | "total_sum";
type SortDirection = "asc" | "desc";

interface StatusesResponse {
  statusMap: RetailCrmStatusMap;
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) return null;

  return direction === "asc" ? (
    <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
  ) : (
    <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [statusMap, setStatusMap] = useState<RetailCrmStatusMap>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatusMap() {
      try {
        const response = await fetch("/api/retailcrm/statuses");
        const payload = (await response.json()) as StatusesResponse | {
          error: string;
        };

        if (!response.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "Failed to load statuses");
        }

        if (!cancelled) {
          setStatusMap(payload.statusMap);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching RetailCRM statuses:", error);
        }
      }
    }

    fetchStatusMap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function syncFromCRM() {
      try {
        await fetch("/api/sync/orders");
      } catch {
        // non-critical, ignore
      }
    }

    syncFromCRM();
    const interval = setInterval(syncFromCRM, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("[realtime] orders change received");
          setRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    async function fetchCities() {
      const { data } = await supabase.from("orders").select("city");
      if (data) {
        const unique = Array.from(
          new Set(data.map((r) => r.city).filter(Boolean) as string[])
        ).sort();
        setCities(unique);
      }
    }
    fetchCities();
  }, []);

  const buildQuery = useCallback(
    (select: string, opts?: { count?: "exact"; head?: boolean }) => {
      let q = supabase.from("orders").select(select, opts);
      if (debouncedSearch) {
        q = q.or(
          [
            `number.ilike.%${debouncedSearch}%`,
            `customer_name.ilike.%${debouncedSearch}%`,
            `phone.ilike.%${debouncedSearch}%`,
          ].join(",")
        );
      }
      if (statusFilter) {
        q = q.eq("status", statusFilter);
      }
      if (cityFilter) {
        q = q.eq("city", cityFilter);
      }
      return q;
    },
    [debouncedSearch, statusFilter, cityFilter]
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);

      const { count } = await buildQuery("*", {
        count: "exact",
        head: true,
      });

      if (cancelled) return;
      setTotalCount(count ?? 0);

      const effectiveTotalPages = Math.max(
        1,
        Math.ceil((count ?? 0) / pageSize)
      );
      const effectivePage = Math.min(page, effectiveTotalPages);
      const from = (effectivePage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = (await buildQuery("*")
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range(from, to)) as unknown as {
        data: Order[] | null;
        error: { message: string } | null;
      };

      if (cancelled) return;

      if (error) {
        console.error("Error fetching orders:", error);
        setOrders([]);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortColumn, sortDirection, buildQuery, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(column === "total_sum" ? "desc" : "asc");
    }
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  function handleCityChange(value: string) {
    setCityFilter(value);
    setPage(1);
  }

  function resetFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("");
    setCityFilter("");
    setPage(1);
  }

  const hasActiveFilters = debouncedSearch || statusFilter || cityFilter;

  // Compute bottom summary stats
  const newOrders = orders.filter((o) => o.status === "new").length;
  const pendingOrders = orders.filter(
    (o) => o.status === "offer-analog"
  ).length;
  const recentRevenue = orders.reduce(
    (sum, o) => sum + Number(o.total_sum),
    0
  );

  return (
    <>
      <DashboardShell
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavToggle={() => setIsMobileNavOpen((open) => !open)}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
      >
        <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[2.75rem] font-black text-on-surface tracking-tight leading-none">
                  Orders
                </h2>
                <LiveIndicator />
              </div>
              <p className="text-on-surface-variant font-medium mt-2">
                Manage and track your global retail transactions
              </p>
            </div>
          </div>

          {/* Filters Bento */}
          <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-12 lg:col-span-5 bg-surface-container-lowest p-5 rounded-xl flex items-center gap-3">
              <Search className="w-5 h-5 text-outline" />
              <input
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-on-surface placeholder:text-outline/60"
                placeholder="Search by Order #, Customer, or Phone..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="md:col-span-4 lg:col-span-2 bg-surface-container-lowest p-5 rounded-xl">
              <select
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-on-surface"
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="">All Statuses</option>
                {getStatusFilterOptions(statusMap).map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 lg:col-span-2 bg-surface-container-lowest p-5 rounded-xl">
              <select
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-on-surface"
                value={cityFilter}
                onChange={(e) => handleCityChange(e.target.value)}
              >
                <option value="">All Cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 lg:col-span-3 flex gap-3">
              <button
                onClick={() => setPage(1)}
                className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold rounded-xl transition-colors py-4"
              >
                Filter Results
              </button>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-5 bg-surface-container-low text-on-surface-variant hover:text-error rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </section>

          {/* Table Section */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-ambient">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <button
                        className="flex items-center gap-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:text-primary"
                        onClick={() => handleSort("number")}
                      >
                        Order #
                        <SortIndicator
                          active={sortColumn === "number"}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <button
                        className="flex items-center gap-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:text-primary"
                        onClick={() => handleSort("created_at")}
                      >
                        Date
                        <SortIndicator
                          active={sortColumn === "created_at"}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <button
                        className="flex items-center gap-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:text-primary"
                        onClick={() => handleSort("customer_name")}
                      >
                        Customer
                        <SortIndicator
                          active={sortColumn === "customer_name"}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                        Shipping
                      </span>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                        Items
                      </span>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                        Status
                      </span>
                    </th>
                    <th className="px-6 py-4 text-right">
                      <button
                        className="flex items-center justify-end gap-1 w-full text-xs font-bold text-on-surface-variant uppercase tracking-wider hover:text-primary"
                        onClick={() => handleSort("total_sum")}
                      >
                        Amount
                        <SortIndicator
                          active={sortColumn === "total_sum"}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {loading
                    ? Array.from({ length: pageSize }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-5">
                            <div className="h-4 w-20 rounded skeleton" />
                          </td>
                          <td className="px-6 py-5">
                            <div className="h-4 w-24 rounded skeleton" />
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full skeleton" />
                              <div className="space-y-1.5">
                                <div className="h-4 w-28 rounded skeleton" />
                                <div className="h-3 w-36 rounded skeleton" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="h-4 w-24 rounded skeleton" />
                          </td>
                          <td className="px-6 py-5">
                            <div className="h-4 w-20 rounded skeleton" />
                          </td>
                          <td className="px-6 py-5">
                            <div className="h-4 w-20 rounded skeleton" />
                          </td>
                          <td className="px-6 py-5">
                            <div className="h-4 w-24 rounded skeleton ml-auto" />
                          </td>
                        </tr>
                      ))
                    : orders.length === 0
                      ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Package className="w-10 h-10 text-outline" />
                              <p className="text-sm text-on-surface-variant">
                                No orders found
                              </p>
                              {hasActiveFilters && (
                                <button
                                  onClick={resetFilters}
                                  className="text-sm text-primary hover:underline transition-colors"
                                >
                                  Reset filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                      : orders.map((order) => {
                          const config = getStatusPresentation(
                            order.status,
                            statusMap
                          );
                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-surface-container-high transition-colors cursor-pointer group"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <td className="px-6 py-5 font-bold text-primary">
                                #{order.number}
                              </td>
                              <td className="px-6 py-5 text-sm text-on-surface-variant">
                                {format(
                                  parseISO(order.created_at),
                                  "MMM dd, yyyy"
                                )}
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
                                    <span className="text-on-secondary-container font-bold text-xs">
                                      {getCustomerInitials(
                                        order.customer_name
                                      )}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-on-surface">
                                      {order.customer_name}
                                    </div>
                                    <div className="text-xs text-on-surface-variant">
                                      {order.email ||
                                        order.phone ||
                                        "No contact"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="text-sm text-on-surface font-medium">
                                  {order.city || "Unknown"}
                                </div>
                                <div className="text-xs text-on-surface-variant truncate max-w-[160px]">
                                  {order.delivery_address || "No address"}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-on-surface">
                                    {order.items_count || 0} Item
                                    {(order.items_count || 0) !== 1 ? "s" : ""}
                                  </span>
                                  <span className="text-xs text-on-surface-variant truncate max-w-[140px]">
                                    {order.items_summary || "No items"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <span
                                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full tracking-widest ${config.bg} ${config.color}`}
                                >
                                  {config.label}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right font-black text-on-surface">
                                {formatCurrency(Number(order.total_sum))}
                              </td>
                            </tr>
                          );
                        })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {!loading && totalCount > 0 && (
              <TablePagination
                page={currentPage}
                pageSize={pageSize}
                totalItems={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
                itemLabel="orders"
              />
            )}
          </div>

          {/* Bottom Summary Widgets */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12">
            <div className="bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden shadow-ambient">
              <div className="relative z-10">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  New Requests
                </p>
                <h3 className="text-3xl font-black text-primary mt-2">
                  {newOrders}
                </h3>
                <div className="mt-4 flex items-center text-xs text-on-tertiary-fixed-variant bg-tertiary-fixed w-fit px-2 py-1 rounded-full">
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                  from current page
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <Package className="w-20 h-20 text-primary" />
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden shadow-ambient">
              <div className="relative z-10">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Pending Fulfillment
                </p>
                <h3 className="text-3xl font-black text-on-surface mt-2">
                  {pendingOrders}
                </h3>
                <p className="mt-4 text-xs text-on-surface-variant font-medium">
                  In-progress orders on this page
                </p>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden shadow-ambient">
              <div className="relative z-10">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Page Revenue
                </p>
                <h3 className="text-3xl font-black text-on-primary-fixed-variant mt-2">
                  {formatCurrency(recentRevenue)}
                </h3>
                <div className="mt-4 flex items-center text-xs text-on-error-container bg-error-container w-fit px-2 py-1 rounded-full">
                  <TrendingDown className="w-3.5 h-3.5 mr-1" />
                  current page total
                </div>
              </div>
            </div>
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
