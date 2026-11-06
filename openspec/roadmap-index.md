# Roadmap index

One OpenSpec change per delivery in [`docs/roadmap.md`](../docs/roadmap.md). Every change is `specified`: it has `state.yaml`, `proposal.md` and `specs/`. Design and tasks are written when the delivery starts.

## How to run a delivery

1. `sdd-design` → `sdd-tasks` → `sdd-apply` → `sdd-verify` → `sdd-archive`, on the change folder.
2. Start a delivery only when every change in its `depends_on` is archived (roadmap rule: the previous delivery meets its exit criterion first).
3. Archive in delivery order. A delta spec (`# Delta for ...`, ADDED only) merges into the base spec created by an earlier change, so the base change MUST be archived first.
4. If the delivery teaches something new, update PRD-00 / TRD-00 first, then the module docs, then the remaining changes.

**Build order (D-37).** The MVP is cloud-only. Do not start hybrid work — local HTTPS, offline alerts, sync, SQLite, node resilience, the offline QR queue, the warehouse node — until the cloud product is operating. Cloud deliveries no longer wait on those changes.

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
| 0.2 | `p0-02-skeleton-and-sync` | operating-mode, sync | — |
| 0.3 | `p0-03-organization` | organization, operating-mode Δ | 0.2 |
| 0.4 | `p0-04-identity-and-devices` | identity, device-registry | 0.3 |
| 0.5 | `p0-05-roles-and-permissions` | authorization | 0.4 |
| 0.6 | `p0-06-audit` | audit | 0.2, 0.4 |
| 0.7 | `p0-07-hybrid-resilience` | node-resilience, sync Δ | 0.2, 0.3, 0.4, 0.6 |
| 0.8 | `p0-08-infrastructure-and-delivery` | infrastructure, continuous-delivery | 0.2 |
| 0.9 | `p0-09-monitoring-and-errors` | observability | 0.2, 0.8 |

## Phase 1 · Dining room in 1 site

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 1.1 | `p1-01-menu-and-catalog` | catalog | 0.2–0.6 |
| 1.2 | `p1-02-dining-room-and-kitchen` | dining-room, kitchen | 0.2–0.6, 1.1 |
| 1.3 | `p1-03-cash-register` | cash-register | 0.3, 0.5, 0.6, 1.2 |
| 1.4 | `p1-04-tax-engine` | tax-engine | 0.2, 0.3, 0.6, 1.1, 1.3 |
| 1.5 | `p1-05-electronic-invoicing` | e-invoicing | 0.2, 0.3, 0.5, 0.6, 0.8, 0.9, 1.3, 1.4 |
| 1.6 | `p1-06-printing` | printing | 0.1, 0.4–0.6, 1.2, 1.3, 1.5 |
| 1.7 | `p1-07-anti-theft-controls` | sensitive-actions, authorization Δ | 0.4–0.6, 1.2, 1.3, 1.5, 1.6 |
| 1.8 | `p1-08-invoicing-portal` | invoicing-portal | 0.5, 0.6, 1.2, 1.3, 1.5, 1.6 |
| 1.9 | `p1-09-attendance` | attendance | 0.2–0.6 |
| 1.10 | `p1-10-tips` | tips | 0.5, 0.6, 1.3, 1.6, 1.9 |
| 1.11 | `p1-11-site-reports` | reporting | 0.2, 0.5, 1.2, 1.3, 1.5, 1.8–1.10 |
| 1.12 | `p1-12-qr-table-ordering` | qr-table-ordering, dining-room Δ | 0.2, 1.1, 1.2, 1.8 |
| 1.13 | `p1-13-qr-table-payment` | qr-table-payment, cash-register Δ | 1.3, 1.5, 1.8, 1.10, 1.12 |
| 1.14 | `p1-14-go-live` | site-rollout | 0.8, 0.9, 1.1–1.13 |

## Phase 2 · Inventory (6 sites)

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 2.1 | `p2-01-ingredients-and-recipes` | recipes | 0.2, 0.3, 0.5, 0.6, 1.1 |
| 2.2 | `p2-02-sale-consumption` | stock-consumption, inventory-ledger | 0.2, 0.6, 1.2, 2.1 |
| 2.3 | `p2-03-purchasing` | purchasing | 0.5, 0.6, 1.5, 2.1, 2.2 |
| 2.4 | `p2-04-production` | production | 2.1–2.3 |
| 2.5 | `p2-05-warehouses-and-transfers` | warehouses-and-transfers | 0.3–0.5, 1.6, 2.2, 2.3 |
| 2.6 | `p2-06-waste-and-counts` | waste-and-counts | 0.5, 0.6, 2.2, 2.3 |
| 2.7 | `p2-07-producible-quantity` | producible-quantity, catalog Δ | 1.1, 1.2, 2.1, 2.2, 2.4, 2.5 |
| 2.8 | `p2-08-shortage-alerts` | shortage-alerts | 0.5, 0.6, 2.2, 2.3, 2.5, 2.7 |
| 2.9 | `p2-09-not-restocked-today` | dish-withdrawal | 1.2, 1.12, 2.2, 2.5, 2.7, 2.8 |
| 2.10 | `p2-10-inventory-reports` | reporting Δ | 1.11, 2.1–2.3, 2.5–2.8 |
| 2.11 | `p2-11-six-site-rollout` | site-rollout Δ | 0.3, 1.14, 2.5, 2.6, 2.10 |

## Phase 3 · Delivery and reservations

| Delivery | Change | Capabilities | Depends on |
|---|---|---|---|
| 3.1 | `p3-01-own-delivery` | delivery | 0.2, 0.4–0.6, 1.2–1.5, 2.2 |
| 3.2 | `p3-02-platform-hub-and-manual-capture` | platform-hub | 0.5, 0.6, 1.1–1.3, 2.2, 3.1 |
| 3.3 | `p3-03-rappi-connector` | rappi-connector, platform-hub Δ | 0.8, 2.7, 3.2 |
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

Open questions live only in the [open-questions register](../docs/preguntas-abiertas.md); changes cite them by code (`PA-xx`) and decisions by `D-xx`. A delivery does not start its design while an open question blocks it. This table mirrors the register's "Bloquea" column; when they differ, the register wins.

| Delivery | Open questions |
|---|---|
| 0.6 | PA-41 |
| 2.6 | PA-42 |
| 3.3, 3.4 | PA-28 |
| 3.7 | PA-48 |
| 4.2 | PA-10 |
| 4.3 | PA-27, PA-38, PA-39, PA-40, PA-47 |
| 4.4 | PA-47 |
| 5.2 | PA-43 |
| 5.3 | PA-45 |
| Hybrid phase | PA-29, PA-30, PA-44, PA-52 |

Decided and already applied to the changes: D-37 (cloud MVP first; hybrid after the cloud product operates), D-01 (3.7 cash in person), D-02 (0.2, 0.7 return to cloud), D-03 (5.1 SMS), D-04 (2.5 warehouse node), D-05 (4.5 support view in `admin-web`), D-06 (English code names, [glossary](../docs/glosario-codigo.md)), D-16 (1.5, 4.3, 4.5 bag quota per NIT), D-17 (1.5, 4.2 issue date is validation), D-18 (4.3 Factus 2026 price list), D-19 (1.5 one in-flight validate per numbering range), D-20 (1.4, 1.5 sandbox credentials held outside the repo), D-21 (1.8 acquirer lookup does not consume documents), D-22 (0.5 bartender charge starts off), D-23 (1.12 QR acceptance at the register starts off), D-24 (1.10 equal split or percentage per employee), D-25 (each venue contracts its own internet), D-26 (2.4 production cost is configurable), D-27 (2.5 transfer keeps origin cost), D-28 (2.6 count adjustment cap defaults to 1,000 COP), D-29 (3.1 bag tax on deliveries is a per-site switch), D-30 (0.5, 1.7 default caps and the site administrator authorizes), D-31 (1.7, 1.11 thresholds are configurable), D-32 (2.8 stock levels are suggested and editable), D-33 (1.9 a clocked-in cashier is required to start), D-34 (3.6, 3.7 reservation charge is configurable), D-35 (3.2–3.5 adapters and test data until API access), D-36 (0.1, 0.7, 1.14 the owner buys the recommended router and 4G modem), D-48 (1.8, 5.1 Twilio for email, SMS and WhatsApp; the system generates the one-time code).
