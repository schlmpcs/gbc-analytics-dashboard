export interface RetailCrmStatusMeta {
  code: string;
  label: string;
  group: string | null;
  active: boolean;
  ordering: number | null;
}

export type RetailCrmStatusMap = Record<string, RetailCrmStatusMeta>;

interface RetailCrmStatusesResponse {
  success?: boolean;
  statuses?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStatusMap(payload: unknown): RetailCrmStatusMap | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { success, statuses } = payload as RetailCrmStatusesResponse;
  if (success !== true || !Array.isArray(statuses)) {
    return null;
  }

  const entries = statuses.flatMap((status) => {
    if (!isRecord(status)) {
      return [];
    }

    const code = status.code;
    const name = status.name;
    if (typeof code !== "string" || typeof name !== "string") {
      return [];
    }

    return [
      [
        code,
        {
          code,
          label: name,
          group: typeof status.group === "string" ? status.group : null,
          active: typeof status.active === "boolean" ? status.active : true,
          ordering:
            typeof status.ordering === "number" ? status.ordering : null,
        } satisfies RetailCrmStatusMeta,
      ],
    ];
  });

  return Object.fromEntries(entries);
}

function buildReferenceStatusesUrl(
  retailCrmUrl: string,
  apiKey: string,
  version: "v5" | "v4"
) {
  const url = new URL(`/api/${version}/reference/statuses`, retailCrmUrl);
  url.searchParams.set("apiKey", apiKey);
  return url.toString();
}

export async function fetchRetailCrmStatusMap(
  fetchImpl: typeof fetch = fetch
): Promise<RetailCrmStatusMap> {
  const retailCrmUrl = process.env.RETAILCRM_URL;
  const apiKey = process.env.RETAILCRM_API_KEY;

  if (!retailCrmUrl || !apiKey) {
    throw new Error("Missing RETAILCRM_URL or RETAILCRM_API_KEY");
  }

  const urls = [
    buildReferenceStatusesUrl(retailCrmUrl, apiKey, "v5"),
    buildReferenceStatusesUrl(retailCrmUrl, apiKey, "v4"),
  ];

  let lastError: string | null = null;

  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        lastError = `RetailCRM returned HTTP ${response.status} for ${url}`;
        continue;
      }

      const payload = await response.json();
      const statusMap = parseStatusMap(payload);

      if (statusMap && Object.keys(statusMap).length > 0) {
        return statusMap;
      }

      lastError = `RetailCRM returned an unexpected status dictionary payload for ${url}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(
    lastError || "Failed to load RetailCRM order status dictionary"
  );
}
