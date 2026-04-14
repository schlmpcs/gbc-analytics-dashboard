import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  buildRetailCrmOrdersUrl,
  mapCRMOrdersToRows,
  type CRMOrder,
} from "../src/lib/orderSync";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const RETAILCRM_URL = process.env.RETAILCRM_URL;
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!RETAILCRM_URL || !RETAILCRM_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fetchOrdersFromCRM(): Promise<CRMOrder[]> {
  const allOrders: CRMOrder[] = [];
  let page = 1;

  while (true) {
    const url = buildRetailCrmOrdersUrl(
      RETAILCRM_URL!,
      RETAILCRM_API_KEY!,
      page
    );
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      console.error("Failed to fetch orders from CRM:", data.errorMsg || data);
      break;
    }

    allOrders.push(...data.orders);
    console.log(`Fetched page ${page}: ${data.orders.length} orders`);

    if (page >= data.pagination.totalPageCount) break;
    page++;
  }

  return allOrders;
}

async function syncToSupabase() {
  console.log("Fetching orders from RetailCRM...");
  const crmOrders = await fetchOrdersFromCRM();
  console.log(`Total orders fetched: ${crmOrders.length}`);

  const rows = mapCRMOrdersToRows(crmOrders);

  const { error } = await supabase
    .from("orders")
    .upsert(rows, { onConflict: "external_id" });

  if (error) {
    console.error("Supabase upsert error:", error);
  } else {
    console.log(`Successfully synced ${rows.length} orders to Supabase`);
  }
}

syncToSupabase();
