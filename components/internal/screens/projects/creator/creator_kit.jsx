"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";

export function FilterDropdown({ value, onValueChange, options, placeholder, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8 gap-1.5 rounded-md border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-subtle"
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-text-secondary" /> : null}
          {options.find((o) => o.value === value)?.label || placeholder}
          <ChevronDown className="h-3 w-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
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

export function RowActions({ onEdit, onDelete, extra }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Row actions"
            className="h-7 w-7 text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="end">
          {extra}
          <DropdownMenuItem className="cursor-pointer text-xs focus:bg-surface-hover" onClick={onEdit}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-surface-hover" />
          <DropdownMenuItem
            className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ClearFiltersButton({ onClick }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
      onClick={onClick}
    >
      <X className="mr-1 h-3 w-3" />
      Clear
    </Button>
  );
}

export function useCreatorRows(listFn, projectId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listFn(projectId).then((result) => {
      setRows(result ?? []);
      setLoading(false);
    });
  }, [projectId]);
  return [rows, setRows, loading];
}

export function CreateDialog({ open, onOpenChange, title, description, children, onSubmit, submitLabel = "Create", wide }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${wide ? "max-w-2xl" : "max-w-lg"} border-border bg-surface-subtle text-foreground`}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-text-secondary">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-xs text-muted-foreground hover:bg-surface-active"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={onSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditDialog({ open, onOpenChange, title, children, onSave }) {
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      submitLabel="Save changes"
      onSubmit={onSave}
    >
      {children}
    </CreateDialog>
  );
}

export function TextField({ label, value, onChange, placeholder, hint }) {
  return (
    <Field label={label} hint={hint}>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}
