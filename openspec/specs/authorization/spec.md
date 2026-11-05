# Authorization Specification

## Purpose

Decide who can do what, where and up to how much (PRD-01, TRD-00 10.2). The node decides offline with its site copy; the cloud decides for administration and cloud-mode sites, with the same rules.

## Requirements

### Requirement: Permission Catalog and Matrix

Permissions MUST be defined by the product; each sensitive one MUST have a paired authorize permission. Predefined roles MUST carry the PRD-01 6 matrix and MUST NOT be editable; a company MAY copy and change one.

#### Scenario: Every matrix cell holds
- GIVEN the default matrix
- WHEN each role attempts each action
- THEN the outcome matches its cell (yes, limited, authorization, no)

#### Scenario: Edit a predefined role
- GIVEN the predefined cashier role
- WHEN an owner edits it
- THEN it is rejected

### Requirement: Scoped Assignments

A user MAY hold several assignments scoped to company, brand, site, warehouse or taxpayer, optionally time-bound. Company scope MUST cover everything below it; brand scope its sites. The most permissive applicable assignment MUST apply.

#### Scenario: Two sites, two roles
- GIVEN a user who is cashier in site 1 and administrator in site 2
- WHEN they view site 2 audit
- THEN it is allowed, and in site 1 it is denied

#### Scenario: Expired assignment
- GIVEN a replacement cashier valid only on Saturday
- WHEN they try to charge on Sunday
- THEN it is denied

### Requirement: Server-Side Evaluation

Evaluation MUST return allowed, requires authorization (with the exceeded limit) or denied, decided by the server. Every data-changing route MUST declare its permission, enforced by an automated check.

#### Scenario: Direct call by a waiter
- GIVEN a waiter session
- WHEN it calls the charge endpoint directly
- THEN it is denied

#### Scenario: Undeclared route
- GIVEN a new route that changes data with no permission
- WHEN the test suite runs
- THEN it fails

### Requirement: Limits and Site Adjustments

Limits MUST be set per role by the company and a site MAY only lower them. Above the limit, evaluation MUST require authorization.

#### Scenario: Discount above limit
- GIVEN a cashier with a 5 % limit
- WHEN they apply 10 %
- THEN authorization is required

#### Scenario: Raise at site
- GIVEN a company limit of 15 % for supervisors
- WHEN a site sets 20 %
- THEN it is rejected

### Requirement: No Privilege Escalation

A user MUST only create or assign roles whose permissions and limits are a subset of their own, within their scope. The last active owner MUST NOT be removable. Role, permission and limit changes MUST happen in the cloud only, be recorded with before and after, and notify the owner.

#### Scenario: Escalation attempt
- GIVEN an administrator without the edit-recipes permission
- WHEN they create a role that includes it
- THEN it is rejected

#### Scenario: Last owner
- GIVEN a company with one active owner
- WHEN that owner is removed
- THEN it is rejected

### Requirement: Supervisor Authorization

A request MUST capture a reason and MUST expire if unanswered. Approval MUST come from another person whose authorize permission covers the value, by PIN on the same device or remotely; remote approval MUST work on the site network offline in hybrid mode, and from outside only with internet. Self-authorization MUST require per-shift enablement by an administrator and MUST be flagged and alerted. Outcomes MUST record requester, authorizer, action, value, reason, device and time.

#### Scenario: Remote approval offline
- GIVEN a hybrid node without internet
- WHEN a supervisor approves from their phone on-site
- THEN the action runs and the record is complete

#### Scenario: Self-authorization blocked
- GIVEN no self-authorization for the shift
- WHEN a supervisor enters their own PIN for their void
- THEN it is denied

### Requirement: Support Access

Support and platform administrators MUST access tenant operational data only with an expiring, revocable owner grant, and every support action MUST be audited in the tenant.

#### Scenario: Within grant
- GIVEN a 4-hour grant
- WHEN support reads site data after 1 hour
- THEN it is allowed and recorded

#### Scenario: Expired grant
- GIVEN the grant expired
- WHEN support reads site data
- THEN it is denied

### Requirement: Authorization Bound to One Operation

An approved authorization MUST apply only to the requested action, target and value, exactly once. Executing a different value or target MUST require a new authorization. Request expiry is defined by the Supervisor Authorization requirement.

#### Scenario: Value matches
- GIVEN an approved discount authorization of 10 % on account A
- WHEN the cashier applies 10 % on account A
- THEN the discount applies and the authorization is consumed

#### Scenario: Value increased
- GIVEN an approved discount authorization of 10 % on account A
- WHEN the cashier applies 20 %
- THEN the discount is rejected and a new request is required

### Requirement: Shift Accumulators From Executed Operations

Per-shift caps MUST be evaluated against operations actually executed in the current shift by that user, such as voids before kitchen and courtesy value. Rejected or expired requests MUST NOT count.

#### Scenario: Courtesy cap reached
- GIVEN an admin with a courtesy cap of 100,000 per shift and 90,000 used
- WHEN she grants a 20,000 courtesy
- THEN authorization by another person is required

#### Scenario: Rejected request not counted
- GIVEN a waiter whose last void request was rejected
- WHEN the shift void count is evaluated
- THEN the rejected request is not counted

### Requirement: Authorization by Operating Mode

In hybrid mode the node MUST evaluate permissions and validate PIN authorizations of its site without internet, using its copy of roles and caps. Remote approval is defined by the Supervisor Authorization requirement. In cloud mode, sensitive operations during a cut SHALL be unavailable with the rest of the service.

#### Scenario: Hybrid offline PIN
- GIVEN a hybrid node without internet
- WHEN a supervisor authorizes a void with her PIN
- THEN the node validates it locally and the audit event syncs later

#### Scenario: Cloud mode cut
- GIVEN a cloud-mode site without internet
- WHEN a cashier requests a void authorization
- THEN no authorization is evaluated and nothing changes
