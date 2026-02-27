"use strict";
/**
 * Metric Adapter Scope Paths — What the subflow reads/writes.
 * ----------------------------------------------------------------------------
 * All metric adapters read from and write to the same scope paths so the
 * parent pipeline can mount any adapter interchangeably.
 *
 * Mirrors ADAPTER_PATHS from agent-footprint-adapters.
 *
 * @module core/paths
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRIC_PATHS = void 0;
exports.METRIC_PATHS = {
    /** Namespace for all metric adapter scope paths */
    NAMESPACE: 'metric',
    /** Input seeded by parent's inputMapper or MetricCollector */
    INPUT: {
        /** Array of MetricEntry data points to process */
        ENTRIES: 'entries',
        /** Window strategy configuration */
        STRATEGY_CONFIG: 'strategyConfig',
        /** Backend-specific configuration */
        BACKEND_CONFIG: 'backendConfig',
    },
    /** Intermediate state between stages */
    INTERNAL: {
        /** Validated and normalized entries (written by CollectMetric, read by ApplyStrategy) */
        VALIDATED_ENTRIES: 'validatedEntries',
        /** Aggregated MetricResult (written by ApplyStrategy, read by ExportMetric) */
        METRIC_RESULT: 'metricResult',
        /** Error during collection or strategy application */
        PROCESSING_ERROR: 'processingError',
    },
    /** Output read by parent's outputMapper */
    OUTPUT: {
        /** The export result */
        RESULT: 'result',
    },
};
