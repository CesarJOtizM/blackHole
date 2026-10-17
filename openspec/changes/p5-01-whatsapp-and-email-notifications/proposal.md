# Proposal: WhatsApp and Email Notifications

## Intent

Alerts and customer messages today reach only in-app screens and Web Push. PRD-00 marks WhatsApp and email as a later phase for shortage alerts (sec. 6, M4), reservation confirmation and reminders (M9), and invoice delivery (TRD-00 sec. 8.2 "Correo"). Bag balance alerts (TRD-00 sec. 8.2) need the same channels.

## Scope

### In Scope
- WhatsApp and email channel adapters behind the M0 notifier.
- Per-site configuration by notification type: channels, recipient roles, quiet fallback.
- Staff alerts: shortage alerts (all levels and escalation) and bag balance alerts (yellow, red, critical).
- Customer messages: reservation confirmation and reminder; invoice delivery by WhatsApp once validated.
- Customer consent and opt-out (Ley 1581), delivery status and retries.

### Out of Scope
- SMS (PRD-00 M9 lists it; roadmap 5.1 does not) — open question.
- Card terminals, reservation gateway (→ 5.2, 5.3).
- Marketing or loyalty messages (PRD-00 out of scope).

## Capabilities

### New Capabilities
- `notifications`: channel configuration per site and type, WhatsApp/email delivery, consent, idempotency and retries.

### Modified Capabilities
None

## Approach

Add `WhatsAppChannel` and `EmailChannel` adapters to the M0 notifier port (c4-m0). Producers (M4, M7, M9, M3) keep emitting their events; a cloud worker resolves recipients from site configuration and sends. In-app/Web Push stay as the base channel. Delivery is idempotent per event, recipient and channel.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/application` | Modified | Notification routing and preferences |
| `contexts/platform/adapters/whatsapp` | New | WhatsApp provider adapter |
| `contexts/platform/adapters/email` | New | Email provider adapter |
| `contexts/invoicing/application` | Modified | Invoice-validated message trigger |
| `contexts/reservations/application` | Modified | Confirmation and reminder triggers |
| `shared/contracts` | Modified | Notification events and preferences schemas |
| `apps/api-cloud`, `apps/web-admin` | Modified | Sender worker, configuration screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| WhatsApp provider templates/cost not chosen | High | Port + in-memory adapter; provider ADR before build |
| Stale messages after a hybrid outage | Med | Time-bound types (reminders) expire instead of sending late |
| Messaging without consent | Med | Customer channel requires recorded consent |
| PRD-00 includes SMS; roadmap does not | Low | SMS excluded; noted as open question |

## Rollback Plan

Disable external channels per site; the notifier falls back to in-app and Web Push only. No producer event changes, so removal has no business impact.

## Dependencies

- WhatsApp Business provider and email provider; 2.8 shortage alerts, 1.5 bag alerts, 3.6 reservations.

## Success Criteria

- [ ] Notices arrive through the channel configured at each site.
- [ ] A duplicated event sends one message per recipient and channel.
- [ ] A customer who opted out receives nothing on that channel.
- [ ] Integration operates in at least 1 site (PRD-00 sec. 11 phase 5).
