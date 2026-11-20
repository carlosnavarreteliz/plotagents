// Familias de paletas minimalistas: alternativas sobrias que combinan entre
// sí. Cinco colores apagados por familia (desde la 6ª serie, gris "Otros"),
// con su versión para fondo claro y para fondo oscuro, y rampas a juego.
//
//   plot({ ...spec, palette: 'nordico' })                     // una familia
//   plot({ ...spec, palettes: ['cdia', 'arcilla', 'tinta'] })  // alternativas en un SVG
//
// Validadas con validatePalette() en su orden, con un piso de croma de 0,04
// (son apagadas a propósito; la de fábrica usa 0,10): banda de luminosidad,
// separación para daltonismo entre vecinos (ΔE ≥ 11,7, meta 8) y entre todos
// los pares (≥ 7,2), y visión normal (ΔE ≥ 15). Como el croma es bajo, la
// separación viene sobre todo de la luminosidad. Claro y oscuro comparten
// tonos y orden. El ORDEN es parte de la seguridad: no lo cambies sin volver
// a validar (test/families.test.js lo comprueba).

export const MUTED_CHROMA = 0.04;

export const FAMILIES = {
  arcilla: {
    label: { es: 'Arcilla', en: 'Clay' },
    minChroma: MUTED_CHROMA,
    // arcilla, oliva clara, vino, cielo gris, avena
    colors: ['#A45A40', '#979873', '#6E4C4C', '#699DB6', '#CEAD87'],
    dark: ['#993F1C', '#96986A', '#8C6161', '#609DBA', '#99754A'],
    sequential: ['#FEF0EB', '#FCD4C6', '#E7B3A2', '#CA927F', '#A97563', '#845A4C', '#5F4339', '#362B27'],
    sequentialDark: ['#2B1A14', '#4A291D', '#6B3C2C', '#8A5340', '#A9705C', '#C69482', '#DFBBAE', '#F1E1DB'],
    diverging: ['#632A15', '#986250', '#D6B6AB', '#ECEBE6', '#AEC1CB', '#628698', '#295366'],
    divergingDark: ['#FEC1AB', '#BE816B', '#684B40', '#2A2E48', '#425660', '#6F99AE', '#A5DAF4'],
  },
  nordico: {
    label: { es: 'Nórdico', en: 'Nordic' },
    minChroma: MUTED_CHROMA,
    // azul nórdico, rosa seco, pino claro, gris azulado, mostaza suave
    colors: ['#345785', '#B98A8D', '#386E57', '#97B7D9', '#D1AB69'],
    dark: ['#3F689C', '#B98386', '#2D6E55', '#7397BE', '#976F20'],
    sequential: ['#EDF4FF', '#CDE0F9', '#ABC3E4', '#89A4C7', '#6C85A6', '#536883', '#3E4B5D', '#282E37'],
    sequentialDark: ['#17202B', '#233449', '#344C6A', '#496589', '#6682A7', '#8BA4C4', '#B4C6DD', '#DDE5F1'],
    diverging: ['#213E63', '#597396', '#B0BFD3', '#ECEBE6', '#CABCA4', '#967C50', '#64470C'],
    divergingDark: ['#B3D4FE', '#7695BC', '#455467', '#2A2E48', '#5E5039', '#AB8D5B', '#F0CB8D'],
  },
  tinta: {
    label: { es: 'Tinta', en: 'Ink' },
    minChroma: MUTED_CHROMA,
    // tinta, tinta clara, óxido suave, ámbar, tinta media
    colors: ['#3B538A', '#919EBB', '#834A41', '#E1A675', '#6179AD'],
    dark: ['#435E9B', '#8394B6', '#8C4C42', '#C3844E', '#5E79B3'],
    sequential: ['#EFF4FE', '#D0DEFD', '#AEC1E8', '#8DA1CC', '#7083AB', '#576686', '#404A60', '#292E37'],
    sequentialDark: ['#191F2C', '#26324C', '#394A6E', '#4F628D', '#6B80AB', '#8FA2C8', '#B7C4E0', '#DFE5F1'],
    diverging: ['#283B67', '#5E719A', '#B2BED6', '#ECEBE6', '#D0B9A7', '#9F7756', '#6D4119'],
    divergingDark: ['#BBD1FF', '#7C92C1', '#485269', '#2A2E48', '#634E3C', '#B58762', '#FDC496'],
  },
};
