"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TumblingWindowStrategy = void 0;
const percentile_1 = require("./percentile");
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
class TumblingWindowStrategy {
    type = 'tumbling';
    /** Current (active) bucket */
    currentBucket = [];
    /** When the current bucket started */
    bucketStartTime;
    /** Bucket duration in ms */
    windowMs;
    /** Maximum archived buckets to retain */
    maxArchivedBuckets;
    /** Archived (closed) buckets */
    archivedBuckets = [];
    totalPushed = 0;
    totalEvicted = 0;
    constructor(config) {
        this.windowMs = config?.windowMs ?? 60_000;
        this.maxArchivedBuckets = config?.maxArchivedBuckets ?? 10;
        this.bucketStartTime = Date.now();
    }
    /**
     * Push a metric entry. If the entry's timestamp falls outside the current
     * bucket boundary, the bucket is closed and a new one opened.
     */
    push(entry) {
        this.totalPushed++;
        // Check if we need to close the current bucket
        const bucketEndTime = this.bucketStartTime + this.windowMs;
        if (entry.timestamp >= bucketEndTime) {
            this.closeBucket(bucketEndTime);
            // Advance bucket start to align with the entry's timestamp
            this.bucketStartTime = bucketEndTime;
            // Handle case where entry is multiple windows ahead
            while (entry.timestamp >= this.bucketStartTime + this.windowMs) {
                // Create empty archived bucket for skipped windows
                this.archiveBucket([], this.bucketStartTime, this.bucketStartTime + this.windowMs);
                this.bucketStartTime += this.windowMs;
            }
        }
        this.currentBucket.push(entry);
    }
    /**
     * Close the current bucket, archive it, and start fresh.
     */
    closeBucket(endTime) {
        if (this.currentBucket.length > 0) {
            this.archiveBucket(this.currentBucket, this.bucketStartTime, endTime);
        }
        this.currentBucket = [];
    }
    /**
     * Archive a bucket with pre-computed percentiles.
     */
    archiveBucket(entries, startTime, endTime) {
        const bucket = {
            entries: [...entries],
            startTime,
            endTime,
            percentiles: (0, percentile_1.computePercentiles)(entries, 'latency'),
        };
        this.archivedBuckets.push(bucket);
        // Evict old archived buckets if we exceed max
        while (this.archivedBuckets.length > this.maxArchivedBuckets) {
            const evicted = this.archivedBuckets.shift();
            if (evicted) {
                this.totalEvicted += evicted.entries.length;
            }
        }
    }
    /**
     * Manually close the current bucket (useful for flush/shutdown).
     */
    flushCurrentBucket() {
        if (this.currentBucket.length === 0)
            return null;
        const endTime = Date.now();
        const bucket = {
            entries: [...this.currentBucket],
            startTime: this.bucketStartTime,
            endTime,
            percentiles: (0, percentile_1.computePercentiles)(this.currentBucket, 'latency'),
        };
        this.archiveBucket(this.currentBucket, this.bucketStartTime, endTime);
        this.currentBucket = [];
        this.bucketStartTime = endTime;
        return bucket;
    }
    getPercentiles(metric = 'latency') {
        return (0, percentile_1.computePercentiles)(this.currentBucket, metric);
    }
    getStagePercentiles(stageName, metric = 'latency') {
        const entries = this.currentBucket.filter((e) => e.stageName === stageName);
        return (0, percentile_1.computePercentiles)(entries, metric);
    }
    getSnapshot() {
        return {
            entries: [...this.currentBucket],
            startTime: this.bucketStartTime,
            endTime: this.bucketStartTime + this.windowMs,
            size: this.currentBucket.length,
            totalPushed: this.totalPushed,
            totalEvicted: this.totalEvicted,
        };
    }
    getMetricResult() {
        const entries = this.currentBucket;
        const now = Date.now();
        return {
            latencyPercentiles: (0, percentile_1.computePercentiles)(entries, 'latency'),
            stagePercentiles: (0, percentile_1.computeStagePercentiles)(entries, 'latency'),
            totalErrors: entries.filter((e) => e.metric === 'errorCount').reduce((sum, e) => sum + e.value, 0),
            stageErrors: (0, percentile_1.computeStageErrors)(entries),
            totalInvocations: entries.filter((e) => e.metric === 'stageInvocation').length,
            windowInfo: {
                type: 'tumbling',
                startTime: this.bucketStartTime,
                endTime: this.bucketStartTime + this.windowMs,
                entryCount: entries.length,
            },
            computedAt: now,
        };
    }
    clear() {
        this.currentBucket = [];
        this.archivedBuckets = [];
        this.bucketStartTime = Date.now();
        this.totalPushed = 0;
        this.totalEvicted = 0;
    }
    getConfig() {
        return { type: 'tumbling', windowMs: this.windowMs };
    }
    /** Get all archived (closed) buckets */
    getArchivedBuckets() {
        return [...this.archivedBuckets];
    }
    /** Get the latest archived bucket (most recently closed) */
    getLatestArchivedBucket() {
        return this.archivedBuckets[this.archivedBuckets.length - 1];
    }
    /** Current bucket entry count */
    getCurrentBucketSize() {
        return this.currentBucket.length;
    }
}
exports.TumblingWindowStrategy = TumblingWindowStrategy;
