# Proposal: Infrastructure and Continuous Delivery

## Intent

A small team must deploy often without breaking older nodes and without being locked to one cloud (TRD-01 2, 3–6; TRD-00 13). Nothing in the cloud may be created by hand, and a faulty release must roll back on its own.

## Scope

### In Scope
- Terraform modules for AWS, GCP and Azure with identical inputs and outputs; common module for Cloudflare, Grafana and Sentry resources.
- Application ports for file storage and secrets, with one adapter per cloud plus local disk / encrypted file.
- Environments: local (Docker Compose with a simulated node), staging, production; separate accounts.
- Pipeline: checks, build once, scan, publish, migrations, staging, smoke and E2E, approval, gradual production rollout, automatic rollback.
- Compatibility with previous-version nodes; two-step forward-only migrations.
- Autoscaling of API and workers with min/max; cross-cloud encrypted backup; monthly cloud-switch rehearsal.

### Out of Scope
- Dashboards, alarms and Sentry content → 0.9.
- Staged node rollout mechanics → 0.7.
- The first trial cloud is AWS or GCP (D-39). The pipeline is GitHub Actions (D-45).
- Factus per-NIT rate limiter → 1.5 (load-tested in 0.9).

## Capabilities

### New Capabilities
- `infrastructure`: portable Terraform, environments, provider ports, scaling, backups.
- `continuous-delivery`: pipeline, promotion, rollback, node compatibility, rehearsal.

### Modified Capabilities
None

## Approach

Per TRD-01 4.1, in English names: `infra/modules/{aws,gcp,azure,common}` and `infra/environments/{staging-aws,staging-gcp,staging-azure,production-<cloud>}`. Provider-dependent code lives only in adapters behind `FileStorage` and `Secrets` ports. Pipeline uses OIDC, never stored keys.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `infra/modules/*`, `infra/environments/*` | New | Terraform modules and environments |
| `contexts/platform/application` | Modified | `FileStorage`, `Secrets` ports |
| `contexts/platform/adapters/{s3,gcs,blob,disk,secrets-*}` | New | Provider adapters |
| `apps/api-cloud`, `apps/local-node` | Modified | Container images, health endpoint, env config |
| `docker-compose.yml` | New | Local environment |
| CI workflow (per ADR-015) | New | Pipeline definition |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Three-cloud upkeep too costly | Med | Same interfaces, plan on every change, monthly rehearsal; revisit ADR-005 |
| Pipeline service | Low | GitHub Actions (D-45). First trial cloud is AWS or GCP (D-39) |
| How PWAs are served | Low | Cloud static files, installed from the browser (D-40). The node does not serve them in the MVP |
| Existing bootstrap test forbids health routes | Low | Test updated when health is added on purpose |

## Rollback Plan

Application rollback is returning to the previous image, without touching the database. Infrastructure changes are reverted by applying the previous module version through the pipeline. Staging can be destroyed and recreated.

## Dependencies

- p0-02 runnable apps; cloud accounts in all three providers; Cloudflare zone; ADR-005, ADR-015.

## Success Criteria

- [ ] Staging is built from scratch with Terraform in the three clouds and passes the smoke tests.
- [ ] A change on the main branch reaches staging with no manual steps, and one with an injected error returns to the previous version on its own.
- [ ] `terraform plan` passes for the three clouds on every `infra/` change.
- [ ] Production is deployed for 99.5% cloud availability at launch, with at least 2 API instances (TRD-00 15, TRD-01 6).
