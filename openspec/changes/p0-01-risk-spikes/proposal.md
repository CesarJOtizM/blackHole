# Proposal: Risk Spikes

## Intent

The cloud MVP (D-37) needs one spike before the salon prints: ESC/POS with cash drawer, sent through the cloud print bridge (TRD-00 §7). The dedicated router and 4G modem are a recommendation the owner buys (D-36). This change runs that disposable experiment and produces one decision report.

Local HTTPS (PA-29, ADR-003), locked-phone alerts without internet (PA-30) and SQLite at peak hour stay in the product. They are specified below as deferred and start in the hybrid phase, after the cloud product operates.

## Scope

### In Scope
- ESC/POS spike on the pilot printers, 80 and 58 mm, network and USB, with cash drawer kick, from the bridge profile.
- Decision report for that spike. ADR-006 and ADR-008 are already decided (D-36).

### Out of Scope
- Local HTTPS, locked-phone offline alerts and SQLite peak load → hybrid phase (D-37, PA-29, PA-30).
- Production node, sync and outbox → hybrid phase.
- Device registration and node protection → 0.4 for devices; node protection is hybrid phase.
- Print templates, queue and backup printer → 1.6.
- "Ready" alerts as a feature → 1.2.
- Buying the recommended router and 4G modem: the owner does it (D-36).

## Capabilities

### New Capabilities
- `risk-spikes`: what the Phase 0 decision report must establish for each spike.

### Modified Capabilities
None

## Approach

Throwaway prototype outside the bounded contexts, with a written hypothesis, setup, measurement and decision. The printing result feeds TRD-00 and the printing docs before 1.6 starts (roadmap cycle: master first). ADR-003 is not decided here.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `tools/spikes/` (planned) | New | Disposable prototypes; never imported by `contexts/` or `apps/` |
| `docs/adr/ADR-003-*.md` | None in this change | Written in the hybrid phase (PA-29). ADR-006 and ADR-008 are already D-36 |
| `apps/local-node` | None | Not modified; the prototype only borrows the bridge profile |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pilot printers unavailable for the test | Med | Schedule with the technical visit |
| The bridge cannot reach a network printer | Med | Record USB as the fallback and name the documents to update |

## Rollback Plan

Spike code is deleted or left unreferenced under `tools/spikes/`; no production path depends on it. If a decision is reversed, the ADR is superseded by a new one.

## Dependencies

- Access to one pilot site, its router and printers.

## Success Criteria

- [ ] ESC/POS printing and drawer opening proven on every pilot printer model, from a cloud job through the bridge.
- [ ] The report records whether an unregistered device on the shared Wi-Fi can reach the printer port (D-36).
- [ ] ADR-003, locked-phone alerts and the SQLite peak test stay out of this change.
