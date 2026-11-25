# Requirements Specification — Parkinson Classifier SaaS

## 1. Context and Objective

The platform is a SaaS service supporting binary classification **H** (Healthy) / **PD** (Parkinson's Disease) based on PaHaW graphomotor features. It is an educational project for Secure Cloud Computing: **not** a clinically validated diagnostic device. The MVP is a web application integrated with a database and an already-trained ML model, deployed in a local containerized environment; the reference architecture is broader and includes separate services, high availability, retraining, and scaling.

## 2. System Boundary and Actors

The boundary of the UML diagrams is **the entire Parkinson Classifier SaaS platform** (UI, backend, database, inference service, and automated processes). **External actors:**

- **A1 — Local Doctor:** works exclusively on patients under their ownership, inputs features, views predictions, and optionally confirms/corrects results.
- **A2 — System Administrator (application role):** manages reassignments, configuration, and monitoring; cannot view cleartext clinical data through the application role.

The **ML engine is internal** to the system and does not appear as an actor; similarly, NGINX, database, retraining worker, and scheduler are internal components. An *ML Engineer* becomes an actor only in a separate diagram of the offline training procedure, with a different boundary.

## 3. Scope

**Implemented / to-be-completed MVP:** login; 2-role RBAC and ownership; patient UI and feature form; prediction via API; history/reports and basic audit; a relational database; Docker and local Kubernetes deployment; NGINX/TLS/rate limit; Docker Scout and `wrk` tests.

**Architectural design only:** separate microservices, East-West mTLS, actual VPC and subnets, ASL and custom autoscaling, primary/replica database and full failover, dedicated registry, WAF, SLA monitor, asynchronous triggered training and hot swap; full end-to-end GDPR.

**Legend:** **Must** = necessary requirement within the indicated scope; **Should** = desirable; **Arch.** = designed, not necessarily implemented; **Basic MVP** = simplified version actually demonstrable.

## 4. Functional Requirements (FR)


| ID    | Category                      | Verifiable Requirement                                                                                                                                                  | Priority | Scope                              | Verification/Acceptance                                                            |
| ----- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| RF-01 | Authentication                | The system must allow Doctor and Administrator to authenticate and manage a session/token with expiration.                                                              | Must     | MVP                                | Valid/invalid login and expiration verifiable.                                     |
| RF-02 | Role-based Authorization      | The backend must distinguish Doctor and Administrator and authorize each operation according to the role.                                                               | Must     | MVP                                | A role lacking permission receives a rejection even when calling the API directly. |
| RF-03 | Ownership Isolation           | The Doctor must view and modify only the data of patients of whom they are the owner at the time of the request.                                                        | Must     | MVP                                | No data of patient B leaks to doctor A in list, detail, report, or prediction.     |
| RF-04 | Patient Reassignment          | The Administrator must be able to reassign a patient to another Doctor; ownership is verified on every operation, and revocation takes effect upon commit.              | Must     | Basic MVP; Arch. for full workflow | After reassignment, the former doctor can no longer access the patient.            |
| RF-05 | Audit Trail                   | The system must log at least authentications, relevant accesses, predictions, and reassignments with actor, event, timestamp, and outcome.                              | Must     | Basic MVP                          | Events viewable in protected form, without tokens or superfluous clinical data.    |
| RF-06 | Patient Management            | The Doctor must be able to create, list, view, and update the demographics of their own patients; deletion must be governed separately.                                 | Must     | Basic MVP                          | Operations allowed only on own records and validated server-side.                  |
| RF-07 | Input for Allowed Tasks       | The Doctor must be able to enter the feature vector referring exclusively to PaHaW tasks 1, 2, and 3.                                                                   | Must     | MVP                                | The form uses the features specified by the JSON contract.                         |
| RF-08 | Feature Validation            | The API must reject unexpected keys or non-compliant values and apply an explicit policy on missing values.                                                             | Must     | MVP                                | Unknown feature → error; missing/NaN policy defined and tested.                    |
| RF-09 | Prediction Request            | An authorized Doctor must be able to request an H/PD classification on the selected patient.                                                                            | Must     | MVP                                | Valid request with available model returns compliant class.                        |
| RF-10 | Result Recording              | A valid prediction must produce a persisted report associated with the patient, with timestamp and model version.                                                       | Must     | MVP                                | Report available in the history of the correct patient.                            |
| RF-11 | Clinical Feedback             | The Doctor should be able to confirm or report an error on a prediction for their patient.                                                                              | Should   | Arch.; Optional MVP                | Feedback linked to the specific prediction and doctor.                             |
| RF-12 | Prediction History            | The Doctor should be able to view the history of reports/predictions of their own patients.                                                                             | Should   | MVP                                | Search and detail respect ownership.                                               |
| RF-13 | Versioned ML I/O Contract     | The system must adopt the canonical set of 63 features from the schema file, vectorized in deterministic order by the server, and document the request/response format. | Must     | MVP                                | Schema–pipeline–API correspondence, automatable test.                              |
| RF-14 | ML Pipeline                   | The pipeline must include imputation, standardization, filter feature selection (Mutual Information), and classifier.                                                   | Must     | MVP                                | Serialized bundle includes all trained steps.                                      |
| RF-15 | No Synthetic Augmentation     | Training must use only real cases foreseen by the scope, without synthetic generation of samples.                                                                       | Must     | MVP / Arch.                        | Training procedure documented and reproducible.                                    |
| RF-16 | Inference on Serialized Model | In real mode, the API must perform inference with a compatible joblib bundle, rejecting a request when the model is unavailable.                                        | Must     | MVP                                | No demo prediction passed off as a real model.                                     |
| RF-17 | Conditional Retraining        | The designed system should trigger an asynchronous process when validated clinical error exceeds the configured threshold.                                              | Should   | Arch. Only                         | Trigger and conditions described; not required in the demo.                        |
| RF-18 | Zero-Downtime Model Update    | The designed system should publish a new version and allow switching to the active model without interrupting inference.                                                | Should   | Arch. Only                         | Rollback/hot-swap flow described.                                                  |
| RF-19 | Model/Data Separation         | ML artifacts must be stored separately from identifying clinical data, with distinct permissions.                                                                       | Must     | Basic MVP / Arch.                  | Bundle outside the clinical database; consistent permissions.                      |
| RF-20 | Web App with DB               | The prototype must provide UI and API integrated with a relational database for users, patients, and reports.                                                           | Must     | MVP                                | Login→patient→prediction→history flow executable.                                  |
| RF-21 | Container and Deployment      | The prototype must be containerized via Docker and run in a local Kubernetes cluster with at least one control plane and one worker.                                    | Must     | MVP                                | Manifests, images, and startup procedure reproducible.                             |
| RF-22 | Secure Reverse Proxy          | External access must go through NGINX with HTTPS/TLS termination and documented rate limiting.                                                                          | Must     | MVP                                | TLS test, routing, and response upon threshold exceedance.                         |
| RF-23 | Vulnerability Analysis        | Images must be analyzed with Docker Scout; fixable vulnerabilities must be mitigated and results compared/documented.                                                   | Must     | MVP                                | Before/after report and rationale for residual CVEs.                               |




## 5. Non-Functional Requirements (NFR)


| ID     | Quality/Constraint                   | Objective                                                                                                                        | Scope                               | Verification/Evidence                                                                     |
| ------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| RNF-01 | Prediction Latency                   | End-to-end ≤ 1 s during the operational window, at reference load.                                                               | Arch. target; MVP local measurement | Timing and percentile tests with explicit methodology.                                    |
| RNF-02 | Peak Capacity                        | Sustain up to 5,000 requests/minute.                                                                                             | Arch. target; MVP local benchmark   | Observed throughput and gap toward target declared.                                       |
| RNF-03 | User Sizing                          | Design for approximately 50,000 total clients/users.                                                                             | Arch. Only                          | Sizing assumptions and simulation documented.                                             |
| RNF-04 | Service Window                       | Monday–Friday 08:00–18:00.                                                                                                       | Arch.                               | Window and time zone specified in SLA.                                                    |
| RNF-05 | Availability and Reliability         | Target availability and reliability ≥ 99.5% within the service window.                                                           | Arch. Only                          | SLA defined with measurement criteria, not claimed verified on laptop.                    |
| RNF-06 | Fault Recovery                       | Recovery/failover expected within 3 minutes for critical components.                                                             | Arch. Only                          | Failover scenario and preconditions described.                                            |
| RNF-07 | Retraining Resource Isolation        | Retraining must not degrade the synchronous path; separate resources.                                                            | Arch. Only                          | Resource pools or limits in the design.                                                   |
| RNF-08 | Pod Self-Healing                     | The prototype must demonstrate observable recovery of an application Pod after failure.                                          | MVP                                 | Pod restart and endpoint resumption demo.                                                 |
| RNF-09 | Perimeter Security                   | External requests must use HTTPS/TLS via NGINX.                                                                                  | MVP / Arch.                         | Valid TLS negotiation and HTTP explicitly handled.                                        |
| RNF-10 | Internal Traffic Protection          | mTLS for inter-service channels designed in the private subnet.                                                                  | Arch. Only                          | Trust design, certificates, and termination actors.                                       |
| RNF-11 | Data Encrypted at Rest               | Encryption at rest of clinical data, backups, and sensitive artifacts.                                                           | Arch.; MVP document limits          | Mechanisms/limits and responsibilities indicated.                                         |
| RNF-12 | DoS Defense and WAF                  | Rate limiting in the MVP; WAF at the architectural level.                                                                        | MVP rate; Arch. WAF                 | Thresholds, responses, and limits tested/declared.                                        |
| RNF-13 | ML Artifact Separation               | Registry/model bundles separated from identifiable clinical data.                                                                | Basic MVP / Arch.                   | Paths and permissions documented.                                                         |
| RNF-14 | Data Protection and Right to Erasure | Design record deletion upon legitimate request and exclusion from future retraining; evaluate effects on already trained models. | Arch. Only                          | Deletion process and explicit limits.                                                     |
| RNF-15 | Administrator Privileges             | The Admin application role must not be able to view cleartext clinical data.                                                     | MVP / Arch.                         | Admin API and UI without clinical access; infrastructure privileges evaluated separately. |
| RNF-16 | Result Usability                     | Form and response must clearly distinguish H/PD and display a non-diagnostic disclaimer.                                         | MVP                                 | Understandable flow and results not presented as a diagnosis.                             |
| RNF-17 | Model Traceability                   | Every response/report must include `model_version` or another unambiguous version ID.                                            | MVP                                 | Version visible and persisted in the report.                                              |
| RNF-18 | Project Traceability                 | Every architectural block must be labeled implemented/approximated/designed.                                                     | Deliverable                         | Component matrix attached.                                                                |
| RNF-19 | AI Usage Tracking                    | Log substantial AI-assisted activities with human review.                                                                        | Deliverable                         | AI logs updated and accessible.                                                           |
| RNF-20 | Feature Perimeter                    | Only tasks 1–2–3 (spiral, “l”, “le”).                                                                                            | MVP                                 | Schema with 63 names and corresponding tasks.                                             |
| RNF-21 | Filter Feature Selection             | Selection via Mutual Information, inside cross-validation.                                                                       | MVP                                 | Verifiable code pipeline; no leakage in CV.                                               |
| RNF-22 | Model Validation                     | Model selection based on CV on train, not on the final test set.                                                                 | MVP                                 | Train/CV/test report and selection criterion documented.                                  |
| RNF-23 | ML Baseline                          | Linear SVM used as initial demo model, with subsequent updates only if designed/approved.                                        | MVP                                 | Model and version explicitly stated in the demo.                                          |




## 6. User Stories and Acceptance Criteria (Gherkin)

User stories align technical development with clinical/governance value. Format: *As a \<role\>, I want \<capability\>, so that \<benefit\>*. Acceptance criteria use Given–When–Then.

### US-01 — Clinically authorized prediction

**Story:** As a Local Doctor, I want to submit PaHaW task 1–2–3 features for a patient I own and receive an H/PD outcome, so that I can support screening without accessing other doctors’ patients.

**Acceptance criteria:**

- **A (valid owned request):** Given I am authenticated as Doctor and owner of patient P, When I submit 63 schema-valid features, Then I receive `prediction`, `label`, and `model_version`, and the report is persisted on P (design target ≤ 1 s end-to-end).
- **B (ownership denied):** Given I am not the owner of P, When I call predict on P, Then the API returns 403, writes a rejection audit, and performs no inference.
- **C (model unavailable):** Given the serialized model is not loaded, When I request a prediction, Then the system returns an explicit error (e.g. 503) and never invents a class.

### US-02 — Ownership isolation and patient migration

**Story:** As a System Administrator, I want to reassign a patient from Doctor A to Doctor B, so that clinical access always follows the current ownership.

**Acceptance criteria:**

- **A (revocation):** Given the transfer of patient P from A to B has committed, When A attempts read or predict on P, Then the API returns 403.
- **B (new owner):** Given the same transfer has committed, When B opens P, Then access is allowed.
- **C (admin cleartext ban):** The Administrator UI/API never exposes clinical features or prediction outcomes in cleartext (RNF-15).

### US-03 — Clinical feedback and governance metric

**Story:** As a Local Doctor, I want to confirm or correct a prediction on my patient, so that the clinically validated error rate can feed conditional retraining.

**Acceptance criteria:**

- **A (scope):** Only the current owner may submit feedback; each event is linked to the specific report and its `model_version`.
- **B (metric):** Only confirm/correct feedbacks enter the error-rate denominator; predictions without feedback are excluded.

### US-04 — Conditional retraining governance (Arch.)

**Story:** As a System Administrator, I want to configure the minimum sample size N and the error threshold and monitor jobs, so that a new model can be published with zero downtime without my launching training by hand.

**Acceptance criteria:**

- **A (trigger):** Given at least **N ≥ 10** feedbacks on the active model version and `validated_error_rate ≥ 60%`, When the policy is satisfied, Then the Retraining Worker starts in the batch pool (RF-17).
- **B (isolation / hot-swap):** Publication uses the Model Registry hot-swap; the online prediction path is not degraded (RF-18, RNF-07).
- **C (monitoring):** The admin dashboard shows job state and active `model_version` only—no clinical payloads.

### US-05 — Online elasticity (Arch.)

**Story:** As a System Administrator, I want Gateway, Clinical Core, and Inference to scale via the Automated Scaling Listener, so that the service can absorb peaks up to 5,000 req/min in the Mon–Fri 08:00–18:00 window.

**Acceptance criteria:**

- **A (scale):** Given load above the configured guard threshold, When traffic rises, Then the system scales out; when load falls after the stabilization window, Then it scales in.
- **B (pooling):** The Retraining Worker does **not** scale in the same pool as the online path (Resource Pooling).



## 7. Minimum MVP Acceptance Criteria

1. An authenticated doctor cannot obtain patient information belonging to another doctor via either UI or API, including lists, reports, and predictions.
2. A schema-compliant input from an authorized doctor produces a `prediction`, `label`, `model_version` response **when the real model is loaded**. Absence of the model: explicit error, not a plausible placeholder prediction.
3. The contract establishes 63 allowed names, only from tasks 1–2–3. Unknown inputs are rejected; a policy for missing/null keys is formalized.
4. The prediction and model version are saved on the correct patient and appear in the history.
5. The app runs in Docker/Kubernetes behind NGINX with HTTPS and rate limiting; build and deployment documented.
6. Docker Scout scan with before/after evidence, any residual vulnerabilities, and rationale.
7. `wrk` produces repeatable metrics (throughput, latency, errors, and load parameters); the report distinguishes the local result from the architectural SLA.
8. Upon deleting an application Pod, the service becomes available again through the configured Kubernetes mechanisms (demo scenario).



## 8. System Behavior — Sequence Diagrams

> This section shows how the components interact in the **three** main use cases (SD-01 prediction, SD-02 reassignment, **SD-03 retraining governance**). SD-03 is **architectural** (designed), not part of the MVP acceptance criteria in §7.



### 8.1 SD-01 — End-to-End Clinical Prediction

**Title:** Doctor authentication, ownership, feature validation, inference, and report persistence

**Objective:** trace the synchronous path from login to H/PD outcome saved in history.

**Covered requirements:** RF-01, RF-02, RF-03, RF-05, RF-07, RF-08, RF-09, RF-10, RF-13, RF-16, RF-20; RNF-16, RNF-17.

**Acceptance criteria (§7):** 1, 2, 3, 4.

```mermaid
sequenceDiagram
    autonumber
    actor Medico as A1 Local Doctor
    participant UI as Frontend UI
    participant API as Backend API
    participant DB as Clinical DB
    participant ML as ML Inference

    Note over Medico,ML: SD-01 — synchronous clinical path (MVP)

    Medico->>UI: Enters credentials
    UI->>API: POST /api/auth/login
    API->>DB: Verifies credentials and DOCTOR role
    DB-->>API: Authenticated user
    API-->>UI: Session / cookie (RF-01)
    UI-->>Medico: Opens doctor workspace

    Medico->>UI: Selects own patient and submits task 1–2–3 features
    UI->>API: POST /api/clinical/patients/{id}/.../predict
    Note over API: Checks RF-02 (role) and RF-03 (ownership)

    API->>DB: Verifies current patient ownership
    alt Doctor not owner or not authorized
        DB-->>API: Ownership absent
        API->>DB: Writes rejection audit (RF-05)
        API-->>UI: 403 Forbidden
        UI-->>Medico: Access denied
    else Doctor is owner
        DB-->>API: Ownership confirmed
        API->>API: Validates 63-feature contract (RF-08, RF-13)
        alt Features non-compliant or unknown
            API-->>UI: 400 Bad Request
            UI-->>Medico: Input validation error
        else Compliant features
            API->>ML: POST /predict with feature vector
            alt Model absent or invalid response
                ML-->>API: 503 / error
                API->>DB: Writes failure audit (RF-05)
                API-->>UI: 503 model unavailable (RF-16)
                UI-->>Medico: No simulated class
            else Inference succeeded
                ML-->>API: prediction, label, model_version
                API->>DB: Persists report + model_version (RF-10, RNF-17)
                API->>DB: Writes prediction audit (RF-05)
                DB-->>API: Persistence OK
                API-->>UI: H/PD outcome and model version
                UI-->>Medico: Displays result and history (RNF-16)
            end
        end
    end

```





### 8.2 SD-02 — Patient Reassignment and Immediate Ownership Revocation

**Title:** Administrative transfer, atomic commit, former doctor access attempt, and new owner access

**Objective:** demonstrate multi-tenant isolation and immediate revocation after reassignment, without exposing clinical data to the admin.

**Covered requirements:** RF-01, RF-02, RF-03, RF-04, RF-05; RNF-15.

**Acceptance criteria (§7):** 1 (also after transfer).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as A2 Administrator
    actor DoctorA as A1 Outgoing Doctor
    actor DoctorB as A1 Incoming Doctor
    participant UI as Frontend UI
    participant API as Backend API
    participant DB as Clinical DB

    Note over Admin,DB: SD-02 — dynamic ownership (basic MVP)
    Note over Admin,UI: Admin does not read features or clinical outcomes (RNF-15)

    Admin->>UI: Administrator login
    UI->>API: POST /api/auth/login
    API->>DB: Verifies credentials and ADMIN role
    DB-->>API: ADMIN user
    API-->>UI: Admin session (RF-01, RF-02)

    Admin->>UI: Requests transfer of patient P from DoctorA to DoctorB
    UI->>API: Reassignment request (expectedDoctorId, toDoctorId)
    API->>API: Authorizes ADMIN role only (RF-02)

    API->>DB: Transaction UPDATE ownership P → DoctorB
    DB-->>API: Commit succeeded (RF-04)
    API->>DB: Writes reassignment audit (RF-05)
    API-->>UI: Transfer confirmed
    UI-->>Admin: Assignment updated (metadata only)

    Note over DoctorA,DB: Upon commit DoctorA loses all privileges on P

    DoctorA->>UI: Attempts opening or predicting on patient P
    UI->>API: GET/POST on resources of P
    API->>DB: Verifies current ownership
    DB-->>API: Current owner = DoctorB
    API->>DB: Writes access denied audit (RF-05)
    API-->>UI: 403 Forbidden
    UI-->>DoctorA: Access denied (RF-03)

    DoctorB->>UI: Opens assigned patient P
    UI->>API: GET patient P
    API->>DB: Verifies current ownership
    DB-->>API: Current owner = DoctorB
    API-->>UI: Allowed clinical data
    UI-->>DoctorB: Patient view and history

```





### 8.3 SD-03 — Conditional Retraining and Hot-Swap (Administrator governance)

**Title:** Threshold configuration, automatic trigger, offline retraining, registry publish, and admin monitoring without clinical cleartext

**Objective:** show the asynchronous model lifecycle: the Administrator governs policy and observes job state; training runs in the isolated Retraining Worker when the clinically validated error rate breaches the policy (see `02_cloud architecture.md` §3.4).

**Covered requirements:** RF-05, RF-11 (feedback upstream), RF-15, RF-17, RF-18, RF-19; RNF-07, RNF-13, RNF-15, RNF-17.

**Scope:** Arch. Only (not required in the local MVP demo; MVP retains dual joblib artifacts for simulated baseline swap).

**Policy defaults (reference):** evaluate only after **N ≥ 10** feedbacks on the *active* model version; trigger when `validated_error_rate ≥ 60%` (above expected ~50% operating error of the demo model).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as A2 Administrator
    actor Doctor as A1 Local Doctor
    participant UI as Frontend UI
    participant API as Clinical Core and Auth
    participant DB as Clinical and Identity DB
    participant Mon as SLA / Governance Monitor
    participant Worker as Retraining Worker
    participant Reg as Model Registry
    participant ML as ML Inference

    Note over Admin,ML: SD-03 — asynchronous path (Arch. Only)
    Note over Admin,UI: Admin never reads cleartext features or clinical outcomes (RNF-15)

    Admin->>UI: Login as Administrator
    UI->>API: POST /api/auth/login
    API->>DB: Verifies ADMIN role
    API-->>UI: Admin session

    Admin->>UI: Sets retraining policy (N min, error threshold)
    UI->>API: Configure governance thresholds
    API->>DB: Persists policy (e.g. N≥10, error≥60%)
    API->>DB: Audit: threshold update (RF-05)
    API-->>UI: Policy saved

    Note over Doctor,DB: Upstream clinical feedback (synchronous; feeds the metric)
    Doctor->>UI: Confirms or corrects a prediction (own patient)
    UI->>API: Submit clinical feedback
    API->>DB: Ownership check then store feedback
    API->>DB: Audit: feedback event

    Mon->>DB: Reads feedbacks for active model_version
    Mon->>Mon: If count ≥ N and error_rate ≥ threshold
    Mon->>Worker: Emit retraining trigger (RF-17)
    Note over Worker: Batch pool — does not share online ASL capacity (RNF-07)

    Worker->>DB: Load historical + confirmed task 1–2–3 cases (no IDs to registry)
    Note over Worker: No synthetic augmentation (RF-15)
    Worker->>Worker: Impute → scale → MI filter FS → train → versioned bundle
    Worker->>Reg: Publish new bundle (controlled write)
    Reg-->>Worker: Version registered
    Worker->>ML: Signal hot-swap / reload active version (RF-18)
    ML->>Reg: Read-only fetch of active bundle
    ML-->>Worker: Reload OK (service stays up)
    Worker->>DB: Audit: trigger, N, error_rate, dataset size, version, outcome

    Admin->>UI: Opens monitoring (job state, active model_version)
    UI->>API: GET retraining / model governance status
    API->>DB: Reads job metadata and audit (no clinical payloads)
    API-->>UI: Status: running | succeeded | failed + model_version
    UI-->>Admin: Dashboard without cleartext clinical data

    opt Publish gate fails or Admin requests rollback
        Admin->>UI: Request rollback to previous version
        UI->>API: Rollback active pointer
        API->>Reg: Reactivate previous bundle
        API->>ML: Reload previous version
        API->>DB: Audit: rollback
    end



```



