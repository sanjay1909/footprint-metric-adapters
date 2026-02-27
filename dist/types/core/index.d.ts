/**
 * Core Module — Barrel Export
 * @module core
 */
export type { MetricEntry, MetricType, PercentileResult, WindowSnapshot, MetricResult, MetricExportResult, WindowStrategy, WindowConfig, MetricAdapterStageConfig, MetricStageFn, MetricAdapterCapabilities, MetricAdapterResult, } from './types';
export { METRIC_PATHS } from './paths';
export { createMetricSubflow, getMetricAdapterCapabilities } from './createMetricSubflow';
