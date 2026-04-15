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

  // Default all groups open
  const defaultOpenKeys = facets.map((f) => f.key);

  return (
    <aside
      className={cn(
        "w-56 shrink-0 border-l border-border pl-5",
        className
      )}
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between mb-3 pt-0.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground mb-4">
        {filteredCount === totalCount ? (
          <>{totalCount.toLocaleString()} games</>
        ) : (
          <>
            <span className="text-foreground font-medium">
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
                <span className="flex items-center gap-1.5">
                  {group.label}
                  {isGroupFiltered && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                      1
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                <div className="pb-3 space-y-0.5">
                  {/* "All" option — shows pool count for this group (search + system + other facets applied) */}
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
      className={cn(
        "flex w-full items-center justify-between rounded-sm px-1.5 py-1 text-xs transition-colors text-left",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        isAllOption && !active && "italic"
      )}
    >
      <span className="truncate pr-2">{label}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          active ? "text-accent-foreground" : "text-muted-foreground/60"
        )}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}
