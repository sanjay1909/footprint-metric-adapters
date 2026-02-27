"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RingBufferStrategy = void 0;
const percentile_1 = require("./percentile");
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
class RingBufferStrategy {
    type = 'ringBuffer';
    buffer;
    head = 0;
    size = 0;
    maxSize;
    totalPushed = 0;
    totalEvicted = 0;
    constructor(config) {
        this.maxSize = config?.maxSize ?? 1000;
        this.buffer = new Array(this.maxSize);
    }
    /**
     * Push a metric entry into the ring buffer.
     * If the buffer is full, the oldest entry is overwritten.
     */
    push(entry) {
        this.buffer[this.head] = entry;
        this.head = (this.head + 1) % this.maxSize;
        this.totalPushed++;
        if (this.size < this.maxSize) {
            this.size++;
        }
        else {
            this.totalEvicted++;
        }
    }
    /**
     * Get all active entries in chronological order.
     */
    getEntries() {
        if (this.size === 0)
            return [];
        const entries = [];
        if (this.size < this.maxSize) {
            // Buffer not yet full — entries are 0..size-1
            for (let i = 0; i < this.size; i++) {
                entries.push(this.buffer[i]);
            }
        }
        else {
            // Buffer full — head points to oldest, wrap around
            for (let i = 0; i < this.maxSize; i++) {
                const idx = (this.head + i) % this.maxSize;
                entries.push(this.buffer[idx]);
            }
        }
        return entries;
    }
    getPercentiles(metric = 'latency') {
        return (0, percentile_1.computePercentiles)(this.getEntries(), metric);
    }
    getStagePercentiles(stageName, metric = 'latency') {
        const entries = this.getEntries().filter((e) => e.stageName === stageName);
        return (0, percentile_1.computePercentiles)(entries, metric);
    }
    getSnapshot() {
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
    getMetricResult() {
        const entries = this.getEntries();
        const now = Date.now();
        return {
            latencyPercentiles: (0, percentile_1.computePercentiles)(entries, 'latency'),
            stagePercentiles: (0, percentile_1.computeStagePercentiles)(entries, 'latency'),
            totalErrors: entries.filter((e) => e.metric === 'errorCount').reduce((sum, e) => sum + e.value, 0),
            stageErrors: (0, percentile_1.computeStageErrors)(entries),
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
    clear() {
        this.buffer = new Array(this.maxSize);
        this.head = 0;
        this.size = 0;
        this.totalPushed = 0;
        this.totalEvicted = 0;
    }
    getConfig() {
        return { type: 'ringBuffer', maxSize: this.maxSize };
    }
    /** Current number of entries in the buffer */
    getSize() {
        return this.size;
    }
    /** Whether the buffer is at capacity */
    isFull() {
        return this.size >= this.maxSize;
    }
}
exports.RingBufferStrategy = RingBufferStrategy;
