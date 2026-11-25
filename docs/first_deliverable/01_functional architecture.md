# Functional Architecture — Parkinson Classifier SaaS

**Functional** view

Does not describe services, subnets, or protocols.

The diagram has **two paths** and a cross-cutting governance block.

```mermaid
flowchart TB
  MED["Local Doctor"]
  ADM["System Administrator"]

  subgraph SYNC["Synchronous clinical path"]
    direction TB
    A1["1. Access management<br/>Authentication → RBAC → Ownership"]
    A2["2. Clinical management<br/>Patient profiles · Task 1–2–3 features · Reports"]
    A3["3. Decision support<br/>H / PD classification → Outcome"]
    A4["4. Clinical feedback<br/>Confirmation or correction → Error rate"]
    A1 --> A2 --> A3 --> A4
  end

  subgraph ASYNC["Asynchronous path — model lifecycle"]
    direction TB
    B1["5a. Retraining trigger<br/>if clinical error > threshold"]
    B2["5b. Offline retraining<br/>on real confirmed cases"]
    B3["5c. Publication<br/>new model version"]
    B1 --> B2 --> B3
  end

  subgraph GOV["Cross-cutting operational governance"]
    direction LR
    G1["Threshold configuration"]
    G2["Audit / traceability"]
    G3["SLA verification"]
  end

  MED --> A1
  ADM --> A1
  ADM --> G1
  ADM --> G3

  A4 -->|"feeds"| B1
  B3 -.->|"updated model"| A3
  G1 -.->|"threshold"| B1

  A2 -->|"patient migration<br/>and ownership revocation"| A1
  ADM --> A2

```

## How to Read It

1. **Synchronous (1→4):** what the doctor does in session, up to feedback on the prediction.
2. **Asynchronous (5a→5c):** retraining outside the online path; the new model returns only to classification.
3. **Governance:** thresholds, audit, and SLAs do not interrupt the clinical flow; the admin configures and monitors.

## Summary Legend

| Block | What It Offers | Who Uses It |
| --- | --- | --- |
| 1. Access management | login, roles, ownership | Doctor, Admin |
| 2. Clinical management | patients, features, reports, migration | Doctor (usage); Admin (migration) |
| 3. Decision support | H/PD prediction | Doctor |
| 4. Clinical feedback | confirmation/correction → error rate | Doctor |
| 5. Model lifecycle | trigger, training, publication | System (Admin monitors) |
| Governance | thresholds, audit, SLA | Admin |