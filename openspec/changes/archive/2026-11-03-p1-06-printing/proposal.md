# Proposal: Printing

## Intent

Every paper the site hands out or uses internally must come out of the pilot's thermal printers reliably, also without internet (PRD-M3 sec. 2 and 6; TRD-00 sec. 7). Browsers cannot speak ESC/POS, so printing needs a server-side queue with retries, backup and audit.

## Scope

### In Scope
- Templates: kitchen ticket, pre-bill, invoice with QR and CUFE, offline sales receipt ("not an invoice", with QR), cash close, transfer, tips settlement; 80 mm and 58 mm.
- Print queue with retries and per-printer status.
- Backup printer per network printer.
- Audited reprint, with the PRD-01 cap for invoices and pre-bills.
- Cash drawer command sent only in cash register jobs to the cash register printer.
- Hybrid: the node prints. Cloud mode: the bridge prints; jobs wait in the cloud if the bridge is off.

### Out of Scope
- Authorization of drawer opening without sale and reprint over cap → 1.7.
- Invoicing portal QR on pre-bill and receipt → 1.8.
- Real transfer data → 2.5; real tips settlement data → 1.10.

## Capabilities

### New Capabilities
- `printing`: templates, widths, queue, retries, printer status, backup printer, audited reprint, cash drawer.

### Modified Capabilities
None

## Approach

`shared/printing` implements the `Printer` port: templates plus ESC/POS driver over TCP 9100 or USB (TRD-M3 sec. 1, 5). Contexts (`orders`, `cash-register`, `invoicing`) send typed print jobs; template data contracts live in `shared/contracts`. No business rule lives in `shared/printing`. Uses the ESC/POS spike results from 0.1.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `shared/printing` | New/Modified | Templates, queue, driver, backup routing |
| `shared/contracts` | Modified | Print job and template data schemas |
| `contexts/orders/application` | Modified | Kitchen ticket and pre-bill jobs |
| `contexts/cash-register/application` | Modified | Close report, drawer jobs |
| `contexts/invoicing/application` | Modified | Invoice, receipt, reprint |
| `apps/local-node` (node and bridge profile) | Modified | Print queue host |
| `apps/api-cloud` | Modified | Waiting jobs for an off bridge |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Printer model quirks (codepage, QR support) | Med | Contract tests on each pilot model in 80 and 58 mm |
| Bridge off in cloud mode | Med | Jobs wait in cloud; screen warns |
| Silent print loss | Low | Job status visible until printed or failed |

## Rollback Plan

Revert to the minimal kitchen-ticket output from 1.2 and disable the new templates per site by flag. Print jobs are transient; the audit of reprints is append-only and kept.

## Dependencies

- 0.1 ESC/POS spike; 1.2, 1.3, 1.5 job producers; 0.4 registered devices; 0.6 audit; pilot printers on site. Offline receipt text is D-10.

## Success Criteria

- [ ] All templates print correctly on the pilot's real printers, in 80 and 58 mm.
- [ ] A failing primary printer falls back to its backup without losing the job.
- [ ] Every reprint appears in the audit.
