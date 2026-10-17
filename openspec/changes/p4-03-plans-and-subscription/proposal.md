# Proposal: Plans and Subscription

## Intent

blackHole must charge customers per site without cutting service on the day a payment fails, and must bill the Factus document bag (PRD-M7 HU-M7-02, HU-M7-03; TRD-M7 sec. 2).

## Scope

### In Scope
- Plans with price per site; price changes never rewrite charged periods.
- Subscription charging through a subscription gateway port (distinct from the table-QR gateway, ADR-016).
- Lifecycle active → grace → suspended → active, with configurable grace length.
- Suspension effect on sites (open: PA-40, answered in this delivery), propagated to nodes.
- Document bag billing: recharge purchase, balance credit, re-issue of "no balance" pending invoices.

### Out of Scope
- Bag balance counter and coverage alerts — already in e-invoicing (→ 1.5).
- Guided onboarding and Factus NIT activation (→ 4.4).
- WhatsApp/email delivery of payment and balance notices (→ 5.1).
- Final price figure: a business decision recorded as plan configuration.

## Capabilities

### New Capabilities
- `subscriptions`: plans, per-site pricing, charging, grace, suspension, reactivation and document-bag billing.

### Modified Capabilities
None

## Approach

Cloud-only `contexts/saas` with `Subscription`, `Plan` and `DocumentWallet` aggregates (TRD-M7 sec. 2). Charging sits behind a `SubscriptionGateway` port; provider chosen before build. State changes emit `SubscriptionChanged` to M0, which syncs the suspension flag down the site channel. Recharge calls M3 to issue pending documents with reason "no balance".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/saas/domain` | New | Subscription, plan, document bag |
| `contexts/saas/application` | New | Charge, grace, suspend, reactivate, recharge |
| `contexts/saas/adapters/postgres` | New | `plans`, `subscriptions`, `bag_recharges` |
| `contexts/saas/adapters/subscription-gateway` | New | Provider adapter + in-memory double |
| `contexts/platform/application` | Modified | Enforce suspension state |
| `contexts/invoicing/application/entry-port.ts` | Modified | Issue pending "no balance" documents |
| `apps/api-cloud`, `apps/local-node` | Modified | Backoffice routes (backoffice container open: PA-47); node applies synced suspension |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Subscription gateway open: PA-38 | High | Port + in-memory adapter; test subscription runs against the double |
| Suspending a hybrid node offline | Med | Applied on reconnect; lag audited; offline sales kept |
| Suspension blocks a service mid-day | Med | Open: PA-40. Assumed: open service day may close; only new shifts blocked |
| Price set before real costs | Med | Price is plan data, not code |

## Rollback Plan

Plans and subscriptions are additive cloud tables. Disable the charging worker and force every tenant to `active`; M0 then syncs "not suspended" to every node. Bag recharges already credited are kept.

## Dependencies

- Subscription gateway (PA-38); site price and whether the bag is included (PA-39); cost per site (PA-27); Factus 2026 price list (D-18); 1.5 bag counter and `DocumentConsumed` event; quota per NIT (D-16); 0.3 organization.

## Success Criteria

- [ ] A test subscription goes through charge, non-payment, grace and suspension.
- [ ] Reactivation restores access and issues "no balance" pending invoices when balance exists.
- [ ] Suspension never deletes data or issued documents.
- [ ] Active never jumps directly to suspended.
