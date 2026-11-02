# Delta for Operating Mode

## ADDED Requirements

### Requirement: Site Mode in the Structure

Each site MUST show its mode (`cloud` or `hybrid`) as part of the organization structure. Only an administrator with scope over the site MUST be able to request a mode change, and a new site MUST be created in `cloud` mode.

#### Scenario: New site mode
- GIVEN the pilot structure being loaded
- WHEN six sites are created
- THEN all six show `cloud` mode

#### Scenario: Mode change out of scope
- GIVEN an administrator of site 1
- WHEN they request hybrid mode for site 2
- THEN the request is refused

### Requirement: Structure Copy Reaches the Node

When hybrid is activated, the pairing snapshot MUST include the site's structure: company, its taxpayer, brand, kitchen stations, cash registers and inventory locations of that site. Later structure changes MUST reach the node through the configuration cursor. In cloud mode no copy exists.

#### Scenario: Activation snapshot
- GIVEN a pilot site with 3 stations, 2 registers and one warehouse
- WHEN hybrid is activated and the node pairs
- THEN the node holds exactly that structure

#### Scenario: Later change while offline
- GIVEN a hybrid site offline
- WHEN a station is added in the cloud
- THEN the node receives it once on reconnect, in cursor order

#### Scenario: Other sites excluded
- GIVEN a company with 6 sites
- WHEN the node of site 3 pairs
- THEN it holds no structure of the other five sites
