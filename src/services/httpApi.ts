/**
 * HTTP API for serve mode (`neoceg serve`).
 *
 * Implemented on Node's built-in `http` module only — no runtime dependency
 * beyond the Node standard library (CLI-NF-022, CLI-SR-057). This is a
 * JSON/text transport over the same core the batch CLI uses; it adds no
 * algorithm. Contract: Doc/CLI_Requirements_Specification.md §7.
 */

import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFileSync } from 'node:fs';

import type { LogicalModel } from '../types/logical.js';
import { isCause } from '../types/logical.js';
import type { TestCondition } from '../types/decisionTable.js';
import { parseLogicalDSL } from './logicalDslParser.js';
import {
  generateOptimizedDecisionTableWithState,
  generateLearningModeTable,
  getFeasibleConditions,
  getNodeLabel,
} from './decisionTableCalculator.js';
import { generateCoverageTableFromState } from './coverageTableCalculator.js';
import {
  generateDecisionTableCSV,
  generateCoverageTableCSV,
} from './csvGenerator.js';
import { generateGraphSVG } from './cliSvgGenerator.js';
import {
  sortByY,
  collectWarnings,
  serializeDecisionTable,
  serializeCoverageTable,
} from './apiSerialize.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ServeConfig {
  host: string;
  port: number;
  corsOrigin: string;
  /** Reject a larger request body with 413. */
  maxBodyBytes: number;
  /** Per-IP requests/min on /generate (0 = off) → 429 over the cap. */
  rateLimitPerMin: number;
  /** Max nodes in the parsed model (0 = off) → 422 model_too_large. */
  maxNodes: number;
  /** Max cause nodes in the parsed model (0 = off) → 422 model_too_large. */
  maxCauses: number;
}

export const DEFAULT_SERVE_CONFIG: ServeConfig = {
  host: '127.0.0.1',
  port: 8091,
  corsOrigin: '*',
  maxBodyBytes: 2 * 1024 * 1024,
  rateLimitPerMin: 60,
  maxNodes: 512,
  maxCauses: 64,
};

/**
 * Resolve serve config from CLI flags plus environment overrides (§7.6).
 * Env wins over the flag default only where the caller left the flag unset;
 * callers pass already-parsed flag values, and env fills body/rate limits.
 */
export function resolveServeConfig(flags: Partial<ServeConfig>): ServeConfig {
  const envPort = Number(process.env.PORT);
  const envMaxBody = Number(process.env.NEOCEG_MAX_BODY_BYTES);
  const envRate = Number(process.env.NEOCEG_RATE_LIMIT_PER_MIN);
  const envMaxNodes = Number(process.env.NEOCEG_MAX_NODES);
  const envMaxCauses = Number(process.env.NEOCEG_MAX_CAUSES);
  return {
    host: flags.host ?? DEFAULT_SERVE_CONFIG.host,
    port: flags.port ?? (Number.isFinite(envPort) && envPort > 0 ? envPort : DEFAULT_SERVE_CONFIG.port),
    corsOrigin:
      flags.corsOrigin ?? process.env.NEOCEG_ALLOWED_ORIGIN ?? DEFAULT_SERVE_CONFIG.corsOrigin,
    maxBodyBytes:
      Number.isFinite(envMaxBody) && envMaxBody > 0 ? envMaxBody : DEFAULT_SERVE_CONFIG.maxBodyBytes,
    rateLimitPerMin:
      Number.isFinite(envRate) && envRate >= 0 ? envRate : DEFAULT_SERVE_CONFIG.rateLimitPerMin,
    maxNodes:
      Number.isFinite(envMaxNodes) && envMaxNodes >= 0 ? envMaxNodes : DEFAULT_SERVE_CONFIG.maxNodes,
    maxCauses:
      Number.isFinite(envMaxCauses) && envMaxCauses >= 0 ? envMaxCauses : DEFAULT_SERVE_CONFIG.maxCauses,
  };
}

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

const CT_JSON = 'application/json; charset=utf-8';
const CT_CSV = 'text/csv; charset=utf-8';
const CT_SVG = 'image/svg+xml; charset=utf-8';

// ---------------------------------------------------------------------------
// Result modelling
// ---------------------------------------------------------------------------

export interface ApiResult {
  status: number;
  contentType: string;
  body: string;
}

function jsonResult(payload: object, status = 200): ApiResult {
  return { status, contentType: CT_JSON, body: JSON.stringify(payload) };
}

function errorResult(status: number, type: string, message: string): ApiResult {
  return jsonResult({ error: { type, message } }, status);
}

// ---------------------------------------------------------------------------
// Request processing (pure — unit-testable without sockets)
// ---------------------------------------------------------------------------

type Mode = 'decision-table' | 'all-combinations' | 'coverage' | 'svg';
type Format = 'json' | 'csv' | 'svg';

const MODES: readonly Mode[] = ['decision-table', 'all-combinations', 'coverage', 'svg'];

function hasLayout(model: LogicalModel): boolean {
  return Array.from(model.nodes.values()).some((n) => n.position);
}

/** Model-size limits for the pre-flight compute-DoS guard (CLI-SR-058, §7.6). */
export interface ModelSizeLimits {
  /** Max nodes (0 = off). */
  maxNodes: number;
  /** Max cause nodes (0 = off). */
  maxCauses: number;
}

const DEFAULT_MODEL_SIZE_LIMITS: ModelSizeLimits = {
  maxNodes: DEFAULT_SERVE_CONFIG.maxNodes,
  maxCauses: DEFAULT_SERVE_CONFIG.maxCauses,
};

/**
 * Enforce the model-size cap after parse and before generation (CLI-SR-058).
 * Returns a 422 model_too_large result when a limit is exceeded, else null.
 *
 * This is the primary compute-DoS guard: `calcTable` cost grows super-linearly
 * with model size and, being synchronous, cannot be preempted by a wall-clock
 * timeout — so oversized models are rejected pre-flight (§7.6).
 */
function checkModelSize(model: LogicalModel, limits: ModelSizeLimits): ApiResult | null {
  const nodeCount = model.nodes.size;
  if (limits.maxNodes > 0 && nodeCount > limits.maxNodes) {
    return errorResult(
      422,
      'model_too_large',
      `model has ${nodeCount} nodes, exceeding the limit of ${limits.maxNodes} (NEOCEG_MAX_NODES)`
    );
  }
  let causeCount = 0;
  for (const node of model.nodes.values()) {
    if (isCause(node)) causeCount++;
  }
  if (limits.maxCauses > 0 && causeCount > limits.maxCauses) {
    return errorResult(
      422,
      'model_too_large',
      `model has ${causeCount} cause nodes, exceeding the limit of ${limits.maxCauses} (NEOCEG_MAX_CAUSES)`
    );
  }
  return null;
}

/**
 * Process a POST /generate request body and produce the response.
 * Never throws for expected conditions; any unexpected error maps to 500.
 *
 * `limits` bounds the parsed model size (CLI-SR-058); defaults to the standard
 * serve limits so existing callers and tests keep the same guard.
 */
export function processGenerate(
  body: unknown,
  limits: ModelSizeLimits = DEFAULT_MODEL_SIZE_LIMITS
): ApiResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorResult(400, 'invalid_request', 'request body must be a JSON object');
  }
  const req = body as Record<string, unknown>;

  const source = req.source;
  if (typeof source !== 'string' || source.trim() === '') {
    return errorResult(400, 'invalid_request', '`source` is required and must be a non-empty string');
  }

  const mode = (req.mode ?? 'decision-table') as unknown;
  if (typeof mode !== 'string' || !MODES.includes(mode as Mode)) {
    return errorResult(
      400,
      'invalid_request',
      `\`mode\` must be one of ${MODES.map((m) => `"${m}"`).join(', ')}`
    );
  }
  const resolvedMode = mode as Mode;

  // Resolve + validate format against the mode.
  const format = resolveFormat(resolvedMode, req.format);
  if (format === null) {
    return errorResult(
      400,
      'invalid_request',
      resolvedMode === 'svg'
        ? '`format` for mode "svg" must be "svg" (or omitted)'
        : '`format` must be "json" or "csv" for this mode'
    );
  }

  // Parse — parse failure is a 400 parse_error (batch exit 1 analogue).
  const parsed = parseLogicalDSL(source);
  if (!parsed.success) {
    const detail = parsed.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ');
    return errorResult(400, 'parse_error', detail || 'failed to parse .nceg source');
  }
  const model = parsed.model;

  // Pre-flight compute-DoS guard: reject oversized models before generation.
  const tooLarge = checkModelSize(model, limits);
  if (tooLarge) return tooLarge;

  try {
    return dispatch(resolvedMode, format, model);
  } catch (e) {
    // Unexpected library exception — logged by the caller; generic to client.
    const message = e instanceof Error ? e.message : 'unexpected error';
    return errorResult(500, 'internal_error', `generate failed: ${message}`);
  }
}

/** Resolve the format for a mode, or null if the mode×format pairing is invalid. */
function resolveFormat(mode: Mode, raw: unknown): Format | null {
  if (mode === 'svg') {
    if (raw === undefined || raw === 'svg') return 'svg';
    return null;
  }
  const fmt = raw ?? 'json';
  if (fmt === 'json' || fmt === 'csv') return fmt;
  return null;
}

function dispatch(mode: Mode, format: Format, model: LogicalModel): ApiResult {
  if (mode === 'decision-table') {
    const { table } = generateOptimizedDecisionTableWithState(model);
    if (table.stats.feasibleConditions === 0) {
      return errorResult(422, 'unsatisfiable', 'no feasible rules — all combinations violate constraints');
    }
    const conditions = getFeasibleConditions(table);
    if (format === 'csv') {
      return csvDecisionTable(table, conditions, model);
    }
    return jsonResult(
      serializeDecisionTable(table, conditions, model, 'decision-table', collectWarnings(table, model))
    );
  }

  if (mode === 'all-combinations') {
    const { table } = generateOptimizedDecisionTableWithState(model);
    const learning = generateLearningModeTable(model, table);
    if (!learning) {
      return errorResult(
        422,
        'unsatisfiable',
        `too many causes for all-combinations: 2^${table.causeIds.length} exceeds the 256-column limit`
      );
    }
    if (format === 'csv') {
      return csvDecisionTable(learning, learning.conditions, model);
    }
    return jsonResult(
      serializeDecisionTable(
        learning,
        learning.conditions,
        model,
        'all-combinations',
        collectWarnings(table, model)
      )
    );
  }

  if (mode === 'coverage') {
    const { table, state } = generateOptimizedDecisionTableWithState(model);
    if (table.stats.feasibleConditions === 0) {
      return errorResult(422, 'unsatisfiable', 'no feasible rules — all combinations violate constraints');
    }
    const coverage = generateCoverageTableFromState(model, state);
    if (format === 'csv') {
      return { status: 200, contentType: CT_CSV, body: generateCoverageTableCSV(coverage) };
    }
    return jsonResult(serializeCoverageTable(coverage));
  }

  // mode === 'svg'
  if (!hasLayout(model)) {
    return errorResult(422, 'unsatisfiable', 'SVG output requires @layout coordinates in the .nceg source');
  }
  return { status: 200, contentType: CT_SVG, body: generateGraphSVG(model) };
}

function csvDecisionTable(
  table: Parameters<typeof generateDecisionTableCSV>[0],
  conditions: TestCondition[],
  model: LogicalModel
): ApiResult {
  const nodeLabels = new Map<string, string>();
  for (const id of [...table.causeIds, ...table.intermediateIds, ...table.effectIds]) {
    nodeLabels.set(id, getNodeLabel(model, id));
  }
  const csv = generateDecisionTableCSV(
    table,
    conditions,
    nodeLabels,
    sortByY(table.causeIds, model),
    sortByY(table.intermediateIds, model),
    sortByY(table.effectIds, model)
  );
  return { status: 200, contentType: CT_CSV, body: csv };
}

// ---------------------------------------------------------------------------
// Rate limiting (fixed per-minute window, per client IP)
// ---------------------------------------------------------------------------

interface RateBucket {
  windowStart: number;
  count: number;
}

function makeRateLimiter(perMin: number) {
  const buckets = new Map<string, RateBucket>();
  return function allow(ip: string): boolean {
    if (perMin <= 0) return true;
    const now = Date.now();
    const windowStart = now - (now % 60_000);
    const bucket = buckets.get(ip);
    if (!bucket || bucket.windowStart !== windowStart) {
      buckets.set(ip, { windowStart, count: 1 });
      return true;
    }
    if (bucket.count >= perMin) return false;
    bucket.count += 1;
    return true;
  };
}

function clientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------

function getVersion(): string {
  try {
    // httpApi lives in src/services/, so package.json is two levels up.
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
    );
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function createServer(config: ServeConfig): Server {
  const version = getVersion();
  const allow = makeRateLimiter(config.rateLimitPerMin);

  const cors = (res: ServerResponse): void => {
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };

  const send = (res: ServerResponse, result: ApiResult): void => {
    const buf = Buffer.from(result.body, 'utf-8');
    res.statusCode = result.status;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', String(buf.length));
    cors(res);
    res.end(buf);
  };

  return createHttpServer((req, res) => {
    const method = req.method ?? 'GET';
    const path = (req.url ?? '/').split('?')[0];

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      cors(res);
      res.end();
      return;
    }

    if (path === '/health') {
      if (method !== 'GET') {
        send(res, errorResult(405, 'method_not_allowed', `use GET for ${path}`));
        return;
      }
      send(res, jsonResult({ status: 'ok', version }));
      return;
    }

    if (path === '/generate') {
      if (method !== 'POST') {
        send(res, errorResult(405, 'method_not_allowed', `use POST for ${path}`));
        return;
      }
      if (!allow(clientIp(req))) {
        send(res, errorResult(429, 'rate_limited', 'per-IP request rate limit exceeded; retry shortly'));
        return;
      }
      readBody(req, config.maxBodyBytes)
        .then((raw) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            send(res, errorResult(400, 'invalid_request', 'request body is not valid JSON'));
            return;
          }
          send(res, processGenerate(parsed, { maxNodes: config.maxNodes, maxCauses: config.maxCauses }));
        })
        .catch((err: Error) => {
          if (err.message === 'body_too_large') {
            send(
              res,
              errorResult(413, 'payload_too_large', `request body exceeds ${config.maxBodyBytes} bytes`)
            );
          } else {
            send(res, errorResult(400, 'invalid_request', 'could not read request body'));
          }
        });
      return;
    }

    send(res, errorResult(404, 'not_found', `no endpoint at ${path}`));
  });
}

/** Read the request body, rejecting with `body_too_large` past the cap. */
function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      size += chunk.length;
      if (size > maxBytes) {
        // Stop accumulating and pause the stream. We do NOT destroy the socket
        // here: the caller still needs to write a 413 response on it. Node sets
        // `Connection: close` automatically because the request is left
        // unconsumed, so the socket is torn down after the response flushes.
        aborted = true;
        req.pause();
        reject(new Error('body_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', (e) => {
      if (!aborted) reject(e);
    });
  });
}

/** Start the server and log to stderr (stdout stays clean, CLI-SR-033). */
export function runServe(config: ServeConfig): void {
  const server = createServer(config);
  server.listen(config.port, config.host, () => {
    process.stderr.write(
      `neoceg ${getVersion()} serving on http://${config.host}:${config.port}\n`
    );
    process.stderr.write(`CORS Access-Control-Allow-Origin: ${config.corsOrigin}\n`);
  });
}
