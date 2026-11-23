# AI session log

- **Date:** 2026-11-14 (and follow-ups mid-November)
- **Author:** Team Group 2 (Francesco Vittorio Allocca, Fabrizio D’Errico, Antonio Esposito)
- **Tool:** Cursor
- **Project area:** architecture | docs
- **Goal:** Fix and evolve the architecture report to match course requirements and professor feedback.

## Prompt / request (summary)

- Fix Markdown formatting and broken LaTeX symbols in `report architecture.md`.
- Integrate continuous training (Retraining Worker), patient migration/ownership revocation, and ML specs (3 tasks + filter FS, no synthetic augmentation).
- Merge Auth & RBAC + Clinical & Patient into **Clinical Core & Auth Service** with a single **Clinical & Identity DB**.
- Discuss Chapter 11 patterns: adopt Resource Pooling / selective Elastic Resource Capacity; discard Cloud Bursting and Elastic Disk Provisioning (not because of Docker Desktop).

## Output used

- Updated architecture narrative and flows in the first deliverable docs.
- Clarifications later reflected in slides (public vs private subnet, sync vs async path).

## Human review

- Team validated professor-driven changes (3 tasks, continuous training trigger > 5%, ownership revocation).
- Core merge justified by atomic ownership / fewer cross-service calls.
- Cloud Bursting explicitly rejected for GDPR + latency, not for local demo limits.
- Slide copy and diagrams reviewed manually for naming consistency (e.g. Local Physician).

## Files touched

- `docs/first_deliverable/report architecture.md`
- `docs/first_deliverable/Architecture.png` (team diagram, iterated with AI discussion)
