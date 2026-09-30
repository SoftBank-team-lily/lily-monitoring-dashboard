import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { buildFlowerParticles, FLOWER_SCALE, OBSERVATION_POINTS } from '../lib/flower-particles.ts';

const bytes = readFileSync(new URL('../public/flower-mask.png', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'), '00134f5c8c6ff825cf54b272031c93f8b4d19a109ae45f1c11ddcc5f407b270f', 'Use the actual lily-frontend flower silhouette');
const mask = PNG.sync.read(bytes);
const flower = buildFlowerParticles(mask);
assert.equal(flower.positions.length, flower.colors.length);
assert.equal(flower.positions.length / 3, flower.sizes.length);
assert.equal(flower.sizes.length, 46_386, 'Reference mask density stays consistent');
for (const array of [flower.positions, flower.colors, flower.sizes, flower.phases, flower.alphas]) assert.ok(array.every(Number.isFinite));
assert.equal(flower.sizes.length, flower.phases.length);
assert.equal(flower.sizes.length, flower.alphas.length);
// Every generated point stays within the reference mask, including asymmetric tips and gaps.
for (let i = 0; i < flower.positions.length; i += 3) {
  const x = Math.floor(flower.positions[i] / FLOWER_SCALE / 3.4 * mask.width + 88.2 / 187 * mask.width);
  const y = Math.floor(-flower.positions[i + 1] / FLOWER_SCALE / 3.4 * mask.height + 79.6 / 187 * mask.height);
  assert.ok(x >= 0 && x < mask.width && y >= 0 && y < mask.height);
  assert.ok(mask.data[(y * mask.width + x) * 4] / 255 >= .1, 'Particle must lie on the source flower');
}
const depths = flower.positions.filter((_, i) => i % 3 === 2);
assert.ok(Math.max(...depths) - Math.min(...depths) > .9, 'Preserve the reference point cloud depth');
for (const { id } of OBSERVATION_POINTS) {
  const position = flower.attachments[id];
  let nearest = Infinity;
  for (let i = 0; i < flower.positions.length; i += 3) nearest = Math.min(nearest, Math.hypot(flower.positions[i] - position[0], flower.positions[i + 1] - position[1], flower.positions[i + 2] - position[2]));
  assert.ok(nearest < 1e-6, `${id} must attach to a real bloom particle`);
  assert.ok(Math.hypot(position[0], position[1]) < .55, 'Observation points belong to the flower center');
}
assert.equal(new Set(OBSERVATION_POINTS.map((p) => p.id)).size, 5);
assert.deepEqual(flower.positions, buildFlowerParticles(mask).positions);
assert.throws(() => buildFlowerParticles({ width: 2, height: 3, data: new Uint8Array(24) }));
assert.throws(() => buildFlowerParticles({ width: 2, height: 2, data: new Uint8Array(16) }));
console.log(`PASS: original Lily mask, ${flower.sizes.length} deterministic particles, source silhouette and five center attachments`);
