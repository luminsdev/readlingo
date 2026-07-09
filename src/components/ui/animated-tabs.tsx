"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: ReactNode;
  href?: string;
  onClick?: () => void;
};

export function AnimatedTabs({
  tabs,
  activeTab,
  className,
  layoutIdPrefix = "animated-tabs",
}: {
  tabs: TabItem[];
  activeTab: string;
  className?: string;
  layoutIdPrefix?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-[44px] items-center justify-center rounded-[14px] bg-black/5 p-1 shadow-inner dark:bg-black/20",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        const content = (
          <>
            {isActive && (
              <motion.div
                className="bg-background dark:bg-surface-strong absolute inset-0 rounded-[10px] border border-black/5 shadow-md dark:border-white/10"
                layoutId={`${layoutIdPrefix}-indicator`}
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {tab.label}
            </span>
          </>
        );

        const itemClassName = cn(
          "focus-visible:ring-ring relative flex items-center justify-center rounded-[10px] px-5 py-1.5 text-[0.92rem] font-medium transition-colors outline-none focus-visible:ring-2",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        );

        if (tab.href) {
          return (
            <Link
              key={tab.id}
              className={itemClassName}
              href={tab.href}
              prefetch={true}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            aria-pressed={isActive}
            className={itemClassName}
            onClick={tab.onClick}
            type="button"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
