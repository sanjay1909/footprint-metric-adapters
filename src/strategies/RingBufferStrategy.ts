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
export class RingBufferStrategy implements WindowStrategy {
  readonly type = 'ringBuffer' as const;

  private buffer: MetricEntry[];
  private head = 0;
  private size = 0;
  private readonly maxSize: number;
  private totalPushed = 0;
  private totalEvicted = 0;

  constructor(config?: { maxSize?: number }) {
    this.maxSize = config?.maxSize ?? 1000;
    this.buffer = new Array(this.maxSize);
  }

  /**
   * Push a metric entry into the ring buffer.
   * If the buffer is full, the oldest entry is overwritten.
   */
  push(entry: MetricEntry): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.maxSize;
    this.totalPushed++;

    if (this.size < this.maxSize) {
      this.size++;
    } else {
      this.totalEvicted++;
    }
  }

  /**
   * Get all active entries in chronological order.
   */
  private getEntries(): MetricEntry[] {
    if (this.size === 0) return [];

    const entries: MetricEntry[] = [];
    if (this.size < this.maxSize) {
      // Buffer not yet full — entries are 0..size-1
      for (let i = 0; i < this.size; i++) {
        entries.push(this.buffer[i]);
      }
    } else {
      // Buffer full — head points to oldest, wrap around
      for (let i = 0; i < this.maxSize; i++) {
        const idx = (this.head + i) % this.maxSize;
        entries.push(this.buffer[idx]);
      }
    }
    return entries;
  }

  getPercentiles(metric: MetricType = 'latency'): PercentileResult {
    return computePercentiles(this.getEntries(), metric);
  }

  getStagePercentiles(stageName: string, metric: MetricType = 'latency'): PercentileResult {
    const entries = this.getEntries().filter((e) => e.stageName === stageName);
    return computePercentiles(entries, metric);
  }

  getSnapshot(): WindowSnapshot {
    const entries = this.getEntries();
    return {
      entries,
      startTime: entries.length > 0 ? entries[0].timestamp : 0,
      endTime: entries.length > 0 ? entries[entries.length - 1].timestamp : 0,
      size: entries.length,
      totalPushed: this.totalPushed,
      totalEvicted: this.totalEvicted,
    };
  }

  getMetricResult(): MetricResult {
    const entries = this.getEntries();
    const now = Date.now();

    return {
      latencyPercentiles: computePercentiles(entries, 'latency'),
      stagePercentiles: computeStagePercentiles(entries, 'latency'),
      totalErrors: entries.filter((e) => e.metric === 'errorCount').reduce((sum, e) => sum + e.value, 0),
      stageErrors: computeStageErrors(entries),
      totalInvocations: entries.filter((e) => e.metric === 'stageInvocation').length,
      windowInfo: {
        type: 'ringBuffer',
        startTime: entries.length > 0 ? entries[0].timestamp : now,
        endTime: entries.length > 0 ? entries[entries.length - 1].timestamp : now,
        entryCount: entries.length,
      },
      computedAt: now,
    };
  }

  clear(): void {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.size = 0;
    this.totalPushed = 0;
    this.totalEvicted = 0;
  }

  getConfig(): WindowConfig {
    return { type: 'ringBuffer', maxSize: this.maxSize };
  }

  /** Current number of entries in the buffer */
  getSize(): number {
    return this.size;
  }

  /** Whether the buffer is at capacity */
  isFull(): boolean {
    return this.size >= this.maxSize;
  }
}
