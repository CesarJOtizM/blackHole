# Proposal: Platform Reconciliation

## Intent

Platforms pay the restaurant later, net of commissions and fees, and nobody checks whether the payout matches. This change records channel commissions, imports settlements, flags differences and shows net sales and profitability per channel (PRD-M5 HU-M5-04, PRD-00 M5, TRD-00 sec. 6.1, TRD-M5).

## Scope

### In Scope
- Commission per channel: percentage and fixed fees, with validity; snapshot on each accepted order
- Platform receivable ledger per channel and period
- Settlement import by file or by API when the connector supports it; once per period and channel
- Expected vs settled comparison, flagged differences and alerts
- Differences marked, never edited; audited reconciliation close
- Net sales per channel and profitability vs theoretical dish cost

### Out of Scope
- Platform commission invoices stay outside this system (D-13). The reconciliation shows gross sales, commission, withholdings and net.
- Channel reports and dashboards → 3.9; consolidated view → 4.1

## Capabilities

### New Capabilities
- `platform-reconciliation`: commissions, receivables, settlement import, differences, channel profitability

### Modified Capabilities
None

## Approach

Cloud-only use cases in `contexts/delivery`: `Settlement` entity unique per (channel, period), `ChannelCommission` value object copied into each order at acceptance. Import stores the original file in object storage, compares per order and emits `SettlementDifference` events. Profitability reads theoretical cost from `inventory`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/delivery/domain` | Modified | Settlement, ChannelCommission |
| `contexts/delivery/adapters/{rappi,didi-food,integrator}` | Modified | Settlement retrieval where supported |
| `contexts/cash-register` | Modified | Receivable settlement |
| `shared/contracts` | Modified | Settlement schemas, difference events |
| `apps/api-cloud` | Modified | Import worker, object storage |
| `apps/admin-web` | Modified | Commission setup, reconciliation screen |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Settlement file formats vary per platform | High | Per-adapter parsers behind one schema |
| Commission edited after orders | Med | Snapshot per order |
| Matching fails for manually captured codes | Med | Unmatched lines flagged, not dropped |

## Rollback Plan

Disable the reconciliation screen; imported settlements stay read-only. No operational data (orders, shifts) is altered by this change.

## Dependencies

- Hub and connectors (3.2–3.4); recipes with theoretical cost (2.1)
- A real settlement file from the pilot
- Commission invoice stays outside (D-13). Commission figures are venue data loaded when the accounts exist; until then, test data (D-35).

## Success Criteria

- [ ] A real settlement reconciled, with its differences alerted
- [ ] Re-importing the same period does not duplicate
- [ ] Net sales per channel shown against dish cost
