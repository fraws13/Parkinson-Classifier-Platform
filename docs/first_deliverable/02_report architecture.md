## 1. Architectural Framing and Reference Models

The designed architecture implements a cloud-native **Software-as-a-Service (SaaS)** platform for clinical decision support in the classification of Parkinson's disease based on graphomotor features. According to the **NIST** taxonomy, the system exposes a complete web application (SaaS) to the end user, built on virtualized compute and network resources (IaaS/PaaS) within a dedicated **Virtual Private Cloud (VPC)**.

From a structural standpoint, the system adopts a **Decoupled Microservices** style combined with the **Database-per-Service** pattern and strict **network segregation** between the Public Subnet and the Private Subnet. Authentication, RBAC, and the clinical domain are **consolidated** into a single transactional backend (**Clinical Core & Auth Service**), while inference and retraining remain dedicated services: this avoids internal round-trips and ownership inconsistencies on every query, without sacrificing selective scaling of computationally intensive components. The system satisfies the contractual service constraints (**SLA**): a user base of 50,000 users, peaks of 5,000 requests/minute, an operational window from Monday to Friday (08:00–18:00), end-to-end latency ≤ 1 second, and availability (*availability* and *reliability*) ≥ 99.5%.

The model lifecycle is not static: in addition to synchronous inference, the architecture provides an asynchronous **Continuous Training** flow that hot-updates the bundle in the **Model Registry** whenever the clinically validated error rate exceeds a predefined threshold (e.g., > 5%), without interrupting the online service.

---



## 2. Detailed Component Analysis



### 2.1 Authenticated Actors (RBAC Access Control)

Interaction with the platform is governed by **Role-Based Access Control (RBAC)** policies that differentiate operational privileges based on the professional profile:

- **1. Local Physician:** The primary clinical actor. They use the platform to submit graphomotor feature vectors acquired during tests, initiate diagnostic inference, consult medical reports exclusively for their own patients, request specialist consultations if needed, and **report/validate prediction errors** (clinical feedback used to calculate the error rate that can trigger retraining).
- **2. System Administrator:** The technical manager of the platform and model lifecycle governance. They oversee operational configuration, retraining trigger thresholds, and *Patient Migration* procedures; they do not have plaintext access to individual patients' personal data and do not manually execute training, which runs in the background via the **Retraining Worker**.



### 2.2 Public Perimeter (Public Subnet)

The **Public Subnet** constitutes the sole point of contact exposed to the Internet and is designed to absorb, filter, and encrypt external traffic before it reaches internal services:

- **Load Balancer Cluster (Active-Active):** A redundant pair of simultaneously active load balancers to eliminate any perimeter *Single Point of Failure (SPOF)*. It handles **HTTPS/TLS termination** (*Data-in-Transit*) and evenly distributes incoming requests. It integrates a **Web Application Firewall (WAF)** to block malicious payloads (e.g., SQL injection, XSS) and **Rate Limiting** mechanisms calibrated to the maximum threshold of **5,000 requests/minute** to mitigate application-level DoS attacks.



### 2.3 Ingress and Elasticity Layer (Private Subnet)

All traffic passing through the public perimeter enters the **Private Subnet**, a network completely isolated from the outside where every internal communication is encrypted via **Mutual TLS (mTLS)**:

- **Automated Scaling Listener (ASL):** Implements the formal *Service Agent* mechanism. Positioned directly along the communication path between the Load Balancer and the API Gateway, it intercepts and measures traffic volume in real time during the operational window (**Mon–Fri, 08:00–18:00**). When load thresholds are exceeded, it triggers *Scaling Out* (provisioning new instances) and, once the peak subsides, *Scaling In* (releasing excess resources).
- **API Gateway:** Serves as the *Single Entry Point* for the microservices ecosystem. It performs request routing to backend services, response aggregation, mTLS security policy enforcement, and preliminary validation of session tokens.



### 2.4 Independent Microservices (Bounded Contexts)

Application logic is decomposed into decoupled microservices, each equipped with internal balancing (*Internal Load Balancing*):

- **Frontend UI Service:** Delivers the web interface of the application, allowing the physician to enter kinematic/graphomotor parameters of the **selected tasks**, view the classification outcome, and record clinical feedback (confirmation or correction of the prediction).
- **Clinical Core & Auth Service:** A single transactional backend that unifies authentication, RBAC, and the clinical domain. It manages session token issuance/verification, roles, **Doctor-Patient Ownership**, acquisition of permitted tasks only, patient profiles, medical reports, consultations, error/validation feedback, and **Patient Migration**. Every clinical query resolves authentication, role, and ownership within the same process and on the same transaction of the **Clinical & Identity DB**. In the event of reassignment or retirement, a single atomic update operation transfers ownership: the outgoing physician **instantaneously** loses all read privileges. It also exposes the clinically confirmed cases required by the Retraining Worker.
- **ML Inference Service (Stateless):** A microservice dedicated exclusively to online predictive computation. It operates in *stateless* mode: for each request, it loads the active model from the **Model Registry**, applies the pipeline to the data entered by the physician, and produces the binary prediction (healthy subject vs. Parkinson's patient) along with its probability. It does not perform training and remains available during model updates.
- **Retraining Worker (Asynchronous):** A background component, decoupled from the synchronous inference path. It triggers when the clinically reported/validated error rate exceeds the configured threshold (e.g., **> 5%**). It merges historical training data with newly confirmed cases, re-runs the pipeline on the **three tasks** using **Filter Feature Selection**, serializes a new bundle, and publishes it to the **Model Registry** via hot-swapping (*hot-swap*), without interrupting online inference instances.



### 2.5 Persistence Layer (Database-per-Service Pattern)

To avoid unnecessary structural coupling and fault propagation, datastores follow service boundaries—with an intentional exception for the clinical-identity core—all protected by **Data-at-Rest** encryption:

- **Clinical & Identity DB** (Primary + Replica): The single relational database of the Clinical Core & Auth Service. It stores credentials, roles, doctor-patient ownership, clinical data, validation feedback, and audit logs in encrypted form. Keeping ownership and clinical data in the same DB enables atomic revocations within a single SQL transaction. It writes to the Primary and uses the Replica for reads and recovery.
- **Model Registry:** A versioned repository of serialized model artifacts (imputer parameters, scaler parameters, filter-selected feature mask, and classifier weights). Exposed in **read-only** mode to the `ML Inference Service` and in **controlled write** mode to the `Retraining Worker`, which publishes a new active version by hot-swapping the previous bundle. It remains physically separated from patients' personal data.



### 2.6 Continuity and Governance Mechanisms

Supporting the entire Private Subnet are two cross-cutting control and resilience mechanisms:

- **Failover System:** Continuously monitors the health status (*health check*) of critical nodes. In the event of a failure of an `ML Inference Service` instance or the `Clinical & Identity DB Primary` node, it executes an **automatic switchover in ≤ 3 minutes**, rerouting traffic to standby instances and promoting the `Replica` node to `Primary` to ensure uptime ≥ 99.5%. The `Retraining Worker` is restartable: an interrupted job can be resumed without degrading online inference.
- **SLA Monitor:** A telemetry and auditing component that constantly measures response times of the `API Gateway` and underlying services, verifying compliance with the maximum latency (≤ 1 second) and certifying the continuous availability exposed by the `Load Balancer`. It can also observe model governance metrics (validated error rate, retraining job status, active version in the registry).



### 2.7 Algorithmic Specifications of the ML Domain

Online inference and retraining share the exact same domain contract, constrained by three design choices:

1. **Three selected graphomotor tasks:** spiral; sequence of repeated **"L"** letters; bigrams / two spelling words. Features originating from other exercises fall outside both the training and prediction perimeters.
2. **Filter-based Feature Selection:** selection based on classifier-independent criteria (e.g., **entropy** and/or **Mutual Information**), applied both during retraining and, via a frozen mask inside the bundle, during inference.
3. **No synthetic data augmentation:** the training dataset consists exclusively of historical real cases and newly clinically confirmed cases; no synthetic samples are generated to balance or expand the training set.

---



## 3. Operational Flows and Request Lifecycle



### 3.1 Main Clinical Inference Flow (Synchronous)

The end-to-end path of a diagnostic request initiated by the **Local Physician** is structured into the following sequential steps:

1. **Ingress and Perimeter Security:** From the browser, the Local Physician sends an **HTTPS/TLS**-encrypted request accompanied by their **Session Token**. The **Load Balancer Cluster** verifies the certificate, filters traffic via **WAF** and **Rate Limiting** (max 5,000 req/min), terminates the external TLS connection, and initiates an internal **mTLS**-encrypted session.
2. **Interception and Routing:** Traffic passes through the **Automated Scaling Listener (ASL)**, which logs the request for load monitoring, and reaches the **API Gateway**.
3. **Auth, Ownership, and Clinical Persistence (single hop):** The **API Gateway** routes the call to the **Clinical Core & Auth Service**, which in a single interaction with the **Clinical & Identity DB** validates the token, verifies the role (`Local Physician`), checks **current ownership** over the patient, records the access in the audit log, and, if authorized, validates and saves the vector of **permitted tasks** on the **Primary** node (replicated in the background to the **Replica**). If the physician is not the owner, the request is rejected with no further internal hops.
4. **Stateless Inference Execution:** The API Gateway sends the numerical vector to the **ML Inference Service**. The latter loads the **active** bundle into memory from the **Model Registry** (read-only), performs imputation, standardization, application of the **Filter Feature Selection** mask, and classification, returning the prediction within a few milliseconds.
5. **Report Delivery and Feedback:** The outcome is linked to the clinical record in the `Clinical & Identity DB` via the **Clinical Core & Auth Service** and returned to the physician's interface within the contractual threshold of **1 second**. The physician can subsequently **confirm or report** a prediction error; these events feed into the error rate used to trigger asynchronous retraining.



### 3.2 Background Continuous Training Flow (Asynchronous)

The model does not remain frozen indefinitely. The update cycle is governed by the **Retraining Worker**:

1. **Threshold Detection:** The system aggregates physician error reports/validations stored by the **Clinical Core & Auth Service**. When the clinically validated error rate exceeds the configured threshold (e.g., **> 5%**), a trigger event is emitted to the **Retraining Worker** (the Administrator can monitor the threshold and job status without running training manually).
2. **Training Set Construction:** The Worker retrieves only samples from the **three selected tasks** out of the historical archive and newly **confirmed** cases. It does not apply synthetic *data augmentation*.
3. **Offline Training Relative to the Online Path:** It re-runs imputation, scaling, and **Filter Feature Selection** (entropy / Mutual Information), trains the classifier, and serializes a new versioned bundle.
4. **Hot-Swap in the Model Registry:** The new bundle is published as the active version in the **Model Registry**. Instances of the **ML Inference Service** detect or reload the current version and serve subsequent requests using the updated model, **without interrupting** online inference (*zero-downtime*).
5. **Audit and Traceability:** The retraining event (trigger, dataset size, published version, job outcome) is recorded in the audit logs on the **Clinical & Identity DB**.



### 3.3 Patient Migration and Ownership Revocation Flow

Doctor-patient ownership is dynamic and enforced on every request within the same service:

1. The **System Administrator** (or an authorized reassignment process) initiates **Patient Migration** on the **Clinical Core & Auth Service**, specifying the patient and the new owning physician (e.g., physician transfer or retirement).
2. The service executes a **single SQL transaction** on the **Clinical & Identity DB** (e.g., atomic ownership `UPDATE`).
3. From that moment onward, any read or write attempt by the **outgoing physician** fails the ownership check within the same backend: revocation is **instantaneous** and leaves no residual privileges over the patient's data, reports, or feedback.
4. The operation is recorded in the audit logs for accountability and compliance purposes.



### 3.4 Cross-Cutting Scaling, Failover, and Auditing Flows

In parallel with application traffic, secure cloud computing mechanisms operate continuously:

- **Selective Elasticity:** When the **ASL** detects an increase in requests during the 08:00–18:00 window, it sends selective **Scaling Out** commands to the **API Gateway**, the **Clinical Core & Auth Service**, and the **ML Inference Service**, increasing the number of compute replicas to absorb peaks of up to 5,000 req/min without degrading response times. The **Retraining Worker** scales independently so that training workloads do not contend for resources with the synchronous path.
- **Operational Continuity:** The **Failover System** performs periodic health checks on the `ML Inference Service` and the `Clinical & Identity DB`; in the event of an anomaly, it instantaneously switches traffic over to redundant resources, keeping any potential service disruption well below the 3-minute average threshold.
- **SLA Verification:** The **SLA Monitor** continuously collects reachability metrics from the `Load Balancer` and processing times from the `API Gateway`, ensuring formal traceability of compliance with service-level agreements.

---



## 4. Security Guarantees and GDPR Compliance

The architecture fulfills regulatory requirements for processing health data (GDPR) through defense-in-depth (*Defense-in-Depth*): data is encrypted both in transit (**HTTPS/TLS** on the external perimeter and **mTLS** on every internal channel of the Private Subnet) and at rest (**Data-at-Rest** across all datastores).

Access control is not limited to roles: **Doctor-Patient Ownership** and **Patient Migration**, managed atomically by the **Clinical Core & Auth Service** on the **Clinical & Identity DB**, ensure that upon a change or termination of the owning physician, all read privileges on the patient's data are revoked immediately, eliminating inconsistency windows across separate services.

Physical decoupling between the **Clinical & Identity DB** and the **Model Registry** keeps the model as a mathematical artifact devoid of personal identifiers: retraining uses aggregated/confirmed clinical features and labels without exposing identities to the inference path. Should a patient exercise their **Right to Erasure / Right to be Forgotten** (Art. 17 GDPR), their records are removed from the clinical-identity database and excluded from subsequent training cycles; *Machine Unlearning* on the already published bundle is unnecessary, as it retains no personal identifiers.

## 5. Architectural Choices: Adoption and Rejections

With respect to the elasticity architectures in Ch. 11, the project adopts only the modules that protect SLAs, GDPR compliance, and the decoupling between synchronous inference and asynchronous retraining. The others are excluded or remain out of scope.

**Resource Pooling (adopted)**
Compute resources in the Private Subnet are organized into distinct pools: one pool dedicated to the synchronous path (API Gateway, Clinical Core & Auth, ML Inference) and one pool dedicated to the Retraining Worker. Segregation ensures that continuous training jobs do not drain CPU/RAM from the online path, preserving ≤ 1 second latency and SLA compliance during the Mon–Fri 08:00–18:00 window.

**Elastic Resource Capacity (selectively adopted)**
On the online path, horizontal scaling out/in driven by the ASL is confirmed. On the Retraining Worker, by contrast, vertical elastic capacity is adopted: for the duration of the job (cross-validation and filter feature selection), additional CPU/RAM is allocated from the batch sub-pool and released once training completes. This choice stems from the single-job/batch nature of retraining, rather than a need to multiply stateless replicas.

**Elastic Disk Provisioning (not adopted)**
The volume of application data (vectors for the three tasks, Model Registry bundles, audit logs, and backups) does not constitute a critical bottleneck with respect to latency, availability, or the 5,000 req/min peak. Thin/pay-per-use elastic disk provisioning would primarily optimize storage costs rather than clinical path performance; therefore, this pattern was evaluated and excluded from the target design.

**Cloud Bursting (excluded)**
A hybrid architecture with overflow to an external public cloud is not adopted. The data processed is health-related and subject to GDPR: bursting outside the dedicated VPC would expand the data transfer surface and reduce perimeter control. Furthermore, routing clinical workloads to an external environment would introduce additional network latency incompatible with the end-to-end ≤ 1 second constraint. The required elasticity is therefore achieved entirely within the VPC through Resource Pooling and selective horizontal/vertical scaling.