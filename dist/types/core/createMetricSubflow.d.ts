/**
 * Metric Subflow Factory — Builds a 3-stage FlowChart from metric adapter stage functions.
 * ----------------------------------------------------------------------------
 * Every metric adapter (Prometheus, Datadog, CloudWatch, Mock, Console)
 * follows the same 3-stage pattern:
 *   CollectMetric → ApplyStrategy → ExportMetric
 *
 * This factory encapsulates the FlowChart construction so adapter authors
 * only provide three functions and a name.
 *
 * Mirrors createAdapterSubflow from agent-footprint-adapters.
 *
 * @module core/createMetricSubflow
 */
import type { FlowChart } from 'footprint';
import type { MetricAdapterStageConfig, MetricAdapterCapabilities } from './types';
/**
 * Reads MetricAdapterCapabilities from a FlowChart built by createMetricSubflow.
 *
 * @param flowChart - A FlowChart returned by createMetricSubflow
 * @returns The adapter's capabilities
 */
export declare function getMetricAdapterCapabilities(flowChart: FlowChart): MetricAdapterCapabilities;
/**
 * Creates a self-contained 3-stage metric adapter subflow FlowChart.
 *
 * @param config - Metric adapter stage functions and name
 * @returns A compiled FlowChart ready to mount as a subflow
 *
 * @example
 * ```typescript
 * const adapter = createMetricSubflow({
 *   name: 'Prometheus',
 *   collectMetric: async (scope) => { ... },
 *   applyStrategy: async (scope) => { ... },
 *   exportMetric: async (scope) => { ... },
 * });
 * ```
 */
export declare function createMetricSubflow(config: MetricAdapterStageConfig): FlowChart;
