/**
 * MockDatadogAdapter — Simulates Datadog API metric submission.
 * ----------------------------------------------------------------------------
 * Mimics Datadog behavior:
 *   - Sliding window strategy (Datadog tracks last T seconds of data)
 *   - Metrics submitted as series with tags (key:value)
 *   - Export format mirrors Datadog v2 /api/v2/series payload
 *   - Supports distributions (DDSketch-style percentiles)
 *
 * Use this for testing Datadog integration without real Datadog API keys.
 *
 * @module adapters/datadog/MockDatadogAdapter
 */
import type { WindowConfig } from '../../core/types';
import type { WindowStrategy } from '../../core/types';
import type { FlowChart } from 'footprint';
/** Datadog series point — mirrors Datadog v2 API format */
export interface DatadogSeriesPoint {
    metric: string;
    type: 'count' | 'gauge' | 'rate' | 'distribution';
    points: Array<{
        timestamp: number;
        value: number;
    }>;
    tags: string[];
    interval?: number;
}
export interface MockDatadogAdapterOptions {
    /** Datadog metric prefix (default: 'footprint.pipeline') */
    prefix?: string;
    /** Default tags applied to all metrics */
    tags?: string[];
    /** Window strategy config (default: sliding 300s — Datadog uses rolling windows) */
    windowConfig?: WindowConfig;
    /** Optional callback on each export */
    onExport?: (data: DatadogExportData) => void;
}
export interface DatadogExportData {
    /** Series payload (mirrors Datadog v2 /api/v2/series body) */
    series: DatadogSeriesPoint[];
    /** API key used (mock) */
    apiKey: string;
    exportedAt: number;
}
export interface MockDatadogAdapterResult {
    flowChart: FlowChart;
    /** Get all exported Datadog payloads */
    getExports: () => DatadogExportData[];
    /** Get the underlying strategy */
    getStrategy: () => WindowStrategy;
    /** Clear all stored exports */
    clear: () => void;
}
export declare function MockDatadogAdapter(options?: MockDatadogAdapterOptions): MockDatadogAdapterResult;
