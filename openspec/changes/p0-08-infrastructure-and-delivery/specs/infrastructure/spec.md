# Infrastructure Specification

## Purpose

Run the cloud side (central API, workers, PostgreSQL, files, secrets) from code on AWS, GCP or Azure without rewriting the application (TRD-01 3, 4, 6, 9). Site nodes are not cloud infrastructure and are not managed here.

## Requirements

### Requirement: Equivalent Cloud Modules

Each cloud MUST have modules for network, PostgreSQL, service, storage, secrets and image registry with the same inputs and outputs. An environment MUST combine modules of one cloud only. Modules MUST be versioned and pinned per environment.

#### Scenario: Staging from scratch
- GIVEN empty accounts in AWS, GCP and Azure
- WHEN each staging environment is applied
- THEN all three come up and pass the smoke tests

#### Scenario: Mismatched outputs
- GIVEN a GCP module missing an output present in AWS
- WHEN the module checks run
- THEN the change is rejected

### Requirement: Provider Ports

Code that depends on a provider MUST sit behind file storage and secrets ports, with an adapter per cloud and a local adapter for development and the node. Configuration MUST arrive through environment variables. Domain code MUST NOT know the cloud.

#### Scenario: Switch storage provider
- GIVEN the API running on AWS
- WHEN it is deployed on Azure with the Azure adapter
- THEN signed file links work with no domain change

#### Scenario: Node secrets
- GIVEN a node without cloud secret services
- WHEN it starts
- THEN it reads secrets from its encrypted file

### Requirement: Portable PostgreSQL

The database MUST use only features and extensions available in all three managed services, and MUST be reachable only from the private network.

#### Scenario: New extension
- GIVEN a migration requiring an extension missing in one cloud
- WHEN it is reviewed in the pipeline
- THEN it is rejected

#### Scenario: Public access
- GIVEN a database in any environment
- WHEN reached from the internet
- THEN the connection is refused

### Requirement: Environments and Changes

There MUST be local, staging and production environments; staging MUST never hold real customer data and MUST NOT share network or credentials with production. Only the pipeline MUST apply Terraform, with short-lived credentials; a plan MUST run for all three clouds on each infrastructure change; a periodic check MUST alert on manual drift.

#### Scenario: Manual change
- GIVEN a resource edited by hand in production
- WHEN the drift check runs
- THEN an alert names the resource

#### Scenario: Local apply
- GIVEN a developer workstation
- WHEN it tries to apply production
- THEN it lacks credentials and fails

### Requirement: Autoscaling with Limits

The API MUST scale horizontally with at least 2 production instances; workers MUST scale by queue depth and age with at least 1. Every service MUST have a maximum instance count. Staging SHOULD scale to zero when idle.

#### Scenario: Queue burst
- GIVEN a long job queue
- WHEN depth grows
- THEN workers scale up and back down once drained

#### Scenario: Runaway scaling
- GIVEN an error that floods requests
- WHEN scaling reaches the maximum
- THEN no more instances start

### Requirement: Cloud Availability

The cloud API MUST be sized and deployed for 99.5% monthly availability at launch (TRD-00 15); production MUST keep at least 2 API instances for it (TRD-01 6).

#### Scenario: One instance lost
- GIVEN production with 2 API instances
- WHEN one instance fails
- THEN the other keeps serving and a replacement starts

#### Scenario: Gradual rollout
- GIVEN a production release rolling out gradually
- WHEN part of the instances are being replaced
- THEN the API keeps answering requests during the rollout

### Requirement: Cross-Cloud Backup

A daily encrypted copy of the production database MUST be exported to a different cloud, and restoring it MUST be proven monthly.

#### Scenario: Restore in another cloud
- GIVEN the latest backup copy
- WHEN staging in a non-production cloud restores it
- THEN smoke tests pass

#### Scenario: Missed export
- GIVEN the daily export fails
- WHEN the schedule checks it
- THEN the team is alerted
