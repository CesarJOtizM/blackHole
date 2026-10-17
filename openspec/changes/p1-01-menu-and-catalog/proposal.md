# Proposal: Menu and Catalog

## Intent

The pilot site cannot take a single order until its menu exists. The menu belongs to the brand, and each site adjusts price, availability and schedule (PRD-M1 sec. 2, rule 1; PRD-00 sec. 7 M1). Roadmap delivery 1.1 loads the full pilot menu and shows it on the waiter's phone.

## Scope

### In Scope
- Brand menu: products, variants (size), modifiers with and without cost, combos.
- Tax classification per product (read later by the tax engine).
- Site price, manual availability and schedule, without changing the brand product.
- Menu edit permission with the admin cap from PRD-01 sec. 6.4, audited.
- Cloud-owned menu copied to the node; the waiter's phone reads the copy in force.

### Out of Scope
- Taking orders, kitchen routing by station → 1.2.
- Tax calculation from the classification → 1.4.
- Menu shown to customers on the table QR → 1.12.
- Automatic availability from stock and producible quantity → 2.7; "not restocked today" → 2.9.
- Recipes and modifier consumption → 2.1.

## Capabilities

### New Capabilities
- `catalog`: brand menu, variants, modifiers, combos, tax classification, site price, availability and schedule, menu copy to the node.

### Modified Capabilities
None

## Approach

Bounded context `orders` (TRD-M1 sec. 1, 2) with a thin `Menu` aggregate and `SitePrice`. The cloud owns the menu (TRD-M1 sec. 3); changes travel to hybrid nodes through the sync channel from 0.2 as a versioned menu copy. In cloud mode the site app reads the cloud directly. Schemas live in `shared/contracts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/orders/domain` | New | Menu, product, variant, modifier, combo, site price |
| `contexts/orders/application` | New | Catalog use cases, menu copy query |
| `contexts/orders/adapters/{postgres,sqlite,http}` | New | Cloud store, node copy, admin HTTP |
| `shared/contracts` | Modified | Menu copy schema and events |
| `apps/api-cloud`, `apps/local-node` | Modified | Wire catalog module |
| `apps/web-admin`, `apps/site-app` | New (planned) | Menu admin; waiter menu view |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale menu on the node after a cut | Med | Versioned copy; order uses copy in force at send (TRD-M1 sec. 10) |
| Tax classification wrong before 1.4 exists | Med | Classification is mandatory data, validated by the accountant in 1.4 |
| No dedicated catalog module doc | Med | Derived from PRD-00 M1 and PRD/TRD-M1; gaps raised as open questions |

## Rollback Plan

The catalog is additive. Disable the catalog module in both apps and revert migrations of `menus`, `products`, `variants`, `modifiers`, `site_prices`; no other context consumes it yet.

## Dependencies

- 0.3 organization (brands, sites), 0.2 sync channel, 0.4 registered devices, 0.5 permissions, 0.6 audit.

## Success Criteria

- [ ] The full menu of the pilot site is loaded and visible on the waiter's phone.
- [ ] A site price change leaves the brand product unchanged.
- [ ] In hybrid mode, a menu change made during a cut reaches the node after reconnection.
