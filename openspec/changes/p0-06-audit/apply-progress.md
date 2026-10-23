# Apply progress: p0-06-audit

**Change**: p0-06-audit
**Mode**: Standard (strict_tdd false). RED then GREEN was still followed for every task, per ADR-017.
**Delivery**: feature-branch-chain, all four work units implemented in this worktree. No commit, no push, no pull request.
**Tasks**: 16/16 checked.

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|----------------------------------|-----------------|-------------------|
| 1 Device chain | RED `pnpm vitest run --project platform domain/audit` exit 1. Cannot find module `#domain/audit.js`. 1 failed suite, no tests. GREEN same command exit 0. 1 file, 6 tests passed. | N/A: pure domain | `contexts/platform/domain/audit.ts`, `audit.test.ts`, `domain/index.ts` export |
| 2 Record, verify, read, memory | RED `pnpm vitest run --project platform record-audit-event verify-device-chain read-audit in-memory-audit` exit 1. 4 failed suites, missing modules, no tests. GREEN same command exit 0. 4 files, 16 tests passed. | N/A: memory ports | use-case folders, ports, `audit-chain.ts`, memory adapter, import keys |
| 3 SHA-256 and Postgres | RED `pnpm vitest run --project platform sha256-audit-digest drizzle-audit` exit 1. 2 failed suites, missing modules, no tests. GREEN same command exit 0. 2 files, 8 tests passed. | N/A: PGlite, no listen | `contexts/platform/adapters/postgres/0007_audit.sql`, drizzle repository, schema table, digest adapter |
| 4 Entry port and GET /audit | RED `pnpm vitest run --project api-cloud read-audit` exit 1. 5 failed, 1 passed. GET returned 404 before the route existed. POST, PUT, and DELETE were already 404. GREEN same command exit 0. 1 file, 6 tests passed. Inject only. No listen. | N/A: `inject`, no `listen` | controller, `shared/contracts/audit.ts`, entry-port export, module wiring |

Post-format confirmation:

- `pnpm vitest run --project platform domain/audit record-audit-event verify-device-chain read-audit in-memory-audit sha256-audit-digest drizzle-audit` exit 0. 7 files, 30 tests passed.
- `pnpm vitest run --project api-cloud test/composition/bootstrap.test.ts` exit 0. 1 file, 3 tests passed, after the provider list included `AuditRepository`.
- `pnpm typecheck` exit 0.
- `pnpm architecture` exit 0. No dependency violations (254 modules, 635 dependencies). The TypeScript 7 transpiler warning is the existing cruiser notice.

## Completed tasks

- [x] 1.1–1.2 domain chain
- [x] 2.1–2.8 use cases, ports, memory
- [x] 3.1–3.4 SHA-256 and Postgres
- [x] 4.1–4.2 contract, GET /audit, entry port

## Deviations

- Migration file is `contexts/platform/adapters/postgres/0007_audit.sql`. `0006` was not created. `0001` through `0005` were not edited.
- `list(tenantId, deviceId)` accepts `null` for the device so a company read can use the same append/list port.
- `application/audit-chain.ts` is shared by record and verify so a finding is appended once and does not extend the device chain.
- The entry port also exports `ReadAudit` and `AuditReadDenied`. The controller calls the use case through that package boundary.
- `ReadAudit` calls `evaluate` for the caller's assignments. `evaluateFor` walks every covering assignment and throws on the prose `auditor` role.
- `audits` is optional on the cloud module and defaults to an empty in-memory repository.
- `GET /audit` takes `tenantId` and optional `siteId` as query parameters, with `x-session-id`. There is no POST, PUT, or DELETE.
- The repository contract checks the concrete prototype for `append` and `list`. Abstract methods are erased, so they are not on `AuditRepository.prototype`.
- The digest test forbids structural whitespace (`: `, `, `, newlines). Spaces inside string values, such as a reason, remain.

## Out of scope left undone

No SQLite chain, no local-node binding, no email. PA-41 stays open.
