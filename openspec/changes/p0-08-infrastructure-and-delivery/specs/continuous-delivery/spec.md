# Continuous Delivery Specification

## Purpose

Take every change on the main branch to staging without manual steps, to production with one approval, and back to the previous version on its own when it degrades, while older site nodes keep syncing (TRD-01 5).

## Requirements

### Requirement: Automatic Path to Staging

A change on the main branch MUST run lint, types, tests and architecture checks, build images once, scan them, publish images and source maps, run staging migrations, deploy to staging and run smoke and E2E tests, with no manual step.

#### Scenario: Green change
- GIVEN a passing change merged to main
- WHEN the pipeline runs
- THEN staging runs the new version and smoke tests pass

#### Scenario: Failing check
- GIVEN a change that breaks an architecture rule
- WHEN the pipeline runs
- THEN no image is published and staging is unchanged

### Requirement: Build Once, Promote

The image deployed to production MUST be the same artifact tested in staging. A critical vulnerability MUST block deployment.

#### Scenario: Promotion
- GIVEN an image that passed staging
- WHEN production is approved
- THEN the same image digest is deployed

#### Scenario: Critical vulnerability
- GIVEN a scan reporting a critical vulnerability
- WHEN deployment is attempted
- THEN it is blocked

### Requirement: Gradual Production with Automatic Rollback

Production MUST require an approval and MUST roll out to part of the instances first. If error rate or p95 latency worsens against the previous version, the pipeline MUST return to the previous image without touching the database.

#### Scenario: Injected error
- GIVEN a release with a deliberately injected error
- WHEN it starts receiving production traffic
- THEN errors rise and the previous image is restored automatically

#### Scenario: Healthy release
- GIVEN a release with stable errors and latency
- WHEN the gradual rollout completes
- THEN all instances run the new version

### Requirement: Forward-Only Two-Step Migrations

Migrations MUST add new structures first and remove old ones only when no service or node uses them. Migrations MUST NOT be reverted; fixes MUST be new forward migrations.

#### Scenario: Column rename
- GIVEN a column to rename
- WHEN it is changed
- THEN the new column is added in one release and the old removed in a later one

#### Scenario: Rollback after migration
- GIVEN a release that ran an additive migration
- WHEN it is rolled back
- THEN the previous image works on the migrated schema

### Requirement: Compatibility with Older Nodes

The cloud MUST accept the sync contract of the current and the previous node version. A breaking contract change MUST be split across two releases. The pipeline MUST publish the node image for staged rollout.

#### Scenario: Previous node
- GIVEN a node one version behind
- WHEN it syncs after a cloud release
- THEN its batches are accepted

#### Scenario: Two versions behind
- GIVEN a node two versions behind
- WHEN it syncs
- THEN the cloud refuses with an upgrade-required answer and the node keeps its outbox

### Requirement: Monthly Cloud-Switch Rehearsal

Monthly, the pipeline MUST build staging from scratch in the two non-production clouds, restore a backup, run smoke tests and destroy it.

#### Scenario: Rehearsal passes
- GIVEN the monthly schedule
- WHEN the rehearsal runs
- THEN both clouds pass smoke tests and are destroyed afterwards

#### Scenario: Rehearsal fails
- GIVEN a stale module in one cloud
- WHEN the rehearsal fails
- THEN the team is alerted with the failing step
