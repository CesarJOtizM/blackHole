# Proposal: Invoicing Portal

## Intent

Customers must get an electronic invoice in their own name without the cashier typing anything, and nobody may learn another person's data by typing an ID number (PRD-00 6.1.1, PRD-M3 HU-M3-02/04, TRD-00 8.5, Ley 1581).

## Scope

### In Scope
- Pre-bill QR (`/d/<token>`) and receipt/invoice QR (`/f/<reference_code>`); tokens signed in the cloud by the operation owner.
- DIAN autocomplete (name and email only), shown masked; manual fallback; NIT check digit, email and DANE municipality validation.
- "Remember my data" per company with a one-time code to the holder's email or phone.
- Ley 1581 consent and deletion requests.
- "Data received" flag at the cash register; cashier decides on conflicts.
- Invoice status lookup (in process / issued with PDF).
- Re-invoicing: credit note then new invoice, within the company window, always approved by a holder of sale.credit-note.

### Out of Scope
- QR table ordering → 1.12; QR table payment → 1.13.
- Portal links for delivery and reservations → 3.1, 3.6; invoice by WhatsApp → 5.1.
- Portal-capture and re-invoicing metrics → 1.11; accountant monthly summary → 4.2.

## Capabilities

### New Capabilities
- `invoicing-portal`: customer billing data self-service, masked autocomplete, remembered data with one-time code, consent, invoice lookup, re-invoicing.

### Modified Capabilities
None

## Approach

The portal runs only in api-cloud (`apps/customer-portal`), never on the node (TRD-00 10.1.2). Factus lookups share the per-NIT limiter, issuance first (TRD-M3 sec. 1). Re-invoicing reuses the 1.5 credit-note path.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/invoicing/domain`, `contexts/invoicing/application` | New | Billing data, consent, one-time code, re-invoicing |
| `contexts/invoicing/adapters/factus` | Modified | Acquirer lookup |
| `apps/customer-portal` | New | Mobile-first public portal |
| `apps/api-cloud` | Modified | Portal endpoints |
| `shared/contracts` | Modified | Billing-data schemas |
| `apps/venue-app`, `apps/admin-web` | Modified | Register flag; re-invoicing window |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ID enumeration through the portal | High | Masking, token-only lookups, rate limit per token and IP |
| Lookups starve issuance quota | Med | Shared limiter, issuance priority, per-company cache |
| `/f/` uses a time-ordered UUIDv7 | Med | Design must confirm unguessability or add a signed suffix |
| Credit note of a re-invoice | Low | Administration approves it; once approved, it is issued (D-42) |
| One-time code delivery depends on Twilio | Med | Port with a pluggable sender. Twilio is the production adapter (D-48). Tests use an in-memory sender |

## Rollback Plan

A per-company flag hides portal QR codes; pre-bills print without QR and cashiers enter data as in 1.5. Re-invoicing is disabled by setting the window to off. Stored consents and invoice-backing data are kept (legal retention).

## Dependencies

- p1-05, p1-06, p1-02, p1-03, p0-05, p0-06.
- Re-invoicing rules are D-11. Administration approves the credit note and then it is issued (D-42). `GET /v2/dian/acquirer` does not consume documents (D-21). Email, SMS and WhatsApp go through Twilio (D-48). The domain generates the one-time code. Twilio Verify is not used.

## Success Criteria

- [ ] Invoices in the customer's name are issued without typing data at the cash register, and nobody sees another person's data just by typing their ID number.
- [ ] Re-invoicing outside the window never calls Factus.
