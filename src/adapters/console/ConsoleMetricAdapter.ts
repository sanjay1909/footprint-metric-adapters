/**
 * ConsoleMetricAdapter — Logs formatted metrics to console.
 * ----------------------------------------------------------------------------
 * Development/debugging adapter. Formats metric results into readable
 * console output with stage breakdowns, percentiles, and error summaries.
 *
 * @module adapters/console/ConsoleMetricAdapter
 *
 * @example
 * ```typescript
 * const { flowChart } = ConsoleMetricAdapter({ prefix: '[METRICS]' });
 *
 * // After execution, console shows:
 * // [METRICS] ═══════════════════════════════════════
 * // [METRICS] Window: ringBuffer | 42 entries | 12.5s
 * // [METRICS] Latency: p50=45ms p95=230ms p99=890ms
 * // [METRICS] Errors: 2 total
 * // [METRICS] Stages:
 * // [METRICS]   llmCall      p95=180ms  errors=1
 * // [METRICS]   toolExec     p95=50ms   errors=1
 * // [METRICS] ═══════════════════════════════════════
 * ```
 */

import type { MetricEntry, MetricResult, MetricExportResult, WindowConfig } from '../../core/types';
import { METRIC_PATHS } from '../../core/paths';
import { createMetricSubflow } from '../../core/createMetricSubflow';
import { RingBufferStrategy } from '../../strategies/RingBufferStrategy';
import { TumblingWindowStrategy } from '../../strategies/TumblingWindowStrategy';
import { SlidingWindowStrategy } from '../../strategies/SlidingWindowStrategy';
import type { WindowStrategy } from '../../core/types';
import type { FlowChart, StageContext } from 'footprint';

// ============================================================================
// Types
// ============================================================================

export interface ConsoleMetricAdapterOptions {
  /** Prefix for console output (default: '[METRICS]') */
  prefix?: string;
  /** Window strategy configuration (default: ringBuffer with maxSize 1000) */
  windowConfig?: WindowConfig;
  /** Whether to show per-stage breakdown (default: true) */
  showStages?: boolean;
  /** Custom logger function (default: console.log) */
  logger?: (message: string) => void;
}

export interface ConsoleMetricAdapterResult {
  flowChart: FlowChart;
  getStrategy: () => WindowStrategy;
}

// ============================================================================
// Factory
// ============================================================================

export function ConsoleMetricAdapter(options?: ConsoleMetricAdapterOptions): ConsoleMetricAdapterResult {
  const prefix = options?.prefix ?? '[METRICS]';
  const windowConfig = options?.windowConfig ?? { type: 'ringBuffer', maxSize: 1000 };
  const showStages = options?.showStages ?? true;
  const log = options?.logger ?? console.log;

  const strategy = createWindowStrategy(windowConfig);

  // --------------------------------------------------------------------------
  // Stage 1: CollectMetric
  // --------------------------------------------------------------------------
  const collectMetric = async (scope: StageContext): Promise<void> => {
    const entries = scope.getValue(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INPUT.ENTRIES,
    ) as MetricEntry[] | undefined;

    if (!entries || entries.length === 0) {
      scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES, []);
      return;
    }

    for (const entry of entries) {
      if (entry.stageName && entry.metric && typeof entry.value === 'number') {
        strategy.push(entry);
      }
    }

    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES, entries);
  };

  // --------------------------------------------------------------------------
  // Stage 2: ApplyStrategy
  // --------------------------------------------------------------------------
  const applyStrategy = async (scope: StageContext): Promise<void> => {
    const metricResult = strategy.getMetricResult();
    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.INTERNAL.METRIC_RESULT, metricResult);
  };

  // --------------------------------------------------------------------------
  // Stage 3: ExportMetric — Format and log to console
  // --------------------------------------------------------------------------
  const exportMetric = async (scope: StageContext): Promise<void> => {
    const metricResult = scope.getValue(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INTERNAL.METRIC_RESULT,
    ) as MetricResult | undefined;

    if (!metricResult) {
      log(prefix + ' No metrics to export.');
      scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.OUTPUT.RESULT, {
        success: true,
        destination: 'console',
        entriesExported: 0,
        exportedAt: Date.now(),
      });
      return;
    }

    const sep = ' ' + '='.repeat(45);
    log(prefix + sep);

    // Window info
    const wi = metricResult.windowInfo;
    const windowDuration = ((wi.endTime - wi.startTime) / 1000).toFixed(1);
    log(prefix + ' Window: ' + wi.type + ' | ' + wi.entryCount + ' entries | ' + windowDuration + 's');

    // Overall percentiles
    const lp = metricResult.latencyPercentiles;
    if (lp.count > 0) {
      log(
        prefix + ' Latency: p50=' + lp.p50.toFixed(0) + 'ms' +
        ' p95=' + lp.p95.toFixed(0) + 'ms' +
        ' p99=' + lp.p99.toFixed(0) + 'ms' +
        ' (min=' + lp.min.toFixed(0) + ' max=' + lp.max.toFixed(0) +
        ' mean=' + lp.mean.toFixed(0) + ' n=' + lp.count + ')'
      );
    }

    // Errors
    if (metricResult.totalErrors > 0) {
      log(prefix + ' Errors: ' + metricResult.totalErrors + ' total');
    }

    // Per-stage breakdown
    if (showStages && metricResult.stagePercentiles.size > 0) {
      log(prefix + ' Stages:');
      for (const [stageName, sp] of metricResult.stagePercentiles) {
        const stageErrors = metricResult.stageErrors.get(stageName) ?? 0;
        const errorStr = stageErrors > 0 ? '  errors=' + stageErrors : '';
        log(
          prefix + '   ' + stageName.padEnd(16) +
          ' p95=' + sp.p95.toFixed(0) + 'ms' + errorStr
        );
      }
    }

    log(prefix + sep);

    const exportResult: MetricExportResult = {
      success: true,
      destination: 'console',
      entriesExported: metricResult.windowInfo.entryCount,
      exportedAt: Date.now(),
    };

    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.OUTPUT.RESULT, exportResult);
  };

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------
  const flowChart = createMetricSubflow({
    name: 'Console',
    collectMetric: collectMetric as any,
    applyStrategy: applyStrategy as any,
    exportMetric: exportMetric as any,
    capabilities: {
      supportsHistograms: true,
      supportsLabels: false,
      supportsPush: true,
    },
  });

  return { flowChart, getStrategy: () => strategy };
}

// ============================================================================
// Helper
// ============================================================================

function createWindowStrategy(config: WindowConfig): WindowStrategy {
  switch (config.type) {
    case 'ringBuffer':
      return new RingBufferStrategy({ maxSize: config.maxSize ?? 1000 });
    case 'tumbling':
      return new TumblingWindowStrategy({ windowMs: config.windowMs ?? 60_000 });
    case 'sliding':
      return new SlidingWindowStrategy({ windowMs: config.windowMs ?? 300_000 });
    default:
      return new RingBufferStrategy({ maxSize: 1000 });
  }
}
