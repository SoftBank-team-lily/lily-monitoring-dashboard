import assert from 'node:assert/strict';
import { mockAppMetrics, mockServers } from '../lib/mock.ts';
import { busiestServer, investigationTarget, worstVersion } from '../lib/monitoring.ts';

const bad = mockAppMetrics('sample', '15m', 'bad');
const healthy = mockAppMetrics('sample', '15m', 'healthy');
const servers = mockServers('15m');
assert.equal(investigationTarget(bad, servers), 'logs');
assert.equal(investigationTarget(healthy, servers), 'servers');
assert.equal(investigationTarget(healthy, { ...servers, servers: [] }), 'compare');
assert.equal(busiestServer({ ...servers, servers: [] }), undefined);
assert.equal(worstVersion([], 'errorRate'), undefined);
assert.equal(worstVersion(bad.versions, 'errorRate').version, 'v42');
assert.deepEqual(bad.versions, mockAppMetrics('sample', '1h', 'bad').versions, 'Summary window must not change with chart range');
for (const scenario of ['bad', 'healthy', 'single']) {
  const data = mockAppMetrics('sample', '1h', scenario);
  assert.equal(data.series.timestamps.length, 120);
  for (const values of Object.values(data.series.byVersion)) {
    for (const series of Object.values(values)) assert.equal(series.length, 120);
  }
  if (scenario === 'single') assert.equal(data.versions.length, 1);
}
console.log('PASS: investigation routing, empty data, version selection, time ranges, single-version data');
