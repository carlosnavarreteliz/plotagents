// plotagents type declarations.

export type ChartType =
  | 'auto' | 'bar' | 'column' | 'count' | 'line' | 'area' | 'scatter' | 'bubble'
  | 'regplot' | 'residplot' | 'jointplot' | 'hist' | 'kde' | 'ecdf'
  | 'box' | 'violin' | 'strip' | 'swarm' | 'point' | 'radar'
  | 'treemap' | 'sunburst' | 'donut' | 'pie' | 'heatmap' | 'sankey' | 'kpi'
  // Aliases (seaborn and others)
  | 'barplot' | 'countplot' | 'lineplot' | 'scatterplot' | 'histplot' | 'kdeplot' | 'ecdfplot'
  | 'lmplot' | 'boxplot' | 'violinplot' | 'stripplot' | 'swarmplot' | 'beeswarm' | 'pointplot' | 'spider';

export type Row = Record<string, string | number | Date | null | undefined>;

export type Format =
  | 'number' | 'compact' | 'percent' | 'currency' | 'integer'
  | { type?: string; prefix?: string; suffix?: string; decimals?: number; currency?: string; scale?: number };

export interface KpiItem {
  label: string;
  value: number;
  /** Relative change as a fraction (0.12 = +12%). */
  delta?: number;
  previous?: number;
  period?: string;
  good?: 'up' | 'down';
  trend?: number[];
  target?: number;
  format?: Format;
  display?: string;
  note?: string;
}

export interface RefLine { y?: number; x?: number; value?: number; label?: string; color?: string }
export interface Annotation { x: string | number | Date; label?: string }

export interface Theme {
  name: string;
  mode: 'light' | 'dark';
  surface: string; ink: string; lede: string; muted: string;
  grid: string; axis: string; tint: string; tint2: string; dim: string; other: string;
  link: number;
  categorical: string[]; sequential: string[]; diverging: string[];
  status: { good: string; warning: string; critical: string };
  font: { family: string; mono: string; import: string };
  type: { title: number; subtitle: number; label: number; axis: number; legend: number; source: number; titleWeight: number };
  marks: { barRadius: number; barMax: number; barMaxH: number; lineWidth: number; pointRadius: number; gap: number; ring: number; areaOpacity: number; bandOpacity: number; dotOpacity: number };
  axes: { inside: boolean; grid: boolean };
  layout: { padding: number; paddingSmall: number };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends any[] ? T[K] | string : DeepPartial<T[K]>) : T[K] };
/** JSON theme: deep-merged over `extends` (default "papel"). */
export type ThemeInput = 'papel' | 'noche' | 'light' | 'dark' | (DeepPartial<Theme> & { extends?: 'papel' | 'noche' })

export interface Spec {
  type?: ChartType;
  data?: Row[] | Record<string, number>;
  title?: string;
  subtitle?: string;
  source?: string;
  x?: string;
  y?: string | string[];
  series?: string;
  color?: string;
  value?: string;
  label?: string;
  group?: string;
  path?: string[];
  size?: string;
  from?: string;
  to?: string;
  items?: KpiItem[];
  format?: Format;
  xFormat?: Format;
  yFormat?: Format;
  stack?: boolean | 'percent';
  horizontal?: boolean;
  sort?: 'desc' | 'asc' | 'none' | 'alpha';
  top?: number;
  highlight?: string | string[];
  labels?: boolean | 'auto' | number | string[];
  labelsFor?: Record<string, string>;
  refLines?: RefLine[];
  annotations?: Annotation[];
  index?: boolean;
  curve?: 'linear' | 'smooth';
  zero?: boolean;
  points?: boolean;
  xScale?: 'linear' | 'log';
  yScale?: 'linear' | 'log';
  trend?: boolean;
  xLabel?: string;
  yLabel?: string;
  aggregate?: 'sum' | 'mean' | 'max' | 'min' | 'count' | 'last' | 'first';
  colors?: Record<string, string>;
  theme?: ThemeInput;
  palette?: string | string[];
  ramp?: string | string[];
  hue?: string;
  facet?: string;
  col?: string;
  sharey?: boolean;
  sharex?: boolean;
  panelHeight?: number;
  time?: string;
  timeValue?: string | number;
  slider?: boolean;
  play?: boolean;
  compare?: 'previous' | 'first' | string | number | false;
  compareData?: Row[];
  colorBy?: 'group' | 'change' | 'label';
  shade?: boolean;
  change?: boolean;
  playInterval?: number;
  xRange?: [string | number, string | number];
  xDomain?: [number, number];
  yDomain?: [number, number];
  ci?: boolean | number;
  errorbar?: 'ci' | 'sd' | 'se' | 'pi' | 'none' | false;
  estimator?: 'mean' | 'median' | 'sum' | 'count';
  focus?: string[];
  depth?: number;
  half?: boolean;
  bins?: number;
  binWidth?: number;
  stat?: 'count' | 'percent' | 'density' | 'probability';
  kde?: boolean;
  multiple?: 'layer' | 'stack' | 'dodge' | 'fill';
  fill?: boolean;
  order?: number | string[];
  lowess?: boolean;
  logx?: boolean;
  annotate?: boolean;
  kind?: 'scatter' | 'reg';
  marginal?: 'hist' | 'kde';
  inner?: 'box' | 'quartiles' | 'points' | 'none';
  split?: boolean;
  axis?: string;
  axes?: string[];
  normalize?: boolean;
  legend?: boolean;
  locale?: 'es' | 'en';
  width?: number;
  height?: number;
  padding?: number;
  fontFamily?: string;
  fontImport?: boolean;
  background?: boolean;
  maxSlices?: number;
  centerValue?: string;
  centerLabel?: string;
  midpoint?: number;
  diverging?: boolean;
  columns?: number;
  [key: string]: unknown;
}

export interface Issue { code: string; message: string; fix?: string }
export interface LintReport { ok: boolean; type: ChartType; errors: Issue[]; warnings: Issue[]; suggestions: Issue[] }
export interface SafeResult extends Omit<LintReport, 'ok'> { ok: boolean; svg: string | null; description: string }

export declare class PlotError extends Error { hint?: string }

/** Draws and returns an SVG string. Throws PlotError with a fix hint when the spec cannot be drawn. */
export declare function plot(spec: Spec): string;
/** Never throws: returns the SVG plus errors, warnings and design suggestions. */
export declare function safePlot(spec: Spec): SafeResult;
/** Reviews a spec and suggests improvements without drawing. */
export declare function lint(spec: Spec): LintReport;
/** Text description of the chart (also in the SVG <desc>). */
export declare function describe(spec: Spec): string;
/** Browser: draws into an element with tooltips, responsive width, time sliders and drill-down. */
export declare function render(target: string | Element, spec: Spec, opts?: { controls?: boolean }): { readonly svg: SVGSVGElement | null; readonly spec: Spec; update(spec: Spec): unknown; destroy(): void };
/** Self-contained HTML page with one or more interactive charts. */
export declare function toHTML(specs: Spec | Spec[], opts?: { title?: string; lang?: string; columns?: number }): string;
/** Adds tooltips to a container that already holds a plotagents SVG. */
export declare function attach(root: Element): void;
export declare function resolve(spec: Spec): Spec;

export declare const schema: Record<string, unknown>;
export declare const palettes: Record<string, string[]>;
export declare const ramps: Record<string, string[]>;
export declare function themeFor(spec: Spec): Theme;
export declare function timeValues(spec: Spec): (string | number)[];
export declare function validatePalette(colors: string[], opts?: { mode?: 'light' | 'dark'; surface?: string; pairs?: 'adjacent' | 'all' }): { ok: boolean; checks: { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }[] };
export declare function bundleSource(): string | null;
export declare function toolDefinition(opts?: { name?: string; flavor?: 'anthropic' | 'openai' }): Record<string, unknown>;
export declare const themes: Record<'papel' | 'noche' | 'light' | 'dark', Theme>;
export declare function getTheme(t?: Spec['theme']): Theme;
export declare const TYPES: ChartType[];
export declare function squarify<T extends { value: number }>(items: T[], x: number, y: number, w: number, h: number): (T & { x: number; y: number; w: number; h: number })[];
export declare function makeFormat(fmt?: Format, locale?: string, values?: number[]): ((v: number) => string) & { type: string };
export declare function formatNumber(v: number, decimals?: number, locale?: string, trim?: boolean): string;
export declare function formatCompact(v: number, locale?: string, decimals?: number): string;

export default plot;
