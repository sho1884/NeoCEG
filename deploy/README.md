# NeoCEG API deployment / NeoCEG API デプロイ

Serve mode (`neoceg serve`, CLI spec §7) is containerized and co-located behind
the shared reverse proxy alongside the sibling demo APIs (`/nswitch`, `/pict`),
reached at the `/neoceg` prefix. Public, no auth — protected by the in-process
guardrails (§7.6), not an identity gate.

serve モード（`neoceg serve`・CLI 仕様 §7）をコンテナ化し、姉妹デモ API（`/nswitch`・
`/pict`）と同居する形で共有リバースプロキシ背後に配置、`/neoceg` プレフィックスで到達する。
公開・無認証で、守りはインプロセスのガードレール（§7.6）。

## Pieces / 構成

| File | Role |
|---|---|
| [`../Dockerfile`](../Dockerfile) | The `neoceg-api` image: `node:20-alpine`, runs `neoceg serve` on `0.0.0.0:8091`, non-root. |
| [`neoceg-api.compose.yml`](neoceg-api.compose.yml) | Reference compose service, merged into the shared box's **server-only** `docker-compose.override.yml` (built from `/opt/neoceg`). |
| ModelLogue `deploy/Caddyfile` | The `handle_path /neoceg/*` rule that proxies to `neoceg-api:8091`. |

## Local check / ローカル確認

```bash
docker build -t neoceg/neoceg-api .
docker run --rm -p 8091:8091 -e NEOCEG_ALLOWED_ORIGIN='*' neoceg/neoceg-api
curl -sS http://localhost:8091/health           # {"status":"ok","version":"..."}
```

## On the shared box / 共有ボックス

1. `rsync` the NeoCEG source to `/opt/neoceg`.
2. Merge [`neoceg-api.compose.yml`](neoceg-api.compose.yml) into the server-only
   `docker-compose.override.yml`.
3. Ensure the ModelLogue `deploy/Caddyfile` has the `/neoceg/*` route (added in
   this change).
4. Rebuild the stack: `docker compose ... up -d --build`.

Reached at `https://<shared-box>/neoceg` — same pattern as `/nswitch` and
`/pict`. See CLI spec §7.8. / 到達は `https://<共有ボックス>/neoceg`。§7.8 参照。

## Config / 設定 (env)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8091` (`--port`) | Listen port; overrides `--port` when the host injects it. |
| `NEOCEG_ALLOWED_ORIGIN` | `*` | CORS allow-origin; set to the GUI origin in production. |
| `NEOCEG_MAX_BODY_BYTES` | `2097152` | Request body cap → `413`. |
| `NEOCEG_RATE_LIMIT_PER_MIN` | `60` | Per-IP `/generate` rate limit (`0` = off) → `429`. |
| `NEOCEG_MAX_NODES` | `512` | Max nodes in the parsed model (`0` = off) → `422` (pre-flight compute-DoS guard). |
| `NEOCEG_MAX_CAUSES` | `64` | Max cause nodes in the parsed model (`0` = off) → `422`; primary compute bound. |
