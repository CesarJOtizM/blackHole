# Roadmap index

One OpenSpec change per delivery in [`docs/roadmap.md`](../docs/roadmap.md). Every change is `specified`: it has `state.yaml`, `proposal.md` and `specs/`. Design and tasks are written when the delivery starts.

## How to run a delivery

1. `sdd-design` → `sdd-tasks` → `sdd-apply` → `sdd-verify` → `sdd-archive`, on the change folder.
2. Start a delivery only when every change in its `depends_on` is archived (roadmap rule: the previous delivery meets its exit criterion first).
3. Archive in delivery order. A delta spec (`# Delta for ...`, ADDED only) merges into the base spec created by an earlier change, so the base change MUST be archived first.
4. If the delivery teaches something new, update PRD-00 / TRD-00 first, then the module docs, then the remaining changes.

## Capability owners

The change that creates each base spec. Later changes only add requirements.

| Capability | Base spec | Extended by |
|---|---|---|
| operating-mode | 0.2 | 0.3 |
| sync | 0.2 | 0.7 |
| authorization | 0.5 | 1.7 |
| catalog | 1.1 | 2.7 |
| dining-room | 1.2 | 1.12 |
| cash-register | 1.3 | 1.13, 5.2 |
| attendance | 1.9 | 5.4 |
| reporting | 1.11 | 2.10, 3.9, 4.1 |
| site-rollout | 1.14 | 2.11, 4.6 |
| inventory-ledger | 2.2 | — |
| platform-hub | 3.2 | 3.3 |
| reservation-payments | 3.7 | 5.3 |

All other capabilities are created and owned by a single change.

## Phase 0 · Foundation

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 0.1 | `p0-01-risk-spikes` | risk-spikes | — |
| 0.2 | `p0-02-skeleton-and-sync` | operating-mode, sync | 0.1 |
| 0.3 | `p0-03-organization` | organization, operating-mode Δ | 0.2 |
| 0.4 | `p0-04-identity-and-devices` | identity, device-registry | 0.1, 0.3 |
| 0.5 | `p0-05-roles-and-permissions` | authorization | 0.4 |
| 0.6 | `p0-06-audit` | audit | 0.2, 0.4 |
| 0.7 | `p0-07-hybrid-resilience` | node-resilience, sync Δ | 0.2, 0.3, 0.4, 0.6 |
| 0.8 | `p0-08-infrastructure-and-delivery` | infrastructure, continuous-delivery | 0.2 |
| 0.9 | `p0-09-monitoring-and-errors` | observability | 0.2, 0.8 |

## Phase 1 · Dining room in 1 site

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 1.1 | `p1-01-menu-and-catalog` | catalog | 0.2–0.6 |
| 1.2 | `p1-02-dining-room-and-kitchen` | dining-room, kitchen | 0.1–0.6, 1.1 |
| 1.3 | `p1-03-cash-register` | cash-register | 0.3, 0.5, 0.6, 1.2 |
| 1.4 | `p1-04-tax-engine` | tax-engine | 0.2, 0.3, 0.6, 1.1, 1.3 |
| 1.5 | `p1-05-electronic-invoicing` | e-invoicing | 0.2, 0.3, 0.5–0.9, 1.3, 1.4 |
| 1.6 | `p1-06-printing` | printing | 0.1, 0.4–0.6, 1.2, 1.3, 1.5 |
| 1.7 | `p1-07-anti-theft-controls` | sensitive-actions, authorization Δ | 0.4–0.6, 1.2, 1.3, 1.5, 1.6 |
| 1.8 | `p1-08-invoicing-portal` | invoicing-portal | 0.5, 0.6, 1.2, 1.3, 1.5, 1.6 |
| 1.9 | `p1-09-attendance` | attendance | 0.2–0.6 |
| 1.10 | `p1-10-tips` | tips | 0.5, 0.6, 1.3, 1.6, 1.9 |
| 1.11 | `p1-11-site-reports` | reporting | 0.2, 0.5, 1.2, 1.3, 1.5, 1.8–1.10 |
| 1.12 | `p1-12-qr-table-ordering` | qr-table-ordering, dining-room Δ | 0.2, 0.7, 1.1, 1.2, 1.8 |
| 1.13 | `p1-13-qr-table-payment` | qr-table-payment, cash-register Δ | 0.7, 1.3, 1.5, 1.8, 1.10, 1.12 |
| 1.14 | `p1-14-go-live` | site-rollout | 0.7–0.9, 1.1–1.13 |

## Phase 2 · Inventory (6 sites)

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 2.1 | `p2-01-ingredients-and-recipes` | recipes | 0.2, 0.3, 0.5, 0.6, 1.1 |
| 2.2 | `p2-02-sale-consumption` | stock-consumption, inventory-ledger | 0.2, 0.6, 1.2, 2.1 |
| 2.3 | `p2-03-purchasing` | purchasing | 0.5, 0.6, 1.5, 2.1, 2.2 |
| 2.4 | `p2-04-production` | production | 2.1–2.3 |
| 2.5 | `p2-05-warehouses-and-transfers` | warehouses-and-transfers | 0.3–0.5, 0.7, 1.6, 2.2, 2.3 |
| 2.6 | `p2-06-waste-and-counts` | waste-and-counts | 0.5, 0.6, 2.2, 2.3 |
| 2.7 | `p2-07-producible-quantity` | producible-quantity, catalog Δ | 1.1, 1.2, 2.1, 2.2, 2.4, 2.5 |
| 2.8 | `p2-08-shortage-alerts` | shortage-alerts | 0.5, 0.6, 2.2, 2.3, 2.5, 2.7 |
| 2.9 | `p2-09-not-restocked-today` | dish-withdrawal | 1.2, 1.12, 2.2, 2.5, 2.7, 2.8 |
| 2.10 | `p2-10-inventory-reports` | reporting Δ | 1.11, 2.1–2.3, 2.5–2.8 |
| 2.11 | `p2-11-six-site-rollout` | site-rollout Δ | 0.3, 0.7, 1.14, 2.5, 2.6, 2.10 |

## Phase 3 · Delivery and reservations

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 3.1 | `p3-01-own-delivery` | delivery | 0.2, 0.4–0.6, 1.2–1.5, 2.2 |
| 3.2 | `p3-02-platform-hub-and-manual-capture` | platform-hub | 0.5, 0.6, 1.1–1.3, 2.2, 3.1 |
| 3.3 | `p3-03-rappi-connector` | rappi-connector, platform-hub Δ | 0.7, 0.8, 2.7, 3.2 |
| 3.4 | `p3-04-didi-food-connector` | didi-food-connector | 3.2, 3.3 |
| 3.5 | `p3-05-platform-reconciliation` | platform-reconciliation | 0.6, 2.1, 3.2–3.4 |
| 3.6 | `p3-06-reservations` | reservations | 0.2, 0.3, 0.5, 0.6, 1.2 |
| 3.7 | `p3-07-reservation-payments` | reservation-payments | 0.5, 0.6, 1.3, 1.5, 3.6 |
| 3.8 | `p3-08-public-booking-link` | public-booking | 3.6, 3.7 |
| 3.9 | `p3-09-delivery-and-reservation-reports` | reporting Δ | 1.11, 3.1, 3.2, 3.5–3.8 |

## Phase 4 · Commercial

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 4.1 | `p4-01-consolidated-reports` | reporting Δ | 0.5, 0.6, 1.7, 1.11, 2.10, 3.9 |
| 4.2 | `p4-02-accountant-information` | accounting-exports | 1.4, 1.5, 1.8, 1.11, 4.1 |
| 4.3 | `p4-03-plans-and-subscription` | subscriptions | 0.2, 0.3, 0.6, 1.5 |
| 4.4 | `p4-04-customer-onboarding` | tenant-onboarding | 0.3–0.5, 1.1, 1.4, 1.5, 2.1, 4.3 |
| 4.5 | `p4-05-support-panel` | support-panel | 0.2, 0.5, 0.6, 0.9, 1.5, 4.3 |
| 4.6 | `p4-06-first-new-customer` | site-rollout Δ | 1.14, 2.11, 4.1–4.5 |

## Phase 5 · Integrations and channels

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 5.1 | `p5-01-whatsapp-and-email-notifications` | notifications | 1.5, 2.8, 3.6, 4.3 |
| 5.2 | `p5-02-card-terminal-integration` | card-terminal-integration, cash-register Δ | 0.4, 0.6, 1.3 |
| 5.3 | `p5-03-reservation-payment-gateway` | reservation-payments Δ | 3.6–3.8 |
| 5.4 | `p5-04-attendance-photo` | attendance Δ | 0.2, 0.8, 1.9 |

## Blocking decisions

Pending ADRs or owner decisions that block a delivery before its design starts.

| Decision | Blocks |
|---|---|
| ADR-003 local HTTPS, ADR-006 printing, locked-phone notifications without internet | 0.1 → 0.4, 1.2, 1.6 |
| ADR-005 production cloud, ADR-015 pipeline service | 0.8 |
| ADR-016 QR payment gateway | 1.13 → 1.14 |
| ADR-010 warehouse node mode | 2.5 |
| ADR-011 direct connector or integrator | 3.3, 3.4 |
| Cash deposits for reservations (PRD-00 allows them, PRD-M9 does not) | 3.7 |
| ADR-012 reservation gateway, subscription gateway, WhatsApp provider | 4.3, 5.1, 5.3 |
| ADR-007 card terminal integration type per provider | 5.2 |
