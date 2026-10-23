# Tasks: Audit

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1600–2400 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Cloud slice. RED then GREEN (ADR-017). Titles: given / when / then. Package `imports` only. `strict_tdd` stays false. Threat matrix N/A: no threat RED task. Split `ReadAudit` or the digest if that unit exceeds 400 lines.

### Suggested Work Units

PR 1 base = tracker `p0-06-audit`. PR 2 base = PR 1. PR 3 base = PR 2. PR 4 base = PR 3.

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Device chain | 1, base tracker | `pnpm vitest run --project platform domain/audit` | N/A: pure domain | `domain/audit.ts`, its test, index export |
| 2 | Record, verify, read, memory | 2, base PR 1 | `pnpm vitest run --project platform record-audit-event verify-device-chain read-audit in-memory-audit` | N/A: memory ports | use-case folders, ports, memory adapter, import keys |
| 3 | SHA-256 and Postgres | 3, base PR 2 | `pnpm vitest run --project platform sha256-audit-digest drizzle-audit` | N/A: PGlite | next `NNNN_*.sql`, drizzle repo, audit tables, digest |
| 4 | Entry port and GET /audit | 4, base PR 3 | `pnpm vitest run --project api-cloud read-audit` | N/A: `inject`, no `listen` | controller, audit contract, entry-port export, module wiring |

## Phase 1: Domain chain

- [x] 1.1 RED `contexts/platform/domain/audit.test.ts`: missing actor; three links, one device; two devices independent; altered digest; sequence gap. Genesis: sequence 1, 64 zero hex digits. No `node:crypto`.
- [x] 1.2 GREEN `domain/audit.ts`: `DeviceChain` per company and device, `MissingActor`. Export `domain/index.ts` via `#domain/*`. No digest here.

## Phase 2: Use cases and memory

- [x] 2.1 RED `application/record-audit-event/record-audit-event.test.ts`: server `Clock`; missing actor rejected; broken tail appends a finding and does not extend the chain. `AuditDigest` double.
- [x] 2.2 GREEN `record-audit-event.ts`, `ports/audit-digest.ts`. Append only. No `node:crypto`. `#application/record-audit-event/*`.
- [x] 2.3 RED `application/verify-device-chain/verify-device-chain.test.ts`: re-read stored rows; bad digest or previous hash appends `altered`; missing sequence appends `deleted`; same device, sequence, and kind once.
- [x] 2.4 GREEN `verify-device-chain.ts`. No delete or dismiss. A finding stays; a later note is a new audit event.
- [x] 2.5 RED `application/read-audit/read-audit.test.ts`: owner, general manager, and `auditor` read the company (no write); site 1 admin denied for site 2; cashier denied. `audit.view`. `with_limit` is the site filter.
- [x] 2.6 GREEN `read-audit.ts`.
- [x] 2.7 RED `ports/audit-repository.contract.ts` and `adapters/memory/in-memory-audit-repository.contract.test.ts`: `append` and `list` only; round-trip; hidden tenant.
- [x] 2.8 GREEN `in-memory-audit-repository.ts`. Add the three `#application/.../*` keys to `contexts/platform/package.json`.

## Phase 3: Digest and Postgres

- [x] 3.1 RED `adapters/crypto/sha256-audit-digest.test.ts`: sorted-key UTF-8 JSON, no whitespace, includes `previousHash`, SHA-256 hex.
- [x] 3.2 GREEN `sha256-audit-digest.ts` via `#adapters/crypto/*`. Domain does not import `node:crypto`.
- [x] 3.3 RED `adapters/postgres/drizzle-audit-repository.contract.test.ts` on PGlite: `audit_app` SELECT and INSERT; trigger rejects UPDATE and DELETE; forced RLS on `app.tenant_id`; hidden tenant; round-trip. No Drizzle mock. Use the next unused `NNNN_*.sql` in `contexts/platform/adapters/postgres` at apply time. Do not edit `0001` through `0005`. Do not use `0006`; pin-lock may add `0006_pin_lock.sql`.
- [x] 3.4 GREEN that `NNNN_*.sql`, `schema.ts`, `drizzle-audit-repository.ts`. `append` sets `audit_app` and `app.tenant_id`. `#adapters/postgres/*`.

## Phase 4: Entry port and HTTP

- [x] 4.1 RED `apps/api-cloud/test/http/read-audit.controller.test.ts`: `inject` `GET /audit` with `x-session-id` returns 200 for owner, auditor, and own site; 403 for the other site and a cashier. No POST, PUT, or DELETE. No `listen`.
- [x] 4.2 GREEN `shared/contracts/audit.ts` (`z.json()` for before and after, `#contracts/*`); `src/http/read-audit.controller.ts` (`#src/http/*`); `composition/application-module.ts`; `entry-port.ts` exports `RecordAuditEvent`. Read uses `audit.view`. No public record or verify route.

## Out of scope

No tasks for the SQLite chain, local-node binding, offline append, node-batch verification, or the SQLite contract suite. PA-41 does not block.
