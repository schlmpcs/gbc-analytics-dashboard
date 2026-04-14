"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Settings,
  HelpCircle,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: null, label: "Analytics", icon: BarChart3 },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: null, label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col bg-surface-container-low p-4">
      <div className="mb-4 flex items-center justify-between gap-3 px-2 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <LayoutDashboard className="h-5 w-5 text-on-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black leading-none text-primary">
              GBC Analytics
            </h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-secondary">
              Retail Management
            </p>
          </div>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-high hover:text-primary"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href
                ? pathname.startsWith(item.href)
                : false;
          const Icon = item.icon;

          const className = `group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-300 ease-in-out ${
            isActive
              ? "bg-surface-container-high text-primary"
              : "text-secondary hover:bg-surface-container-high hover:text-primary"
          }`;

          const content = (
            <>
              <Icon
                className={`h-5 w-5 ${
                  isActive
                    ? "text-primary"
                    : "text-secondary transition-colors group-hover:text-primary"
                }`}
              />
              <span>{item.label}</span>
            </>
          );

          if (!item.href) {
            return (
              <span
                key={item.label}
                className={`${className} cursor-default opacity-70`}
              >
                {content}
              </span>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onClose}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        <span className="group flex cursor-default items-center gap-3 rounded-lg px-4 py-3 text-secondary opacity-70 transition-all duration-300 ease-in-out">
          <HelpCircle className="h-5 w-5 text-secondary" />
          <span className="text-sm font-medium">Help Center</span>
        </span>
      </div>
    </aside>
  );
}
