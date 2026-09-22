"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@geiger/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";

import { cn } from "@/lib/utils";

const defaultOptions = [
  { value: "1d", label: "Last 1 day" },
  { value: "1w", label: "Last 1 week" },
  { value: "1m", label: "Last 1 month" },
];

export function FilterDropdown({
  value: controlledValue,
  onValueChange,
  options = defaultOptions,
  placeholder = "Select filter",
  height = "h-9",
  icon: Icon,
  align = "start",
  className,
}) {
  const [internalFilter, setInternalFilter] = useState(options[0]?.value || "1d");
  const filter = controlledValue !== undefined ? controlledValue : internalFilter;

  const handleValueChange = (next) => {
    if (onValueChange) onValueChange(next);
    else setInternalFilter(next);
  };

  const label = options.find((o) => o.value === filter)?.label || placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-1.5 rounded-lg border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-subtle",
            height,
            className,
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-text-secondary" /> : null}
          {label}
          <ChevronDown className="ml-1 h-3 w-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="border-border bg-surface-subtle text-foreground"
      >
        <DropdownMenuRadioGroup value={filter} onValueChange={handleValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer text-xs focus:bg-surface-hover focus:text-foreground"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FilterDropdown;
