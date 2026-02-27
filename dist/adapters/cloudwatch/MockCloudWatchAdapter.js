"use strict";
/**
 * MockCloudWatchAdapter — Simulates AWS CloudWatch PutMetricData.
 * ----------------------------------------------------------------------------
 * Mimics CloudWatch behavior:
 *   - Tumbling window strategy (fixed time buckets — CloudWatch aggregates in 1-min periods)
 *   - Metrics organized by Namespace + MetricName + Dimensions
 *   - Export format mirrors PutMetricData StatisticValues
 *
 * Use this for testing CloudWatch integration without real AWS credentials.
 *
 * @module adapters/cloudwatch/MockCloudWatchAdapter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockCloudWatchAdapter = void 0;
const paths_1 = require("../../core/paths");
const createMetricSubflow_1 = require("../../core/createMetricSubflow");
const TumblingWindowStrategy_1 = require("../../strategies/TumblingWindowStrategy");
const RingBufferStrategy_1 = require("../../strategies/RingBufferStrategy");
const SlidingWindowStrategy_1 = require("../../strategies/SlidingWindowStrategy");
// ============================================================================
// Factory
// ============================================================================
function MockCloudWatchAdapter(options) {
    const namespace = options?.namespace ?? 'FootPrint/Pipeline';
    const windowConfig = options?.windowConfig ?? { type: 'tumbling', windowMs: 60_000 };
    const onExport = options?.onExport;
    const strategy = createWindowStrategy(windowConfig);
    const exports = [];
    // --------------------------------------------------------------------------
    // Stage 1: CollectMetric
    // --------------------------------------------------------------------------
    const collectMetric = async (scope) => {
        const entries = scope.getValue([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INPUT.ENTRIES);
        if (!entries || entries.length === 0) {
            scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES, []);
            return;
        }
        const validated = [];
        for (const entry of entries) {
            if (entry.stageName && entry.metric && typeof entry.value === 'number') {
                strategy.push(entry);
                validated.push(entry);
            }
        }
        scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES, validated);
    };
    // --------------------------------------------------------------------------
    // Stage 2: ApplyStrategy
    // --------------------------------------------------------------------------
    const applyStrategy = async (scope) => {
        const metricResult = strategy.getMetricResult();
        scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.METRIC_RESULT, metricResult);
    };
    // --------------------------------------------------------------------------
    // Stage 3: ExportMetric — Format as CloudWatch PutMetricData
    // --------------------------------------------------------------------------
    const exportMetric = async (scope) => {
        const metricResult = scope.getValue([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.METRIC_RESULT);
        const metricData = [];
        if (metricResult) {
            // Overall latency metric
            const lp = metricResult.latencyPercentiles;
            if (lp.count > 0) {
                metricData.push({
                    MetricName: 'PipelineLatency',
                    Dimensions: [{ Name: 'Pipeline', Value: 'Overall' }],
                    Timestamp: new Date(metricResult.computedAt).toISOString(),
                    StatisticValues: {
                        SampleCount: lp.count,
                        Sum: lp.mean * lp.count,
                        Minimum: lp.min,
                        Maximum: lp.max,
                    },
                    Unit: 'Milliseconds',
                });
            }
            // Per-stage latency metrics
            for (const [stageName, sp] of metricResult.stagePercentiles) {
                metricData.push({
                    MetricName: 'StageLatency',
                    Dimensions: [
                        { Name: 'Pipeline', Value: 'Overall' },
                        { Name: 'StageName', Value: stageName },
                    ],
                    Timestamp: new Date(metricResult.computedAt).toISOString(),
                    StatisticValues: {
                        SampleCount: sp.count,
                        Sum: sp.mean * sp.count,
                        Minimum: sp.min,
                        Maximum: sp.max,
                    },
                    Unit: 'Milliseconds',
                });
            }
            // Error count metrics
            if (metricResult.totalErrors > 0) {
                metricData.push({
                    MetricName: 'ErrorCount',
                    Dimensions: [{ Name: 'Pipeline', Value: 'Overall' }],
                    Timestamp: new Date(metricResult.computedAt).toISOString(),
                    StatisticValues: {
                        SampleCount: 1,
                        Sum: metricResult.totalErrors,
                        Minimum: metricResult.totalErrors,
                        Maximum: metricResult.totalErrors,
                    },
                    Unit: 'Count',
                });
            }
            // Per-stage error counts
            for (const [stageName, errorCount] of metricResult.stageErrors) {
                if (errorCount > 0) {
                    metricData.push({
                        MetricName: 'StageErrorCount',
                        Dimensions: [
                            { Name: 'Pipeline', Value: 'Overall' },
                            { Name: 'StageName', Value: stageName },
                        ],
                        Timestamp: new Date(metricResult.computedAt).toISOString(),
                        StatisticValues: {
                            SampleCount: 1,
                            Sum: errorCount,
                            Minimum: errorCount,
                            Maximum: errorCount,
                        },
                        Unit: 'Count',
                    });
                }
            }
        }
        const exportData = {
            Namespace: namespace,
            MetricData: metricData,
            exportedAt: Date.now(),
        };
        exports.push(exportData);
        if (onExport) {
            try {
                onExport(exportData);
            }
            catch { /* swallow */ }
        }
        const exportResult = {
            success: true,
            destination: 'cloudwatch://' + namespace,
            entriesExported: metricData.length,
            exportedAt: Date.now(),
        };
        scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.OUTPUT.RESULT, exportResult);
    };
    // --------------------------------------------------------------------------
    // Build
    // --------------------------------------------------------------------------
    const flowChart = (0, createMetricSubflow_1.createMetricSubflow)({
        name: 'CloudWatch',
        collectMetric: collectMetric,
        applyStrategy: applyStrategy,
        exportMetric: exportMetric,
        capabilities: {
            supportsHistograms: true,
            supportsLabels: true,
            supportsPush: true,
        },
    });
    return {
        flowChart,
        getExports: () => [...exports],
        getStrategy: () => strategy,
        clear: () => {
            exports.length = 0;
            strategy.clear();
        },
    };
}
exports.MockCloudWatchAdapter = MockCloudWatchAdapter;
// ============================================================================
// Helper
// ============================================================================
function createWindowStrategy(config) {
    switch (config.type) {
        case 'tumbling':
            return new TumblingWindowStrategy_1.TumblingWindowStrategy({ windowMs: config.windowMs ?? 60_000 });
        case 'ringBuffer':
            return new RingBufferStrategy_1.RingBufferStrategy({ maxSize: config.maxSize ?? 1000 });
        case 'sliding':
            return new SlidingWindowStrategy_1.SlidingWindowStrategy({ windowMs: config.windowMs ?? 300_000 });
        default:
            return new TumblingWindowStrategy_1.TumblingWindowStrategy({ windowMs: 60_000 });
    }
}
