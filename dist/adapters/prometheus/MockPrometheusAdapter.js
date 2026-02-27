"use strict";
/**
 * MockPrometheusAdapter — Simulates Prometheus exposition format.
 * ----------------------------------------------------------------------------
 * Mimics Prometheus behavior:
 *   - Ring buffer strategy (Prometheus scrapes latest data — fixed window)
 *   - Pull-based: generates exposition text format on export
 *   - Metric names use snake_case with labels in {key="value"} format
 *   - Supports histogram buckets (le), summary quantiles, counters, gauges
 *
 * Use this for testing Prometheus/Grafana integration without real Prometheus.
 *
 * @module adapters/prometheus/MockPrometheusAdapter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPrometheusAdapter = void 0;
const paths_1 = require("../../core/paths");
const createMetricSubflow_1 = require("../../core/createMetricSubflow");
const RingBufferStrategy_1 = require("../../strategies/RingBufferStrategy");
const TumblingWindowStrategy_1 = require("../../strategies/TumblingWindowStrategy");
const SlidingWindowStrategy_1 = require("../../strategies/SlidingWindowStrategy");
// ============================================================================
// Factory
// ============================================================================
function MockPrometheusAdapter(options) {
    const prefix = options?.prefix ?? 'footprint_pipeline';
    const windowConfig = options?.windowConfig ?? { type: 'ringBuffer', maxSize: 1000 };
    const onExport = options?.onExport;
    const strategy = createWindowStrategy(windowConfig);
    const exportData = [];
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
    // Stage 3: ExportMetric — Format as Prometheus exposition text
    // --------------------------------------------------------------------------
    const exportMetric = async (scope) => {
        const metricResult = scope.getValue([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.METRIC_RESULT);
        const lines = [];
        const metricLines = [];
        if (metricResult) {
            // ── Overall latency summary ──
            const lp = metricResult.latencyPercentiles;
            if (lp.count > 0) {
                const metricName = prefix + '_latency_milliseconds';
                lines.push('# HELP ' + metricName + ' Pipeline stage latency in milliseconds');
                lines.push('# TYPE ' + metricName + ' summary');
                const quantiles = [
                    ['0.5', lp.p50], ['0.95', lp.p95], ['0.99', lp.p99],
                ];
                for (const [q, v] of quantiles) {
                    lines.push(metricName + '{quantile="' + q + '"} ' + v.toFixed(3));
                    metricLines.push({
                        name: metricName,
                        labels: { quantile: q },
                        value: v,
                        type: 'summary',
                        help: 'Pipeline stage latency in milliseconds',
                    });
                }
                lines.push(metricName + '_sum ' + (lp.mean * lp.count).toFixed(3));
                lines.push(metricName + '_count ' + lp.count);
            }
            // ── Per-stage latency ──
            for (const [stageName, sp] of metricResult.stagePercentiles) {
                const metricName = prefix + '_stage_latency_milliseconds';
                const safe = sanitizeLabel(stageName);
                const quantiles = [
                    ['0.5', sp.p50], ['0.95', sp.p95], ['0.99', sp.p99],
                ];
                for (const [q, v] of quantiles) {
                    lines.push(metricName + '{stage="' + safe + '",quantile="' + q + '"} ' + v.toFixed(3));
                    metricLines.push({
                        name: metricName,
                        labels: { stage: safe, quantile: q },
                        value: v,
                        type: 'summary',
                    });
                }
                lines.push(metricName + '_sum{stage="' + safe + '"} ' + (sp.mean * sp.count).toFixed(3));
                lines.push(metricName + '_count{stage="' + safe + '"} ' + sp.count);
            }
            // ── Error counter ──
            if (metricResult.totalErrors > 0) {
                const metricName = prefix + '_errors_total';
                lines.push('# HELP ' + metricName + ' Total error count');
                lines.push('# TYPE ' + metricName + ' counter');
                lines.push(metricName + ' ' + metricResult.totalErrors);
                metricLines.push({
                    name: metricName,
                    labels: {},
                    value: metricResult.totalErrors,
                    type: 'counter',
                    help: 'Total error count',
                });
            }
            // ── Per-stage errors ──
            for (const [stageName, errorCount] of metricResult.stageErrors) {
                if (errorCount > 0) {
                    const metricName = prefix + '_stage_errors_total';
                    const safe = sanitizeLabel(stageName);
                    lines.push(metricName + '{stage="' + safe + '"} ' + errorCount);
                    metricLines.push({
                        name: metricName,
                        labels: { stage: safe },
                        value: errorCount,
                        type: 'counter',
                    });
                }
            }
            // ── Invocation gauge ──
            const invocMetric = prefix + '_invocations_total';
            lines.push('# HELP ' + invocMetric + ' Total stage invocations');
            lines.push('# TYPE ' + invocMetric + ' counter');
            lines.push(invocMetric + ' ' + metricResult.totalInvocations);
            metricLines.push({
                name: invocMetric,
                labels: {},
                value: metricResult.totalInvocations,
                type: 'counter',
                help: 'Total stage invocations',
            });
        }
        const expositionText = lines.join('\n') + '\n';
        const data = {
            expositionText,
            metricLines,
            exportedAt: Date.now(),
        };
        exportData.push(data);
        if (onExport) {
            try {
                onExport(data);
            }
            catch { /* swallow */ }
        }
        const exportResult = {
            success: true,
            destination: 'prometheus:///metrics',
            entriesExported: metricLines.length,
            exportedAt: Date.now(),
        };
        scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.OUTPUT.RESULT, exportResult);
    };
    // --------------------------------------------------------------------------
    // Build
    // --------------------------------------------------------------------------
    const flowChart = (0, createMetricSubflow_1.createMetricSubflow)({
        name: 'Prometheus',
        collectMetric: collectMetric,
        applyStrategy: applyStrategy,
        exportMetric: exportMetric,
        capabilities: {
            supportsHistograms: true,
            supportsLabels: true,
            supportsPush: false, // Prometheus is pull-based
        },
    });
    return {
        flowChart,
        getExports: () => [...exportData],
        getLatestExposition: () => exportData.length > 0 ? exportData[exportData.length - 1].expositionText : '',
        getStrategy: () => strategy,
        clear: () => {
            exportData.length = 0;
            strategy.clear();
        },
    };
}
exports.MockPrometheusAdapter = MockPrometheusAdapter;
// ============================================================================
// Helpers
// ============================================================================
function sanitizeLabel(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}
function createWindowStrategy(config) {
    switch (config.type) {
        case 'ringBuffer':
            return new RingBufferStrategy_1.RingBufferStrategy({ maxSize: config.maxSize ?? 1000 });
        case 'tumbling':
            return new TumblingWindowStrategy_1.TumblingWindowStrategy({ windowMs: config.windowMs ?? 60_000 });
        case 'sliding':
            return new SlidingWindowStrategy_1.SlidingWindowStrategy({ windowMs: config.windowMs ?? 300_000 });
        default:
            return new RingBufferStrategy_1.RingBufferStrategy({ maxSize: 1000 });
    }
}
