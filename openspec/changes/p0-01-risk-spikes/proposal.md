# Proposal: Risk Spikes

## Intent

Five technical unknowns can invalidate the hybrid design before any feature is built: local HTTPS for the site PWA (ADR-003, TRD-00 5.4), the per-site hardware kit and dedicated router (ADR-006, TRD-00 10.1.2), waiter alerts on a locked phone without internet (TRD-M1 risks), ESC/POS printing with cash drawer (TRD-00 7) and SQLite at peak hour (TRD-00 17). This change runs disposable experiments and produces one decision report.

## Scope

### In Scope
- Local HTTPS spike on an Android mid-range phone, an iPhone (iOS 16.4+), a mini PC and a real site router, including certificate renewal.
- Locked-phone, no-internet alert spike on both platforms.
- ESC/POS spike on the pilot printers, 80 and 58 mm, network and USB, with cash drawer kick.
- SQLite WAL peak-hour load test of a minimal node API.
- Decision report; ADR-003 and ADR-006 written as decided.

### Out of Scope
- Production node, sync and outbox → 0.2.
- Device registration and node protection → 0.4.
- Print templates, queue and backup printer → 1.6.
- "Ready" alerts as a feature → 1.2.
- 4G modem choice (ADR-008) → 0.7.

## Capabilities

### New Capabilities
- `risk-spikes`: what the Phase 0 decision report must establish for each spike.

### Modified Capabilities
None

## Approach

Throwaway prototypes outside the bounded contexts, each with a written hypothesis, setup, measurement and decision. Option A of ADR-003 is tested first; options B/C only if A fails. Results feed TRD-00 and module docs before 0.2 starts (roadmap cycle: master first).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `tools/spikes/` (planned) | New | Disposable prototypes; never imported by `contexts/` or `apps/` |
| `docs/adr/ADR-003-*.md`, `docs/adr/ADR-006-*.md` | New (by owner) | Decisions written after the report |
| `apps/local-node` | None | Not modified; prototypes only borrow its stack |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Option A fails on iPhone or pilot routers | Med | Pre-agreed fallback B/C; report lists impacted docs |
| No offline push on locked iPhone: Web Push needs FCM/APNs | High | Report must define an accepted fallback |
| Pilot printers unavailable for the test | Med | Schedule with technical visit |

## Rollback Plan

Spike code is deleted or left unreferenced under `tools/spikes/`; no production path depends on it. If a decision is reversed, the ADR is superseded by a new one.

## Dependencies

- Access to one pilot site, its router and printers; Android and iPhone devices; a Cloudflare zone for DNS-01.

## Success Criteria

- [ ] A report with the decisions of ADR-003 and ADR-006, and the solution for alerts with the phone locked.
- [ ] ESC/POS printing and drawer opening proven on every pilot printer model.
- [ ] SQLite peak-hour result recorded against node API p95 < 200 ms.
