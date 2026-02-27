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
import type { MetricEntry, MetricType, PercentileResult, WindowSnapshot, MetricResult, WindowStrategy, WindowConfig } from '../core/types';
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
export declare class SlidingWindowStrategy implements WindowStrategy {
    readonly type: "sliding";
    /** All entries within the window, sorted by timestamp */
    private entries;
    /** Window duration in ms */
    private readonly windowMs;
    private totalPushed;
    private totalEvicted;
    constructor(config?: {
        windowMs?: number;
    });
    /**
     * Push a metric entry and evict stale entries.
     */
    push(entry: MetricEntry): void;
    /**
     * Evict entries older than windowMs from the given reference time.
     */
    private evictStale;
    getPercentiles(metric?: MetricType): PercentileResult;
    getStagePercentiles(stageName: string, metric?: MetricType): PercentileResult;
    getSnapshot(): WindowSnapshot;
    getMetricResult(): MetricResult;
    clear(): void;
    getConfig(): WindowConfig;
    /** Current number of entries in the window */
    getSize(): number;
}
