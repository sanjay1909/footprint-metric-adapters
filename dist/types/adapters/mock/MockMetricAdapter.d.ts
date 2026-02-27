/**
 * MockMetricAdapter — In-memory metric adapter for testing.
 * ----------------------------------------------------------------------------
 * Stores all exported metrics in memory. Perfect for unit tests:
 *   - Assert metrics were collected correctly
 *   - Verify percentile calculations
 *   - Test alarm rule evaluation
 *   - Validate window strategy behavior
 *
 * Follows the same factory function pattern as LLM adapters.
 *
 * @module adapters/mock/MockMetricAdapter
 *
 * @example
 * ```typescript
 * const { adapter, getExports, getHistory, clear } = MockMetricAdapter();
 *
 * // Attach to pipeline...
 *
 * // After execution:
 * const exports = getExports();
 * expect(exports).toHaveLength(1);
 * expect(exports[0].percentiles.p95).toBeLessThan(500);
 * ```
 */
import type { MetricResult, MetricExportResult, WindowStrategy, WindowConfig } from '../../core/types';
import type { FlowChart } from 'footprint';
export interface MockMetricAdapterOptions {
    /** Window strategy configuration (default: ringBuffer with maxSize 1000) */
    windowConfig?: WindowConfig;
    /** Optional callback on each export */
    onExport?: (result: MetricResult) => void;
}
export interface MockMetricAdapterResult {
    /** The 3-stage FlowChart subflow */
    flowChart: FlowChart;
    /** Get all exported metric results */
    getExports: () => MetricResult[];
    /** Get the full export history with results */
    getHistory: () => MetricExportResult[];
    /** Get the underlying window strategy (for direct inspection) */
    getStrategy: () => WindowStrategy;
    /** Clear all stored exports */
    clear: () => void;
}
/**
 * Creates a Mock metric adapter for testing.
 *
 * @param options - Configuration options
 * @returns MockMetricAdapterResult with flowChart and inspection methods
 */
export declare function MockMetricAdapter(options?: MockMetricAdapterOptions): MockMetricAdapterResult;
