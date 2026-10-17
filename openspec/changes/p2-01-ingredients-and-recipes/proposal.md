# Proposal: Ingredients and Recipes

## Intent

Brands cannot know the theoretical cost or margin of a dish, and later deliveries cannot deduct stock without recipes. This change introduces the brand-level ingredient catalog and versioned recipes (PRD-M4 HU-M4-01, PRD-00 M4, TRD-M4 sec. 2, TRD-00 sec. 9.1–9.2) in the new `inventory` bounded context.

## Scope

### In Scope
- Ingredients with base, purchase and recipe units and non-zero conversion factors.
- Recipes per product and variant, sub-recipes without cycles, yield, modifier adjustments (add/subtract).
- Immutable recipe versions, published from the cloud and copied to hybrid nodes.
- Excel import that reports failing rows and never publishes a partial version.
- Theoretical cost and margin per dish, visible only with the "view costs" permission.

### Out of Scope
- Stock movements and sale deduction → 2.2.
- Real purchase cost and weighted average cost → 2.3.
- Producing stocked preparations → 2.4.
- Producible quantity and menu availability → 2.7.

## Capabilities

### New Capabilities
- `recipes`: ingredient catalog, unit conversions, versioned recipes, recipe explosion, Excel import, theoretical cost and margin.

### Modified Capabilities
None

## Approach

Cloud (`api-cloud`, PostgreSQL) owns ingredients and recipes (TRD-00 sec. 5.1). A publish creates a new immutable version and emits a versioned copy through the site channel (`shared/sync`); `local-node` (SQLite) reads only the copy. Recipe explosion is a pure domain rule returning base-unit quantities as scaled integers (TRD-M4 sec. 5).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | New | Ingredient, recipe, version, explosion rule |
| `contexts/inventory/application` | New | Catalog, publish, import, cost use cases |
| `contexts/inventory/adapters/{postgres,sqlite,http}` | New | Cloud repository, node recipe copy, admin endpoints |
| `shared/contracts` | Modified | Recipe version copy schemas |
| `apps/api-cloud`, `apps/local-node` | Modified | Wire the inventory module |
| `apps/web-admin` | New | Ingredient, recipe and import screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No real cost exists before 2.3 | High | Reference cost per ingredient; replaced by average cost later |
| Incomplete Excel | Med | Row-level report, all-or-nothing publish |
| PRD "inventory unit" (kg) vs TRD-00 "base unit" (g/ml/unit) | Med | Master wins: base unit; flagged to PO |

## Rollback Plan

Disable the inventory module flag in both apps; recipe tables are additive and unused by sales until 2.2. Revert migrations only if no version has been published.

## Dependencies

- p1-01 catalog (products, variants, modifiers), p0-03 organization, p0-05 permissions, p0-06 audit, p0-02 sync.

## Success Criteria

- [ ] The pilot site's recipes are loaded, with their theoretical cost and margin per dish.
- [ ] "Extra cheese" adds and "no onion" subtracts in the exploded quantities.
- [ ] A hybrid node keeps its copied version during an outage; a new version arrives on reconnect.
