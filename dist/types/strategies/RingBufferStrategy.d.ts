/**
 * RingBufferStrategy — Fixed-size circular buffer window strategy.
 * ----------------------------------------------------------------------------
 * Retains the last N metric entries. When full, the oldest entry is evicted
 * automatically. Percentiles are always computed from the most recent N entries.
 *
 * USE CASE: "Last 1000 requests" — always fresh, bounded memory.
 * Best for: CustomDB, in-process dashboards, real-time monitoring.
 *
 * @module strategies/RingBufferStrategy
 */
import type { MetricEntry, MetricType, PercentileResult, WindowSnapshot, MetricResult, WindowStrategy, WindowConfig } from '../core/types';
/**
 * RingBufferStrategy — keeps the last N entries in a circular buffer.
 *
 * @example
 * ```typescript
 * const strategy = new RingBufferStrategy({ maxSize: 1000 });
 *
 * strategy.push({ stageName: 'llmCall', metric: 'latency', value: 230, timestamp: Date.now() });
 * strategy.push({ stageName: 'llmCall', metric: 'latency', value: 180, timestamp: Date.now() });
 *
 * const p = strategy.getPercentiles();
 * console.log(p.p50, p.p95, p.p99);
 * ```
 */
export declare class RingBufferStrategy implements WindowStrategy {
    readonly type: "ringBuffer";
    private buffer;
    private head;
    private size;
    private readonly maxSize;
    private totalPushed;
    private totalEvicted;
    constructor(config?: {
        maxSize?: number;
    });
    /**
     * Push a metric entry into the ring buffer.
     * If the buffer is full, the oldest entry is overwritten.
     */
    push(entry: MetricEntry): void;
    /**
     * Get all active entries in chronological order.
     */
    private getEntries;
    getPercentiles(metric?: MetricType): PercentileResult;
    getStagePercentiles(stageName: string, metric?: MetricType): PercentileResult;
    getSnapshot(): WindowSnapshot;
    getMetricResult(): MetricResult;
    clear(): void;
    getConfig(): WindowConfig;
    /** Current number of entries in the buffer */
    getSize(): number;
    /** Whether the buffer is at capacity */
    isFull(): boolean;
}
