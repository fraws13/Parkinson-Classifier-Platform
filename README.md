# Cloud ML SaaS – Parkinson’s Disease Classification (Track 2)

## 1. Selected Track and Project Objective

* **General objective:** Exploration, training, and deployment of a Machine Learning model as a **SaaS (Software-as-a-Service)** solution on a secure cloud infrastructure.


* **Track 2 (Classification):** Distinguishing healthy subjects from patients with Parkinson’s disease.


* **Scope of responsibility:** The project focuses on the design, security, and quality of the software service (SaaS), abstracting away the physical management of the underlying infrastructure.



---

## 2. Dataset and ML Pipeline Specifications

* **Dataset availability:** Training and test data will be released after the mid-term break, contingent upon the submission of the architectural design.


* **Sample structure:** The dataset includes 175 subjects who performed various graphomotor tasks (e.g., writing sequences of the letter "L," diagrams, trigrams, and words). Each sample is represented by a set of features extracted from these exercises.


* **Data cleaning and noise management:** The data has not been pre-processed; the dataset contains noise, missing values, and potential inconsistencies that must be addressed prior to the feature selection and training phases.


* **Feature selection:** The application of *feature selection* techniques is mandatory to reduce dimensionality and computational complexity.


* **General Model and Validation:** The goal is to develop a general classification model (a single model for all subjects), evaluated via *cross-validation* on patients not seen during training, using the provided fold-based split.


* **Retraining policy:** Continuous, automated retraining is not included; The model is retrained by incorporating new subjects into the training set only if performance during the testing phase is found to have degraded.



---

## 3. Architectural Requirements, Security, and Governance

* **End-to-End Application:** Demonstrate a complete containerized cloud solution, presenting both the system architecture and the Machine Learning model employed.


* **Cluster Security:** Discuss and justify security measures in light of the application’s healthcare-related nature, implementing them technically via **NGINX**.


* **Data Segregation and Roles:** Ensure the isolation of clinical data between different physicians, and differentiate access permissions among operators who acquire data, physicians who consult predictions, and system administrators.


* **AI Tracking:** Every activity performed with the support of Artificial Intelligence tools must be logged within a dedicated project, named after the team.



---

## 4. Service Level Agreement (SLA) and Load Requirements

| Parameter | Requirement to be Met |
| :--- | :--- |
| **User Base** | Approximately 50,000 total clients |
| **Peak Load** | Up to 5,000 simultaneous requests per minute during operation |
| **Uptime Window (Track 2)** | 08:00 to 18:00, Monday through Friday |
| **Availability Rate** | ≥ 99.5% of uptime |
| **Reliability Rate** | ≥ 99.5% of uptime |
| **Outage Duration** | Maximum 30 minutes; average 3 minutes |
| **Response Time (Latency)** | ≤ 1 second |

---

## 5. Required Operational Phases (Tasks A – H)

* **A) Offline Training:** Train the machine learning model offline.


* **B) Web App:** Save the final model and build a web application capable of generating predictions on new data.


* **C) Containerization:** Containerize the web application and run it using **Docker Desktop**.


* **D) Vulnerability Analysis:** Check the container image for vulnerabilities using **Docker Scout**.


* **E) Patching:** Apply corrective patches to the web application to remove all remediable vulnerabilities.


* **F) Kubernetes Cluster:** Create a **Kubernetes** cluster consisting of one control node and one or more worker nodes.


* **G) Stress Test:** Perform a stress test using **wrk** to evaluate the performance of the web application on the cluster.


* **H) Final Deployment:** Deploy the final web application onto the established Kubernetes cluster.
