"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetricSubflow = exports.getMetricAdapterCapabilities = void 0;
const footprint_1 = require("footprint");
/**
 * Symbol key for attaching MetricAdapterCapabilities to a FlowChart.
 */
const METRIC_CAPABILITIES_KEY = Symbol.for('footprintMetric.adapterCapabilities');
/**
 * Default capabilities when none are specified.
 */
const DEFAULT_CAPABILITIES = {
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
function getMetricAdapterCapabilities(flowChart) {
    return flowChart[METRIC_CAPABILITIES_KEY] ?? DEFAULT_CAPABILITIES;
}
exports.getMetricAdapterCapabilities = getMetricAdapterCapabilities;
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
function createMetricSubflow(config) {
    const { name, collectMetric, applyStrategy, exportMetric, capabilities } = config;
    const fb = new footprint_1.FlowChartBuilder();
    // Stage 1: CollectMetric — Validate and normalize incoming metric entries
    fb.start('Collect Metric', collectMetric, 'collect-metric', undefined, 'Validate and normalize incoming metric entries from scope recorders');
    // Stage 2: ApplyStrategy — Apply window strategy and compute aggregates
    fb.addFunction('Apply Strategy', applyStrategy, 'apply-strategy', undefined, 'Apply the configured window strategy (RingBuffer/Tumbling/Sliding) and compute percentiles');
    // Stage 3: ExportMetric — Send aggregated data to the backend
    fb.addFunction('Export Metric', exportMetric, 'export-metric', undefined, 'Export the aggregated metric result to ' + name + ' backend');
    const flowChart = fb.build();
    // Attach capabilities metadata
    flowChart[METRIC_CAPABILITIES_KEY] = capabilities ?? DEFAULT_CAPABILITIES;
    return flowChart;
}
exports.createMetricSubflow = createMetricSubflow;
