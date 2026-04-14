import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { RetailCrmStatusMap } from "@/lib/retailCrm";

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof Package }
> = {
  new: {
    label: "New",
    color: "text-on-secondary-container",
    bg: "bg-secondary-container border-transparent",
    icon: Package,
  },
  "offer-analog": {
    label: "In-Progress",
    color: "text-amber-700",
    bg: "bg-amber-100 border-transparent",
    icon: Clock,
  },
  complete: {
    label: "Complete",
    color: "text-on-primary-fixed",
    bg: "bg-primary-fixed border-transparent",
    icon: CheckCircle2,
  },
  "cancel-other": {
    label: "Cancelled",
    color: "text-on-error-container",
    bg: "bg-error-container border-transparent",
    icon: XCircle,
  },
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  new: "#005074",
  "offer-analog": "#d97706",
  complete: "#00288e",
  "cancel-other": "#ba1a1a",
};

const DEFAULT_STATUS_PRESENTATION = {
  label: "",
  color: "text-secondary",
  bg: "bg-surface-container-high border-transparent",
  icon: Package,
};

export function getStatusPresentation(
  status: string,
  statusMap?: RetailCrmStatusMap
) {
  const config = STATUS_CONFIG[status] || DEFAULT_STATUS_PRESENTATION;

  return {
    ...config,
    label: statusMap?.[status]?.label || config.label || status,
  };
}

export function getStatusChartColor(status: string) {
  return STATUS_CHART_COLORS[status] || "#757684";
}

export function getStatusFilterOptions(statusMap?: RetailCrmStatusMap) {
  if (statusMap && Object.keys(statusMap).length > 0) {
    return Object.values(statusMap)
      .filter((status) => status.active)
      .sort((a, b) => {
        const orderingA = a.ordering ?? Number.MAX_SAFE_INTEGER;
        const orderingB = b.ordering ?? Number.MAX_SAFE_INTEGER;
        if (orderingA !== orderingB) {
          return orderingA - orderingB;
        }
        return a.label.localeCompare(b.label);
      })
      .map((status) => ({
        value: status.code,
        label: status.label,
      }));
  }

  return Object.entries(STATUS_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
  }));
}
