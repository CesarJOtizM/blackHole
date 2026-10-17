# Proposal: Consolidated Reports

## Intent

The general manager needs one company-wide view across all sites, menu engineering and unusual-behavior alerts, without reading the audit trail line by line (PRD-M6 HU-M6-02, HU-M6-03; PRD-00 sec. 8).

## Scope

### In Scope
- Company, brand and site consolidated view over synced projections, with lagging sites flagged.
- Percentiles (average, p50, p90) by site, brand, product, kitchen station, person, time slot and weekday.
- Menu engineering: popularity × margin per dish, using M4 theoretical cost.
- Cloud behavior detectors (voids, discounts, no-sale drawer, repeated pairs, self-authorization) using PRD-01 sec. 11 thresholds.

### Out of Scope
- Monthly invoice summary, tax reports and accounting exports → 4.2.
- WhatsApp/email delivery of alerts → 5.1.
- Separate analytics database (TRD-00 sec. 11) — only if volume demands it.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `reporting`: adds consolidated multi-site view, percentile dimensions, menu engineering and cloud behavior detectors.

## Approach

Extend cloud projections built from the inbox (TRD-M6 sec. 4: `ProjectFacts`, `QueryConsolidatedReport`, `DetectPatterns`). Metric definitions stay pure in `contexts/reporting/domain` so node and cloud compute identical numbers. Materialized views first; detectors run as cloud workers and notify through the M0 notifier. Every query filters by role scope (TRD-M6 sec. 8).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reporting/domain` | Modified | Percentile, menu-engineering and detector rules |
| `contexts/reporting/application` | Modified | Consolidated query, detector use case |
| `contexts/reporting/adapters/postgres` | Modified | Fact tables, materialized views |
| `shared/contracts` | Modified | Filter and alert schemas |
| `apps/api-cloud` | Modified | Admin HTTP routes, detector workers |
| `apps/admin-web` | Modified | Consolidated and menu-engineering screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Phase 1 events lack a timestamp needed for a metric | Med | Metric reports "not available"; never invents a value |
| Projection volume across 6 sites | Med | Materialized views; read replica only with evidence (TRD-01 sec. 6) |
| Detector thresholds not agreed (PRD-01 sec. 13) | Med | Thresholds are configuration; defaults documented |
| Overlap with 1.7 anti-theft day indicators | Low | 1.7 owns on-site controls; this change owns cloud detectors |

## Rollback Plan

Feature-flag the consolidated routes and detector workers per tenant. Disable the workers and drop the new materialized views; site-level reports from 1.11 remain intact because no operational table is written.

## Dependencies

- 1.11, 2.10 and 3.9 projections; 0.6 audit events; 1.7 thresholds; M4 costs (2.1).

## Success Criteria

- [ ] The general manager sees the 6 sites consolidated.
- [ ] A hybrid site offline for 2 hours appears complete after syncing, with zero duplicates.
- [ ] A lagging site is shown as lagging, never as zero sales.
- [ ] A repeated void pattern raises one alert that points to its events and writes nothing in M1/M2.
