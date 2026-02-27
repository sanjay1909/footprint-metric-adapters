/**
 * ConsoleMetricAdapter — Logs formatted metrics to console.
 * ----------------------------------------------------------------------------
 * Development/debugging adapter. Formats metric results into readable
 * console output with stage breakdowns, percentiles, and error summaries.
 *
 * @module adapters/console/ConsoleMetricAdapter
 *
 * @example
 * ```typescript
 * const { flowChart } = ConsoleMetricAdapter({ prefix: '[METRICS]' });
 *
 * // After execution, console shows:
 * // [METRICS] ═══════════════════════════════════════
 * // [METRICS] Window: ringBuffer | 42 entries | 12.5s
 * // [METRICS] Latency: p50=45ms p95=230ms p99=890ms
 * // [METRICS] Errors: 2 total
 * // [METRICS] Stages:
 * // [METRICS]   llmCall      p95=180ms  errors=1
 * // [METRICS]   toolExec     p95=50ms   errors=1
 * // [METRICS] ═══════════════════════════════════════
 * ```
 */
import type { WindowConfig } from '../../core/types';
import type { WindowStrategy } from '../../core/types';
import type { FlowChart } from 'footprint';
export interface ConsoleMetricAdapterOptions {
    /** Prefix for console output (default: '[METRICS]') */
    prefix?: string;
    /** Window strategy configuration (default: ringBuffer with maxSize 1000) */
    windowConfig?: WindowConfig;
    /** Whether to show per-stage breakdown (default: true) */
    showStages?: boolean;
    /** Custom logger function (default: console.log) */
    logger?: (message: string) => void;
}
export interface ConsoleMetricAdapterResult {
    flowChart: FlowChart;
    getStrategy: () => WindowStrategy;
}
export declare function ConsoleMetricAdapter(options?: ConsoleMetricAdapterOptions): ConsoleMetricAdapterResult;
