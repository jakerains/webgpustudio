"use client";

import { type LucideIcon } from "lucide-react";

interface CategorySectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export function CategorySection({
  title,
  icon: Icon,
  children,
}: CategorySectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color: "var(--accent)" }} />
        <h2
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted)", fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {children}
      </div>
    </section>
  );
}
