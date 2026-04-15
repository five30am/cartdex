"use client";

import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Root — allows multiple items open simultaneously
function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Root>) {
  return (
    <BaseAccordion.Root
      multiple
      className={cn("w-full", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Item>) {
  return (
    <BaseAccordion.Item
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Trigger>) {
  return (
    <BaseAccordion.Header>
      <BaseAccordion.Trigger
        className={cn(
          "flex w-full items-center justify-between py-3 px-0 text-sm font-medium text-foreground",
          "hover:text-foreground/80 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "[&[data-panel-open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200" />
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

function AccordionPanel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Panel>) {
  return (
    <BaseAccordion.Panel
      keepMounted
      className={cn(
        // Grid trick: animate grid-template-rows 0fr ↔ 1fr for height
        // data-[starting-style] fires on open entry, data-[ending-style] on close exit
        "grid overflow-hidden text-sm",
        "transition-[grid-template-rows,opacity] duration-200 ease-in-out",
        "grid-rows-[1fr] opacity-100",
        "data-[starting-style]:grid-rows-[0fr] data-[starting-style]:opacity-0",
        "data-[ending-style]:grid-rows-[0fr] data-[ending-style]:opacity-0",
        className
      )}
      {...props}
    >
      {/* min-h-0 lets the inner content collapse with the grid row */}
      <div className="min-h-0">{children}</div>
    </BaseAccordion.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel };
