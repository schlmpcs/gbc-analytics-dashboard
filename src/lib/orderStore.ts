import { mapCRMOrderToRow, type CRMOrder } from "./orderSync.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

export async function upsertOrder(order: CRMOrder) {
  const row = mapCRMOrderToRow(order);

  const { error } = await supabaseAdmin
    .from("orders")
    .upsert(row, { onConflict: "external_id" });

  if (error) {
    throw error;
  }

  return row;
}
