// =============================================================================
// Serve-mode HTTP API tests (CLI spec §7).
//
// Two layers:
//   1. processGenerate() — the pure request→result core (no sockets).
//   2. createServer()    — the HTTP layer (routing, CORS, guardrails), driven
//      over a real ephemeral-port server with fetch.
// =============================================================================

import { describe, test, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import {
  processGenerate,
  createServer,
  resolveServeConfig,
  DEFAULT_SERVE_CONFIG,
  type ServeConfig,
} from '../services/httpApi';

// --- Sample DSL models (verified valid against parseLogicalDSL) --------------

// Single cause → single effect, with @layout (so SVG mode works).
const IDENTITY = `A: "input"\nE := A\n@layout {\n  A: (100, 100)\n  E: (300, 100)\n}\n`;

// Same model without a layout block (SVG must fail; tables still work).
const NO_LAYOUT = `A: "input"\nE := A\n`;

// AND(p1,p2)->p3 with ONE(p1,p2): 2 causes ⇒ 2^2 = 4 combinations, two of
// which ONE renders infeasible.
const TWO_CAUSE = `p1: "A"\np2: "B"\np3: "C"\np3 := p1 AND p2\nONE(p1, p2)\n`;

// 9 independent causes ⇒ 2^9 = 512 > 256 (over the learning-mode limit).
const NINE_CAUSE = (() => {
  const causes = Array.from({ length: 9 }, (_, i) => `p${i + 1}: "c${i + 1}"`).join('\n');
  const orExpr = Array.from({ length: 9 }, (_, i) => `p${i + 1}`).join(' OR ');
  return `${causes}\np10: "Out"\np10 := ${orExpr}\n`;
})();

// ---------------------------------------------------------------------------
// processGenerate — request validation
// ---------------------------------------------------------------------------

describe('processGenerate: request validation', () => {
  test('non-object body → 400 invalid_request', () => {
    const r = processGenerate('nope');
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('invalid_request');
  });

  test('missing source → 400 invalid_request', () => {
    const r = processGenerate({ mode: 'decision-table' });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('invalid_request');
  });

  test('empty source → 400 invalid_request', () => {
    const r = processGenerate({ source: '   ' });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('invalid_request');
  });

  test('unknown mode → 400 invalid_request', () => {
    const r = processGenerate({ source: IDENTITY, mode: 'bogus' });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('invalid_request');
  });

  test('svg mode with format json → 400 invalid_request', () => {
    const r = processGenerate({ source: IDENTITY, mode: 'svg', format: 'json' });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('invalid_request');
  });

  test('table mode with format svg → 400 invalid_request', () => {
    const r = processGenerate({ source: IDENTITY, mode: 'coverage', format: 'svg' });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('invalid_request');
  });

  test('unparseable source → 400 parse_error', () => {
    const r = processGenerate({ source: 'this is not valid ::: dsl @@@' });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('parse_error');
  });
});

// ---------------------------------------------------------------------------
// processGenerate — outputs per mode/format
// ---------------------------------------------------------------------------

describe('processGenerate: decision-table', () => {
  test('default (only source) → 200 JSON with the §7.3 shape', () => {
    const r = processGenerate({ source: TWO_CAUSE });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('application/json');
    const body = JSON.parse(r.body);
    expect(body.mode).toBe('decision-table');
    expect(Array.isArray(body.causes)).toBe(true);
    expect(Array.isArray(body.effects)).toBe(true);
    expect(Array.isArray(body.conditions)).toBe(true);
    expect(body.stats).toBeTruthy();
    // ONE(p1,p2) leaves fewer than the full 2^2 = 4 columns.
    expect(body.conditions.length).toBeLessThan(4);
    expect(body.conditions.every((c: { excluded: boolean }) => c.excluded === false)).toBe(true);
  });

  test('format csv → 200 text/csv', () => {
    const r = processGenerate({ source: TWO_CAUSE, format: 'csv' });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('text/csv');
    expect(r.body).toContain('#'); // column headers start with '#'
  });
});

describe('processGenerate: all-combinations', () => {
  test('json includes all 2^n columns with excluded flags', () => {
    const r = processGenerate({ source: TWO_CAUSE, mode: 'all-combinations' });
    expect(r.status).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.mode).toBe('all-combinations');
    expect(body.conditions.length).toBe(4); // 2^2
    expect(body.conditions.some((c: { excluded: boolean }) => c.excluded)).toBe(true);
  });

  test('2^n > 256 → 422 unsatisfiable', () => {
    const r = processGenerate({ source: NINE_CAUSE, mode: 'all-combinations' });
    expect(r.status).toBe(422);
    const err = JSON.parse(r.body).error;
    expect(err.type).toBe('unsatisfiable');
    expect(err.message).toContain('256');
  });
});

describe('processGenerate: coverage', () => {
  test('json → 200 with rows and stats', () => {
    const r = processGenerate({ source: TWO_CAUSE, mode: 'coverage' });
    expect(r.status).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.mode).toBe('coverage');
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.stats).toBeTruthy();
  });

  test('csv → 200 text/csv', () => {
    const r = processGenerate({ source: TWO_CAUSE, mode: 'coverage', format: 'csv' });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('text/csv');
  });
});

describe('processGenerate: svg', () => {
  test('with @layout → 200 image/svg+xml', () => {
    const r = processGenerate({ source: IDENTITY, mode: 'svg' });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('image/svg+xml');
    expect(r.body).toContain('<svg');
  });

  test('without @layout → 422 unsatisfiable', () => {
    const r = processGenerate({ source: NO_LAYOUT, mode: 'svg' });
    expect(r.status).toBe(422);
    expect(JSON.parse(r.body).error.type).toBe('unsatisfiable');
  });
});

// ---------------------------------------------------------------------------
// processGenerate — model-size cap (CLI-SR-058, §7.6)
// ---------------------------------------------------------------------------

describe('processGenerate: model-size cap', () => {
  // TWO_CAUSE has 3 nodes (p1, p2, p3), of which 2 are causes.
  test('over maxNodes → 422 model_too_large', () => {
    const r = processGenerate({ source: TWO_CAUSE }, { maxNodes: 2, maxCauses: 0 });
    expect(r.status).toBe(422);
    const err = JSON.parse(r.body).error;
    expect(err.type).toBe('model_too_large');
    expect(err.message).toContain('NEOCEG_MAX_NODES');
  });

  test('over maxCauses → 422 model_too_large', () => {
    const r = processGenerate({ source: TWO_CAUSE }, { maxNodes: 0, maxCauses: 1 });
    expect(r.status).toBe(422);
    const err = JSON.parse(r.body).error;
    expect(err.type).toBe('model_too_large');
    expect(err.message).toContain('NEOCEG_MAX_CAUSES');
  });

  test('at the limit → not rejected (200)', () => {
    const r = processGenerate({ source: TWO_CAUSE }, { maxNodes: 3, maxCauses: 2 });
    expect(r.status).toBe(200);
  });

  test('limit 0 disables the check', () => {
    const r = processGenerate({ source: TWO_CAUSE }, { maxNodes: 0, maxCauses: 0 });
    expect(r.status).toBe(200);
  });

  test('the cap runs after parse — invalid source is still a parse_error', () => {
    const r = processGenerate({ source: 'this is not valid ::: dsl @@@' }, { maxNodes: 1, maxCauses: 1 });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error.type).toBe('parse_error');
  });
});

// ---------------------------------------------------------------------------
// resolveServeConfig — env overrides for the size cap
// ---------------------------------------------------------------------------

describe('resolveServeConfig: model-size env overrides', () => {
  afterEach(() => {
    delete process.env.NEOCEG_MAX_NODES;
    delete process.env.NEOCEG_MAX_CAUSES;
  });

  test('defaults when env unset', () => {
    const c = resolveServeConfig({});
    expect(c.maxNodes).toBe(DEFAULT_SERVE_CONFIG.maxNodes);
    expect(c.maxCauses).toBe(DEFAULT_SERVE_CONFIG.maxCauses);
  });

  test('env overrides are applied, including 0 (off)', () => {
    process.env.NEOCEG_MAX_NODES = '128';
    process.env.NEOCEG_MAX_CAUSES = '0';
    const c = resolveServeConfig({});
    expect(c.maxNodes).toBe(128);
    expect(c.maxCauses).toBe(0);
  });

  test('non-numeric env falls back to the default', () => {
    process.env.NEOCEG_MAX_NODES = 'nonsense';
    const c = resolveServeConfig({});
    expect(c.maxNodes).toBe(DEFAULT_SERVE_CONFIG.maxNodes);
  });
});

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------

let openServers: Server[] = [];

function startServer(overrides: Partial<ServeConfig> = {}): Promise<string> {
  const config: ServeConfig = { ...DEFAULT_SERVE_CONFIG, port: 0, ...overrides };
  const server = createServer(config);
  openServers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

afterEach(async () => {
  await Promise.all(
    openServers.map((s) => new Promise<void>((res) => s.close(() => res())))
  );
  openServers = [];
});

describe('HTTP layer', () => {
  test('GET /health → 200 {status:ok, version}', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
  });

  test('OPTIONS /generate → 204 with CORS header', async () => {
    const base = await startServer({ corsOrigin: 'https://neoceg.app' });
    const res = await fetch(`${base}/generate`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://neoceg.app');
  });

  test('GET /generate → 405 method_not_allowed', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/generate`);
    expect(res.status).toBe(405);
    expect((await res.json()).error.type).toBe('method_not_allowed');
  });

  test('POST /generate valid → 200 JSON', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: TWO_CAUSE }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).mode).toBe('decision-table');
  });

  test('POST /generate with malformed JSON → 400 invalid_request', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.type).toBe('invalid_request');
  });

  test('unknown path → 404 not_found', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.type).toBe('not_found');
  });

  test('oversized body → 413 payload_too_large', async () => {
    const base = await startServer({ maxBodyBytes: 64 });
    const big = JSON.stringify({ source: 'x'.repeat(500) });
    const res = await fetch(`${base}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error.type).toBe('payload_too_large');
  });

  test('oversized model → 422 model_too_large', async () => {
    const base = await startServer({ maxNodes: 2 });
    const res = await fetch(`${base}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: TWO_CAUSE }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error.type).toBe('model_too_large');
  });

  test('rate limit → 429 after the per-minute cap', async () => {
    const base = await startServer({ rateLimitPerMin: 2 });
    const post = () =>
      fetch(`${base}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: TWO_CAUSE }),
      });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    const third = await post();
    expect(third.status).toBe(429);
    expect((await third.json()).error.type).toBe('rate_limited');
  });
});
