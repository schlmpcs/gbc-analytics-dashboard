export interface CRMOrderItem {
  offer?: { displayName?: string; name?: string };
  productName?: string;
  quantity?: number;
  initialPrice: number;
}

export interface CRMOrder {
  id: number;
  externalId?: string;
  number: string;
  totalSumm: number;
  createdAt: string;
  status: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  delivery?: { address?: { city?: string; text?: string } };
  items?: CRMOrderItem[];
}

export interface SupabaseOrderRow {
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
  items_count: number;
  items_summary: string | null;
}

export function buildRetailCrmOrdersUrl(
  retailCrmUrl: string,
  apiKey: string,
  page: number
) {
  const url = new URL("/api/v5/orders", retailCrmUrl);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("limit", "100");
  url.searchParams.set("page", String(page));
  return url.toString();
}

export function buildRetailCrmOrderUrl(
  retailCrmUrl: string,
  apiKey: string,
  identifier: string | number,
  by: "id" | "externalId" | "number" = "id"
) {
  const safeIdentifier = encodeURIComponent(String(identifier));
  const url = new URL(`/api/v5/orders/${safeIdentifier}`, retailCrmUrl);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("by", by);
  return url.toString();
}

export function mapCRMOrderToRow(order: CRMOrder): SupabaseOrderRow {
  return {
    external_id: order.externalId || String(order.id),
    number: order.number,
    total_sum: order.totalSumm,
    created_at: order.createdAt,
    status: order.status,
    customer_name:
      [order.firstName, order.lastName].filter(Boolean).join(" ") || "Unknown",
    phone: order.phone || null,
    email: order.email || null,
    city: order.delivery?.address?.city || null,
    delivery_address: order.delivery?.address?.text || null,
    items_count:
      order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ||
      0,
    items_summary:
      order.items
        ?.map((item) => {
          const name =
            item.offer?.displayName ||
            item.offer?.name ||
            item.productName ||
            "Unknown";
          const quantity = Number(item.quantity || 0);

          return quantity > 0 ? `${name} x${quantity}` : name;
        })
        .join(", ") || null,
  };
}

export function mapCRMOrdersToRows(orders: CRMOrder[]) {
  return orders.map(mapCRMOrderToRow);
}
