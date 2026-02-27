"use strict";
/**
 * MetricCollector — Recorder that bridges Scope events to metric pipeline.
 * ----------------------------------------------------------------------------
 * Implements FootPrint's Recorder interface. Listens to scope events
 * (onError, onStageStart, onStageEnd, onRead, onWrite, onCommit) and
 * produces MetricEntry data points that feed into a WindowStrategy.
 *
 * This is the bridge between FootPrint's execution engine and the metric
 * adapter pipeline. Attach it to a Scope, and it automatically collects
 * latency, error, read/write/commit counts, and stage invocation metrics.
 *
 * @module collector/MetricCollector
 *
 * @example
 * ```typescript
 * const strategy = new RingBufferStrategy({ maxSize: 1000 });
 * const collector = new MetricCollector({ strategy });
 *
 * scope.attachRecorder(collector);
 *
 * // After execution:
 * const percentiles = collector.getPercentiles();
 * const result = collector.getMetricResult();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricCollector = void 0;
// ============================================================================
// MetricCollector Implementation
// ============================================================================
class MetricCollector {
    id;
    strategy;
    trackReads;
    trackWrites;
    trackCommits;
    onMetricEntry;
    /** Stage start timestamps for latency calculation */
    stageStartTimes = new Map();
    /** Track all observed stages */
    observedStages = new Set();
    /** Running counters */
    totalErrors = 0;
    totalInvocations = 0;
    totalEntries = 0;
    constructor(options) {
        this.id = options.id ?? 'metric-collector-' + Date.now();
        this.strategy = options.strategy;
        this.trackReads = options.trackReads ?? true;
        this.trackWrites = options.trackWrites ?? true;
        this.trackCommits = options.trackCommits ?? true;
        this.onMetricEntry = options.onMetricEntry;
    }
    // ==========================================================================
    // Recorder Hooks
    // ==========================================================================
    onStageStart(event) {
        this.stageStartTimes.set(event.stageName, event.timestamp);
        this.observedStages.add(event.stageName);
        this.totalInvocations++;
        this.emit({
            stageName: event.stageName,
            metric: 'stageInvocation',
            value: 1,
            timestamp: event.timestamp,
        });
    }
    onStageEnd(event) {
        if (event.duration !== undefined) {
            this.emit({
                stageName: event.stageName,
                metric: 'latency',
                value: event.duration,
                timestamp: event.timestamp,
            });
        }
        else {
            // Calculate duration from start time
            const startTime = this.stageStartTimes.get(event.stageName);
            if (startTime !== undefined) {
                const duration = event.timestamp - startTime;
                this.emit({
                    stageName: event.stageName,
                    metric: 'latency',
                    value: duration,
                    timestamp: event.timestamp,
                });
            }
        }
        this.stageStartTimes.delete(event.stageName);
    }
    onError(event) {
        this.totalErrors++;
        this.observedStages.add(event.stageName);
        this.emit({
            stageName: event.stageName,
            metric: 'errorCount',
            value: 1,
            timestamp: event.timestamp,
            metadata: {
                error: event.error?.message ?? String(event.error),
                operation: event.operation,
                path: event.path,
                key: event.key,
            },
        });
    }
    onRead(event) {
        if (!this.trackReads)
            return;
        this.emit({
            stageName: event.stageName,
            metric: 'readCount',
            value: 1,
            timestamp: event.timestamp,
        });
    }
    onWrite(event) {
        if (!this.trackWrites)
            return;
        this.emit({
            stageName: event.stageName,
            metric: 'writeCount',
            value: 1,
            timestamp: event.timestamp,
        });
    }
    onCommit(event) {
        if (!this.trackCommits)
            return;
        this.emit({
            stageName: event.stageName,
            metric: 'commitCount',
            value: 1,
            timestamp: event.timestamp,
        });
    }
    // ==========================================================================
    // Public API
    // ==========================================================================
    /**
     * Get percentiles from the underlying window strategy.
     */
    getPercentiles() {
        return this.strategy.getPercentiles('latency');
    }
    /**
     * Get percentiles for a specific stage.
     */
    getStagePercentiles(stageName) {
        return this.strategy.getStagePercentiles(stageName, 'latency');
    }
    /**
     * Get the full metric result from the window strategy.
     */
    getMetricResult() {
        return this.strategy.getMetricResult();
    }
    /**
     * Get a snapshot of the window.
     */
    getSnapshot() {
        return this.strategy.getSnapshot();
    }
    /**
     * Get a summary of all collected metrics.
     */
    getSummary() {
        return {
            totalEntries: this.totalEntries,
            totalErrors: this.totalErrors,
            totalInvocations: this.totalInvocations,
            stageNames: Array.from(this.observedStages),
            strategyType: this.strategy.type,
            windowSize: this.strategy.getSnapshot().size,
        };
    }
    /**
     * Get the underlying window strategy (for direct access).
     */
    getStrategy() {
        return this.strategy;
    }
    /**
     * Reset all counters and clear the window strategy.
     */
    reset() {
        this.strategy.clear();
        this.stageStartTimes.clear();
        this.observedStages.clear();
        this.totalErrors = 0;
        this.totalInvocations = 0;
        this.totalEntries = 0;
    }
    // ==========================================================================
    // Private
    // ==========================================================================
    /**
     * Emit a metric entry to the strategy and optional callback.
     */
    emit(entry) {
        this.totalEntries++;
        this.strategy.push(entry);
        if (this.onMetricEntry) {
            try {
                this.onMetricEntry(entry);
            }
            catch {
                // Swallow callback errors to prevent disrupting pipeline
            }
        }
    }
}
exports.MetricCollector = MetricCollector;
