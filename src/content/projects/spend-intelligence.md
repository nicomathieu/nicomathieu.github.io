---
title: "Finance Spend Intelligence"
subtitle: "RAG + NL-to-SQL assistant for procurement compliance"
description: "A production-grade prototype combining a data quality pipeline, a RAG endpoint over procurement policy, and a natural-language-to-SQL agent over DuckDB — with a compliance dashboard and a full SOX §8.2 audit trail."
status: "prototype"
order: 3
featured: true
concepts: ["RAG", "NL-to-SQL", "Compliance", "Data Quality", "LLM Safety"]
tech: ["Python", "FastAPI", "DuckDB", "React", "LiteLLM", "Pydantic v2"]
---

## Problem

Finance procurement controls teams deal with two layers of complexity: messy invoice data (9 recurring data quality failure classes) and policy questions that span both unstructured regulatory documents and structured transaction tables. Existing tools answer one or the other — rarely both in the same interface.

## What I built

**Three integrated systems:**

### 1. Data quality pipeline

Ingests raw invoice CSVs, repairs 9 classes of DQ issues (malformed vendor IDs, fuzzy-matched missing keys, currency mismatches, format errors), and flags compliance violations against FIN-POL-014. Every transformation is audit-logged for SOX §8.2 lineage.

Key design decisions:
- **No silent data loss**: every problematic row is quarantined with an explicit reason and retained — nothing is dropped silently
- **Idempotent + transactional**: tables are dropped and recreated inside a single DuckDB transaction. Same input → same output. Crash mid-run → rollback to previous consistent state
- **`reference_date = max(invoice_date)`**: `datetime.now()` would produce different `OVERDUE_APPROVAL` flags on every run — incompatible with auditability

### 2. RAG + NL-to-SQL backend (FastAPI)

A single `POST /ask` endpoint classifies intent (policy question, data question, or hybrid) via keyword lookup — no extra LLM call — then routes to the appropriate engine:

- **Policy questions**: chunked policy document, cosine similarity over 9 chunks
- **Data questions**: NL-to-SQL agent generating queries over `invoices_enriched`, `compliance_flags`, `vendors`
- **Hybrid**: both policy retrieval and SQL, combined in a single evidence payload

### 3. SQL safety — defence in depth

Three independent guards prevent unauthorised data access:

| Guard | What it blocks |
|-------|---------------|
| System prompt whitelist | LLM querying internal tables (audit_log, pipeline_log) |
| DML keyword blocklist | Write/DDL statements (INSERT, UPDATE, DROP, etc.) |
| `read_only=True` connection | Any write at the DB engine level |

The prompt guard handles the 99% case. The code and DB guards are independent backstops requiring no trust in LLM output.

## Evaluation

**Offline golden dataset: 9/10 passing (90% — CI gate threshold: 70%)**

The one known failure (q01): the SQL agent filters EUR only when counting invoices without a PO, returning 14 vs 21 total across currencies. Mitigation documented; production fix requires multi-currency ECB FX rate integration.

Ground truth for numeric questions is derived from `sql_results` in the evidence payload — automatically stays in sync with pipeline output, more reliable than substring matching against prose.

**Online evaluation signals** (designed for production):
- Answer relevance (Claude-as-judge on live queries)
- SQL error rate (syntax + runtime errors / total SQL queries)
- Policy citation accuracy
- User feedback (thumbs up/down)
- Cost per query (~$0.002 at current volume)

## What I deliberately did not build

Authentication/authorisation (out of scope for the prototype; production path: Azure AD SSO with analyst/controller/auditor roles), a production vector DB (9 policy chunks do not warrant Pinecone or ChromaDB), and CI/CD. These are documented explicitly in the README — the architecture is designed so each layer has a clear production upgrade path.
