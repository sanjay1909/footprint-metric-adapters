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
export declare const METRIC_PATHS: {
    /** Namespace for all metric adapter scope paths */
    readonly NAMESPACE: "metric";
    /** Input seeded by parent's inputMapper or MetricCollector */
    readonly INPUT: {
        /** Array of MetricEntry data points to process */
        readonly ENTRIES: "entries";
        /** Window strategy configuration */
        readonly STRATEGY_CONFIG: "strategyConfig";
        /** Backend-specific configuration */
        readonly BACKEND_CONFIG: "backendConfig";
    };
    /** Intermediate state between stages */
    readonly INTERNAL: {
        /** Validated and normalized entries (written by CollectMetric, read by ApplyStrategy) */
        readonly VALIDATED_ENTRIES: "validatedEntries";
        /** Aggregated MetricResult (written by ApplyStrategy, read by ExportMetric) */
        readonly METRIC_RESULT: "metricResult";
        /** Error during collection or strategy application */
        readonly PROCESSING_ERROR: "processingError";
    };
    /** Output read by parent's outputMapper */
    readonly OUTPUT: {
        /** The export result */
        readonly RESULT: "result";
    };
};
