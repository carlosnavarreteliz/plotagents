// Familias de paletas: alternativas que combinan entre sí, cada una con su
// categórica para fondo claro y para fondo oscuro, y rampas a juego.
//
//   plot({ ...spec, palette: 'bosque' })                    // una familia
//   plot({ ...spec, palettes: ['cdia', 'bosque', 'oceano'] }) // alternativas en un SVG
//
// Las categóricas están validadas con validatePalette() (no a ojo), en el
// mismo orden en que se asignan: banda de luminosidad, piso de croma,
// separación bajo protanopía/deuteranopía entre vecinos (ΔE ≥ 8, en todas
// ≥ 11,9), visión normal (ΔE ≥ 15) y los 3 primeros todos-los-pares (≥ 11,9).
// Claro y oscuro comparten tonos y orden: un grupo no cambia de color al
// cambiar el fondo. El ORDEN es parte de la seguridad: no lo cambies sin
// volver a validar (test/families.test.js lo comprueba).

export const FAMILIES = {
  terracota: {
    label: { es: 'Terracota', en: 'Terracotta' },
    // terracota, pizarra, arcilla, oliva, ocre, ciruela, arena tostada, petróleo
    colors: ['#A23A0C', '#256EB7', '#D37895', '#336E25', '#D1A045', '#864C93', '#C97B32', '#02A396'],
    dark: ['#A23A0C', '#1562AA', '#C66C8A', '#357028', '#B98929', '#884E95', '#CB7D35', '#00A296'],
    sequential: ['#FEF0EB', '#FFD3C4', '#FFA88A', '#F07C53', '#CC5E36', '#A14827', '#723723', '#3F271F'],
    sequentialDark: ['#351408', '#5A1B01', '#802A02', '#A73A06', '#C85B32', '#E48462', '#F7B199', '#FCDDD2'],
    diverging: ['#6B2202', '#AD5434', '#E4B09E', '#ECEBE6', '#A2C1E4', '#4983C2', '#014E8E'],
    divergingDark: ['#FEC1AB', '#D27555', '#724636', '#2A2E48', '#395573', '#5B96D6', '#B0D5FF'],
  },
  bosque: {
    label: { es: 'Bosque', en: 'Forest' },
    // pino, ámbar, niebla, liquen, corteza, musgo, mora, óxido
    colors: ['#1F6F38', '#DD983C', '#4BAAF4', '#C2A305', '#884401', '#859C19', '#99376C', '#D77E54'],
    dark: ['#23723C', '#C5821F', '#1E86CD', '#AC9000', '#924A06', '#81980F', '#9F3D72', '#D0774D'],
    sequential: ['#DFFDE4', '#B8EEC2', '#8DD59C', '#66B678', '#49975C', '#367646', '#2C5536', '#233226'],
    sequentialDark: ['#0E2514', '#083E1B', '#0B5A29', '#21753D', '#45935A', '#73B381', '#A5D1AD', '#D7EBDA'],
    diverging: ['#004B1E', '#438152', '#A7C8AC', '#ECEBE6', '#DFADC3', '#B55F8A', '#822058'],
    divergingDark: ['#99E6AA', '#64A373', '#3E5B44', '#2A2E48', '#6D4458', '#C9729D', '#FEBAD9'],
  },
  oceano: {
    label: { es: 'Océano', en: 'Ocean' },
    // marino, coral, espuma, erizo, turquesa, anémona, arena, alga
    colors: ['#1065BF', '#F49383', '#0596D0', '#9D2A3F', '#06BAAB', '#8865C0', '#CE9E22', '#017B4F'],
    dark: ['#1568C3', '#B95E50', '#099DD9', '#A73447', '#03A295', '#825FB9', '#B68903', '#01754B'],
    sequential: ['#EDF4FE', '#C9E0FF', '#97C4FE', '#5AA3FE', '#3383E2', '#2566B3', '#224B7D', '#1F2F43'],
    sequentialDark: ['#081F3C', '#003167', '#024990', '#0361BD', '#3080DF', '#62A4F6', '#9DC7FF', '#D4E6FE'],
    diverging: ['#013C79', '#3372BF', '#9FC1EC', '#ECEBE6', '#DFB1A9', '#B5685B', '#822C22'],
    divergingDark: ['#B3D4FE', '#5594E4', '#36547A', '#2A2E48', '#6D4741', '#C9796C', '#FEBFB4'],
  },
  atardecer: {
    label: { es: 'Atardecer', en: 'Sunset' },
    // púrpura, naranja, laguna, magenta, crepúsculo, oro, violeta, coral
    colors: ['#7047A9', '#F78104', '#0ABFA9', '#AA4068', '#3994D8', '#DB9D02', '#546ABB', '#CC4F3F'],
    dark: ['#774EB1', '#B75D01', '#089D8A', '#9D345D', '#2C88CC', '#916600', '#5A71C3', '#CD5040'],
    sequential: ['#F5F1FF', '#E3D6FE', '#CCB0FF', '#B288F5', '#936AD1', '#7351A5', '#523D74', '#31293F'],
    sequentialDark: ['#241837', '#3C2160', '#58318A', '#7347AF', '#9066CE', '#AF8DE7', '#CDB7F7', '#E8DFFC'],
    diverging: ['#4C1E7F', '#7E5DB1', '#C4B4E4', '#ECEBE6', '#E7B18C', '#C16304', '#773A00'],
    divergingDark: ['#D9C6FF', '#9F7ED5', '#584A73', '#2A2E48', '#6E492F', '#CB7C44', '#FEC29B'],
  },
  jardin: {
    label: { es: 'Jardín', en: 'Garden' },
    // rosa, brote, lavanda, durazno, aciano, hoja, ciruela, rocío
    colors: ['#BF6291', '#939422', '#B495EA', '#C88833', '#5194E7', '#337A39', '#7C3977', '#05BAB3'],
    dark: ['#AC5180', '#91921E', '#9C7ED1', '#A46801', '#4B8DE0', '#5FA662', '#934E8E', '#01A59E'],
    sequential: ['#FEEFF5', '#FECEE4', '#FCA0CC', '#E07CAD', '#BD5E8E', '#95486F', '#6A3750', '#3B2730'],
    sequentialDark: ['#311423', '#531B39', '#782854', '#993C6E', '#B95B8B', '#D683AC', '#ECB0CB', '#F7DCE8'],
    diverging: ['#6B1347', '#A1547B', '#DCAFC3', '#ECEBE6', '#A8C8A9', '#569059', '#105D1D'],
    divergingDark: ['#FFB9D9', '#C5759C', '#6B4557', '#2A2E48', '#3F5B40', '#68A36A', '#9DE69F'],
  },
  retro: {
    label: { es: 'Retro', en: 'Retro' },
    // verde azulado, naranja quemado, denim, mostaza, ladrillo, palta, café, salmón
    colors: ['#06A094', '#CB6B2D', '#22559E', '#C39B03', '#994440', '#6D9A34', '#944B01', '#F48397'],
    dark: ['#019F93', '#A84E04', '#2C5FA9', '#B08C01', '#98433F', '#709D38', '#924A03', '#D96A7F'],
    sequential: ['#D4FDF7', '#A1EFE5', '#68D7CA', '#2CB9AB', '#02988C', '#08766D', '#0F564F', '#1C3330'],
    sequentialDark: ['#012522', '#003C37', '#025750', '#01736A', '#029489', '#4FB5AA', '#92D3CA', '#D0EBE7'],
    diverging: ['#014842', '#0D8379', '#9AC9C2', '#ECEBE6', '#E1B299', '#B96837', '#7B3702'],
    divergingDark: ['#70E9DB', '#40A59A', '#305C56', '#2A2E48', '#6E4833', '#CB7B4C', '#FFC2A0'],
  },
};
