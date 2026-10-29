# Tax Engine Specification

## Purpose

Data-driven line taxes for every regime of PRD-00 sec. 7.1 (TRD-00 sec. 8.6). Bounded context: `invoicing`. Results MUST match on node (SQLite copy) and cloud (PostgreSQL).

## Requirements

### Requirement: Taxpayer Fiscal Profile

Each taxpayer MUST have a profile: person type, regime (ordinary or SIMPLE), VAT and INC responsibility, RUT responsibilities, franchise, municipality per site. Non-VAT-responsible means all products excluded.

#### Scenario: INC-responsible restaurant
- GIVEN an ordinary taxpayer responsible for INC
- WHEN a "restaurant service" line is computed
- THEN the line carries INC 8 %

#### Scenario: Not VAT responsible
- GIVEN a taxpayer not responsible for VAT
- WHEN a "packaged drink" line is computed
- THEN the line is excluded

### Requirement: Dated Tax Rules

A line tax MUST result from profile, classification and sale date. Rules MUST carry validity dates; a new rate SHALL be a new record, not a deployment.

#### Scenario: Rate change by date
- GIVEN a 5 % rule until March 31 and a 19 % record from April 1
- WHEN sales happen on March 31 and April 1
- THEN they use 5 % and 19 % respectively

#### Scenario: No rule found
- GIVEN no rule matches on the sale date
- WHEN the line is computed
- THEN the engine returns an explicit error, never a silent zero

### Requirement: Price-Included Breakdown and Rounding

Menu prices MUST include taxes. Base = price ÷ (1 + sum of rates), 2 decimals; taxes apply sequentially with banker's rounding; totals round to the peso; gaps go to cash rounding within ±500.

#### Scenario: VAT 19 % breakdown
- GIVEN a line priced 11,900 at VAT 19 %
- WHEN the engine computes it
- THEN base is 10,000 and VAT is 1,900

#### Scenario: Gap beyond rounding limit
- GIVEN computed and paid totals differ by more than 500
- WHEN document totals are built
- THEN the totals are rejected

### Requirement: Tip Outside the Base

The tip MUST NOT change any base or tax.

#### Scenario: Tip added
- GIVEN a line priced 10,800 at INC 8 %
- WHEN a 1,000 tip is added
- THEN base stays 10,000 and INC stays 800

#### Scenario: Tip on an excluded sale
- GIVEN an excluded sale
- WHEN a tip is added
- THEN no tax is computed on the tip

### Requirement: Plastic Bag as Item Line

The bag tax MUST be an item line with a fixed value per bag, never a percentage tax.

#### Scenario: Take-out with bags
- GIVEN a bag value of 66 and a take-out order with 2 bags
- WHEN the sale is computed
- THEN one bag line of 132 is produced

#### Scenario: No bags used
- GIVEN a dine-in order with no bags
- WHEN the sale is computed
- THEN no bag line is produced

### Requirement: Corporate Withholdings on Payment

Withholdings (income, VAT, ICA) MUST NOT be computed on the sale; they SHALL be recorded on a withholding-agent corporate customer's payment.

#### Scenario: Corporate customer pays
- GIVEN a corporate customer flagged as withholding agent
- WHEN its payment is recorded with withholdings
- THEN they are stored with the payment and invoice taxes are unchanged

#### Scenario: Final consumer
- GIVEN a final-consumer sale
- WHEN payment is recorded
- THEN no withholding can be entered

### Requirement: Predefined Profiles

The system MUST offer accountant-validated profile and rule templates that a taxpayer MAY adopt.

#### Scenario: Adopt a template
- GIVEN template "SIMPLE regime, INC responsible"
- WHEN an admin assigns it to a taxpayer
- THEN the profile and rules are created from it

#### Scenario: Customized copy
- GIVEN a taxpayer adopted a template
- WHEN its rules are edited
- THEN the template and other taxpayers are unchanged

### Requirement: Traceability and Offline Parity

Each sale line MUST store the rule and version applied. The local node MUST reject quote, publish, and adopt with 403 TaxRejected and MUST store nothing. It does not compute taxes.

#### Scenario: Node rejection
- GIVEN a tax quote, a rule publish, and a fiscal-profile adopt
- WHEN they are posted on the local node
- THEN each response is 403 TaxRejected and nothing is stored

#### Scenario: Accountant case table
- GIVEN the accountant-validated case table per regime
- WHEN automated tests run
- THEN every case matches the expected breakdown and the Factus sandbox
