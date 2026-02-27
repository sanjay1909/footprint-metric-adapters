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
import type { FlowChart, StageContext, StreamCallback } from 'footprint';
/**
 * A single metric data point collected during execution.
 *
 * WHY: Every scope event (error, stage completion, read, write) produces
 * metric entries. These feed into window strategies for aggregation.
 */
export interface MetricEntry {
    /** The stage that produced this metric */
    stageName: string;
    /** Metric type identifier */
    metric: MetricType;
    /** The numeric value (e.g., latency in ms, error count, byte size) */
    value: number;
    /** When this entry was recorded (Unix ms) */
    timestamp: number;
    /** Optional metadata (e.g., customer ID, request ID, error message) */
    metadata?: Record<string, unknown>;
}
/**
 * Built-in metric types that the collector tracks.
 */
export type MetricType = 'latency' | 'errorCount' | 'readCount' | 'writeCount' | 'commitCount' | 'stageInvocation' | 'custom';
/**
 * Latency percentiles computed from a window of entries.
 *
 * WHY: p50/p95/p99 are the industry standard for latency monitoring.
 * The window strategy computes these from its current entries.
 */
export interface PercentileResult {
    /** Minimum value in the window */
    min: number;
    /** Maximum value in the window */
    max: number;
    /** 50th percentile (median) */
    p50: number;
    /** 95th percentile */
    p95: number;
    /** 99th percentile */
    p99: number;
    /** Arithmetic mean */
    mean: number;
    /** Number of entries in the window */
    count: number;
}
/**
 * A snapshot of the current window state.
 *
 * WHY: Adapters need to inspect the window contents for export.
 * This provides a read-only view without exposing internal state.
 */
export interface WindowSnapshot {
    /** The entries currently in the window */
    entries: MetricEntry[];
    /** When the window started (first entry timestamp or bucket start) */
    startTime: number;
    /** When the window ends (latest entry timestamp or bucket end) */
    endTime: number;
    /** Number of entries in the window */
    size: number;
    /** Total entries pushed since last reset (including evicted) */
    totalPushed: number;
    /** Number of entries evicted from the window */
    totalEvicted: number;
}
/**
 * Aggregated metric result from a window strategy.
 *
 * WHY: After windowing and percentile calculation, this is what gets
 * exported to the backend. Contains both aggregate stats and per-stage breakdown.
 */
export interface MetricResult {
    /** Overall latency percentiles across all stages */
    latencyPercentiles: PercentileResult;
    /** Per-stage latency percentiles */
    stagePercentiles: Map<string, PercentileResult>;
    /** Total error count in the window */
    totalErrors: number;
    /** Per-stage error counts */
    stageErrors: Map<string, number>;
    /** Total stage invocations in the window */
    totalInvocations: number;
    /** Window information */
    windowInfo: {
        type: 'ringBuffer' | 'tumbling' | 'sliding';
        startTime: number;
        endTime: number;
        entryCount: number;
    };
    /** When this result was computed */
    computedAt: number;
}
/**
 * Result of exporting metrics to a backend.
 */
export interface MetricExportResult {
    /** Whether the export succeeded */
    success: boolean;
    /** Backend destination identifier */
    destination: string;
    /** Number of metric entries exported */
    entriesExported: number;
    /** Timestamp of the export */
    exportedAt: number;
    /** Error message if export failed */
    error?: string;
}
/**
 * Interface that every window strategy must implement.
 *
 * WHY: Each strategy (Ring Buffer, Tumbling, Sliding) has different
 * windowing semantics, but they all expose the same API so the
 * metric pipeline can swap strategies at runtime.
 */
export interface WindowStrategy {
    /** Strategy type identifier */
    readonly type: 'ringBuffer' | 'tumbling' | 'sliding';
    /** Push a metric entry into the window */
    push(entry: MetricEntry): void;
    /** Calculate percentiles for a specific metric type across all entries */
    getPercentiles(metric?: MetricType): PercentileResult;
    /** Calculate percentiles for a specific stage */
    getStagePercentiles(stageName: string, metric?: MetricType): PercentileResult;
    /** Get a read-only snapshot of current window state */
    getSnapshot(): WindowSnapshot;
    /** Get the full MetricResult with all aggregated data */
    getMetricResult(): MetricResult;
    /** Clear all entries and reset the window */
    clear(): void;
    /** Get the current configuration */
    getConfig(): WindowConfig;
}
/**
 * Configuration for window strategies.
 */
export interface WindowConfig {
    /** Which strategy to use */
    type: 'ringBuffer' | 'tumbling' | 'sliding';
    /** Maximum entries (ringBuffer) */
    maxSize?: number;
    /** Window duration in ms (tumbling, sliding) */
    windowMs?: number;
}
/**
 * Configuration for creating a metric adapter subflow.
 *
 * WHY: Mirrors AdapterStageConfig from agent-footprint-adapters.
 * Each metric backend provides three stage functions that handle
 * collection, windowing, and export in their backend-specific way.
 */
export interface MetricAdapterStageConfig {
    /** Human-readable adapter name (e.g., 'Prometheus', 'Datadog', 'Mock') */
    name: string;
    /** Collects and validates metric entries from scope */
    collectMetric: MetricStageFn;
    /** Applies window strategy and computes aggregates */
    applyStrategy: MetricStageFn;
    /** Exports aggregated metrics to the backend */
    exportMetric: MetricStageFn;
    /** Adapter capabilities */
    capabilities?: MetricAdapterCapabilities;
}
/**
 * A single metric adapter stage function.
 */
export type MetricStageFn = (scope: StageContext, breakFn: () => void, streamCallback?: StreamCallback) => Promise<unknown>;
/**
 * Declares what the metric adapter supports.
 */
export interface MetricAdapterCapabilities {
    /** Whether the backend supports histogram data (percentiles) */
    supportsHistograms: boolean;
    /** Whether the backend supports labels/tags on metrics */
    supportsLabels: boolean;
    /** Whether the adapter can push (vs pull-based like Prometheus) */
    supportsPush: boolean;
}
/**
 * Result of a metric adapter factory function.
 */
export interface MetricAdapterResult {
    /** The 3-stage FlowChart subflow */
    flowChart: FlowChart;
}
