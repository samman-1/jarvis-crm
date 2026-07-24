"use client";

import type {
  ButtonHTMLAttributes,
  ComponentPropsWithRef,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  padded = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-border bg-surface shadow-card",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted">{hint}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-press border border-transparent",
  secondary:
    "bg-surface-2 text-fg border border-border hover:border-border-strong hover:bg-surface-3",
  ghost:
    "bg-transparent text-muted border border-transparent hover:text-fg hover:bg-surface-2",
  danger:
    "bg-critical-soft text-critical border border-transparent hover:bg-critical hover:text-white",
  quiet:
    "bg-transparent text-muted border border-border hover:text-fg hover:border-border-strong",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-sm",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-6 text-base gap-2 rounded-md",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Chips & badges
 * ------------------------------------------------------------------ */

export function Chip({
  children,
  color,
  soft,
  className,
  title,
}: {
  children: ReactNode;
  color?: string;
  soft?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={
        color
          ? { color, backgroundColor: soft ?? "transparent" }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form fields
 * ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-xs font-medium text-muted">
        {label}
        {required ? <span className="text-accent">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-critical">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL =
  "w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none disabled:opacity-50";

export function Input({
  className,
  ...props
}: ComponentPropsWithRef<"input">) {
  return <input className={cn(CONTROL, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(CONTROL, "min-h-24 resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: ComponentPropsWithRef<"select">) {
  return (
    <select className={cn(CONTROL, "h-10 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ *
 * Data display
 * ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  sub,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface px-3.5 py-3",
        className,
      )}
    >
      <div className="text-[11px] font-medium tracking-wide text-muted uppercase">
        {label}
      </div>
      <div
        className="tnum mt-1 font-display text-2xl leading-none font-semibold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-faint">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-faint">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-live rounded-md bg-surface-2", className)}
      aria-hidden
    />
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

export function Bar({
  percent,
  color = "var(--accent)",
  className,
  height = "h-1.5",
}: {
  percent: number;
  color?: string;
  className?: string;
  height?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-surface-3",
        height,
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color }}
      />
    </div>
  );
}

/** The efficiency ring. Plain SVG — no chart library for one circle. */
export function Ring({
  value,
  size = 104,
  stroke = 9,
  color = "var(--accent)",
  label,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-display text-xl leading-none font-semibold">
          {Math.round(value)}
        </span>
        {label ? (
          <span className="mt-0.5 text-[10px] font-medium" style={{ color }}>
            {label}
          </span>
        ) : null}
        {sub ? <span className="text-[10px] text-faint">{sub}</span> : null}
      </div>
    </div>
  );
}
