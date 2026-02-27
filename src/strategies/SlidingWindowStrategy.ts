/**
 * SlidingWindowStrategy — Time-based sliding window strategy.
 * ----------------------------------------------------------------------------
 * Keeps all entries within the last T milliseconds. Older entries are evicted
 * on every push or read. The window size varies based on traffic volume.
 *
 * USE CASE: "Last 5 minutes of requests" — variable count, fixed time horizon.
 * Best for: Datadog (5-min aggregation), real-time dashboards.
 *
 * EVICTION: Happens lazily on push() and getPercentiles() — no background timer.
 *
 * @module strategies/SlidingWindowStrategy
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
 * SlidingWindowStrategy — keeps entries from the last T milliseconds.
 *
 * @example
 * ```typescript
 * const strategy = new SlidingWindowStrategy({ windowMs: 300000 }); // 5-min window
 *
 * // Push entries over time
 * strategy.push({ stageName: 'llmCall', metric: 'latency', value: 230, timestamp: now });
 * strategy.push({ stageName: 'llmCall', metric: 'latency', value: 180, timestamp: now + 1000 });
 *
 * // Entries older than 5 minutes are automatically evicted
 * const p = strategy.getPercentiles();
 * ```
 */
export class SlidingWindowStrategy implements WindowStrategy {
  readonly type = 'sliding' as const;

  /** All entries within the window, sorted by timestamp */
  private entries: MetricEntry[] = [];
  /** Window duration in ms */
  private readonly windowMs: number;

  private totalPushed = 0;
  private totalEvicted = 0;

  constructor(config?: { windowMs?: number }) {
    this.windowMs = config?.windowMs ?? 300_000; // 5 minutes default
  }

  /**
   * Push a metric entry and evict stale entries.
   */
  push(entry: MetricEntry): void {
    this.totalPushed++;
    this.entries.push(entry);
    this.evictStale(entry.timestamp);
  }

  /**
   * Evict entries older than windowMs from the given reference time.
   */
  private evictStale(referenceTime?: number): void {
    const cutoff = (referenceTime ?? Date.now()) - this.windowMs;
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.timestamp >= cutoff);
    this.totalEvicted += before - this.entries.length;
  }

  getPercentiles(metric: MetricType = 'latency'): PercentileResult {
    this.evictStale();
    return computePercentiles(this.entries, metric);
  }

  getStagePercentiles(stageName: string, metric: MetricType = 'latency'): PercentileResult {
    this.evictStale();
    const filtered = this.entries.filter((e) => e.stageName === stageName);
    return computePercentiles(filtered, metric);
  }

  getSnapshot(): WindowSnapshot {
    this.evictStale();
    const now = Date.now();
    return {
      entries: [...this.entries],
      startTime: now - this.windowMs,
      endTime: now,
      size: this.entries.length,
      totalPushed: this.totalPushed,
      totalEvicted: this.totalEvicted,
    };
  }

  getMetricResult(): MetricResult {
    this.evictStale();
    const now = Date.now();

    return {
      latencyPercentiles: computePercentiles(this.entries, 'latency'),
      stagePercentiles: computeStagePercentiles(this.entries, 'latency'),
      totalErrors: this.entries.filter((e) => e.metric === 'errorCount').reduce((sum, e) => sum + e.value, 0),
      stageErrors: computeStageErrors(this.entries),
      totalInvocations: this.entries.filter((e) => e.metric === 'stageInvocation').length,
      windowInfo: {
        type: 'sliding',
        startTime: now - this.windowMs,
        endTime: now,
        entryCount: this.entries.length,
      },
      computedAt: now,
    };
  }

  clear(): void {
    this.entries = [];
    this.totalPushed = 0;
    this.totalEvicted = 0;
  }

  getConfig(): WindowConfig {
    return { type: 'sliding', windowMs: this.windowMs };
  }

  /** Current number of entries in the window */
  getSize(): number {
    this.evictStale();
    return this.entries.length;
  }
}
