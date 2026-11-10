// plotagents type declarations.

export type ChartType =
  | 'auto' | 'bar' | 'column' | 'count' | 'line' | 'area' | 'scatter' | 'bubble'
  | 'regplot' | 'residplot' | 'jointplot' | 'hist' | 'kde' | 'ecdf'
  | 'box' | 'violin' | 'strip' | 'swarm' | 'point' | 'radar'
  | 'treemap' | 'sunburst' | 'donut' | 'pie' | 'heatmap' | 'sankey' | 'kpi'
  | 'network' | 'chord' | 'pyramid' | 'flowchart' | 'gantt' | 'wordcloud' | 'choropleth' | 'symbolmap' | 'pointmap' | 'table' | 'corr' | 'pairplot'
  // Aliases (seaborn and others)
  | 'barplot' | 'countplot' | 'lineplot' | 'scatterplot' | 'histplot' | 'kdeplot' | 'ecdfplot'
  | 'lmplot' | 'boxplot' | 'violinplot' | 'stripplot' | 'swarmplot' | 'beeswarm' | 'pointplot' | 'spider'
  | 'timeline' | 'roadmap' | 'schedule' | 'cronograma' | 'map' | 'mapa' | 'tabla' | 'datatable'
  | 'correlation' | 'corrplot' | 'clustermap' | 'pairs' | 'splom' | 'scattermatrix';

export type Locale = 'es' | 'en' | 'pt' | 'fr' | 'de' | 'auto';

/** table: one column. A bare field name infers everything. */
export interface TableColumn {
  field?: string;
  label?: string;
  /** Indicator. Inferred when omitted: bar on the main measure, delta on change fields, sparkline on lists of numbers, progress on 0–1 goals, badge on status words, check on booleans. */
  type?: 'text' | 'number' | 'bar' | 'heat' | 'delta' | 'sparkline' | 'progress' | 'badge' | 'check' | 'date' | 'link' | 'rank';
  format?: Format;
  align?: 'left' | 'right' | 'center';
  width?: number;
  /** delta/progress: whether up is good (default) or down (costs). */
  good?: 'up' | 'down';
  /** progress: field or number to compare against. */
  target?: string | number;
  /** heat: matplotlib colormap or colors. */
  colorScale?: string | string[] | { name?: string; colors?: string[]; reverse?: boolean; mid?: number };
  /** Totals row for this column. */
  total?: boolean | 'sum' | 'mean' | 'min' | 'max' | 'count';
  /** Text: lines before truncating (default 2, 3 for long text). */
  lines?: number;
  /** link: field with the text shown instead of the URL. */
  text?: string;
  /** badge: { value: "#hex" }. */
  colors?: Record<string, string>;
  sortable?: boolean;
}

export type Row = Record<string, string | number | Date | null | undefined>;

export type Format =
  /** JS only: your own formatter, used for value labels, tooltips and axis ticks. */
  | ((value: number) => string)
  | 'number' | 'compact' | 'percent' | 'currency' | 'integer'
  | { type?: 'number' | 'compact' | 'percent' | 'currency' | 'integer'; prefix?: string; suffix?: string; /** 0–20. */ decimals?: number; currency?: string; scale?: number };

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
/** Simple theme tokens, mapped onto the full theme. */
export interface ThemeTokens {
  /** Alias of surface. */
  background?: string;
  /** Alias of ink. */
  text?: string;
  /** First series color. */
  accent?: string;
  /** Grid color, or { color, dash, width }. */
  grid?: string | { color?: string; dash?: string; width?: number };
  axis?: string;
  tooltip?: { bg?: string; ink?: string };
  /** Corner radius of bars and tiles. */
  radius?: number;
  barRadius?: number;
  font?: string | { family?: string; mono?: string; import?: string };
}
/** JSON theme: deep-merged over `extends` (default "papel"). Strings: built-in or registerTheme() names. */
export type ThemeInput = 'papel' | 'noche' | 'light' | 'dark' | (string & {}) | (Omit<DeepPartial<Theme>, 'grid' | 'font'> & ThemeTokens & { extends?: 'papel' | 'noche' | (string & {}) })

/** matplotlib colormap name (case-insensitive, `_r` reverses), a list of hex colors, or { name | colors, reverse, mid }. */
export type ColorScale = string | string[] | { name?: string; colors?: string[]; reverse?: boolean; mid?: number };
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';
export type TileProvider = 'osm' | 'esri-gray' | 'esri-dark' | 'carto-light' | 'carto-dark' | 'mapbox-light' | 'mapbox-dark';
export type NetworkLayout = 'force' | 'circular' | 'radial' | 'concentric' | 'clusters' | 'tree' | 'grid' | 'circle';

/** A color set for `skins`: patches only colors. */
export interface Skin {
  /** CSS selector of an ancestor under which this skin applies (every skin but the first). */
  when?: string;
  theme?: ThemeInput;
  palette?: string | string[];
  ramp?: string | string[];
  colorScale?: ColorScale;
  colors?: Record<string, string>;
}

export interface TooltipSpec {
  /** Field for the header. */
  title?: string;
  /** "Field: value" lines from the mark's rows. */
  fields?: Array<string | { field: string; label?: string; format?: Format }>;
  /** Field with pre-written text (may hold line breaks), appended as is. */
  text?: string;
  /** Drop the default lines. */
  replace?: boolean;
}
export interface TooltipContext { title: string; lines: string[]; rows: Row[]; row?: Row; match?: Record<string, unknown> }
export interface XBand { from: string | number; to?: string | number; label?: string; color?: string }

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
  sort?: 'desc' | 'asc' | 'none' | 'alpha' | 'start';
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
  refLines?: RefLine[] | RefLine;
  annotations?: Annotation[];
  index?: boolean;
  curve?: 'linear' | 'smooth' | 'step';
  zero?: boolean;
  points?: boolean;
  xScale?: 'linear' | 'log';
  yScale?: 'linear' | 'log';
  trend?: boolean;
  xLabel?: string;
  /** What each mark says on hover beyond its value: fields of its rows, pre-written text, or (JS) a function. */
  tooltip?: false | string | Array<string | { field: string; label?: string; format?: Format }> | TooltipSpec | ((d: TooltipContext) => string | string[] | { title?: string; lines?: string[] } | null | false);
  /** line/area: false writes a tooltip column per x instead of the browser crosshair. */
  crosshair?: boolean;
  /** line/area: an interval already computed, drawn as is. */
  band?: { lower: string; upper: string; label?: string };
  /** bar: tooltip text for a missing value (never drawn as 0). */
  missingLabel?: string;
  /** bar: text written at the base of a missing bar. */
  missingMark?: string;
  /** bar (columns), line, area: shaded ranges of the x axis. */
  xBands?: XBand | XBand[];
  /** treemap tiles, horizontal bar names, scatter dots: field with the URL to link to. */
  href?: string;
  /** scatter/bubble: rows where this field is truthy are hollow dots. */
  hollow?: string;
  /** scatter/bubble: rows where this field is falsy are hollow dots. */
  filled?: string;
  /** sankey: a heading over each column. */
  stages?: string[];
  /** sankey: flows take the source's or the target's color, or one per stage. */
  linkColor?: 'source' | 'target' | Array<'source' | 'target'>;
  /** facet: a field written under each panel name. */
  panelNote?: string | ((key: string, rows: Row[]) => string);
  yLabel?: string;
  aggregate?: 'sum' | 'mean' | 'max' | 'min' | 'count' | 'last' | 'first';
  /** Entity → color. Any color may be "var(--name, #fallback)": the page decides it, the fallback is used to compute. */
  colors?: Record<string, string>;
  /** Several color sets in one SVG, chosen by page CSS. The first is the default; the rest need `when` (a CSS selector of an ancestor). */
  skins?: Skin[] | null;
  theme?: ThemeInput;
  /** Palette name ("okabe-ito", "tab10", "Set2"…, or any colormap, sampled) or a list of colors. */
  palette?: string | string[];
  ramp?: string | string[];
  hue?: string;
  facet?: string;
  col?: string;
  /** facet: shared y scale; "span" = same span, own floor. */
  sharey?: boolean | 'span';
  sharex?: boolean;
  panelHeight?: number;
  time?: string;
  timeValue?: string | number;
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
  /** jointplot: center plot. pairplot: "reg" adds a fit line to every scatter panel. */
  kind?: 'scatter' | 'reg';
  /** corr/pairplot: numeric fields to relate (default: all numeric; pairplot: first 6). */
  vars?: string[];
  /** corr: "pearson" (default) or "spearman". */
  method?: 'pearson' | 'spearman';
  /** corr: "lower" (default) or "full" (default with `cluster`). */
  triangle?: 'lower' | 'full' | boolean;
  /** corr: hierarchical clustering order + dendrogram (clustermap). */
  cluster?: boolean;
  dendrogram?: boolean;
  /** corr: grey out cells with p ≥ alpha. */
  alpha?: number;
  cellSize?: number;
  /** pairplot: diagonal panels ("kde" by default with hue). */
  diag?: 'hist' | 'kde';
  /** pairplot: above the diagonal. */
  upper?: 'corr' | 'scatter' | false;
  corner?: boolean;
  panelSize?: number;
  marginal?: 'hist' | 'kde';
  inner?: 'box' | 'quartiles' | 'points' | 'stick' | 'none';
  split?: boolean;
  axis?: string;
  axes?: string[];
  normalize?: boolean;
  /** Legend on/off or position (default top; left/right fall back to bottom under 520px). */
  legend?: boolean | LegendPosition | { position?: LegendPosition };
  legendTitle?: string;
  /** Drop legend entries (series, first level, group); colors stay fixed and the entries stay in the legend, faded. */
  exclude?: string | string[];
  /** Continuous color scale. Aliases: cmap, colormap. */
  colorScale?: ColorScale;
  cmap?: ColorScale;
  colormap?: ColorScale;
  locale?: Locale;
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
  /** network: node rows (id, group, size). flowchart: steps (id, label, type, lane). */
  nodes?: Row[];
  /** flowchart: connections (from, to, label). Same as `data`. */
  edges?: Row[];
  layout?: NetworkLayout;
  /** network: edge curvature, 0 straight (default 0.3). */
  curveness?: number;
  nodeId?: string;
  nodeLabel?: string;
  /** Largest node / circle radius in px. */
  maxRadius?: number;
  /** network: force-layout iterations. */
  iterations?: number;
  /** chord: square flow matrix with `names`. */
  matrix?: number[][];
  names?: string[];
  directed?: boolean;
  ribbonColor?: 'source' | 'smaller' | 'larger';
  labelOrientation?: 'horizontal' | 'radial';
  direction?: 'TB' | 'LR';
  /** pyramid */
  age?: string;
  sex?: string;
  percent?: boolean;
  /** pointmap: tile basemap with lat/lon dots. */
  lat?: string;
  lon?: string;
  tiles?: TileProvider | { url: string; attribution?: string; subdomains?: string; maxZoom?: number; retina?: boolean } | false;
  /** Public token / API key for the tile provider (a secret Mapbox "sk." token is rejected). */
  tilesKey?: string;
  tileStyle?: 'muted' | 'original';
  tileOpacity?: number;
  zoom?: number;
  /** [lon, lat] */
  center?: [number, number];
  /** choropleth */
  missing?: 'hatch' | 'plain';
  thresholds?: number[];
  classes?: number;
  scale?: 'quantile' | 'equal' | 'continuous' | 'categorical' | number[] | string;
  values?: boolean;
  tall?: boolean;
  /** Seaborn-style options */
  orient?: 'v' | 'h';
  valueDomain?: [number, number];
  bandwidth?: number;
  bwAdjust?: number;
  cut?: number;
  jitter?: number | boolean;
  dodge?: boolean;
  hueOrder?: string[];
  showMeans?: boolean;
  cumulative?: boolean;
  rug?: boolean;
  complementary?: boolean;
  radius?: number;
  endLabels?: boolean;
  /** treemap/sunburst */
  showValues?: boolean;
  hole?: number;
  thickness?: number;
  cellHeight?: number;
  facetOrder?: string[];
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
  /** gantt: phases drawn collapsed into a summary row; true for all. Click toggles in the browser. */
  collapsed?: boolean | string | string[];
  collapsible?: boolean;
  /** gantt: highlight the zero-slack chain along dependsOn. */
  critical?: boolean;
  criticalColor?: string;
  /** gantt: shade weekends on day plans of up to 120 days (default true). */
  weekends?: boolean;
  todayColor?: string;
  /** Browser time controls, off by default: true (buttons or slider), "buttons" or "slider". */
  slider?: boolean | 'buttons' | 'slider';
  play?: boolean;
  /** wordcloud: words field, or raw text to count. */
  text?: string | string[];
  textField?: string;
  /** facet/kpi: panels or tiles per row. table: the columns. */
  columns?: number | Array<string | TableColumn>;
  /** table: column to sort by (field or label). */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** table: rows per page (default: all up to 15, then 10). false shows every row. */
  pageSize?: number | false;
  page?: number;
  /** table: keep rows containing these words (accent- and case-insensitive). */
  query?: string;
  /** table: browser search box (default: on above 20 rows). */
  search?: boolean;
  /** table: totals row. */
  total?: boolean | 'sum' | 'mean' | 'min' | 'max' | Record<string, string | boolean>;
  totalLabel?: string;
  /** table: "#" column with the position. */
  rank?: boolean;
  /** table: one card per row. "auto" (default) when the columns do not fit. */
  cards?: boolean | 'auto';
  density?: 'compact' | 'normal' | 'comfortable';
  striped?: boolean;
  /** table: false disables the automatic data bar. */
  bars?: boolean;
  sortable?: boolean;
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
  locale?: Locale; theme?: Spec['theme']; font?: Spec['font']; palette?: string | string[];
  data?: Row[];
  kpis?: Array<{ label: string; value?: number; delta?: number; period?: string; previous?: number; display?: string; trend?: number[]; good?: 'up' | 'down'; format?: Format;
    field?: string; agg?: 'sum' | 'mean' | 'median' | 'min' | 'max' | 'count' | 'distinct' | 'ratio'; over?: string; scale?: number;
    compare?: { field: string; current: string | number; previous: string | number }; trendBy?: string }>;
  /** Optional when there are `kpis`. */
  charts?: Array<Spec & { primary?: boolean; size?: 'full' | 'large' | 'medium' | 'small'; span?: number }>;
  filters?: Array<string | { field: string; label?: string; control?: 'buttons' | 'select'; value?: string }>;
  layout?: 'auto' | 'executive' | 'grid';
  colors?: Record<string, string>;
  /** "given" keeps the charts in the order written (otherwise the main time series goes first). */
  order?: 'given';
  ramp?: string | string[];
  textScale?: number;
}
/** Self-contained HTML dashboard with best-practice layout, shared colors, KPIs and filters. */
export declare function dashboard(spec: DashboardSpec): string;
/** Never throws: { ok, html, plan, errors, warnings, suggestions }. */
export declare function safeDashboard(spec: DashboardSpec): { ok: boolean; html: string | null; plan: object | null; errors: Issue[]; warnings: Issue[]; suggestions: Issue[] };
export declare function lintDashboard(spec: DashboardSpec): { ok: boolean; errors: Issue[]; warnings: Issue[]; suggestions: Issue[] };
export declare function planDashboard(spec: DashboardSpec): object;
/** Browser: draws a dashboard into an element. */
/** Browser: wires the filters and charts of a dashboard already in the DOM. */
export declare function mountDashboard(root: Element, plan: object): { plan: object; update(): void; destroy(): void };
export declare function packRows(spans: number[]): Array<Array<{ i: number; span: number }>>;
export declare function balancedRows(spans: number[], hasPrimary?: boolean): Array<Array<{ i: number; span: number }>>;
export declare function renderDashboard(target: string | Element, spec: DashboardSpec): { update(): void; destroy(): void };
export declare const dashboardSchema: Record<string, unknown>;
/** Raw text → [{ text, value }] word counts without stopwords. */
export declare function countWords(text: string | string[], opts?: { minLength?: number; stopwords?: string[] }): { text: string; value: number }[];
export declare function getGeo(geo: string | object, objectName?: string): object;
export declare function registeredGeo(): string[];
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
export declare function bundleSource(file?: string): string | null;
export declare function toolDefinition(opts?: { name?: string; flavor?: 'anthropic' | 'openai'; kind?: 'chart' | 'dashboard' }): Record<string, unknown>;
export declare const themes: Record<'papel' | 'noche' | 'light' | 'dark', Theme> & Record<string, Theme>;
export declare function getTheme(t?: Spec['theme']): Theme;
/** Registers a named theme (merged over `extends`, default papel); use it as theme: "name" or configure({ theme: "name" }). */
export declare function registerTheme(name: string, theme: ThemeInput): Theme;
/** Resolves a color scale to its stops, or null when the name is unknown. */
export declare function resolveColorScale(v: ColorScale): { name: string; stops: string[]; kind: 'sequential' | 'diverging' | 'cyclic' | 'qualitative' } | null;
/** Available colormap and palette names by kind. */
export declare function colorScaleNames(): { sequential: string[]; diverging: string[]; cyclic: string[]; qualitative: string[] };
/** Color at t ∈ [0, 1] along `stops` (OKLab). */
export declare function interpolateColor(stops: string[], t: number): string;
export declare const COLORMAPS: Record<string, string>;
export declare const QUALITATIVE: Record<string, string>;
export declare const TYPES: ChartType[];
export declare function squarify<T extends { value: number }>(items: T[], x: number, y: number, w: number, h: number): (T & { x: number; y: number; w: number; h: number })[];
export declare function makeFormat(fmt?: Format, locale?: string, values?: number[]): ((v: number) => string) & { type: string };
/** Most likely language of some texts ('es' | 'en' | 'pt' | 'fr' | 'de'), or null. */
export declare function detectLocale(texts: string | string[]): 'es' | 'en' | 'pt' | 'fr' | 'de' | null;
export declare function formatNumber(v: number, decimals?: number, locale?: string, trim?: boolean): string;
export declare function formatCompact(v: number, locale?: string, decimals?: number): string;

export default plot;
