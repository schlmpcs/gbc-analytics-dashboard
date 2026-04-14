process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.TELEGRAM_CHAT_ID = "12345";
process.env.RETAILCRM_URL = "https://demo.retailcrm.ru";
process.env.RETAILCRM_API_KEY = "test-key";

globalThis.fetch = async (input) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (url.includes("/api/v5/orders/")) {
    const number = decodeURIComponent(url.split("/api/v5/orders/")[1].split("?")[0]);
    const totalSumm =
      number === "C-303" ? 1200 : number === "D-404" ? 90000 : 75000;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        order: {
          id: 1,
          externalId: number,
          number,
          totalSumm,
          createdAt: "2026-04-14T10:00:00Z",
          status: "new",
          firstName: "Test",
          lastName: "User",
          items: [],
        },
      }),
    } as Response;
  }

  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, result: { message_id: 1 } }),
  } as Response;
};

async function run() {
  const { handleTelegramWebhook } = await import("../src/lib/telegramWebhook.ts");
  const syncedOrders: string[] = [];

  const jsonRequest = new Request("http://localhost/api/webhook/retailcrm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "order.create",
      order: {
        totalSumm: 75000,
        number: "A-101",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    }),
  });

  const formBody = new URLSearchParams({
    event: "order.create",
    "order[totalSumm]": "88000",
    "order[number]": "B-202",
    "order[firstName]": "Grace",
    "order[lastName]": "Hopper",
  });

  const formRequest = new Request("http://localhost/api/webhook/retailcrm", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody,
  });

  const lowValueRequest = new Request("http://localhost/api/webhook/retailcrm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "order.create",
      order: {
        totalSumm: 1200,
        number: "C-303",
      },
    }),
  });

  const ignoredEventRequest = new Request("http://localhost/api/webhook/retailcrm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "order.edit",
      order: {
        totalSumm: 90000,
        number: "D-404",
      },
    }),
  });

  const [jsonResponse, formResponse, lowValueResponse, ignoredEventResponse] =
    await Promise.all([
      handleTelegramWebhook(jsonRequest, {
        syncOrder: async (order) => {
          syncedOrders.push(order.number);
        },
      }),
      handleTelegramWebhook(formRequest, {
        syncOrder: async (order) => {
          syncedOrders.push(order.number);
        },
      }),
      handleTelegramWebhook(lowValueRequest, {
        syncOrder: async (order) => {
          syncedOrders.push(order.number);
        },
      }),
      handleTelegramWebhook(ignoredEventRequest, {
        syncOrder: async (order) => {
          syncedOrders.push(order.number);
        },
      }),
    ]);

  console.log(
    JSON.stringify(
      {
        json: jsonResponse.body,
        form: formResponse.body,
        lowValue: lowValueResponse.body,
        ignoredEvent: ignoredEventResponse.body,
        syncedOrders,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
