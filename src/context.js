// Contexto de dibujo: valores globales que plot() fija mientras dibuja un
// gráfico (todo es sincrónico, así que no hay mezcla entre gráficos).
export const ctx = { textScale: 1 };

/** Ejecuta fn con un contexto temporal y lo restaura después. */
export function withContext(values, fn) {
  const prev = { ...ctx };
  Object.assign(ctx, values);
  try { return fn(); } finally { Object.assign(ctx, prev); }
}
