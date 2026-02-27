"use strict";
/**
 * Tree of IDs — Types
 * ----------------------------------------------------------------------------
 * The Tree of IDs is an LLM-navigable execution tree where each node has:
 *   - ID (from FlowChart builder — stable, predictable)
 *   - Description (from Builder — what the stage is designed to do)
 *   - Narrative (from NarrativeGenerator — what actually happened)
 *   - Data (from Recorders — reads, writes, metrics, errors)
 *
 * An LLM gets the SUMMARY first (IDs + short descriptions), then calls
 * drillDown(id) for full details. This is lazy-loading for LLM context
 * windows — don't dump everything at once.
 *
 * VISION: Build an LLM-friendly system for both:
 *   - Customers: "What happened to my request?" → Navigate tree → find answer
 *   - Providers: "Why did this fail?" → Navigate tree → find root cause
 *
 * @module tree/types
 */
Object.defineProperty(exports, "__esModule", { value: true });
