/**
 * TumblingWindowStrategy — Fixed time bucket window strategy.
 * ----------------------------------------------------------------------------
 * Collects entries into fixed-duration buckets (e.g., 1 minute). When a new
 * entry arrives past the bucket boundary, the current bucket is closed and
 * a new one starts. Percentiles are computed from the current (active) bucket.
 *
 * USE CASE: "Every 60 seconds, aggregate and export."
 * Best for: Prometheus (scrape interval), CloudWatch (1-min resolution).
 *
 * BUCKET LIFECYCLE:
 *   [bucket opens] → entries accumulate → [bucket closes on next push past boundary]
 *                                          → percentiles computed → bucket archived → new bucket opens
 *
 * @module strategies/TumblingWindowStrategy
 */
import type { MetricEntry, MetricType, PercentileResult, WindowSnapshot, MetricResult, WindowStrategy, WindowConfig } from '../core/types';
/**
 * An archived bucket of metrics.
 */
export interface MetricBucket {
    /** Entries collected in this bucket */
    entries: MetricEntry[];
    /** When the bucket started */
    startTime: number;
    /** When the bucket ended */
    endTime: number;
    /** Pre-computed percentiles for the bucket */
    percentiles: PercentileResult;
}
/**
 * TumblingWindowStrategy — fixed time bucket metric aggregation.
 *
 * @example
 * ```typescript
 * const strategy = new TumblingWindowStrategy({ windowMs: 60000 }); // 1-min buckets
 *
 * strategy.push({ stageName: 'llmCall', metric: 'latency', value: 230, timestamp: now });
 *
 * // After 60 seconds, next push closes the bucket
 * strategy.push({ stageName: 'llmCall', metric: 'latency', value: 180, timestamp: now + 61000 });
 *
 * // Previous bucket is archived
 * const archived = strategy.getArchivedBuckets();
 * ```
 */
export declare class TumblingWindowStrategy implements WindowStrategy {
    readonly type: "tumbling";
    /** Current (active) bucket */
    private currentBucket;
    /** When the current bucket started */
    private bucketStartTime;
    /** Bucket duration in ms */
    private readonly windowMs;
    /** Maximum archived buckets to retain */
    private readonly maxArchivedBuckets;
    /** Archived (closed) buckets */
    private archivedBuckets;
    private totalPushed;
    private totalEvicted;
    constructor(config?: {
        windowMs?: number;
        maxArchivedBuckets?: number;
    });
    /**
     * Push a metric entry. If the entry's timestamp falls outside the current
     * bucket boundary, the bucket is closed and a new one opened.
     */
    push(entry: MetricEntry): void;
    /**
     * Close the current bucket, archive it, and start fresh.
     */
    private closeBucket;
    /**
     * Archive a bucket with pre-computed percentiles.
     */
    private archiveBucket;
    /**
     * Manually close the current bucket (useful for flush/shutdown).
     */
    flushCurrentBucket(): MetricBucket | null;
    getPercentiles(metric?: MetricType): PercentileResult;
    getStagePercentiles(stageName: string, metric?: MetricType): PercentileResult;
    getSnapshot(): WindowSnapshot;
    getMetricResult(): MetricResult;
    clear(): void;
    getConfig(): WindowConfig;
    /** Get all archived (closed) buckets */
    getArchivedBuckets(): MetricBucket[];
    /** Get the latest archived bucket (most recently closed) */
    getLatestArchivedBucket(): MetricBucket | undefined;
    /** Current bucket entry count */
    getCurrentBucketSize(): number;
}
