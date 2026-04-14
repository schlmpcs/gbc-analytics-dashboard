"use client";

import { useEffect, useCallback } from "react";
import {
  X,
  User,
  ShoppingBag,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Order } from "@/lib/types";
import { getStatusPresentation } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { RetailCrmStatusMap } from "@/lib/retailCrm";

interface Props {
  order: Order | null;
  statusMap?: RetailCrmStatusMap;
  onClose: () => void;
}

function parseItems(summary: string | null): { name: string; qty: string }[] {
  if (!summary) return [];
  return summary.split(",").map((part) => {
    const trimmed = part.trim();
    const match = trimmed.match(/^(.+?)\s+x(\d+)$/i);
    if (match) return { name: match[1], qty: match[2] };
    return { name: trimmed, qty: "1" };
  });
}

export function OrderDetailDrawer({
  order,
  statusMap,
  onClose,
}: Props) {
  const isOpen = order !== null;

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, handleEscape]);

  const statusCfg = order ? getStatusPresentation(order.status, statusMap) : null;

  const items = order ? parseItems(order.items_summary) : [];
  const subtotal = order ? Number(order.total_sum) : 0;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className={`fixed inset-0 z-40 bg-on-surface/10 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel with glassmorphism */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg glass-panel shadow-[0px_12px_32px_rgba(13,28,47,0.12)] border-l border-outline-variant/10 transition-transform duration-500 flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {order && statusCfg && (
          <>
            {/* Drawer Header */}
            <div className="p-6 flex justify-between items-center bg-surface-container-low">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] block mb-1">
                  Transaction Insight
                </span>
                <h2 className="text-2xl font-black text-on-surface">
                  Order Details
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-error-container hover:text-on-error-container transition-all shadow-sm"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Essential Meta */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    Reference ID
                  </p>
                  <p className="text-xl font-black text-primary">
                    #{order.number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    Timestamp
                  </p>
                  <p className="text-sm font-medium text-on-surface">
                    {format(parseISO(order.created_at), "MMM dd, yyyy")} &bull;{" "}
                    {format(parseISO(order.created_at), "HH:mm")}
                  </p>
                </div>
              </div>

              {/* Status Display */}
              <div className="bg-primary-container/5 rounded-xl p-4 border border-primary/10">
                <p className="text-xs font-bold text-on-surface-variant">
                  Current Status
                </p>
                <p className="mt-1 text-sm font-bold text-primary">
                  {statusCfg.label}
                </p>
              </div>

              {/* Customer Details */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">
                    Customer Details
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-y-6 gap-x-4 bg-surface-container-lowest p-6 rounded-xl">
                  <DetailField label="Full Name" value={order.customer_name} />
                  <DetailField label="Phone Number" value={order.phone} />
                  <div className="col-span-2">
                    <DetailField label="Email Address" value={order.email} />
                  </div>
                  <DetailField label="City / Region" value={order.city} />
                  <DetailField label="External ID" value={order.external_id} />
                  <div className="col-span-2">
                    <DetailField
                      label="Shipping Address"
                      value={order.delivery_address}
                    />
                  </div>
                </div>
              </section>

              {/* Itemized Summary */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">
                    Itemized Summary
                  </h3>
                </div>
                <div className="space-y-3">
                  {items.length > 0 ? (
                    items.map((item, i) => (
                      <div key={i} className="flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-5 h-5 text-outline" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">
                            {item.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-on-surface-variant">
                            Qty: {item.qty}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-on-surface-variant">
                      No item details available
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Drawer Footer */}
            <div className="p-8 bg-surface-container-low border-t border-outline-variant/10">
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Subtotal</span>
                  <span className="font-medium text-on-surface">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">
                    Shipping
                  </span>
                  <span className="font-medium text-primary">Free</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Tax</span>
                  <span className="font-medium text-on-surface">
                    {formatCurrency(0)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-end gap-6">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Total Amount Paid
                  </p>
                  <p className="text-3xl font-black text-primary">
                    {formatCurrency(subtotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    External ID
                  </p>
                  <p className="text-sm font-semibold text-on-surface">
                    {order.external_id}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-semibold text-on-surface">
        {value || "N/A"}
      </p>
    </div>
  );
}
