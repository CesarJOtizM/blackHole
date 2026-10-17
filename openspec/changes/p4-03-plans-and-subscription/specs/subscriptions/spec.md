# Subscriptions Specification

## Purpose

Charge each company per site without cutting service the day a payment fails, and bill document-bag recharges. Cloud only (api-cloud, PostgreSQL); local-node receives only the suspension state.

## Requirements

### Requirement: Plans Priced per Site

A plan MUST define a price per site and billing period. The charge for a period MUST equal the plan price times the active sites at charge time. Changing a plan price MUST NOT alter periods already charged.

#### Scenario: Charge for three sites

- GIVEN a company on a plan of 100,000 COP per site with 3 active sites
- WHEN the period is charged
- THEN the charge is 300,000 COP

#### Scenario: Price change after charge

- GIVEN a period already charged at 100,000 COP per site
- WHEN the plan price changes to 120,000 COP
- THEN the charged period still shows 100,000 COP

### Requirement: Subscription Lifecycle

A subscription MUST be in exactly one state: active, in grace or suspended. Allowed transitions: active → in grace; in grace → active or suspended; suspended → active. Every transition MUST be audited and emitted to the platform context.

#### Scenario: Payment fails

- GIVEN an active subscription with a 7-day grace period
- WHEN the period charge fails
- THEN the subscription moves to in grace
- AND grace ends 7 days later

#### Scenario: No skipping grace

- GIVEN an active subscription
- WHEN a suspension is requested directly
- THEN the transition is rejected

#### Scenario: Grace expires

- GIVEN a subscription in grace with no successful payment
- WHEN the grace period ends
- THEN it becomes suspended

### Requirement: Suspension Effect

While suspended, a site MUST keep all data and issued documents, MUST allow reading reports and exports, MUST allow closing a shift already open, and MUST reject opening new shifts and new orders. Cloud-mode sites apply it immediately; hybrid nodes apply it when the state reaches them, and sales made before that MUST be kept and the lag audited.

#### Scenario: Cloud-mode site suspended

- GIVEN a cloud-mode site of a suspended company
- WHEN a cashier tries to open a new shift
- THEN the request is rejected with a suspension reason
- AND closing the current open shift still succeeds

#### Scenario: Hybrid node offline at suspension

- GIVEN a hybrid node without internet when the company is suspended
- WHEN the node keeps selling and later reconnects
- THEN those sales sync and are kept
- AND the node then applies the suspension and the lag is audited

### Requirement: Reactivation

A successful payment from grace or suspended MUST return the subscription to active, restore access and request issuance of invoices pending with reason "no balance" when the bag has balance.

#### Scenario: Pay while suspended

- GIVEN a suspended subscription with pending "no balance" invoices and bag balance
- WHEN the payment succeeds
- THEN the subscription becomes active
- AND those invoices are requested for issuance in sale order

#### Scenario: Duplicate payment confirmation

- GIVEN a payment confirmation already applied
- WHEN the gateway sends the same confirmation again
- THEN no second payment or transition is recorded

### Requirement: Document Bag Billing

A paid bag recharge MUST credit documents to the company bag, charged through the subscription gateway per plan configuration, and MUST request issuance of "no balance" pending documents. Sales MUST NOT be blocked at zero balance.

#### Scenario: Recharge releases pending invoices

- GIVEN a bag at zero with 12 invoices pending "no balance"
- WHEN a recharge of 1,000 documents is paid
- THEN the balance increases by 1,000
- AND the 12 invoices are requested for issuance

#### Scenario: Recharge payment fails

- GIVEN a recharge request
- WHEN the gateway declines the charge
- THEN no documents are credited
- AND pending invoices remain pending

### Requirement: Platform Role Isolation

Backoffice users managing plans and subscriptions MUST NOT read the customer's orders, payments or invoices.

#### Scenario: Backoffice reads plans

- GIVEN a platform administrator
- WHEN they open a company's subscription
- THEN plan, state and charges are shown

#### Scenario: Backoffice reads orders

- GIVEN the same administrator without support access
- WHEN they request that company's orders
- THEN the request is rejected
