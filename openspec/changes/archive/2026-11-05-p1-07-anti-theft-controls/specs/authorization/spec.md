# Delta for Authorization

## ADDED Requirements

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
