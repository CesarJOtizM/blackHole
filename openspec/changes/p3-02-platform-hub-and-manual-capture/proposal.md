# Proposal: Platform Hub and Manual Capture

## Intent

Cashiers juggle one tablet per platform and retype orders. This change adds the cloud integration hub, the `ConnectorPort` with declared capabilities, and the Manual adapter, so every platform order enters through one screen from day one, even typed by hand (PRD-M5 HU-M5-02/03, TRD-00 sec. 6.1, TRD-M5).

## Scope

### In Scope
- Hub in `api-cloud`; external order idempotency by (platform, external id)
- Connector capability declaration; Manual adapter (no API calls)
- Single channel queue with alert, channel, code and acceptance deadline
- Accept / reject; accept creates the internal order and a platform receivable
- Automatic acceptance per site and schedule
- Channel menu and channel price; product mapping, unmapped-product alert
- Handover to the platform rider verifying the order code
- Platform cancellation: stock return or waste
- Permissions and audit (PRD-01 sec. 6.4)

### Out of Scope
- Rappi connector, status/availability publishing, store pause and silent-node watchdog → 3.3
- DiDi Food and integrator → 3.4
- Commissions and settlement → 3.5
- Platform reports → 3.9

## Capabilities

### New Capabilities
- `platform-hub`: external order intake, queue, acceptance, channel menu, mapping, manual capture, cancellation

### Modified Capabilities
None

## Approach

`contexts/delivery` gains `ExternalOrder` and `ChannelProduct` entities and the `ConnectorPort` with optional operations queried before each call. The cloud owns external orders until accepted; acceptance runs on the operation owner (node in hybrid, cloud in cloud mode) and calls the `orders` and `cash-register` entry ports. Manual capture runs on the node and needs no platform.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/delivery/domain` | Modified | ExternalOrder, ChannelProduct, capability rule |
| `contexts/delivery/adapters/manual` | New | Manual adapter |
| `contexts/orders`, `contexts/cash-register`, `contexts/inventory` | Modified | Platform channel, receivable, cancellation waste |
| `shared/contracts` | Modified | ExternalOrder schemas and events |
| `apps/api-cloud`, `apps/local-node` | Modified | Hub, site channel events |
| `apps/site-app`, `apps/web-admin` | Modified | Queue screen; channel menu and mapping |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Manual capture typo duplicates a platform order | Med | Unique (platform, code) key |
| Auto-accept while the node is silent | Med | Auto-accept only on the operation owner |
| Who issues the DIAN document for platform orders (TRD-00 6.1) | Med | Validate with accountant before go-live |

## Rollback Plan

Disable platform channels per site via flag; cashiers return to the tablets. Hub tables are additive; accepted orders stay as normal internal orders.

## Dependencies

- Own delivery (3.1), catalog (1.1), dining room (1.2), cash register (1.3), sale consumption (2.2)

## Success Criteria

- [ ] Orders from all platforms of a site enter through a single screen, even if typed by hand
- [ ] A manually captured order follows the same kitchen path and is never duplicated
- [ ] Accept, reject and manual capture appear in the audit
