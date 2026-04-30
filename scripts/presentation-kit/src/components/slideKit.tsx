import type { CSSProperties, ReactNode } from "react";
import { cn } from "../utils/cn";

/** Standard content column for data slides (timeline, velocity, scope, recap). */
export function SlideContent({
  title,
  subtitle,
  subtitleMarginBottom,
  headerRight,
  contentClassName,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleMarginBottom?: number;
  headerRight?: ReactNode;
  /** Extra classes on the outer `.slide-content` wrapper (e.g. `slide-content--from-top`). */
  contentClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("slide-content", contentClassName)}>
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
