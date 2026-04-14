import assert from "node:assert/strict";

import {
  buildRetailCrmOrdersUrl,
  mapCRMOrderToRow,
  type CRMOrder,
} from "../src/lib/orderSync.ts";

const sampleOrder: CRMOrder = {
  id: 42,
  externalId: "crm-42",
  number: "A-42",
  totalSumm: 91250,
  createdAt: "2026-04-14T10:15:00+05:00",
  status: "complete",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "+7 777 000 1111",
  email: "ada@example.com",
  delivery: {
    address: {
      city: "Almaty",
      text: "Satpayev 1",
    },
  },
  items: [
    {
      offer: { displayName: "Widget Pro" },
      quantity: 2,
      initialPrice: 30000,
    },
    {
      productName: "Cable",
      quantity: 1,
      initialPrice: 1250,
    },
  ],
};

const row = mapCRMOrderToRow(sampleOrder);
const retailCrmUrl = buildRetailCrmOrdersUrl(
  "https://demo.retailcrm.ru",
  "test-key",
  3
);

assert.equal(row.external_id, "crm-42");
assert.equal(row.customer_name, "Ada Lovelace");
assert.equal(row.items_count, 3);
assert.equal(row.items_summary, "Widget Pro x2, Cable x1");
assert.equal(row.city, "Almaty");
assert.equal(row.delivery_address, "Satpayev 1");
assert.equal(
  retailCrmUrl,
  "https://demo.retailcrm.ru/api/v5/orders?apiKey=test-key&limit=100&page=3"
);

console.log(
  JSON.stringify(
    {
      success: true,
      externalId: row.external_id,
      itemsCount: row.items_count,
      retailCrmUrl,
    },
    null,
    2
  )
);
