import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const RETAILCRM_URL = process.env.RETAILCRM_URL;
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY;

if (!RETAILCRM_URL || !RETAILCRM_API_KEY) {
  console.error("Missing RETAILCRM_URL or RETAILCRM_API_KEY in .env.local");
  process.exit(1);
}

interface MockOrder {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  orderType: string;
  orderMethod: string;
  status: string;
  items: { productName: string; quantity: number; initialPrice: number }[];
  delivery: { address: { city: string; text: string } };
  customFields: Record<string, string>;
}

async function uploadOrders() {
  const ordersPath = path.resolve(__dirname, "../mock_orders.json");
  const orders: MockOrder[] = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));

  console.log(`Loaded ${orders.length} orders from mock_orders.json`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const externalId = `mock-order-${i + 1}`;

    const crmOrder = {
      externalId,
      firstName: order.firstName,
      lastName: order.lastName,
      phone: order.phone,
      email: order.email,
      items: order.items.map((item) => ({
        offer: { displayName: item.productName },
        productName: item.productName,
        quantity: item.quantity,
        initialPrice: item.initialPrice,
      })),
      delivery: {
        address: order.delivery.address,
      },
    };

    const url = `${RETAILCRM_URL}/api/v5/orders/create`;

    const body = new URLSearchParams();
    body.append("apiKey", RETAILCRM_API_KEY!);
    body.append("order", JSON.stringify(crmOrder));

    try {
      const res = await fetch(url, {
        method: "POST",
        body,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        success++;
        console.log(`[${i + 1}/${orders.length}] ✓ Created order ${externalId} (CRM ID: ${data.id})`);
      } else {
        failed++;
        console.error(`[${i + 1}/${orders.length}] ✗ Failed ${externalId}:`, data.errorMsg || data.errors || data);
      }
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${orders.length}] ✗ Network error for ${externalId}:`, err);
    }

    // Small delay to avoid rate limiting
    if (i < orders.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

uploadOrders();
