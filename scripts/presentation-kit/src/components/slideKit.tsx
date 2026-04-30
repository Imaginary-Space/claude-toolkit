import type { CSSProperties, ReactNode } from "react";
import { cn } from "../utils/cn";

/**
 * Standard content column for data slides (timeline, numbers, workstreams,
 * actions, asks).
 *
 * The PPTX header pattern is: small-caps eyebrow ("01 · TIMELINE"), big serif
 * title ("Where we are in Phase 2"), and a small-caps shared footer ribbon
 * ("LANDIBLE · CYCLE 21 · APR 30, 2026") sitting between the header band and
 * the slide body.
 */
export function SlideContent({
  eyebrow,
  title,
  subtitle,
  subtitleMarginBottom,
  footerLabel,
  headerRight,
  contentClassName,
  children,
}: {
  /** Small-caps section eyebrow shown above the title, e.g. "01 · TIMELINE". */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleMarginBottom?: number;
  /** Small-caps shared ribbon shown after the header band, e.g. "LANDIBLE · CYCLE 21 · APR 30, 2026". */
  footerLabel?: ReactNode;
  headerRight?: ReactNode;
  /** Extra classes on the outer `.slide-content` wrapper (e.g. `slide-content--from-top`). */
  contentClassName?: string;
  children?: ReactNode;
}) {
  const hasEyebrow = eyebrow !== null && eyebrow !== undefined;
  const hasFooterLabel = footerLabel !== null && footerLabel !== undefined;
  return (
    <div className={cn("slide-content", contentClassName)}>
      {hasEyebrow || hasFooterLabel ? (
        <div className="slide-eyebrow-row">
          {hasEyebrow ? <span className="slide-eyebrow">{eyebrow}</span> : <span />}
          {hasFooterLabel ? <span className="slide-meta">{footerLabel}</span> : null}
        </div>
      ) : null}
      {headerRight !== null && headerRight !== undefined ? (
        <div className="slide-header-row">
          <div className="slide-content-title">{title}</div>
          {headerRight}
        </div>
      ) : (
        <div className="slide-content-title">{title}</div>
      )}
      {subtitle !== null && subtitle !== undefined ? (
        <div
          className="slide-content-subtitle"
          style={
            subtitleMarginBottom !== null && subtitleMarginBottom !== undefined
              ? { marginBottom: subtitleMarginBottom }
              : undefined
          }
        >
          {subtitle}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Bottom-of-slide callout used by sections like timeline ("ON PACE …"),
 * workstreams ("TARGET …"), and actions. Renders a left accent rule + small
 * label + body line.
 */
export function SlideCallout({
  label,
  children,
}: {
  /** Optional small-caps lead-in, e.g. "ON PACE" or "TARGET". */
  label?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="slide-callout">
      {label !== null && label !== undefined ? (
        <span className="slide-callout-label">{label}</span>
      ) : null}
      <span className="slide-callout-body">{children}</span>
    </div>
  );
}

export type TextBoxVariant = "hero" | "meta" | "body" | "title" | "subtitle";

/** Absolutely positioned text region (cover / closing / breathing layouts). */
export function TextBox({
  variant,
  role,
  left,
  top,
  width,
  height,
  textAlign,
  className,
  style,
  children,
}: {
  variant: TextBoxVariant;
  role?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  textAlign?: CSSProperties["textAlign"];
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("text-box", variant, className)}
      data-role={role}
      style={{ left, top, width, height, textAlign, ...style }}
    >
      {children}
    </div>
  );
}

/** Vertical + horizontal split dividers for cover / closing slides. */
export function SlideDivider({ variant }: { variant: "dark" | "light" }) {
  return (
    <>
      <div className={cn("divider-v", variant === "dark" ? "divider--dark" : "divider--light")} />
      <div className={cn("divider-h", variant === "dark" ? "divider--dark" : "divider--light")} />
    </>
  );
}

export function StatGroup({ children }: { children: ReactNode }) {
  return <div className="chart-stats">{children}</div>;
}

export function Stat({
  value,
  label,
  fraction,
}: {
  value: ReactNode;
  label: string;
  fraction?: ReactNode;
}) {
  return (
    <div className="chart-stat">
      <div className="chart-stat-value">
        {value}
        {fraction !== null && fraction !== undefined ? (
          <span className="stat-fraction">{fraction}</span>
        ) : null}
      </div>
      <div className="chart-stat-label">{label}</div>
    </div>
  );
}

export type ScopeBarVariant = "dark" | "accent" | "outline";

export function ScopeBarRow({
  label,
  labelMuted,
  variant,
  widthPct,
  value,
  valuePlacement = "inside",
}: {
  label: string;
  labelMuted?: boolean;
  variant: ScopeBarVariant;
  widthPct: number;
  value: ReactNode;
  valuePlacement?: "inside" | "outside";
}) {
  const barMod =
    variant === "dark"
      ? "scope-bar--dark"
      : variant === "accent"
        ? "scope-bar--orange"
        : "scope-bar--outline";

  return (
    <div className="scope-row">
      <div className={cn("scope-label", labelMuted && "scope-label--muted")}>{label}</div>
      <div
        className={cn("scope-bar-track", variant === "outline" && "scope-bar-track--clear")}
      >
        <div className={cn("scope-bar", barMod)} style={{ width: `${widthPct}%` }}>
          {valuePlacement === "inside" ? (
            <span className="scope-bar-value">{value}</span>
          ) : (
            <span className="scope-bar-value-outside">{value}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScopeSectionTitle({ children }: { children: ReactNode }) {
  return <div className="scope-section-title">{children}</div>;
}

export function ScopeDivider() {
  return <hr className="scope-divider" />;
}

export function ScopeItemGrid({ items }: { items: { id: string; text: string }[] }) {
  return (
    <div className="scope-items">
      {items.map(({ id, text }) => (
        <div key={id} className="scope-item">
          <div className="dot dot--orange" />
          <div className="scope-item-id">{id}</div>
          <div>{text}</div>
        </div>
      ))}
    </div>
  );
}

export function GanttBar({ status }: { status: "done" | "ongoing" | "future" | "empty" }) {
  if (status === "empty") {
    return <div />;
  }
  return <div className={cn("gantt-bar", `bar-${status}`)} />;
}

export function GanttLegend({ items }: { items: { barClass: string; label: string }[] }) {
  return (
    <div className="gantt-legend">
      {items.map((item) => (
        <div key={item.label} className="gantt-legend-item">
          <div className={cn("gantt-legend-swatch", item.barClass)} />
          <span className="gantt-legend-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export type ChartLegendEntry =
  | { kind: "line"; color: string; label: string }
  | { kind: "dashed"; label: string };

export function ChartLegend({ entries }: { entries: ChartLegendEntry[] }) {
  return (
    <div className="chart-legend">
      {entries.map((e) => (
        <div key={e.label} className="legend-item">
          {e.kind === "line" ? (
            <div className="legend-line" style={{ background: e.color }} />
          ) : (
            <div className="legend-line-dashed" />
          )}
          {e.label}
        </div>
      ))}
    </div>
  );
}

export function RecapColumns({ children }: { children: ReactNode }) {
  return <div className="recap-columns">{children}</div>;
}

export function RecapColumn({
  headerVariant,
  title,
  children,
}: {
  headerVariant: "wins" | "blockers";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="recap-col">
      <div
        className={cn(
          "recap-col-header",
          headerVariant === "wins" ? "recap-col-header--wins" : "recap-col-header--blockers"
        )}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export function RecapDivider() {
  return <div className="recap-divider" />;
}

export function RecapItem({
  id,
  name,
  impact,
  dotClass,
  children,
}: {
  id: string;
  name: string;
  impact: string;
  /** Tailwind-style dot modifier — e.g. `dot--dark`, `dot--warning`, `dot--orange`. */
  dotClass: string;
  children?: ReactNode;
}) {
  return (
    <div className="recap-item">
      <div className={cn("recap-dot", dotClass)} />
      <div className="recap-item-content">
        <div className="recap-item-top">
          <span className="recap-item-id">{id}</span>
          <span className="recap-item-name">{name}</span>
        </div>
        <div className="recap-item-impact">{impact}</div>
        {children}
      </div>
    </div>
  );
}

export function Pill({ variant, children }: { variant: "client" | "vendor"; children: ReactNode }) {
  return (
    <span className={variant === "client" ? "pill pill--client" : "pill pill--vendor"}>
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────
 * Hero stat grid — large at-a-glance numbers (Numbers slide).
 * ────────────────────────────────────────────────────────── */

export function HeroStatGrid({
  cols = 4,
  children,
}: {
  /** Column count — defaults to 4 to match the canonical "by the numbers" slide. */
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const modifier =
    cols === 2 ? "hero-stat-grid--cols-2" : cols === 3 ? "hero-stat-grid--cols-3" : "";
  return <div className={cn("hero-stat-grid", modifier)}>{children}</div>;
}

export function HeroStat({
  value,
  label,
  context,
  accent,
}: {
  value: ReactNode;
  label: ReactNode;
  context?: ReactNode;
  /** Render the value in `--brand-accent` instead of `--brand-dark`. */
  accent?: boolean;
}) {
  return (
    <div className="hero-stat">
      <div className={cn("hero-stat-value", accent && "hero-stat-value--accent")}>{value}</div>
      <div className="hero-stat-label">{label}</div>
      {context !== null && context !== undefined ? (
        <div className="hero-stat-context">{context}</div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Stacked bar — single horizontal bar with N segments.
 * ────────────────────────────────────────────────────────── */

export interface StackedBarSegment {
  label: string;
  value: number;
  variant?: "dark" | "accent" | "outline";
}

export function StackedBar({
  segments,
  showLegend = true,
}: {
  segments: StackedBarSegment[];
  showLegend?: boolean;
}) {
  const total = segments.reduce((sum, s) => sum + (s.value > 0 ? s.value : 0), 0) || 1;
  return (
    <>
      <div className="stacked-bar">
        {segments.map((s, i) => {
          const variant = s.variant ?? (i === 0 ? "dark" : i === 1 ? "outline" : "accent");
          const widthPct = (Math.max(s.value, 0) / total) * 100;
          return (
            <div
              key={`${s.label}-${i}`}
              className={cn("stacked-bar-segment", `stacked-bar-segment--${variant}`)}
              style={{ width: `${widthPct}%` }}
            >
              {s.value} {s.label}
            </div>
          );
        })}
      </div>
      {showLegend ? (
        <div className="stacked-bar-legend">
          {segments.map((s, i) => {
            const variant = s.variant ?? (i === 0 ? "dark" : i === 1 ? "outline" : "accent");
            return (
              <span key={`${s.label}-legend-${i}`} className="stacked-bar-legend-item">
                <span
                  className={cn(
                    "stacked-bar-legend-swatch",
                    variant === "accent" && "stacked-bar-legend-swatch--accent",
                    variant === "outline" && "stacked-bar-legend-swatch--outline"
                  )}
                />
                {s.label}
              </span>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/* ──────────────────────────────────────────────────────────
 * Item stacks — vertical lists with separators between rows.
 * Used by Workstreams, Actions, Asks slides.
 * ────────────────────────────────────────────────────────── */

export function ItemStack({ children }: { children: ReactNode }) {
  return <div className="item-stack">{children}</div>;
}

/* ──────────────────────────────────────────────────────────
 * Workstream card row — id + serif name + impact + meta.
 * ────────────────────────────────────────────────────────── */

export function WorkstreamCard({
  id,
  name,
  impact,
  status,
  statusVariant = "vendor",
  points,
}: {
  id: string;
  name: ReactNode;
  impact: ReactNode;
  status?: string;
  statusVariant?: "client" | "vendor";
  points?: string;
}) {
  return (
    <div className="workstream-card">
      <div className="workstream-card-id">{id}</div>
      <div className="workstream-card-body">
        <div className="workstream-card-name">{name}</div>
        <div className="workstream-card-impact">{impact}</div>
      </div>
      <div className="workstream-card-meta">
        {status ? <Pill variant={statusVariant}>{status}</Pill> : null}
        {points ? <span className="workstream-card-points">{points}</span> : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Action row — owner + task + status pill.
 * ────────────────────────────────────────────────────────── */

export function ActionRow({
  owner,
  task,
  status,
  statusVariant = "vendor",
}: {
  owner: ReactNode;
  task: ReactNode;
  status: string;
  statusVariant?: "client" | "vendor";
}) {
  return (
    <div className="action-row">
      <div className="action-row-owner">{owner}</div>
      <div className="action-row-task">{task}</div>
      <div className="action-row-status">
        <Pill variant={statusVariant}>{status}</Pill>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Ask row — serif ask + detail + priority chip.
 * ────────────────────────────────────────────────────────── */

export function AskRow({
  ask,
  detail,
  priority,
  priorityVariant = "vendor",
}: {
  ask: ReactNode;
  detail: ReactNode;
  priority: string;
  priorityVariant?: "client" | "vendor";
}) {
  return (
    <div className="ask-row">
      <div>
        <div className="ask-row-name">{ask}</div>
        <div className="ask-row-detail">{detail}</div>
      </div>
      <div className="ask-row-priority">
        <Pill variant={priorityVariant}>{priority}</Pill>
      </div>
    </div>
  );
}
