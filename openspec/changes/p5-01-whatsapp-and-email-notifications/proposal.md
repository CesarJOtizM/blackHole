# Proposal: WhatsApp, Email and SMS Notifications

## Intent

Alerts and customer messages today reach only in-app screens and Web Push. PRD-00 marks WhatsApp, email and SMS as a later phase for shortage alerts (sec. 6, M4), reservation confirmation and reminders (M9), and invoice delivery (TRD-00 sec. 8.2 "Correo"). Bag balance alerts (TRD-00 sec. 8.2) need the same channels. SMS is in scope of 5.1 together with WhatsApp and email (D-03). The change folder keeps its original name.

## Scope

### In Scope
- WhatsApp, email and SMS channels behind the shared `Messaging` port; in-app and Web Push stay on `Notifier`.
- Per-site configuration by notification type: channels, recipient roles, quiet fallback.
- Staff alerts: shortage alerts (all levels and escalation) and bag balance alerts (yellow, red, critical).
- Customer messages: reservation confirmation and reminder; invoice delivery by WhatsApp or SMS once validated.
- Customer consent and opt-out (Ley 1581), delivery status and retries.

### Out of Scope
- Card terminals, reservation gateway (→ 5.2, 5.3).
- Marketing or loyalty messages (PRD-00 out of scope).

## Capabilities

### New Capabilities
- `notifications`: channel configuration per site and type, WhatsApp/email/SMS delivery, consent, idempotency and retries.

### Modified Capabilities
None

## Approach

Add WhatsApp, email and SMS adapters to the `Messaging` port (glossary §4); `Notifier` keeps in-app and Web Push (c4-m0). Producers (M4, M7, M9, M3) keep emitting their events; a cloud worker resolves recipients from site configuration and sends through `Messaging`. Delivery is idempotent per event, recipient and channel.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/application` | Modified | Notification routing and preferences |
| `contexts/platform/adapters/whatsapp` | New | WhatsApp provider adapter of `Messaging` |
| `contexts/platform/adapters/email` | New | Email provider adapter of `Messaging` |
| `contexts/platform/adapters/sms` | New | SMS provider adapter of `Messaging` |
| `contexts/invoicing/application` | Modified | Invoice-validated message trigger |
| `contexts/reservations/application` | Modified | Confirmation and reminder triggers |
| `shared/contracts` | Modified | Notification events and preferences schemas |
| `apps/api-cloud`, `apps/admin-web` | Modified | Sender worker, configuration screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Email, SMS and WhatsApp providers not chosen | High | Open: PA-37. Port + in-memory adapter; provider choice before build |
| Stale messages after a hybrid outage | Med | Time-bound types (reminders) expire instead of sending late |
| Messaging without consent | Med | Customer channel requires recorded consent |
| SMS cost per message | Med | SMS enabled per site and type, never a default channel |

## Rollback Plan

Disable external channels per site; the notifier falls back to in-app and Web Push only. No producer event changes, so removal has no business impact.

## Dependencies

- WhatsApp Business, email and SMS providers (PA-37); 2.8 shortage alerts, 1.5 bag alerts, 3.6 reservations.

## Success Criteria

- [ ] Notices arrive through the channel configured at each site, WhatsApp, email or SMS.
- [ ] A duplicated event sends one message per recipient and channel.
- [ ] A customer who opted out receives nothing on that channel.
- [ ] Integration operates in at least 1 site (PRD-00 sec. 11 phase 5).
