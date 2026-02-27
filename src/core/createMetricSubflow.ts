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

import { FlowChartBuilder } from 'footprint';
import type { FlowChart } from 'footprint';
import type { MetricAdapterStageConfig, MetricAdapterCapabilities } from './types';

/**
 * Symbol key for attaching MetricAdapterCapabilities to a FlowChart.
 */
const METRIC_CAPABILITIES_KEY = Symbol.for('footprintMetric.adapterCapabilities');

/**
 * Default capabilities when none are specified.
 */
const DEFAULT_CAPABILITIES: MetricAdapterCapabilities = {
  supportsHistograms: true,
  supportsLabels: true,
  supportsPush: true,
};

/**
 * Reads MetricAdapterCapabilities from a FlowChart built by createMetricSubflow.
 *
 * @param flowChart - A FlowChart returned by createMetricSubflow
 * @returns The adapter's capabilities
 */
export function getMetricAdapterCapabilities(flowChart: FlowChart): MetricAdapterCapabilities {
  return (flowChart as any)[METRIC_CAPABILITIES_KEY] ?? DEFAULT_CAPABILITIES;
}

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
export function createMetricSubflow(config: MetricAdapterStageConfig): FlowChart {
  const { name, collectMetric, applyStrategy, exportMetric, capabilities } = config;

  const fb = new FlowChartBuilder();

  // Stage 1: CollectMetric — Validate and normalize incoming metric entries
  fb.start(
    'Collect Metric',
    collectMetric as any,
    'collect-metric',
    undefined,
    'Validate and normalize incoming metric entries from scope recorders',
  );

  // Stage 2: ApplyStrategy — Apply window strategy and compute aggregates
  fb.addFunction(
    'Apply Strategy',
    applyStrategy as any,
    'apply-strategy',
    undefined,
    'Apply the configured window strategy (RingBuffer/Tumbling/Sliding) and compute percentiles',
  );

  // Stage 3: ExportMetric — Send aggregated data to the backend
  fb.addFunction(
    'Export Metric',
    exportMetric as any,
    'export-metric',
    undefined,
    'Export the aggregated metric result to ' + name + ' backend',
  );

  const flowChart = fb.build();

  // Attach capabilities metadata
  (flowChart as any)[METRIC_CAPABILITIES_KEY] = capabilities ?? DEFAULT_CAPABILITIES;

  return flowChart;
}
