// Dashboard de ejemplo: ventas del sur por mes, región y canal. Datos ILUSTRATIVOS.
const REGIONS = { Biobío: 520, Ñuble: 210, Araucanía: 300, Maule: 340 };
const CHANNELS = { Tienda: 0.52, Online: 0.3, Mayorista: 0.18 };
const CH_EN = { Tienda: 'Store', Online: 'Online', Mayorista: 'Wholesale' };
const growth = { Biobío: 0.006, Ñuble: 0.022, Araucanía: 0.01, Maule: 0.004 };
const online = (i) => 1 + i * 0.018; // el canal online crece más rápido

export function salesRows(locale = 'es') {
  const en = locale === 'en';
  const rows = [];
  for (let i = 0; i < 24; i++) {
    const year = 2024 + Math.floor(i / 12), m = (i % 12) + 1;
    const month = `${year}-${String(m).padStart(2, '0')}`;
    const season = 1 + 0.12 * Math.sin(((m - 3) / 12) * 2 * Math.PI) + (m === 12 ? 0.18 : 0);
    for (const [region, base] of Object.entries(REGIONS)) for (const [channel, share] of Object.entries(CHANNELS)) {
      const k = channel === 'Online' ? online(i) : 1;
      const sales = Math.round(base * share * season * k * (1 + growth[region]) ** i * (1 + 0.04 * Math.sin(i * 1.7 + base)));
      const ticket = channel === 'Mayorista' ? 1.9 : channel === 'Online' ? 0.042 : 0.031;
      rows.push({ month, year, region, channel: en ? CH_EN[channel] : channel, sales, orders: Math.round((sales / ticket) * (channel === 'Mayorista' ? 0.02 : 1)) });
    }
  }
  return rows;
}

const sum = (rs, f = 'sales') => rs.reduce((a, r) => a + r[f], 0);

/** Spec del dashboard (es o en). */
export function salesDashboard(locale = 'es') {
  const en = locale === 'en';
  const L = (es, e) => (en ? e : es);
  const data = salesRows(locale);
  const y25 = data.filter((r) => r.year === 2025), y24 = data.filter((r) => r.year === 2024);
  const onl = L('Online', 'Online');
  const onShare = (rs) => sum(rs.filter((r) => r.channel === onl)) / sum(rs);
  const byRegion = (rs, reg) => sum(rs.filter((r) => r.region === reg));
  const nubleGrowth = Math.round((byRegion(y25, 'Ñuble') / byRegion(y24, 'Ñuble') - 1) * 100);
  const bioShare = Math.round((byRegion(y25, 'Biobío') / sum(y25)) * 100);
  const regions = Object.keys(REGIONS);
  return {
    title: L('¿Cómo van las ventas del sur?', 'How are southern sales doing?'),
    subtitle: L('Ventas por mes, región y canal, 2024–2025, millones de pesos', 'Sales by month, region and channel, 2024–2025, CLP millions'),
    source: L('datos ilustrativos', 'illustrative data'),
    updated: '2026-01-05',
    locale,
    data,
    kpis: [
      { label: L('Ventas 2025', 'Sales 2025'), field: 'sales', agg: 'sum', format: 'compact', compare: { field: 'year', current: 2025, previous: 2024 }, trendBy: 'month' },
      { label: L('Pedidos 2025', 'Orders 2025'), field: 'orders', agg: 'sum', format: 'compact', compare: { field: 'year', current: 2025, previous: 2024 }, trendBy: 'month' },
      { label: L('Ticket promedio, miles de pesos', 'Average ticket, CLP thousands'), field: 'sales', agg: 'ratio', over: 'orders', scale: 1000, format: { decimals: 1 }, compare: { field: 'year', current: 2025, previous: 2024 } },
      { label: L('Participación online', 'Online share'), value: onShare(y25), format: 'percent', delta: (onShare(y25) - onShare(y24)) / onShare(y24), period: 'vs 2024' },
    ],
    filters: [{ field: 'region', label: L('Región', 'Region') }, { field: 'channel', label: L('Canal', 'Channel') }],
    charts: [
      { type: 'line', x: 'month', y: 'sales', series: 'region', title: L(`Ñuble crece ${nubleGrowth}% en el año, más rápido que las demás regiones`, `Ñuble grew ${nubleGrowth}% this year, faster than any other region`), subtitle: L('Ventas mensuales por región', 'Monthly sales by region'), highlight: 'Ñuble' },
      { type: 'choropleth', geo: 'chile', key: 'region', value: 'sales', fitTo: regions, missing: 'plain', title: L(`Biobío vende el ${bioShare}% del total`, `Biobío makes ${bioShare}% of sales`), subtitle: L('Ventas 2024–2025 por región', 'Sales 2024–2025 by region'), aggregate: 'sum', format: 'compact', tall: false, legendTitle: L('Ventas', 'Sales') },
      { type: 'bar', x: 'channel', y: 'sales', series: 'year', title: L('El canal online es el único que sube con fuerza', 'Online is the only channel growing strongly'), subtitle: L('Ventas por canal y año', 'Sales by channel and year'), format: 'compact' },
      { type: 'treemap', path: ['region', 'channel'], value: 'sales', title: L('La tienda física sigue siendo la mitad del negocio', 'Physical stores are still half the business'), subtitle: L('Ventas por región y canal', 'Sales by region and channel') },
    ],
  };
}
