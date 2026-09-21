---
title: "DocScribe"
subtitle: "LLM agent for structured document authoring"
description: "An LLM agent that reads, understands, and authors DOCX documents — parsing structure into a stable AST, filling fields via MCP tool calls, and preserving run-level formatting. Built for regulated document workflows where formatting is as auditable as content."
status: "private"
order: 2
featured: true
concepts: ["Document Intelligence", "MCP Tools", "AST", "Agentic AI", "Structured Generation"]
tech: ["Python", "Agno", "FastMCP", "python-docx", "LiteLLM"]
---

## Problem

Enterprise workflows in pharma, biotech, and regulated industries run on Word documents — Clinical Study Reports, protocols, consent forms. Each has structure, formatting requirements, and audit obligations. An LLM asked to fill a DOCX naively either destroys the formatting or produces output that fails document QC.

Two failure modes appear immediately:

1. **Format destruction** — the model generates bold text where the template had plain text, or loses the distinction between a label (bold) and its value (plain). Subtle but immediately visible to reviewers.
2. **Structure blindness** — referencing cells by table index is fragile. Table indices shift when content is added. Stable IDs are required.

## Architecture

**AST layer — the foundation.** Every DOCX element (heading, paragraph, table cell) is parsed into a DocumentAST with a stable `element_id`. The LLM never sees raw XML; it sees a structured JSON representation it can navigate and patch.

**5 MCP tools** exposed via FastMCP:

| Tool | Purpose |
|------|---------|
| `upload_document` | Parse DOCX → AST, register in session |
| `get_session_documents` | List uploaded documents |
| `load_document_ast` | Return full element list with `element_id`, `text`, `runs` |
| `edit_document` | Apply a cell/heading edit by `element_id` |
| `validate_document_state` | Diff current AST against original template |

**Run-level formatting preservation.** The core algorithmic challenge: a template cell may read `[bold]"Study Title: "[/bold][plain]""[/plain]`. The agent produces a plain string. The run formatter:
1. Finds the longest common prefix between the new text and the template text
2. Maps that prefix to template runs, preserving bold
3. For remaining text, scans for known bold-label fragments and applies their formatting
4. LLM-generated values always end up plain — no false bold

**Storage backend** is abstracted: `LocalDocumentStore` (filesystem) and `S3DocumentStore` (boto3) share the same interface — switchable via configuration without code changes.

## Technical decisions

**No LangChain.** Every component is written by hand: the AST converter, the MCP server, the formatting engine. The implementation is fully defensible at each step.

**Patch strategy over full regeneration.** Patching individual elements by stable ID preserves structure integrity. Full regeneration introduces risks: table structure drift, incorrect heading hierarchy, accidental content overwrite.

**Agno as the agent framework.** LiteLLM for model routing (environment-agnostic, no hardcoded credentials). The agent follows a 5-step workflow: upload → inspect AST → match fields → edit → validate.

## What this enables

A junior analyst pastes study data into a chat interface. The agent reads the DOCX template's structure, matches data fields to template elements, fills them with the correct values in the correct formatting, and validates the result against the original structure before saving. Clinical document authoring time reduced from hours to minutes — with a complete audit trail of which element was changed, when, and by what instruction.
