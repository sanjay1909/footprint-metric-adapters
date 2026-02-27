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

// ============================================================================
// Recorder Types — Mirrored from FootPrint's scope/types
// ============================================================================
// WHY: FootPrint exports these from its scope submodule, not from the main
// barrel. Rather than depending on internal paths, we define compatible
// interfaces here. These are structurally identical to FootPrint's types,
// so MetricCollector satisfies FootPrint's Recorder interface via duck typing.

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
  mutations: Array<{ path: string[]; key: string; value: unknown; operation: 'set' | 'update' }>;
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

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// MetricCollector Implementation
// ============================================================================

export class MetricCollector implements Recorder {
  readonly id: string;

  private readonly strategy: WindowStrategy;
  private readonly trackReads: boolean;
  private readonly trackWrites: boolean;
  private readonly trackCommits: boolean;
  private readonly onMetricEntry?: (entry: MetricEntry) => void;

  /** Stage start timestamps for latency calculation */
  private stageStartTimes: Map<string, number> = new Map();

  /** Track all observed stages */
  private observedStages: Set<string> = new Set();

  /** Running counters */
  private totalErrors = 0;
  private totalInvocations = 0;
  private totalEntries = 0;

  constructor(options: MetricCollectorOptions) {
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

  onStageStart(event: StageEvent): void {
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

  onStageEnd(event: StageEvent): void {
    if (event.duration !== undefined) {
      this.emit({
        stageName: event.stageName,
        metric: 'latency',
        value: event.duration,
        timestamp: event.timestamp,
      });
    } else {
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

  onError(event: ErrorEvent): void {
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

  onRead(event: ReadEvent): void {
    if (!this.trackReads) return;

    this.emit({
      stageName: event.stageName,
      metric: 'readCount',
      value: 1,
      timestamp: event.timestamp,
    });
  }

  onWrite(event: WriteEvent): void {
    if (!this.trackWrites) return;

    this.emit({
      stageName: event.stageName,
      metric: 'writeCount',
      value: 1,
      timestamp: event.timestamp,
    });
  }

  onCommit(event: CommitEvent): void {
    if (!this.trackCommits) return;

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
  getPercentiles(): PercentileResult {
    return this.strategy.getPercentiles('latency');
  }

  /**
   * Get percentiles for a specific stage.
   */
  getStagePercentiles(stageName: string): PercentileResult {
    return this.strategy.getStagePercentiles(stageName, 'latency');
  }

  /**
   * Get the full metric result from the window strategy.
   */
  getMetricResult(): MetricResult {
    return this.strategy.getMetricResult();
  }

  /**
   * Get a snapshot of the window.
   */
  getSnapshot(): WindowSnapshot {
    return this.strategy.getSnapshot();
  }

  /**
   * Get a summary of all collected metrics.
   */
  getSummary(): CollectorSummary {
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
  getStrategy(): WindowStrategy {
    return this.strategy;
  }

  /**
   * Reset all counters and clear the window strategy.
   */
  reset(): void {
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
  private emit(entry: MetricEntry): void {
    this.totalEntries++;
    this.strategy.push(entry);

    if (this.onMetricEntry) {
      try {
        this.onMetricEntry(entry);
      } catch {
        // Swallow callback errors to prevent disrupting pipeline
      }
    }
  }
}
