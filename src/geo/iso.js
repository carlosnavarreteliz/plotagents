// Códigos de país: ISO 3166-1 alfa-3 → alfa-2, y los estados y territorios
// demasiado chicos para tener contorno a escala mundial (1:110m), con un punto.
//
// Con esto una fila con "CL", "CHL" o "Chile" calza con el mismo país, y
// `microstates: true` dibuja como punto a Singapur, Malta o Baréin en vez de
// perderlos en silencio.

// alfa-3 → alfa-2 de los países que traen contorno en 'world'.
export const ISO2 = {
  AFG: 'AF', AGO: 'AO', ALB: 'AL', ARE: 'AE', ARG: 'AR', ARM: 'AM', ATA: 'AQ', ATF: 'TF', AUS: 'AU', AUT: 'AT', AZE: 'AZ',
  BDI: 'BI', BEL: 'BE', BEN: 'BJ', BFA: 'BF', BGD: 'BD', BGR: 'BG', BHS: 'BS', BIH: 'BA', BLR: 'BY', BLZ: 'BZ', BOL: 'BO',
  BRA: 'BR', BRN: 'BN', BTN: 'BT', BWA: 'BW', CAF: 'CF', CAN: 'CA', CHE: 'CH', CHL: 'CL', CHN: 'CN', CIV: 'CI', CMR: 'CM',
  COD: 'CD', COG: 'CG', COL: 'CO', CRI: 'CR', CUB: 'CU', CYP: 'CY', CZE: 'CZ', DEU: 'DE', DJI: 'DJ', DNK: 'DK', DOM: 'DO',
  DZA: 'DZ', ECU: 'EC', EGY: 'EG', ERI: 'ER', ESH: 'EH', ESP: 'ES', EST: 'EE', ETH: 'ET', FIN: 'FI', FJI: 'FJ', FLK: 'FK',
  FRA: 'FR', GAB: 'GA', GBR: 'GB', GEO: 'GE', GHA: 'GH', GIN: 'GN', GMB: 'GM', GNB: 'GW', GNQ: 'GQ', GRC: 'GR', GRL: 'GL',
  GTM: 'GT', GUY: 'GY', HND: 'HN', HRV: 'HR', HTI: 'HT', HUN: 'HU', IDN: 'ID', IND: 'IN', IRL: 'IE', IRN: 'IR', IRQ: 'IQ',
  ISL: 'IS', ISR: 'IL', ITA: 'IT', JAM: 'JM', JOR: 'JO', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KHM: 'KH', KOR: 'KR',
  KWT: 'KW', LAO: 'LA', LBN: 'LB', LBR: 'LR', LBY: 'LY', LKA: 'LK', LSO: 'LS', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAR: 'MA',
  MDA: 'MD', MDG: 'MG', MEX: 'MX', MKD: 'MK', MLI: 'ML', MMR: 'MM', MNE: 'ME', MNG: 'MN', MOZ: 'MZ', MRT: 'MR', MWI: 'MW',
  MYS: 'MY', NAM: 'NA', NCL: 'NC', NER: 'NE', NGA: 'NG', NIC: 'NI', NLD: 'NL', NOR: 'NO', NPL: 'NP', NZL: 'NZ', OMN: 'OM',
  PAK: 'PK', PAN: 'PA', PER: 'PE', PHL: 'PH', PNG: 'PG', POL: 'PL', PRI: 'PR', PRK: 'KP', PRT: 'PT', PRY: 'PY', PSE: 'PS',
  QAT: 'QA', ROU: 'RO', RUS: 'RU', RWA: 'RW', SAU: 'SA', SDN: 'SD', SEN: 'SN', SLB: 'SB', SLE: 'SL', SLV: 'SV', SOM: 'SO',
  SRB: 'RS', SSD: 'SS', SUR: 'SR', SVK: 'SK', SVN: 'SI', SWE: 'SE', SWZ: 'SZ', SYR: 'SY', TCD: 'TD', TGO: 'TG', THA: 'TH',
  TJK: 'TJ', TKM: 'TM', TLS: 'TL', TTO: 'TT', TUN: 'TN', TUR: 'TR', TWN: 'TW', TZA: 'TZ', UGA: 'UG', UKR: 'UA', URY: 'UY',
  USA: 'US', UZB: 'UZ', VEN: 'VE', VNM: 'VN', VUT: 'VU', XKX: 'XK', YEM: 'YE', ZAF: 'ZA', ZMB: 'ZM', ZWE: 'ZW',
};

// Estados y territorios sin contorno a 1:110m: [alfa-2, alfa-3, nombre, name, lon, lat].
// El punto es la capital o el centro del archipiélago principal.
export const MICROSTATES = [
  ['AD', 'AND', 'Andorra', 'Andorra', 1.52, 42.55],
  ['AG', 'ATG', 'Antigua y Barbuda', 'Antigua and Barbuda', -61.8, 17.08],
  ['AI', 'AIA', 'Anguila', 'Anguilla', -63.07, 18.22],
  ['AS', 'ASM', 'Samoa Americana', 'American Samoa', -170.7, -14.3],
  ['AW', 'ABW', 'Aruba', 'Aruba', -69.97, 12.52],
  ['AX', 'ALA', 'Islas Åland', 'Åland Islands', 19.95, 60.18],
  ['BB', 'BRB', 'Barbados', 'Barbados', -59.55, 13.17],
  ['BH', 'BHR', 'Baréin', 'Bahrain', 50.55, 26.05],
  ['BL', 'BLM', 'San Bartolomé', 'Saint Barthélemy', -62.83, 17.9],
  ['BM', 'BMU', 'Bermudas', 'Bermuda', -64.78, 32.3],
  ['BQ', 'BES', 'Caribe Neerlandés', 'Caribbean Netherlands', -68.26, 12.15],
  ['BV', 'BVT', 'Isla Bouvet', 'Bouvet Island', 3.4, -54.42],
  ['CC', 'CCK', 'Islas Cocos', 'Cocos (Keeling) Islands', 96.87, -12.17],
  ['CK', 'COK', 'Islas Cook', 'Cook Islands', -159.78, -21.23],
  ['CV', 'CPV', 'Cabo Verde', 'Cabo Verde', -23.6, 15.1],
  ['CW', 'CUW', 'Curazao', 'Curaçao', -68.93, 12.17],
  ['CX', 'CXR', 'Isla de Navidad', 'Christmas Island', 105.69, -10.48],
  ['DM', 'DMA', 'Dominica', 'Dominica', -61.37, 15.42],
  ['FM', 'FSM', 'Micronesia', 'Micronesia', 158.2, 6.9],
  ['FO', 'FRO', 'Islas Feroe', 'Faroe Islands', -6.9, 62.0],
  ['GD', 'GRD', 'Granada', 'Grenada', -61.68, 12.12],
  ['GF', 'GUF', 'Guayana Francesa', 'French Guiana', -53.1, 4.0],
  ['GG', 'GGY', 'Guernsey', 'Guernsey', -2.58, 49.46],
  ['GI', 'GIB', 'Gibraltar', 'Gibraltar', -5.35, 36.14],
  ['GP', 'GLP', 'Guadalupe', 'Guadeloupe', -61.55, 16.25],
  ['GS', 'SGS', 'Georgias del Sur', 'South Georgia', -36.6, -54.4],
  ['GU', 'GUM', 'Guam', 'Guam', 144.79, 13.44],
  ['HK', 'HKG', 'Hong Kong', 'Hong Kong', 114.17, 22.32],
  ['HM', 'HMD', 'Islas Heard y McDonald', 'Heard and McDonald Islands', 73.5, -53.1],
  ['IM', 'IMN', 'Isla de Man', 'Isle of Man', -4.55, 54.23],
  ['IO', 'IOT', 'Territorio Británico del Océano Índico', 'British Indian Ocean Territory', 72.4, -7.3],
  ['JE', 'JEY', 'Jersey', 'Jersey', -2.13, 49.21],
  ['KI', 'KIR', 'Kiribati', 'Kiribati', 172.98, 1.45],
  ['KM', 'COM', 'Comoras', 'Comoros', 43.33, -11.7],
  ['KN', 'KNA', 'San Cristóbal y Nieves', 'Saint Kitts and Nevis', -62.75, 17.3],
  ['KY', 'CYM', 'Islas Caimán', 'Cayman Islands', -81.25, 19.3],
  ['LC', 'LCA', 'Santa Lucía', 'Saint Lucia', -60.98, 13.9],
  ['LI', 'LIE', 'Liechtenstein', 'Liechtenstein', 9.55, 47.16],
  ['MC', 'MCO', 'Mónaco', 'Monaco', 7.42, 43.74],
  ['MF', 'MAF', 'San Martín', 'Saint Martin', -63.05, 18.07],
  ['MH', 'MHL', 'Islas Marshall', 'Marshall Islands', 171.2, 7.1],
  ['MO', 'MAC', 'Macao', 'Macao', 113.55, 22.17],
  ['MP', 'MNP', 'Islas Marianas del Norte', 'Northern Mariana Islands', 145.75, 15.2],
  ['MQ', 'MTQ', 'Martinica', 'Martinique', -61.0, 14.65],
  ['MS', 'MSR', 'Montserrat', 'Montserrat', -62.19, 16.74],
  ['MT', 'MLT', 'Malta', 'Malta', 14.45, 35.9],
  ['MU', 'MUS', 'Mauricio', 'Mauritius', 57.55, -20.3],
  ['MV', 'MDV', 'Maldivas', 'Maldives', 73.5, 4.2],
  ['NF', 'NFK', 'Isla Norfolk', 'Norfolk Island', 167.95, -29.03],
  ['NR', 'NRU', 'Nauru', 'Nauru', 166.93, -0.53],
  ['NU', 'NIU', 'Niue', 'Niue', -169.87, -19.05],
  ['PF', 'PYF', 'Polinesia Francesa', 'French Polynesia', -149.4, -17.6],
  ['PM', 'SPM', 'San Pedro y Miquelón', 'Saint Pierre and Miquelon', -56.3, 46.9],
  ['PN', 'PCN', 'Islas Pitcairn', 'Pitcairn Islands', -130.1, -25.07],
  ['PW', 'PLW', 'Palaos', 'Palau', 134.58, 7.5],
  ['RE', 'REU', 'Reunión', 'Réunion', 55.53, -21.12],
  ['SC', 'SYC', 'Seychelles', 'Seychelles', 55.45, -4.62],
  ['SG', 'SGP', 'Singapur', 'Singapore', 103.82, 1.35],
  ['SH', 'SHN', 'Santa Elena', 'Saint Helena', -5.7, -15.95],
  ['SJ', 'SJM', 'Svalbard', 'Svalbard', 15.6, 78.2],
  ['SM', 'SMR', 'San Marino', 'San Marino', 12.45, 43.94],
  ['ST', 'STP', 'Santo Tomé y Príncipe', 'São Tomé and Príncipe', 6.6, 0.25],
  ['SX', 'SXM', 'Sint Maarten', 'Sint Maarten', -63.05, 18.03],
  ['TC', 'TCA', 'Islas Turcas y Caicos', 'Turks and Caicos Islands', -71.8, 21.7],
  ['TK', 'TKL', 'Tokelau', 'Tokelau', -171.85, -9.2],
  ['TO', 'TON', 'Tonga', 'Tonga', -175.2, -21.15],
  ['TV', 'TUV', 'Tuvalu', 'Tuvalu', 179.2, -8.5],
  ['VA', 'VAT', 'Ciudad del Vaticano', 'Vatican City', 12.45, 41.9],
  ['VC', 'VCT', 'San Vicente y las Granadinas', 'Saint Vincent and the Grenadines', -61.2, 13.25],
  ['VG', 'VGB', 'Islas Vírgenes Británicas', 'British Virgin Islands', -64.6, 18.42],
  ['VI', 'VIR', 'Islas Vírgenes de EE. UU.', 'U.S. Virgin Islands', -64.8, 18.34],
  ['WF', 'WLF', 'Wallis y Futuna', 'Wallis and Futuna', -176.2, -13.3],
  ['WS', 'WSM', 'Samoa', 'Samoa', -172.1, -13.75],
  ['YT', 'MYT', 'Mayotte', 'Mayotte', 45.15, -12.8],
];

/** Puntos (Features) de los microestados que no están ya entre `features` (por alfa-3 o alfa-2). */
export function microstateFeatures(features, radius) {
  const have = new Set();
  for (const f of features) { const p = f.properties || {}; for (const k of [p.iso3, p.iso_a3, p.iso2, p.iso_a2, p.code, f.id]) if (k !== undefined && k !== null) have.add(String(k).toUpperCase()); }
  return MICROSTATES.filter(([a2, a3]) => !have.has(a2) && !have.has(a3)).map(([a2, a3, name, nameEn, lon, lat]) => ({
    type: 'Feature', id: a3, properties: { iso3: a3, iso2: a2, name, nameEn, dot: true, microstate: true, r: radius }, geometry: { type: 'Point', coordinates: [lon, lat] },
  }));
}
