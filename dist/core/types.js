"use strict";
/**
 * Core Types — Standard contract for metric adapters.
 * ----------------------------------------------------------------------------
 * Defines the universal types for metric collection, windowing, and export.
 * Every metric adapter (Prometheus, Datadog, CloudWatch, Mock, Console)
 * normalizes to these standard shapes.
 *
 * DESIGN: Mirrors the LLM adapter pattern from agent-footprint-adapters.
 * Each metric adapter is a 3-stage FlowChart subflow:
 *   CollectMetric → ApplyStrategy → ExportMetric
 *
 * @module core/types
 */
Object.defineProperty(exports, "__esModule", { value: true });
