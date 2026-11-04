// plotagents type declarations.

export type ChartType =
  | 'auto' | 'bar' | 'column' | 'count' | 'line' | 'area' | 'scatter' | 'bubble'
  | 'regplot' | 'residplot' | 'jointplot' | 'hist' | 'kde' | 'ecdf'
  | 'box' | 'violin' | 'strip' | 'swarm' | 'point' | 'radar'
  | 'treemap' | 'sunburst' | 'donut' | 'pie' | 'heatmap' | 'sankey' | 'kpi'
  | 'network' | 'chord' | 'pyramid' | 'flowchart' | 'gantt' | 'wordcloud' | 'choropleth' | 'symbolmap'
  // Aliases (seaborn and others)
  | 'barplot' | 'countplot' | 'lineplot' | 'scatterplot' | 'histplot' | 'kdeplot' | 'ecdfplot'
  | 'lmplot' | 'boxplot' | 'violinplot' | 'stripplot' | 'swarmplot' | 'beeswarm' | 'pointplot' | 'spider'
  | 'timeline' | 'roadmap' | 'schedule' | 'cronograma' | 'map' | 'mapa';

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
  /** Dashed shapes (hatched fill + dashed outline): names, a data field, { field, equals } or true. */
  dashed?: string | string[] | boolean | { field: string; equals?: unknown };
  /** line/area/bar on a time axis: dashed from this x on (a projection). */
  dashedFrom?: string | number;
  /** Meaning of the dashed shapes: legend, band label and tooltip. */
  dashedLabel?: string | false;
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
  focus?: string | string[];
  font?: string | { family: string; import?: string };
  textScale?: number;
  fontScale?: number;
  labelScale?: number;
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
  /** choropleth/symbolmap: "chile" (default), "usa", "world", a registered name, your own GeoJSON (FeatureCollection, Feature, Feature[] or geometry) or TopoJSON. In the browser, render() also accepts a URL. */
  geo?: 'chile' | 'usa' | 'world' | string | object | object[];
  /** TopoJSON: object to draw (default: the first). */
  geoObject?: string;
  key?: string;
  /** Feature property matched against `key` (auto-detected when omitted). */
  featureKey?: string;
  /** Feature property with the display name. */
  nameKey?: string;
  projection?: 'mercator' | 'equalEarth' | 'albersUsa' | 'equirectangular' | 'conic' | 'identity' | 'planar' | { type: string; parallels?: [number, number]; rotate?: number; center?: [number, number] };
  /** Zoom to regions, a [lonMin, latMin, lonMax, latMax] box, or "markers". */
  fitTo?: string | string[] | [number, number, number, number];
  markers?: Array<{ lon: number; lat: number; label?: string; value?: number; color?: string }> | { data: Row[]; lon?: string; lat?: string; label?: string; size?: string; color?: string; legend?: string; maxRadius?: number; radius?: number; labels?: boolean };
  layers?: Array<{ geo: object | string; label?: string; stroke?: string; width?: number; fill?: string; dash?: boolean | string; opacity?: number; below?: boolean; object?: string }>;
  borderColor?: string;
  borderWidth?: number;
  pointRadius?: number;
  /** gantt */
  task?: string;
  start?: string;
  end?: string;
  duration?: string;
  progress?: string;
  dependsOn?: string;
  milestone?: string;
  today?: string | number | boolean;
  groupHeaders?: boolean | 'compact';
  rowHeight?: number;
  /** Browser time controls, off by default: true (buttons or slider), "buttons" or "slider". */
  slider?: boolean | 'buttons' | 'slider';
  play?: boolean;
  /** wordcloud: words field, or raw text to count. */
  text?: string | string[];
  textField?: string;
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
/** Library-wide defaults (font, textScale, locale, theme, palette…). The spec always wins. `configure(null)` resets. */
export declare function configure(options?: Partial<Spec> | null): Partial<Spec>;
export interface DashboardSpec {
  title?: string; subtitle?: string; source?: string; updated?: string; note?: string;
  locale?: 'es' | 'en'; theme?: Spec['theme']; font?: Spec['font']; palette?: string | string[];
  data?: Row[];
  kpis?: Array<{ label: string; value?: number; delta?: number; period?: string; trend?: number[]; good?: 'up' | 'down'; format?: Format;
    field?: string; agg?: 'sum' | 'mean' | 'median' | 'min' | 'max' | 'count' | 'distinct' | 'ratio'; over?: string; scale?: number;
    compare?: { field: string; current: string | number; previous: string | number }; trendBy?: string }>;
  charts: Array<Spec & { primary?: boolean; size?: 'full' | 'large' | 'medium' | 'small'; span?: number }>;
  filters?: Array<string | { field: string; label?: string; control?: 'buttons' | 'select'; value?: string }>;
  layout?: 'auto' | 'executive' | 'grid';
  colors?: Record<string, string>;
}
/** Self-contained HTML dashboard with best-practice layout, shared colors, KPIs and filters. */
export declare function dashboard(spec: DashboardSpec): string;
/** Never throws: { ok, html, plan, errors, warnings, suggestions }. */
export declare function safeDashboard(spec: DashboardSpec): { ok: boolean; html: string | null; plan: object | null; errors: Issue[]; warnings: Issue[]; suggestions: Issue[] };
export declare function lintDashboard(spec: DashboardSpec): { ok: boolean; errors: Issue[]; warnings: Issue[]; suggestions: Issue[] };
export declare function planDashboard(spec: DashboardSpec): object;
/** Browser: draws a dashboard into an element. */
export declare function renderDashboard(target: string | Element, spec: DashboardSpec): { update(): void; destroy(): void };
export declare const dashboardSchema: Record<string, unknown>;
/** Raw text → [{ text, value }] word counts without stopwords. */
export declare function countWords(text: string | string[], opts?: { minLength?: number; stopwords?: string[] }): { text: string; value: number }[];
export declare function registerGeo(name: string, geo: object, aliases?: string[]): object;
/** Any GeoJSON / TopoJSON shape → FeatureCollection. */
export declare function toFeatureCollection(geo: object | object[], objectName?: string): object;
/** Browser: downloads (once per URL) a GeoJSON or TopoJSON. */
export declare function loadGeo(url: string): Promise<object>;
export declare const palettes: Record<string, string[]>;
export declare const ramps: Record<string, string[]>;
export declare function themeFor(spec: Spec): Theme;
export declare function timeValues(spec: Spec): (string | number)[];
export declare function validatePalette(colors: string[], opts?: { mode?: 'light' | 'dark'; surface?: string; pairs?: 'adjacent' | 'all' }): { ok: boolean; checks: { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }[] };
export declare function bundleSource(): string | null;
export declare function toolDefinition(opts?: { name?: string; flavor?: 'anthropic' | 'openai'; kind?: 'chart' | 'dashboard' }): Record<string, unknown>;
export declare const themes: Record<'papel' | 'noche' | 'light' | 'dark', Theme>;
export declare function getTheme(t?: Spec['theme']): Theme;
export declare const TYPES: ChartType[];
export declare function squarify<T extends { value: number }>(items: T[], x: number, y: number, w: number, h: number): (T & { x: number; y: number; w: number; h: number })[];
export declare function makeFormat(fmt?: Format, locale?: string, values?: number[]): ((v: number) => string) & { type: string };
export declare function formatNumber(v: number, decimals?: number, locale?: string, trim?: boolean): string;
export declare function formatCompact(v: number, locale?: string, decimals?: number): string;

export default plot;
