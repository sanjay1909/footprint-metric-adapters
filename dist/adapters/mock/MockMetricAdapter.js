"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockMetricAdapter = void 0;
const paths_1 = require("../../core/paths");
const createMetricSubflow_1 = require("../../core/createMetricSubflow");
const RingBufferStrategy_1 = require("../../strategies/RingBufferStrategy");
const TumblingWindowStrategy_1 = require("../../strategies/TumblingWindowStrategy");
const SlidingWindowStrategy_1 = require("../../strategies/SlidingWindowStrategy");
// ============================================================================
// Factory
// ============================================================================
/**
 * Creates a Mock metric adapter for testing.
 *
 * @param options - Configuration options
 * @returns MockMetricAdapterResult with flowChart and inspection methods
 */
function MockMetricAdapter(options) {
    const windowConfig = options?.windowConfig ?? { type: 'ringBuffer', maxSize: 1000 };
    const onExport = options?.onExport;
    // Create the window strategy based on config
    const strategy = createStrategy(windowConfig);
    // Storage for test assertions
    const exportedResults = [];
    const exportHistory = [];
    // --------------------------------------------------------------------------
    // Stage 1: CollectMetric — Read entries from scope, validate, push to strategy
    // --------------------------------------------------------------------------
    const collectMetric = async (scope) => {
        const entries = scope.getValue([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INPUT.ENTRIES);
        if (!entries || entries.length === 0) {
            scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES, []);
            return;
        }
        // Validate and push each entry into the strategy
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
    // Stage 2: ApplyStrategy — Compute aggregates from the window
    // --------------------------------------------------------------------------
    const applyStrategy = async (scope) => {
        const metricResult = strategy.getMetricResult();
        scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.METRIC_RESULT, metricResult);
    };
    // --------------------------------------------------------------------------
    // Stage 3: ExportMetric — Store in memory (mock — no real backend)
    // --------------------------------------------------------------------------
    const exportMetric = async (scope) => {
        const metricResult = scope.getValue([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.INTERNAL.METRIC_RESULT);
        if (metricResult) {
            exportedResults.push(metricResult);
            if (onExport) {
                try {
                    onExport(metricResult);
                }
                catch {
                    // Swallow callback errors
                }
            }
        }
        const exportResult = {
            success: true,
            destination: 'mock://in-memory',
            entriesExported: metricResult?.windowInfo.entryCount ?? 0,
            exportedAt: Date.now(),
        };
        exportHistory.push(exportResult);
        scope.setObject([paths_1.METRIC_PATHS.NAMESPACE], paths_1.METRIC_PATHS.OUTPUT.RESULT, exportResult);
    };
    // --------------------------------------------------------------------------
    // Build the subflow
    // --------------------------------------------------------------------------
    const flowChart = (0, createMetricSubflow_1.createMetricSubflow)({
        name: 'Mock',
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
        getExports: () => [...exportedResults],
        getHistory: () => [...exportHistory],
        getStrategy: () => strategy,
        clear: () => {
            exportedResults.length = 0;
            exportHistory.length = 0;
            strategy.clear();
        },
    };
}
exports.MockMetricAdapter = MockMetricAdapter;
// ============================================================================
// Helper
// ============================================================================
function createStrategy(config) {
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
