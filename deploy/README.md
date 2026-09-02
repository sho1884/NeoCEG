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

## First install on the shared box / 共有ボックスへの初回設置

1. `rsync` the NeoCEG source to `/opt/neoceg` (outside `/opt/modellogue`, which
   ModelLogue's `deploy.sh` rsyncs with `--delete`).
2. Merge [`neoceg-api.compose.yml`](neoceg-api.compose.yml) into the server-only
   `docker-compose.override.yml`.
3. Ensure the ModelLogue `deploy/Caddyfile` has the `/neoceg/*` route.
4. Rebuild the stack: `docker compose ... up -d --build`.

Reached at `https://<shared-box>/neoceg` — same pattern as `/nswitch` and
`/pict`. See CLI spec §7.8. / 到達は `https://<共有ボックス>/neoceg`。§7.8 参照。

## Updating a deployed instance / 稼働中インスタンスの更新

ModelLogue's `./deploy/deploy.sh` does **not** touch `/opt/neoceg`; updating the
API is a separate operation. Server coordinates (`SERVER`, `SSH_KEY`) live in
ModelLogue's untracked `deploy/server.local.sh` — read them from there rather
than hardcoding an address. /
ModelLogue の `./deploy/deploy.sh` は `/opt/neoceg` を**触りません**。API の更新は
別操作です。接続情報は ModelLogue の非追跡 `deploy/server.local.sh` にあります。

```bash
source ~/development/ModelLogue/deploy/server.local.sh
cd <NeoCEG repo root>

# 1) Preview first: --dry-run shows exactly what would be sent and deleted.
rsync -az --delete --dry-run --itemize-changes \
  --exclude=node_modules --exclude=dist --exclude=build --exclude=out \
  --exclude=coverage --exclude=.git --exclude=.github --exclude=.vercel \
  --exclude=.claude --exclude=.idea --exclude=.vscode --exclude='*.log' \
  --exclude=tmp --exclude=temp --exclude=Doc --exclude=public-files \
  --exclude='.env*' --exclude='*.pem' --exclude='*.key' --exclude=.DS_Store \
  -e "ssh -i $SSH_KEY" ./ "$SERVER:/opt/neoceg/"

# 2) Same command without --dry-run to sync.

# 3) Rebuild this service only; the rest of the stack keeps running.
ssh -i "$SSH_KEY" "$SERVER" 'cd /opt/modellogue && docker compose \
  -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.yml \
  up -d --build neoceg-api'

# 4) Verify.
curl -sS https://modellogue.com/neoceg/health
```

**Why `rsync --delete` and not `tar` + `rm -rf`**: the earlier note described
replacing the directory with `rm -rf neoceg` on the server. `rsync` reaches the
same state without a destructive command, touches nothing outside the
destination path, and can be previewed with `--dry-run` before anything moves. /
以前は `tar` ＋ サーバ側 `rm -rf` で置き換える手順だった。`rsync` は破壊的コマンドを
使わずに同じ状態にでき、宛先パス以外に触れず、`--dry-run` で事前確認できる。

**Why the exclude list mirrors [`.dockerignore`](../.dockerignore)**: the image
build then sees the same tree locally and on the box, so a build cannot differ
between them. `.env*` and key files are excluded on top of that — they belong to
neither the image nor a public demo host. /
除外を `.dockerignore` に揃えると、手元とサーバでイメージのビルド対象が同一になる。
その上に `.env*` と鍵ファイルを追加除外する（イメージにも公開デモ機にも不要）。

Before rebuilding, check that `/opt/neoceg` holds nothing outside the repository
(a server-side `.env`, for instance) — `--delete` would remove it. /
再ビルド前に `/opt/neoceg` にリポジトリ由来でないファイルが無いか確認する
（サーバ側 `.env` など）。`--delete` で消える。

The rebuild takes `/neoceg` down briefly (a few hundred milliseconds to seconds);
other prefixes and containers are unaffected. /
再ビルド中は `/neoceg` のみ短時間停止する。他のプレフィックス・コンテナは影響を受けない。

## Config / 設定 (env)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8091` (`--port`) | Listen port; overrides `--port` when the host injects it. |
| `NEOCEG_ALLOWED_ORIGIN` | `*` | CORS allow-origin; set to the GUI origin in production. |
| `NEOCEG_MAX_BODY_BYTES` | `2097152` | Request body cap → `413`. |
| `NEOCEG_RATE_LIMIT_PER_MIN` | `60` | Per-IP `/generate` rate limit (`0` = off) → `429`. |
| `NEOCEG_MAX_NODES` | `512` | Max nodes in the parsed model (`0` = off) → `422` (pre-flight compute-DoS guard). |
| `NEOCEG_MAX_CAUSES` | `64` | Max cause nodes in the parsed model (`0` = off) → `422`; primary compute bound. |
