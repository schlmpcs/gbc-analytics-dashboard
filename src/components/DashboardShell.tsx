"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Settings } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";

interface DashboardShellProps {
  children: ReactNode;
  isMobileNavOpen: boolean;
  onMobileNavToggle: () => void;
  onMobileNavClose: () => void;
  searchSlot?: ReactNode;
}

export function DashboardShell({
  children,
  isMobileNavOpen,
  onMobileNavToggle,
  onMobileNavClose,
  searchSlot,
}: DashboardShellProps) {
  const pathname = usePathname();

  const navLinkClass = (href: string) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return isActive
      ? "border-b-2 border-primary pb-1 font-bold text-primary"
      : "text-secondary transition-colors hover:text-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar />
      </aside>

      <div
        className={`fixed inset-0 z-50 bg-on-surface/10 backdrop-blur-sm transition-opacity lg:hidden ${
          isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
        onClick={onMobileNavClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out lg:hidden ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar mobile onClose={onMobileNavClose} />
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 bg-surface-container-low/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-8">
              <button
                type="button"
                onClick={onMobileNavToggle}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-ambient lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">{searchSlot}</div>
              <nav className="hidden items-center gap-6 text-sm tracking-tight md:flex">
                <Link href="/" className={navLinkClass("/")}>
                  Overview
                </Link>
                <Link href="/orders" className={navLinkClass("/orders")}>
                  Orders
                </Link>
                <span className="cursor-default text-secondary opacity-70">
                  Inventory
                </span>
                <span className="cursor-default text-secondary opacity-70">
                  Reports
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-lowest hover:text-primary sm:flex"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-lowest hover:text-primary sm:flex"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high">
                <span className="text-xs font-bold text-primary">GBC</span>
              </div>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
