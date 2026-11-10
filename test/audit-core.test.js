import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num } from '../src/data.js';
import { formatCompact, formatNumber, isDateLike, parseDate, makeFormat } from '../src/format.js';
import { esc } from '../src/svg.js';

test('num: solo símbolos o hexadecimal no son números', () => {
  for (const s of [' ', '%', '$', '0x10', 'Infinity', '-', '']) assert.ok(Number.isNaN(num(s)), JSON.stringify(s));
  assert.equal(num('-$ 3.000'), -3000);
  assert.equal(num('12,5%'), 12.5);
  assert.equal(num('1.234,5'), 1234.5);
  assert.equal(num('1e3'), 1000);
});

test('formatCompact: el redondeo sube a la unidad siguiente', () => {
  assert.equal(formatCompact(999999), '1 M');
  assert.equal(formatCompact(-999999, 'en'), '−1M');
  assert.equal(formatCompact(1500), '1,5 mil');
});

test('formatNumber: magnitudes sobre 1e21 sin notación científica', () => {
  assert.ok(!/e/.test(formatNumber(1e21)));
});

test('fechas: rangos inválidos no son fechas', () => {
  for (const s of ['2020-21', '2024-13', '2024-02-31', '2024-00']) assert.equal(isDateLike(s), false, s);
  assert.equal(isDateLike('2024-02-29'), true);
  assert.equal(parseDate('2024-03'), Date.UTC(2024, 2, 1));
});

test('ticks: pasos minúsculos no colapsan en 0', () => {
  const f = makeFormat(undefined, 'en', [0, 2e-7]).tick(1e-7, [0, 1e-7, 2e-7]);
  assert.equal(f(1e-7), '0.0000001');
});

test('esc: quita caracteres prohibidos en XML', () => {
  assert.equal(esc('a\x00b\x0B<&>'), 'ab&lt;&amp;&gt;');
  assert.equal(esc('😀'), '😀');
});
