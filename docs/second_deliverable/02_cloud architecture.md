# Cloud Architecture Document — Parkinson Classifier SaaS

**Course:** Secure Cloud Computing  
**Track:** 2 — Parkinson’s Disease Classification  
**Group:** 2  
**Academic year:** 2026/2027  
**Status:** design document (provider-agnostic; concrete technologies belong to the implementation phase)

**Related documents:**

- Functional view: `docs/first_deliverable/architecture_funzionale.md`
- Logical narrative: `docs/first_deliverable/report architecture.md`
- Diagram: `docs/first_deliverable/Architecture.png`
- Requirements & sequences: `docs/second_deliverable/requirements and sequence diagrams.md`
- ML offline pipeline: `docs/second_deliverable/model creation report.md`

---

## Abstract

This document maps the **functional architecture** of the Parkinson’s screening SaaS onto **cloud computing mechanisms and architectures**. It does not bind the design to a specific cloud vendor.

The system runs inside a dedicated logical network perimeter (VPC-style), split into public and private zones. A redundant load balancer terminates TLS, applies WAF and rate limiting, and forwards traffic through an Automated Scaling Listener to an API Gateway. Online services are largely **stateless** and scale horizontally; clinical identity, ownership and reports live in an encrypted **Clinical & Identity DB** (primary + replica); ML artifacts live in a separate **Model Registry**. Retraining runs offline in an isolated compute pool and publishes a new bundle by **hot-swap**, without interrupting inference.

The document describes network zones, infrastructure / specialized / security mechanisms, main flows, how the design addresses the SLA, and threat–countermeasure pairs for health data. Technology choices (Docker, Kubernetes, NGINX, etc.) are deferred to implementation (Tasks C–H).

---

## 1. Cloud architecture

The previous phase defined *what* the system does (actors, clinical prediction, feedback, model lifecycle, governance). This phase answers *how* those functions are placed on cloud mechanisms.

Figure reference: follow the synchronous **clinical prediction path** (must complete within **≤ 1 second**) from the physician browser to the ML Inference Service and back. All other flows (retraining, migration, monitoring) are asynchronous or administrative and must not starve the prediction path.

### Design principles

1. **SaaS on IaaS/PaaS** (NIST): complete application to clinicians; virtualized compute and network underneath.
2. **Decoupled online vs offline:** inference is synchronous and latency-critical; retraining is asynchronous and resource-isolated (**Resource Pooling**).
3. **Single clinical-auth hop:** authentication, RBAC and doctor–patient ownership are resolved in one transactional backend (**Clinical Core & Auth**) to avoid ownership inconsistency across services.
4. **No cloud bursting:** health data remain inside the dedicated perimeter (GDPR + latency).
5. **ML contract:** only PaHaW tasks 1–2–3; filter feature selection (Mutual Information); no synthetic augmentation; bundle = imputer + scaler + FS mask + classifier.

### 1.1 Network zones

Traffic is controlled at the outer perimeter (Internet → public zone) and inside the private zone (mTLS between components).

| Zone | Content | Reachable from |
| --- | --- | --- |
| **Public subnet (DMZ-like)** | Load Balancer Cluster (active-active), WAF, rate limiting, TLS termination | Internet (HTTPS only) |
| **Ingress / elasticity** | Automated Scaling Listener (ASL), API Gateway | Public subnet only |
| **Application (online pool)** | Frontend UI, Clinical Core & Auth, ML Inference (N instances each) | Via API Gateway; internal mTLS |
| **Data** | Clinical & Identity DB (Primary + Replica), audit logs | Application zone (Clinical Core) |
| **Model / training** | Model Registry; Retraining Worker (batch pool) | Inference: read-only registry; Worker: controlled write; no direct Internet |
| **Management & monitoring** | Failover System, SLA Monitor, hardened images, admin configuration plane | Administrators; no cleartext clinical browse for the application Admin role |

**Why isolate identity/clinical DB from the Model Registry.** Credentials, ownership and identifiable clinical records stay in the Clinical & Identity DB. The registry stores only mathematical artifacts (parameters, selected-feature mask, weights) without patient identifiers, so compromise of the training/registry path does not directly expose identities.

**Why isolate the retraining pool.** Training is CPU-heavy, has no ≤1 s constraint, and must not contend with the online path during Mon–Fri 08:00–18:00.

---

## 2. Cloud mechanisms

### 2.1 Infrastructure mechanisms

#### 2.1.1 Logical network perimeter

An outer perimeter separates the SaaS from other cloud consumers. Inner segregation splits public ingress from private application/data/training zones. The data zone is reachable only from authorized application components; the training/registry path receives confirmed feature vectors/labels without needing browser exposure.

#### 2.1.2 Virtual server

Each online service runs on its own virtual servers (or equivalent containers in the MVP) created from **hardened images**. Services are sized and scaled independently so that a fault in inference does not take down authentication, and vice versa.

#### 2.1.3 Cloud storage device

Storage is specialized by sensitivity and use:

| Store | Content | Notes |
| --- | --- | --- |
| Clinical & Identity DB | Users, roles, ownership, patients, reports, clinical feedback, audit | Encrypted at rest; primary–replica |
| Model Registry | Versioned `joblib` bundles (imputer, scaler, MI mask, classifier) | No personal identifiers; read-only for inference |
| (Optional) feature archive for retraining | Confirmed task-1–2–3 vectors + labels | Separated from UI session data; used only by the Retraining Worker |

**Elastic Disk Provisioning is not adopted:** data volume is not the bottleneck for the 5,000 req/min or ≤1 s targets; elastic disk would optimize cost more than clinical latency.

#### 2.1.4 Resource replication

Replication supports both **scale-out** (new service instances) and **recovery** (DB replica promotion, redundant load balancers). Online services keep at least two instances in the target design to enable active-active failover.

### 2.2 Specialized mechanisms

#### 2.2.1 Load balancer

The Load Balancer Cluster is the external entry point: HTTPS/TLS termination, WAF filtering, per-client / global **rate limiting** aligned with the 5,000 req/min peak, and distribution across healthy instances. It removes a single perimeter SPOF via active-active pairing.

#### 2.2.2 Automated Scaling Listener (ASL)

The ASL observes request volume on the path toward the API Gateway during the operational window. When thresholds are exceeded it triggers **horizontal scale-out** of API Gateway, Clinical Core & Auth, and ML Inference; when load drops it scales in. The Retraining Worker is **not** scaled with the same pool (see Resource Pooling).

#### 2.2.3 Failover system

Health checks cover critical nodes (inference instances, DB primary). On failure, traffic is redirected and the replica can be promoted. Target: average switchover **≤ 3 minutes**, supporting availability ≥ 99.5%. The Retraining Worker is restartable without blocking online inference.

#### 2.2.4 SLA monitor

Continuously measures reachability at the load balancer and processing time along the gateway/clinical/inference path against the ≤1 s budget, and can surface model-governance signals (validated error rate, retraining job state, active registry version).

#### 2.2.5 Audit monitor / audit trail

Accesses to clinical operations (login, ownership checks, predictions, migrations, retraining events) are recorded with actor, action, timestamp and outcome. Logs are integrity-oriented (services should not be able to silently rewrite history). The application **Administrator** configures thresholds and migrations but does **not** receive cleartext clinical feature payloads through the admin UI.

### 2.3 Security mechanisms

| Mechanism | Role in this architecture |
| --- | --- |
| Perimeter TLS (HTTPS) | Confidentiality and integrity browser ↔ load balancer |
| mTLS (East–West) | Encrypted authenticated channels inside the private subnet |
| WAF + rate limiting | Block common web attacks; mitigate application-layer DoS |
| IAM / RBAC | Roles: Local Physician, System Administrator |
| Doctor–patient ownership | Per-request authorization beyond role; instantaneous revoke on migration |
| Encryption at rest | Clinical DB and sensitive stores |
| Hardened images | Minimal OS/services; vulnerability scanning before promotion (implementation: Docker Scout) |
| Model/data separation | Registry without identifiers; training on confirmed features/labels only |
| No cloud bursting | Prevents health-data exfiltration to an uncontrolled external cloud |

### 2.4 Elasticity architectures (Ch. 11) — adoption map

| Mechanism / architecture | Adopted? | Binding to blocks |
| --- | --- | --- |
| **Resource Pooling** | Yes | Online pool (Gateway, Clinical Core, Inference) vs batch pool (Retraining Worker) |
| **Elastic Resource Capacity** | Selective | Horizontal scale-out/in via ASL on online path; **vertical** burst for a single retraining job |
| **Elastic Disk Provisioning** | No | Not required for SLA-critical path |
| **Cloud Bursting** | No | GDPR perimeter + ≤1 s latency |

### 2.5 Block ↔ mechanism summary

| Architecture block | Cloud mechanism | Why (SLA / GDPR) |
| --- | --- | --- |
| Load Balancer Cluster | Redundancy, TLS termination, WAF, rate limiting | Availability; absorb peaks; protect ingress |
| ASL | Horizontal elastic capacity | Keep ≤1 s under 5,000 req/min in 08:00–18:00 |
| API Gateway | Controlled entry, token pre-check | Short trusted path into clinical/inference |
| Clinical Core & Auth | IAM + ownership isolation | Multi-tenant GDPR; atomic migration |
| Clinical & Identity DB | Encrypted storage + replication | Continuity; ownership consistency |
| ML Inference | Stateless horizontal scale + model in memory | Millisecond predict; no training I/O on request |
| Model Registry | Least privilege artifact store | No patient IDs in the bundle |
| Retraining Worker | Isolated pool + vertical elasticity | Protect online SLA |
| Failover System | Dynamic recovery | Outage ≤3 min average |
| SLA Monitor | Observability | Evidence vs contractual targets |

---

## 3. Main flows

### 3.1 Clinical prediction path (synchronous, ≤ 1 s)

1. The **Local Physician** submits HTTPS request with session token (feature vector for tasks 1–2–3).
2. **Load Balancer** terminates TLS, applies WAF and rate limiting.
3. **ASL** accounts the request for scaling; **API Gateway** routes inward over mTLS.
4. **Clinical Core & Auth** validates token, role, and **current ownership**; audits the access; persists/validates the feature vector if authorized. Otherwise the call stops (403) with no inference hop.
5. Gateway forwards the numeric vector to **ML Inference**, which uses the **active in-memory** bundle from the Model Registry (loaded at start or on publish—not fetched from disk on every request).
6. Pipeline applies impute → scale → filter mask → classify → returns H/PD (and probability in the full design).
7. Clinical Core stores the report with **model_version** and returns the outcome to the UI within ≤1 s.

### 3.2 Clinical feedback

The physician confirms or corrects a prediction. Feedback is stored against the report and contributes to the **clinically validated error rate** used by the retraining trigger.

### 3.3 Patient migration (administrator)

1. Administrator requests reassignment of patient P from physician A to B (no cleartext feature view required).
2. Clinical Core commits an atomic ownership update on the Clinical & Identity DB.
3. From that commit, A fails ownership checks; B may access P. The event is audited.

### 3.4 Training and publication of a new model (asynchronous)

1. When validated error rate exceeds the configured threshold (e.g. > 5%), a trigger is raised to the **Retraining Worker** (administrator may monitor; training is not run by hand).
2. Worker builds a training set from historical + newly **confirmed** cases, **tasks 1–2–3 only**, **no synthetic augmentation**.
3. Re-runs impute, scale, Mutual Information filter FS, trains classifier, serializes a versioned bundle.
4. Publishes to the **Model Registry** (hot-swap). Inference instances reload the active version gradually so service stays up.
5. Retraining audit is written (trigger, dataset size, version, outcome).

---

## 4. Service Level Agreement and security

### 4.1 SLA targets (Track 2)

| Parameter | Target |
| --- | --- |
| User base | ~50,000 clients |
| Peak load | Up to 5,000 requests/minute (≈ 83.3 req/s average at peak) |
| Operational window | Monday–Friday 08:00–18:00 |
| End-to-end response time | ≤ 1 second (prediction path) |
| Availability | ≥ 99.5% in the window |
| Reliability | ≥ 99.5% |
| Outage duration | Average ≤ 3 minutes; maximum ≤ 30 minutes |

**Availability budget (illustrative).** Over a month with 22 working days × 10 h = 220 operating hours, 99.5% availability allows about **1.1 hours** of unavailability in that window. Automation (failover, multi-instance) is therefore mandatory; manual recovery alone is too slow.

### 4.2 How the architecture meets the SLA

| SLA parameter | Mechanisms |
| --- | --- |
| Availability ≥ 99.5% | Active-active LB; ≥2 online instances (design); DB replica; failover system |
| Outage avg ≤ 3 min / max ≤ 30 min | Health checks, automatic replacement/promotion; rolling model reload |
| Reliability ≥ 99.5% | Stateless inference (retryable); ownership checks fail closed; auditability |
| Response time ≤ 1 s | Short sync path; model cached in RAM; no retraining on the request path; ASL scale-out |
| 50k users / 5k req/min | LB + rate limiting + horizontal scaling of gateway/clinical/inference |
| Protect online path | Separate resource pool for Retraining Worker |

Instance counts and exact ASL thresholds are fixed in implementation through stress testing (`wrk` on the local MVP stack).

### 4.3 Security

#### 4.3.1 Threat agents

- Anonymous attacker on the Internet  
- Trusted attacker (authenticated physician trying another physician’s patients)  
- Malicious insider (administrator probing clinical payloads)  
- Malicious service agent (eavesdropping or altering East–West traffic)

#### 4.3.2 Threats and countermeasures

| Threat | Countermeasures |
| --- | --- |
| Traffic eavesdropping | HTTPS at perimeter; mTLS inside private subnet |
| Malicious intermediary | TLS with server authentication; WAF |
| Denial of service | Rate limiting, WAF, ASL for legitimate peaks |
| Insufficient authorization | RBAC + **per-request ownership**; fail closed; audit |
| Overlapping trust boundaries | Zone segregation; registry vs clinical DB; admin UI without clinical features |
| Virtualization attack | Hardened images; least privilege; network limits between tiers |
| Malicious insider | Encryption at rest; no cleartext clinical browse for Admin role; audit; training without identifiers in the registry |
| Data exfiltration via bursting | Cloud bursting **excluded** |

Most critical for this SaaS: **insufficient authorization** (cross-tenant clinical leakage) and **denial of service** (screening unavailable in the operational window).

---

## 5. Traceability: design vs local MVP

| Concern | Cloud design (this document) | Local MVP (implementation track) |
| --- | --- | --- |
| Entry | LB + WAF + rate limit | Approximated by app server + later NGINX TLS/rate limit |
| Auth / ownership | Clinical Core + DB | Implemented in monolithic API + SQLite |
| Inference | Stateless ML service + registry | Python `/predict` + `pipeline.joblib` |
| Scaling / ASL | Designed | Not implemented; document gap vs 5k req/min |
| mTLS / multi-AZ | Designed | Not in laptop demo |
| Retraining hot-swap | Designed | Baseline SVM artifact reserved; full worker later/optional |
| Evidence | SLA Monitor (designed) | Local timing + future `wrk` / Scout reports |

Every architectural block in presentations should be labelled **implemented**, **approximated**, or **designed**.

---

## 6. Conclusions

The cloud architecture maps Parkinson functional blocks onto perimeter security, elastic online services, isolated retraining, replicated clinical storage, and a identifier-free model registry. Resource Pooling and selective Elastic Capacity protect the ≤1 s path; Cloud Bursting and Elastic Disk Provisioning are rejected as misaligned with GDPR and SLA priorities.

**Next phase (implementation):** choose concrete technologies for each mechanism, containerize the stack, deploy to a local Kubernetes cluster with NGINX TLS/rate limiting, scan images (Docker Scout), calibrate scaling/load with `wrk`, and demonstrate pod recovery—while keeping the clinical prediction contract (63 features, tasks 1–2–3, real model, no fake stub classes) unchanged.
