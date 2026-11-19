# Purchasing Specification

## Purpose

Suppliers, orders, receipts at real cost, average cost and purchase fiscal documents (PRD-00 M4, PRD-M4 rule 5, TRD-M4 sec. 4, TRD-00 sec. 8.2).

## Requirements

### Requirement: Suppliers

The system MUST keep suppliers per company with identification, name, whether they issue e-invoices and lead time. Identification MUST be unique per company.

#### Scenario: Non-invoicing supplier
- GIVEN a market vendor registered with "issues e-invoices" off
- WHEN a receipt from them is confirmed
- THEN a support document is required

#### Scenario: Duplicate identification
- GIVEN a supplier with NIT 900123456
- WHEN another with the same NIT is created
- THEN it is rejected

### Requirement: Purchase Orders

A purchase order MUST target one supplier and one location, with lines in purchase units, and be open, partially received, received or cancelled. Cancelled or received orders MUST NOT accept receipts.

#### Scenario: Partial receipt
- GIVEN an order for 10 sacks
- WHEN 6 are received
- THEN it is partially received with 4 pending

#### Scenario: Cancelled order
- GIVEN a cancelled order
- WHEN a receipt is attempted
- THEN it is rejected

### Requirement: Receipt at Real Cost

A receipt MUST record quantity and actual unit cost, converted to base unit, as an audited purchase movement at the receiving location (warehouse or point of sale), with or without an order. Only holders of "receive a purchase" (PRD-01 sec. 6.3) MUST register it. In hybrid mode the site node MUST accept receipts offline; in cloud mode receipts MUST wait for connectivity.

#### Scenario: Direct receipt
- GIVEN no purchase order
- WHEN the kitchen chief receives 5 kg tomato at 4000 COP/kg into the point of sale
- THEN +5000 g at 4 COP/g is recorded

#### Scenario: Waiter denied
- GIVEN a waiter session
- WHEN a receipt is submitted
- THEN it is denied

#### Scenario: Cloud-mode outage
- GIVEN a cloud-mode site offline
- WHEN a receipt is attempted
- THEN it cannot be recorded until reconnect

### Requirement: Weighted Average Cost

Average cost per ingredient and location MUST change only with real-cost entries; waste, consumption and adjustments MUST NOT change it.

#### Scenario: Recalculated
- GIVEN 1000 g at 10 COP/g
- WHEN 1000 g arrive at 14 COP/g
- THEN average is 12 COP/g

#### Scenario: Waste keeps average
- GIVEN average 12 COP/g
- WHEN 200 g waste is recorded
- THEN average stays 12 COP/g

### Requirement: Support Document

A non-invoicing supplier receipt MUST produce a support document issued by the cloud through Factus with the taxpayer's support-document range. Stock MUST be recorded regardless; rejections MUST alert and allow corrected re-issue.

#### Scenario: Accepted
- GIVEN a connected site
- WHEN a non-invoicing receipt is confirmed
- THEN an accepted support document number is linked to the receipt

#### Scenario: Offline hybrid receipt
- GIVEN an offline hybrid node
- WHEN a market receipt is confirmed
- THEN stock is recorded locally and the document is issued once after reconnect

#### Scenario: Missing range
- GIVEN a taxpayer without a support-document range
- WHEN issuance is attempted
- THEN nothing is sent, an alert names the taxpayer and stock stays recorded

### Requirement: Supplier E-invoice Intake

The cloud MUST accept a supplier invoice XML, register it with Factus and propose a receipt with lines mapped to ingredients, remembering mappings per supplier. Stock MUST change only when the location owner confirms. A CUFE MUST NOT be loaded twice.

#### Scenario: XML proposes receipt
- GIVEN an XML whose 3 items are mapped
- WHEN uploaded
- THEN a proposed receipt reaches the location owner and stock changes on confirmation

#### Scenario: Duplicate CUFE
- GIVEN an invoice already loaded
- WHEN uploaded again
- THEN it is rejected

#### Scenario: Unmapped item
- GIVEN a line with no known ingredient
- WHEN uploaded
- THEN the receipt is held until mapped

### Requirement: Cost Visibility

Receivers without "view costs and margins" MAY enter cost but MUST NOT see average cost.

#### Scenario: Warehouse keeper
- GIVEN a warehouse keeper without "view costs"
- WHEN recording a receipt
- THEN it is saved and no average cost is shown

#### Scenario: Administrator
- GIVEN an administrator with "view costs"
- WHEN viewing it
- THEN the average cost is shown
