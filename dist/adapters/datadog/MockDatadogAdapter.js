"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDatadogAdapter = void 0;
const paths_1 = require("../../core/paths");
const createMetricSubflow_1 = require("../../core/createMetricSubflow");
const SlidingWindowStrategy_1 = require("../../strategies/SlidingWindowStrategy");
const RingBufferStrategy_1 = require("../../strategies/RingBufferStrategy");
const TumblingWindowStrategy_1 = require("../../strategies/TumblingWindowStrategy");
// ============================================================================
// Factory
// ============================================================================
function MockDatadogAdapter(options) {
    const metricPrefix = options?.prefix ?? 'footprint.pipeline';
    const defaultTags = options?.tags ?? ['env:dev', 'service:footprint'];
    const windowConfig = options?.windowConfig ?? { type: 'sliding', windowMs: 300_000 };
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
    // Stage 3: ExportMetric — Format as Datadog v2 series
    // --------------------------------------------------------------------------
    const exportMetric = async (scope) => {
        const metricResult = scope.getValue([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.METRIC_RESULT);
        const series = [];
        const now = Math.floor(Date.now() / 1000); // Datadog uses Unix seconds
        if (metricResult) {
            // ── Overall latency distribution ──
            const lp = metricResult.latencyPercentiles;
            if (lp.count > 0) {
                series.push({
                    metric: metricPrefix + '.latency',
                    type: 'distribution',
                    points: [
                        { timestamp: now, value: lp.p50 },
                        { timestamp: now, value: lp.p95 },
                        { timestamp: now, value: lp.p99 },
                    ],
                    tags: [...defaultTags, 'metric_type:latency'],
                });
                // Also submit avg as gauge
                series.push({
                    metric: metricPrefix + '.latency.avg',
                    type: 'gauge',
                    points: [{ timestamp: now, value: lp.mean }],
                    tags: [...defaultTags],
                });
            }
            // ── Per-stage latency ──
            for (const [stageName, sp] of metricResult.stagePercentiles) {
                series.push({
                    metric: metricPrefix + '.stage.latency',
                    type: 'distribution',
                    points: [
                        { timestamp: now, value: sp.p50 },
                        { timestamp: now, value: sp.p95 },
                        { timestamp: now, value: sp.p99 },
                    ],
                    tags: [...defaultTags, 'stage:' + stageName.replace(/\s+/g, '_').toLowerCase()],
                });
            }
            // ── Error count ──
            if (metricResult.totalErrors > 0) {
                series.push({
                    metric: metricPrefix + '.errors',
                    type: 'count',
                    points: [{ timestamp: now, value: metricResult.totalErrors }],
                    tags: [...defaultTags, 'metric_type:error'],
                });
            }
            // ── Per-stage errors ──
            for (const [stageName, errorCount] of metricResult.stageErrors) {
                if (errorCount > 0) {
                    series.push({
                        metric: metricPrefix + '.stage.errors',
                        type: 'count',
                        points: [{ timestamp: now, value: errorCount }],
                        tags: [...defaultTags, 'stage:' + stageName.replace(/\s+/g, '_').toLowerCase()],
                    });
                }
            }
            // ── Invocation counter ──
            series.push({
                metric: metricPrefix + '.invocations',
                type: 'count',
                points: [{ timestamp: now, value: metricResult.totalInvocations }],
                tags: [...defaultTags],
            });
        }
        const data = {
            series,
            apiKey: 'mock-dd-api-key-xxx',
            exportedAt: Date.now(),
        };
        exports.push(data);
        if (onExport) {
            try {
                onExport(data);
            }
            catch { /* swallow */ }
        }
        const exportResult = {
            success: true,
            destination: 'datadog://api.datadoghq.com/v2/series',
            entriesExported: series.length,
            exportedAt: Date.now(),
        };
        scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.OUTPUT.RESULT, exportResult);
    };
    // --------------------------------------------------------------------------
    // Build
    // --------------------------------------------------------------------------
    const flowChart = (0, createMetricSubflow_1.createMetricSubflow)({
        name: 'Datadog',
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
exports.MockDatadogAdapter = MockDatadogAdapter;
// ============================================================================
// Helper
// ============================================================================
function createWindowStrategy(config) {
    switch (config.type) {
        case 'sliding':
            return new SlidingWindowStrategy_1.SlidingWindowStrategy({ windowMs: config.windowMs ?? 300_000 });
        case 'ringBuffer':
            return new RingBufferStrategy_1.RingBufferStrategy({ maxSize: config.maxSize ?? 1000 });
        case 'tumbling':
            return new TumblingWindowStrategy_1.TumblingWindowStrategy({ windowMs: config.windowMs ?? 60_000 });
        default:
            return new SlidingWindowStrategy_1.SlidingWindowStrategy({ windowMs: 300_000 });
    }
}
