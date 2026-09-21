---
title: "AgentObs"
subtitle: "Observability for agentic AI systems"
description: "A Python library that decodes streaming agent SSE events into typed runs, instruments them with OpenTelemetry tracing, and evaluates retrieval and generation quality — offline over golden datasets and online against sampled production traffic."
status: "open-source"
order: 1
featured: true
concepts: ["Agent Observability", "LLM Evaluation", "RAG", "OpenTelemetry", "Online Evaluation"]
tech: ["Python 3.11+", "OpenTelemetry", "DeepEval", "httpx", "pytest"]
github: "https://github.com/nicomathieu/agentobs"
---

## Problem

Production RAG agents fail in ways that are hard to see. Their retrieval pipelines may surface irrelevant documents, their generations may be unfaithful to retrieved evidence, and tool calls may silently fail midstream. Without structured observability, these failures remain invisible until they affect users.

## What I built

AgentObs provides three composable building blocks for production-grade AI agent observability:

**1. Agentic layer — stream decoding**

Decodes raw Server-Sent Events from a streaming agent API into typed events, then assembles them into a typed `AgentRun` object: answer text, paired tool calls, retrieval evidence, and the documents the agent actually read. Tracks evidence completeness so downstream evaluation knows whether the context it judges is complete or partial.

**2. Observability layer — tracing**

Configures an OpenTelemetry tracer with a single call and provides context managers for tracing agent runs, LLM calls, and tool calls. Falls back gracefully to a no-op when the OpenTelemetry SDK is not installed — no forced dependency.

**3. Evaluation layer — offline + online**

- **Offline**: Runs a golden dataset through the agent, judges each answer with LLM-as-judge metrics (correctness, faithfulness, answer relevance, context relevance) via DeepEval. Durable checkpointing writes each case atomically — a crashed run resumes from the last checkpoint.
- **Online**: A pluggable `SamplingStrategy` (`AlwaysSample`, `NeverSample`, `RateSampler`) feeds an `OnlineEvaluator` that evaluates a fraction of live production traffic without blocking response delivery.

## Key technical decisions

**Schema-driven retrieval detection, not name-based.** A `tool_end` event whose result parses as `{"query": str, "content": [object, ...]}` is classified as a retrieval result — regardless of the tool name. Tool names that produced such results are then used retroactively to classify any earlier calls of the same name. This means the library works with any agent framework without configuration.

**Evidence completeness is retrieval-evidence completeness only.** An unrelated tool failing does not invalidate an otherwise complete retrieval context. Only a gap in retrieval evidence does: an unpaired call, an ambiguous `tool_call_id`, a schema validation failure on a retrieval result, or a retrieval tool that returned a failure.

**Tool calls are paired by `tool_call_id`, never by adjacency.** Duplicate IDs produce a `CALL_DUPLICATED` classification; orphaned `tool_end` events produce `CALL_ORPHANED`. The classification is explicit and surfaced in diagnostics.

**Timing is diagnostic-only, never a verdict.** All elapsed times are recorded but no duration threshold causes a run to be rejected — avoiding false positives on legitimate slow retrievals.

## Core7 Policy

Seven canonical metrics with versioned thresholds (policy v3, `2026-08-01.1`):

| Metric | Threshold |
|--------|-----------|
| Hit@5 | ≥ 0.40 |
| MRR | ≥ 0.30 |
| nDCG@5 | ≥ 0.35 |
| Faithfulness | ≥ 0.70 |
| Correctness | ≥ 0.65 |
| Answer Relevance | ≥ 0.80 |
| Context Relevance | ≥ 0.60 |

Each evaluation run produces a single `pass / fail / incomplete` policy verdict. A K-contract violation (evaluation ran at a different K) yields `skip` rather than `fail` — the distinction between "did not pass" and "could not be evaluated" is surfaced explicitly.

## Design principles

- **Only `httpx` required** at runtime — OpenTelemetry and DeepEval are optional extras (`[otlp]`, `[deepeval]`, `[all]`).
- Fully typed with a `py.typed` marker.
- 253 tests from the initial commit covering SSE decoding, run assembly, checkpoint durability, judge integration, and metrics.
- Apache-2.0 license. Built on Python 3.11–3.13.
