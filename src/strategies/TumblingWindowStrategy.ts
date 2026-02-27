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

import type {
  MetricEntry,
  MetricType,
  PercentileResult,
  WindowSnapshot,
  MetricResult,
  WindowStrategy,
  WindowConfig,
} from '../core/types';
import { computePercentiles, computeStagePercentiles, computeStageErrors } from './percentile';

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
export class TumblingWindowStrategy implements WindowStrategy {
  readonly type = 'tumbling' as const;

  /** Current (active) bucket */
  private currentBucket: MetricEntry[] = [];
  /** When the current bucket started */
  private bucketStartTime: number;
  /** Bucket duration in ms */
  private readonly windowMs: number;
  /** Maximum archived buckets to retain */
  private readonly maxArchivedBuckets: number;
  /** Archived (closed) buckets */
  private archivedBuckets: MetricBucket[] = [];

  private totalPushed = 0;
  private totalEvicted = 0;

  constructor(config?: { windowMs?: number; maxArchivedBuckets?: number }) {
    this.windowMs = config?.windowMs ?? 60_000;
    this.maxArchivedBuckets = config?.maxArchivedBuckets ?? 10;
    this.bucketStartTime = Date.now();
  }

  /**
   * Push a metric entry. If the entry's timestamp falls outside the current
   * bucket boundary, the bucket is closed and a new one opened.
   */
  push(entry: MetricEntry): void {
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
  private closeBucket(endTime: number): void {
    if (this.currentBucket.length > 0) {
      this.archiveBucket(this.currentBucket, this.bucketStartTime, endTime);
    }
    this.currentBucket = [];
  }

  /**
   * Archive a bucket with pre-computed percentiles.
   */
  private archiveBucket(entries: MetricEntry[], startTime: number, endTime: number): void {
    const bucket: MetricBucket = {
      entries: [...entries],
      startTime,
      endTime,
      percentiles: computePercentiles(entries, 'latency'),
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
  flushCurrentBucket(): MetricBucket | null {
    if (this.currentBucket.length === 0) return null;

    const endTime = Date.now();
    const bucket: MetricBucket = {
      entries: [...this.currentBucket],
      startTime: this.bucketStartTime,
      endTime,
      percentiles: computePercentiles(this.currentBucket, 'latency'),
    };
    this.archiveBucket(this.currentBucket, this.bucketStartTime, endTime);
    this.currentBucket = [];
    this.bucketStartTime = endTime;

    return bucket;
  }

  getPercentiles(metric: MetricType = 'latency'): PercentileResult {
    return computePercentiles(this.currentBucket, metric);
  }

  getStagePercentiles(stageName: string, metric: MetricType = 'latency'): PercentileResult {
    const entries = this.currentBucket.filter((e) => e.stageName === stageName);
    return computePercentiles(entries, metric);
  }

  getSnapshot(): WindowSnapshot {
    return {
      entries: [...this.currentBucket],
      startTime: this.bucketStartTime,
      endTime: this.bucketStartTime + this.windowMs,
      size: this.currentBucket.length,
      totalPushed: this.totalPushed,
      totalEvicted: this.totalEvicted,
    };
  }

  getMetricResult(): MetricResult {
    const entries = this.currentBucket;
    const now = Date.now();

    return {
      latencyPercentiles: computePercentiles(entries, 'latency'),
      stagePercentiles: computeStagePercentiles(entries, 'latency'),
      totalErrors: entries.filter((e) => e.metric === 'errorCount').reduce((sum, e) => sum + e.value, 0),
      stageErrors: computeStageErrors(entries),
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

  clear(): void {
    this.currentBucket = [];
    this.archivedBuckets = [];
    this.bucketStartTime = Date.now();
    this.totalPushed = 0;
    this.totalEvicted = 0;
  }

  getConfig(): WindowConfig {
    return { type: 'tumbling', windowMs: this.windowMs };
  }

  /** Get all archived (closed) buckets */
  getArchivedBuckets(): MetricBucket[] {
    return [...this.archivedBuckets];
  }

  /** Get the latest archived bucket (most recently closed) */
  getLatestArchivedBucket(): MetricBucket | undefined {
    return this.archivedBuckets[this.archivedBuckets.length - 1];
  }

  /** Current bucket entry count */
  getCurrentBucketSize(): number {
    return this.currentBucket.length;
  }
}
