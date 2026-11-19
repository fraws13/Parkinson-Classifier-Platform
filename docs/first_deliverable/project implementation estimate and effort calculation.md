## 1. Executive Summary: Capacity and Timeframe

The total estimated effort to complete the entire operational cycle (**Tasks A–H**), the technical report, and the final demo amounts to **210–240 person-hours** (operational target: **220 hours**), based on a production capacity of **13 hours per week for each of the 3 team members** (**~39 team-hours/week**).


| Timeframe                 | Team Capacity | Expected Effort | Margin / Buffer               | Feasibility                                                                                           |
| ------------------------- | ------------- | --------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **5 Weeks (Recommended)** | 195 h         | 210–240 h       | **−15 / −45 h (~−7/−19%)**    | **Moderate:** feasible only with a strict MVP scope and full parallel execution; no buffer available. |
| **4 Weeks (Compressed)**  | 156 h         | 210–240 h       | **−54 ​​/ −84 h (~−25/−35%)** | **Critical:** requires further scope reduction and immediate availability of datasets from Day 1.     |


**Note on the gap:** At 13 hours per person per week, the capacity does not fully cover the 220-hour target. The plan remains sustainable only by applying the scoping strategy outlined in Section 3 (focusing on an MVP for tasks A–H, while other components are limited to the design phase) and by ensuring that tasks on the critical path are executed in parallel.

---



## 2. Role Distribution and Work Package Estimates

To prevent bottlenecks during the deployment phase, the effort is balanced across three parallel areas of responsibility, with a mandatory integration milestone scheduled for the middle of the second week:


| Area / Role                 | Share    | Included Packages (Tasks A–H)                                                                                                                                                                                                                                                        | Estimated Hours |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| **ML Engineer**             | **~20%** | **Task A:** Offline pipeline (imputation, scaling, feature selection, cross-validation across folds), serialization (`joblib`), I/O contract for `/predict`.                                                                                                                         | **16–22 h**     |
| **App Developer**           | **~40%** | **Task B:** Monolithic web app (feature input form, authentication with 2 roles, data isolation per physician, 1 database), model integration, and basic audit logging.                                                                                                              | **40–50 h**     |
| **Platform & SecOps**       | **~40%** | Docker/K8s study (30–40 h) + **Task C:** Containerization (10–14 h) + **Tasks D+E:** CVE scanning and patching (12–16 h) + **Tasks F+H:** Local cluster setup (1 control plane + ≥1 worker node) and NGINX TLS/rate-limiting (30–40 h) + **Task G:** `wrk` stress testing (10–12 h). | **92–122 h**    |
| **Cross-functional (Team)** | —        | End-to-end integration and debugging (20–28 h) + Technical report, demo scripts (8–10 min), and AI log tracking (24–30 h).                                                                                                                                                           | **44–58 h**     |
| **Project Total**           | **100%** | —                                                                                                                                                                                                                                                                                    | **210–240 h**   |


---
## 3. Scope Strategy: Implementation vs. Architecture

To adhere to the time budget without compromising the project comprehensiveness required by the course, the system is divided into components that are actually implemented locally and components that are modeled solely at an architectural level:

- **To be implemented (Local MVP A–H):**
- A unified web application (frontend form + backend API) with **1** relational database.
- **2-role RBAC** authentication (local physician, administrator) with strict patient isolation per individual physician.
- An ML pipeline trained offline, serialized, and served via a `/predict` endpoint.
- Containerization using **Docker Desktop**, vulnerability scanning and remediation via **Docker Scout**, and deployment to a local **Kubernetes** cluster (1 control plane + at least 1 worker).
- An **NGINX** reverse proxy configured for **TLS** termination and **rate limiting**, validated through **wrk** benchmarking.
- **Architectural/Relational modeling only (not to be built):**
- Decomposition into separate microservices (beyond the MVP scope), *mTLS* (East-West) encryption, a custom *Automated Scaling Listener* agent, *Primary-Replica* database replication with automatic failover, a dedicated *SLA Monitor*, advanced resource pooling/elastic capacity, and full-scale continuous training.
- **Traceability rule:** Every block in the architectural diagram will be explicitly classified as ***implemented***, ***approximated***, or ***designed***.

---



## 4. 5-Week Roadmap and Risk Management

1. **Week 1 (Parallel Skeleton):** Definition of the JSON feature contract and `predict()` stub (ML); login, roles, forms, and database persistence (App); Docker Desktop setup, initial Dockerfile, and testing of a basic deployment on K8s (Platform). 2. **Week 2 (Real-world Model and Basic Security):** Training on a real-world dataset and replacing the stub with the actual `.joblib` (ML) model; data segregation between physicians and audit logs (App); full containerization of the stack with NGINX as a front-end (Platform).
2. **Week 3 (Hardening and Clustering):** Docker Scout scanning and patch application (D+E); deployment to a local multi-node Kubernetes (K8s) cluster (F+H).
3. **Week 4 (Stress Testing and Integration):** Running load tests using `wrk` and collecting metrics/screenshots (G); finalizing end-to-end integration and addressing high-priority bug fixes.
4. **Week 5 (Consolidation and Demo):** Drafting a technical report analyzing the limitations—comparing local laptop-based testing against cloud SLAs (5,000 req/min)—reviewing AI logs, and conducting timed dry runs of the demo (8–10 minutes), including a pod-failure simulation and a *before/after* verification using Docker Scout.

**4-Week Variant:** Weeks 3 and 4 are merged (combining hardening, clustering, `wrk` testing, and integration into a single week), and the buffer time for the demo is reduced. This approach is only feasible if the dataset is already available and further non-essential tasks are cut (e.g., a scaled-down demo or fewer iterations of CVE patching).

**Critical Mitigations (Active from Day 1):** Using an ML stub during the first week to prevent application development from stalling while awaiting the dataset; immediate initiation of Kubernetes research by the Platform lead; allocation of buffer time to address complex CVEs identified by Docker Scout; and prioritizing the A–H MVP components over features that are currently only in the design phase.