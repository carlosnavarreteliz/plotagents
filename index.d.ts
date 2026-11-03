// Tipos de plotagents.

export type ChartType =
  | 'auto' | 'bar' | 'column' | 'line' | 'area' | 'scatter' | 'bubble'
  | 'treemap' | 'donut' | 'pie' | 'heatmap' | 'sankey' | 'kpi';

export type Row = Record<string, string | number | Date | null | undefined>;

export type Format =
  | 'number' | 'compact' | 'percent' | 'currency' | 'integer'
  | { type?: string; prefix?: string; suffix?: string; decimals?: number; currency?: string; scale?: number };

export interface KpiItem {
  label: string;
  value: number;
  /** Variación relativa como fracción (0.12 = +12%). */
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
}

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
  theme?: 'papel' | 'noche' | 'light' | 'dark' | (Partial<Theme> & { extends?: string });
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

/** Dibuja y devuelve un SVG. Lanza PlotError con pista si el spec no se puede dibujar. */
export declare function plot(spec: Spec): string;
/** Nunca lanza: devuelve SVG + errores, advertencias y sugerencias de diseño. */
export declare function safePlot(spec: Spec): SafeResult;
/** Revisa un spec y sugiere mejoras sin dibujar. */
export declare function lint(spec: Spec): LintReport;
/** Descripción en texto del gráfico (también está en el <desc> del SVG). */
export declare function describe(spec: Spec): string;
/** Navegador: dibuja en un elemento con tooltips y ancho adaptable. */
export declare function render(target: string | Element, spec: Spec): { readonly svg: SVGSVGElement | null; update(spec: Spec): void; destroy(): void };
/** Página HTML autónoma con uno o varios gráficos interactivos. */
export declare function toHTML(specs: Spec | Spec[], opts?: { title?: string; lang?: string; columns?: number }): string;
/** Agrega tooltips a un contenedor que ya tiene un SVG de plotagents. */
export declare function attach(root: Element): void;
export declare function resolve(spec: Spec): Spec;

export declare const schema: Record<string, unknown>;
export declare function toolDefinition(opts?: { name?: string; flavor?: 'anthropic' | 'openai' }): Record<string, unknown>;
export declare const themes: Record<'papel' | 'noche' | 'light' | 'dark', Theme>;
export declare function getTheme(t?: Spec['theme']): Theme;
export declare const TYPES: ChartType[];
export declare function squarify<T extends { value: number }>(items: T[], x: number, y: number, w: number, h: number): (T & { x: number; y: number; w: number; h: number })[];
export declare function makeFormat(fmt?: Format, locale?: string, values?: number[]): ((v: number) => string) & { type: string };
export declare function formatNumber(v: number, decimals?: number, locale?: string, trim?: boolean): string;
export declare function formatCompact(v: number, locale?: string, decimals?: number): string;

export default plot;
