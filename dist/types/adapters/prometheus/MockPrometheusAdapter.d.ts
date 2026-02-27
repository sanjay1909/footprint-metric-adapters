/**
 * MockPrometheusAdapter — Simulates Prometheus exposition format.
 * ----------------------------------------------------------------------------
 * Mimics Prometheus behavior:
 *   - Ring buffer strategy (Prometheus scrapes latest data — fixed window)
 *   - Pull-based: generates exposition text format on export
 *   - Metric names use snake_case with labels in {key="value"} format
 *   - Supports histogram buckets (le), summary quantiles, counters, gauges
 *
 * Use this for testing Prometheus/Grafana integration without real Prometheus.
 *
 * @module adapters/prometheus/MockPrometheusAdapter
 */
import type { WindowConfig } from '../../core/types';
import type { WindowStrategy } from '../../core/types';
import type { FlowChart } from 'footprint';
export interface MockPrometheusAdapterOptions {
    /** Metric name prefix (default: 'footprint_pipeline') */
    prefix?: string;
    /** Window strategy config (default: ringBuffer 1000 — Prometheus scrapes latest) */
    windowConfig?: WindowConfig;
    /** Optional callback when exposition text is generated */
    onExport?: (data: PrometheusExportData) => void;
}
export interface PrometheusExportData {
    /** Prometheus exposition format text */
    expositionText: string;
    /** Parsed metric lines for inspection */
    metricLines: PrometheusMetricLine[];
    exportedAt: number;
}
export interface PrometheusMetricLine {
    name: string;
    labels: Record<string, string>;
    value: number;
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    help?: string;
}
export interface MockPrometheusAdapterResult {
    flowChart: FlowChart;
    /** Get all exported exposition texts */
    getExports: () => PrometheusExportData[];
    /** Get the latest exposition text (for /metrics endpoint) */
    getLatestExposition: () => string;
    /** Get the underlying strategy */
    getStrategy: () => WindowStrategy;
    /** Clear all stored exports */
    clear: () => void;
}
export declare function MockPrometheusAdapter(options?: MockPrometheusAdapterOptions): MockPrometheusAdapterResult;
