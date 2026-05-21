"use client";

import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion";

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface FacetGroup {
  key: string;
  label: string;
  options: FacetOption[];
  /** Count shown on the "All" row — games visible if this facet were cleared */
  poolCount: number;
}

interface ActiveFilters {
  genre: string;
  publisher: string;
  year: string;
  region: string;
}

interface Props {
  facets: FacetGroup[];
  activeFilters: ActiveFilters;
  onFilterChange: (key: keyof ActiveFilters, value: string) => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

const FACET_KEYS: (keyof ActiveFilters)[] = ["genre", "publisher", "year", "region"];

export function FacetFilterSidebar({
  facets,
  activeFilters,
  onFilterChange,
  totalCount,
  filteredCount,
  className,
}: Props) {
  const hasActiveFilters = FACET_KEYS.some((k) => activeFilters[k] !== "all");

  function clearAll() {
    FACET_KEYS.forEach((k) => onFilterChange(k, "all"));
  }

  const defaultOpenKeys = facets.map((f) => f.key);

  return (
    <aside
      className={cn("w-72 shrink-0 border-l pl-5", className)}
      style={{
        borderLeftColor: "var(--panel-border)",
        background: "linear-gradient(270deg, var(--cd-bg-50) 0%, transparent 100%)",
      }}
    >
      {/* Sidebar header */}
      <div className="flex items-baseline justify-between mb-3 pt-0.5">
        <span
          style={{
            fontFamily: "var(--cd-font-heading)",
            fontWeight: 600,
            fontSize: "0.875rem",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--sand)",
          }}
        >
          Filters
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            style={{
              fontFamily: "var(--cd-font-mono)",
              fontSize: "0.75rem",
              letterSpacing: "1px",
              color: "var(--text-dim)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Result count */}
      <p
        className="mb-4"
        style={{
          fontFamily: "var(--cd-font-mono)",
          fontSize: "0.875rem",
          color: "var(--text-dim)",
        }}
      >
        {filteredCount === totalCount ? (
          <>{totalCount.toLocaleString()} games</>
        ) : (
          <>
            <span style={{ color: "var(--sand)", fontWeight: 700 }}>
              {filteredCount.toLocaleString()}
            </span>{" "}
            of {totalCount.toLocaleString()}
          </>
        )}
      </p>

      <Accordion defaultValue={defaultOpenKeys}>
        {facets.map((group) => {
          const activeValue = activeFilters[group.key as keyof ActiveFilters];
          const isGroupFiltered = activeValue !== "all";

          return (
            <AccordionItem key={group.key} value={group.key}>
              <AccordionTrigger>
                <span
                  className="flex items-center gap-1.5"
                  style={{
                    fontFamily: "var(--cd-font-body)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--text-primary)",
                  }}
                >
                  {group.label}
                  {isGroupFiltered && (
                    <span
                      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1"
                      style={{
                        background: "var(--ochre)",
                        color: "var(--dark-bg)",
                        fontSize: "0.625rem",
                        fontFamily: "var(--cd-font-mono)",
                      }}
                    >
                      1
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                <div className="pb-3 space-y-0.5">
                  <FacetRow
                    label="All"
                    count={group.poolCount}
                    active={activeValue === "all"}
                    onClick={() => onFilterChange(group.key as keyof ActiveFilters, "all")}
                    isAllOption
                  />
                  {group.options.map((opt) => (
                    <FacetRow
                      key={opt.value}
                      label={opt.label}
                      count={opt.count}
                      active={activeValue === opt.value}
                      onClick={() =>
                        onFilterChange(
                          group.key as keyof ActiveFilters,
                          activeValue === opt.value ? "all" : opt.value
                        )
                      }
                    />
                  ))}
                </div>
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Decorative footer text */}
      <div className="mt-8">
        <span
          style={{
            fontFamily: "var(--cd-font-mono)",
            fontSize: "0.6875rem",
            letterSpacing: "4px",
            color: "var(--panel-border)",
            textTransform: "uppercase",
            userSelect: "none",
          }}
        >
          // archive.holocron.v4.2
        </span>
      </div>
    </aside>
  );
}

interface FacetRowProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  isAllOption?: boolean;
}

function FacetRow({ label, count, active, onClick, isAllOption }: FacetRowProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-sm text-left transition-all duration-150 facet-row"
      style={{
        padding: "6px 10px",
        borderLeft: `2px solid ${active ? "var(--ochre)" : "transparent"}`,
        background: active
          ? "var(--cd-accent-tint-10)"
          : "transparent",
        fontFamily: "var(--cd-font-body)",
        fontSize: "0.9375rem",
        fontWeight: active ? 600 : 500,
        color: active ? "var(--sand-light)" : "var(--text-primary)",
        fontStyle: isAllOption && !active ? "italic" : "normal",
      }}
    >
      <span className="truncate pr-2">{label}</span>
      <span
        style={{
          fontFamily: "var(--cd-font-mono)",
          fontSize: "0.8125rem",
          color: "var(--text-dim)",
          flexShrink: 0,
        }}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}
