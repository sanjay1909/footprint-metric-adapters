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
import type { MetricEntry, WindowStrategy, PercentileResult, MetricResult, WindowSnapshot } from '../core/types';
/** Context passed to all recorder hooks */
interface RecorderContext {
    stageName: string;
    pipelineId: string;
    timestamp: number;
}
interface ReadEvent extends RecorderContext {
    path: string[];
    key?: string;
    value: unknown;
}
interface WriteEvent extends RecorderContext {
    path: string[];
    key: string;
    value: unknown;
    operation: 'set' | 'update';
}
interface CommitEvent extends RecorderContext {
    mutations: Array<{
        path: string[];
        key: string;
        value: unknown;
        operation: 'set' | 'update';
    }>;
}
interface ErrorEvent extends RecorderContext {
    error: Error;
    operation: 'read' | 'write' | 'commit';
    path?: string[];
    key?: string;
}
interface StageEvent extends RecorderContext {
    duration?: number;
}
/** Recorder interface — structurally compatible with FootPrint's Recorder */
interface Recorder {
    readonly id: string;
    onRead?(event: ReadEvent): void;
    onWrite?(event: WriteEvent): void;
    onCommit?(event: CommitEvent): void;
    onError?(event: ErrorEvent): void;
    onStageStart?(event: StageEvent): void;
    onStageEnd?(event: StageEvent): void;
}
/**
 * Configuration for MetricCollector.
 */
export interface MetricCollectorOptions {
    /** Unique identifier for this collector */
    id?: string;
    /** Window strategy to use for metric aggregation */
    strategy: WindowStrategy;
    /** Whether to track read counts (default: true) */
    trackReads?: boolean;
    /** Whether to track write counts (default: true) */
    trackWrites?: boolean;
    /** Whether to track commit counts (default: true) */
    trackCommits?: boolean;
    /** Callback fired on every metric entry (useful for real-time streaming) */
    onMetricEntry?: (entry: MetricEntry) => void;
}
/**
 * Summary of all collected metrics.
 */
export interface CollectorSummary {
    /** Total metric entries collected */
    totalEntries: number;
    /** Total errors recorded */
    totalErrors: number;
    /** Total stage invocations */
    totalInvocations: number;
    /** Stages observed */
    stageNames: string[];
    /** Window strategy type */
    strategyType: string;
    /** Current window size */
    windowSize: number;
}
export declare class MetricCollector implements Recorder {
    readonly id: string;
    private readonly strategy;
    private readonly trackReads;
    private readonly trackWrites;
    private readonly trackCommits;
    private readonly onMetricEntry?;
    /** Stage start timestamps for latency calculation */
    private stageStartTimes;
    /** Track all observed stages */
    private observedStages;
    /** Running counters */
    private totalErrors;
    private totalInvocations;
    private totalEntries;
    constructor(options: MetricCollectorOptions);
    onStageStart(event: StageEvent): void;
    onStageEnd(event: StageEvent): void;
    onError(event: ErrorEvent): void;
    onRead(event: ReadEvent): void;
    onWrite(event: WriteEvent): void;
    onCommit(event: CommitEvent): void;
    /**
     * Get percentiles from the underlying window strategy.
     */
    getPercentiles(): PercentileResult;
    /**
     * Get percentiles for a specific stage.
     */
    getStagePercentiles(stageName: string): PercentileResult;
    /**
     * Get the full metric result from the window strategy.
     */
    getMetricResult(): MetricResult;
    /**
     * Get a snapshot of the window.
     */
    getSnapshot(): WindowSnapshot;
    /**
     * Get a summary of all collected metrics.
     */
    getSummary(): CollectorSummary;
    /**
     * Get the underlying window strategy (for direct access).
     */
    getStrategy(): WindowStrategy;
    /**
     * Reset all counters and clear the window strategy.
     */
    reset(): void;
    /**
     * Emit a metric entry to the strategy and optional callback.
     */
    private emit;
}
export {};
