import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const skill = readFileSync(new URL('../skills/plotagents/SKILL.md', import.meta.url), 'utf8');

test('the agent skill states the version being released', () => {
  const front = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(front, 'SKILL.md needs YAML frontmatter');
  assert.match(front[1], /^name: plotagents$/m);
  assert.match(front[1], /^description: .{50,1024}$/m);
  const declared = front[1].match(/version: "([^"]+)"/)?.[1];
  assert.equal(declared, pkg.version, 'bump metadata.version in skills/plotagents/SKILL.md');
  // The body compares against the same version: every mention must match.
  const mentioned = [...skill.matchAll(/\b0\.\d+\.\d+\b/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(mentioned)], [pkg.version]);
});
