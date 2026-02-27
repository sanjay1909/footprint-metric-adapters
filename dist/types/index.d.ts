/**
 * footprint-metric-adapters — Metric collection, window strategies, and LLM-navigable Tree of IDs.
 *
 * Layer 0 extension of the FootPrint stack:
 *   FootPrint (core) + footprint-metric-adapters (observability)
 *
 * THREE SYSTEMS:
 *
 * 1. WINDOW STRATEGIES — Composable units for metric aggregation
 *    - RingBufferStrategy: Last N entries (fixed-size, auto-evict)
 *    - TumblingWindowStrategy: Fixed time buckets (Prometheus/CloudWatch style)
 *    - SlidingWindowStrategy: Last T seconds (Datadog style)
 *    Each strategy is a self-contained SubFlow that can be swapped at runtime.
 *
 * 2. METRIC ADAPTERS — Backend adapters for metric export
 *    - MockMetricAdapter: In-memory for testing
 *    - ConsoleMetricAdapter: Formatted console output for development
 *    - (Community: Prometheus, Datadog, CloudWatch, CustomDB)
 *    Each adapter is a 3-stage FlowChart: CollectMetric → ApplyStrategy → ExportMetric
 *
 * 3. TREE OF IDs — LLM-navigable execution tree
 *    - ExecutionTree: Builds tree from FlowChart + Narrative + Recorders
 *    - TreeNavigator: LLM-friendly API (getSummary → drillDown → getChildren)
 *    Each node has ID + Description (Builder + Narrative) for lazy-loading exploration.
 *
 * @module footprint-metric-adapters
 */
export type { MetricEntry, MetricType, PercentileResult, WindowSnapshot, MetricResult, MetricExportResult, WindowStrategy, WindowConfig, MetricAdapterStageConfig, MetricStageFn, MetricAdapterCapabilities, MetricAdapterResult, } from './core';
export { METRIC_PATHS, createMetricSubflow, getMetricAdapterCapabilities } from './core';
export { RingBufferStrategy } from './strategies';
export { TumblingWindowStrategy, type MetricBucket } from './strategies';
export { SlidingWindowStrategy } from './strategies';
export type { RingBufferConfig, TumblingWindowConfig, SlidingWindowConfig, StrategyConfig } from './strategies';
export { computePercentiles, computeStagePercentiles, computeStageErrors, percentile } from './strategies';
export { MetricCollector, type MetricCollectorOptions, type CollectorSummary } from './collector';
export { ExecutionTree, type StageData } from './tree';
export { TreeNavigator } from './tree';
export type { TreeNode, TreeNodeType, TreeNodeSummary, TreeSummary, DrillDownResult, DataOperation, StageMetricsSummary, ErrorDetail, NavigationResult, } from './tree';
export { MockMetricAdapter, type MockMetricAdapterOptions, type MockMetricAdapterResult, } from './adapters/mock';
export { ConsoleMetricAdapter, type ConsoleMetricAdapterOptions, type ConsoleMetricAdapterResult, } from './adapters/console';
export { MockCloudWatchAdapter, type MockCloudWatchAdapterOptions, type MockCloudWatchAdapterResult, type CloudWatchMetricDatum, type CloudWatchExportData, } from './adapters/cloudwatch';
export { MockPrometheusAdapter, type MockPrometheusAdapterOptions, type MockPrometheusAdapterResult, type PrometheusExportData, type PrometheusMetricLine, } from './adapters/prometheus';
export { MockDatadogAdapter, type MockDatadogAdapterOptions, type MockDatadogAdapterResult, type DatadogExportData, type DatadogSeriesPoint, } from './adapters/datadog';
