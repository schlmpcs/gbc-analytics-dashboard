import { NextRequest, NextResponse } from "next/server";
import { handleTelegramWebhook } from "@/lib/telegramWebhook";

export async function POST(request: NextRequest) {
  const result = await handleTelegramWebhook(request);
  return NextResponse.json(result.body, { status: result.status });
}
