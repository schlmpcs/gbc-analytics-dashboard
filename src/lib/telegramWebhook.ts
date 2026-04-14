import {
  buildRetailCrmOrderUrl,
  type CRMOrder,
} from "./orderSync.ts";

const THRESHOLD = 50000;
const CREATE_EVENT_PATTERNS = [
  "create",
  "created",
  "new",
  "order.create",
  "orders.create",
];

export interface TelegramWebhookConfig {
  botToken?: string;
  chatId?: string;
  fetchImpl?: typeof fetch;
  syncOrder?: (order: CRMOrder) => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toNumber(value: unknown) {
  const normalized =
    typeof value === "string" ? value.replaceAll(/\s/g, "").replace(",", ".") : value;
  const result = Number(normalized);

  return Number.isFinite(result) ? result : undefined;
}

function assignNestedValue(
  target: Record<string, unknown>,
  key: string,
  value: unknown
) {
  const parts = key.replaceAll("]", "").split("[").filter(Boolean);

  if (parts.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = target;

  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];

    if (!isRecord(existing)) {
      cursor[part] = {};
    }

    cursor = cursor[part] as Record<string, unknown>;
  }

  cursor[parts.at(-1)!] = value;
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (
    !(trimmed.startsWith("{") && trimmed.endsWith("}")) &&
    !(trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as unknown;
  }

  const formData = await request.formData();
  const payload: Record<string, unknown> = {};

  for (const [key, rawValue] of formData.entries()) {
    const value = rawValue instanceof File ? rawValue.name : rawValue;

    if (key.includes("[")) {
      assignNestedValue(payload, key, value);
      continue;
    }

    payload[key] = value;
  }

  return payload;
}

function looksLikeOrder(value: Record<string, unknown>) {
  return (
    "totalSumm" in value ||
    "total_sum" in value ||
    "totalSum" in value ||
    "number" in value ||
    "externalId" in value
  );
}

function extractPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return { eventType: undefined, order: null as Record<string, unknown> | null };
  }

  const eventType =
    getString(payload.event) ??
    getString(payload.action) ??
    getString(payload.type) ??
    getString(payload.eventType);

  const nestedOrder = parseMaybeJson(payload.order);

  if (isRecord(nestedOrder)) {
    return { eventType, order: nestedOrder };
  }

  if (isRecord(payload.data) && isRecord(payload.data.order)) {
    return { eventType, order: payload.data.order };
  }

  if (looksLikeOrder(payload)) {
    return { eventType, order: payload };
  }

  return { eventType, order: null as Record<string, unknown> | null };
}

function isCreateEvent(eventType?: string) {
  if (!eventType) {
    return true;
  }

  const normalized = eventType.toLowerCase();
  return CREATE_EVENT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function getPositiveNumber(value: unknown) {
  const parsed = toNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function getOrderIdentifier(order: Record<string, unknown>) {
  const id = getPositiveNumber(order.id);
  if (id !== undefined) {
    return { by: "id" as const, value: id };
  }

  const externalId = getString(order.externalId);
  if (externalId) {
    return { by: "externalId" as const, value: externalId };
  }

  const number = getString(order.number);
  if (number) {
    return { by: "number" as const, value: number };
  }

  return null;
}

async function fetchLatestOrderFromCrm(
  order: Record<string, unknown>,
  fetchImpl: typeof fetch
) {
  const retailCrmUrl = process.env.RETAILCRM_URL;
  const apiKey = process.env.RETAILCRM_API_KEY;

  if (!retailCrmUrl || !apiKey) {
    throw new Error("Missing RETAILCRM_URL or RETAILCRM_API_KEY");
  }

  const identifier = getOrderIdentifier(order);
  if (!identifier) {
    throw new Error("Webhook payload does not contain order id, externalId, or number");
  }

  const url = buildRetailCrmOrderUrl(
    retailCrmUrl,
    apiKey,
    identifier.value,
    identifier.by
  );
  const response = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RetailCRM returned HTTP ${response.status} for ${url}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    order?: CRMOrder;
    errorMsg?: string;
  };

  if (!payload.success || !payload.order) {
    throw new Error(payload.errorMsg || "RetailCRM did not return order data");
  }

  return payload.order;
}

async function defaultSyncOrder(order: CRMOrder) {
  const { upsertOrder } = await import("./orderStore.ts");
  await upsertOrder(order);
}

function getCustomerName(order: Record<string, unknown>) {
  const nestedCustomer = isRecord(order.customer) ? order.customer : undefined;
  const firstName =
    getString(order.firstName) ?? (nestedCustomer ? getString(nestedCustomer.firstName) : undefined);
  const lastName =
    getString(order.lastName) ?? (nestedCustomer ? getString(nestedCustomer.lastName) : undefined);

  return (
    [firstName, lastName].filter(Boolean).join(" ") ||
    getString(order.customer_name) ||
    getString(order.customerName) ||
    "Unknown"
  );
}

async function sendTelegramMessage(
  text: string,
  config: Required<Pick<TelegramWebhookConfig, "botToken" | "chatId" | "fetchImpl">>
) {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const res = await config.fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  const responseText = await res.text();
  const payload = responseText ? JSON.parse(responseText) : null;

  if (!res.ok) {
    throw new Error(
      `Telegram API responded with ${res.status}: ${responseText || "empty response"}`
    );
  }

  return payload;
}

export async function handleTelegramWebhook(
  request: Request,
  config: TelegramWebhookConfig = {}
) {
  const resolvedConfig = {
    botToken: config.botToken ?? process.env.TELEGRAM_BOT_TOKEN,
    chatId: config.chatId ?? process.env.TELEGRAM_CHAT_ID,
    fetchImpl: config.fetchImpl ?? fetch,
    syncOrder: config.syncOrder ?? defaultSyncOrder,
  };

  try {
    if (!resolvedConfig.botToken || !resolvedConfig.chatId) {
      return {
        status: 500,
        body: { error: "Telegram credentials not configured" },
      };
    }
    const telegramConfig = {
      botToken: resolvedConfig.botToken,
      chatId: resolvedConfig.chatId,
      fetchImpl: resolvedConfig.fetchImpl,
    };

    const payload = await readPayload(request);
    const { eventType, order } = extractPayload(payload);

    if (!order) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Could not extract order payload from webhook body",
        },
      };
    }

    const latestOrder = await fetchLatestOrderFromCrm(order, resolvedConfig.fetchImpl);
    await resolvedConfig.syncOrder(latestOrder);

    const totalSum = toNumber(
      latestOrder.totalSumm ?? order.totalSumm ?? order.total_sum ?? order.totalSum
    );
    const orderNumber =
      getString(latestOrder.number) ??
      getString(order.number) ??
      getString(order.externalId) ??
      "N/A";
    const customerName = getCustomerName(
      latestOrder as unknown as Record<string, unknown>
    );

    if (totalSum === undefined) {
      return {
        status: 400,
        body: { success: false, error: "Order total is missing or invalid" },
      };
    }

    if (isCreateEvent(eventType) && totalSum > THRESHOLD) {
      const message = [
        `<b>New High-Value Order!</b>`,
        `Order: #${escapeHtml(orderNumber)}`,
        `Customer: ${escapeHtml(customerName)}`,
        `Amount: ${new Intl.NumberFormat("ru-RU").format(totalSum)} KZT`,
      ].join("\n");

      const result = await sendTelegramMessage(message, telegramConfig);
      console.log("Telegram notification sent:", result);

      return {
        status: 200,
        body: { success: true, notified: true, synced: true },
      };
    }

    return { status: 200, body: { success: true, notified: false, synced: true } };
  } catch (error) {
    console.error("Webhook error:", error);
    return {
      status: 500,
      body: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown webhook error",
      },
    };
  }
}
