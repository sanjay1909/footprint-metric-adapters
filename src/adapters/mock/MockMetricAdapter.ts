/**
 * MockMetricAdapter — In-memory metric adapter for testing.
 * ----------------------------------------------------------------------------
 * Stores all exported metrics in memory. Perfect for unit tests:
 *   - Assert metrics were collected correctly
 *   - Verify percentile calculations
 *   - Test alarm rule evaluation
 *   - Validate window strategy behavior
 *
 * Follows the same factory function pattern as LLM adapters.
 *
 * @module adapters/mock/MockMetricAdapter
 *
 * @example
 * ```typescript
 * const { adapter, getExports, getHistory, clear } = MockMetricAdapter();
 *
 * // Attach to pipeline...
 *
 * // After execution:
 * const exports = getExports();
 * expect(exports).toHaveLength(1);
 * expect(exports[0].percentiles.p95).toBeLessThan(500);
 * ```
 */

import type { MetricEntry, MetricResult, MetricExportResult, WindowStrategy, WindowConfig } from '../../core/types';
import { METRIC_PATHS } from '../../core/paths';
import { createMetricSubflow } from '../../core/createMetricSubflow';
import { RingBufferStrategy } from '../../strategies/RingBufferStrategy';
import { TumblingWindowStrategy } from '../../strategies/TumblingWindowStrategy';
import { SlidingWindowStrategy } from '../../strategies/SlidingWindowStrategy';
import type { FlowChart, StageContext } from 'footprint';

// ============================================================================
// Types
// ============================================================================

export interface MockMetricAdapterOptions {
  /** Window strategy configuration (default: ringBuffer with maxSize 1000) */
  windowConfig?: WindowConfig;
  /** Optional callback on each export */
  onExport?: (result: MetricResult) => void;
}

export interface MockMetricAdapterResult {
  /** The 3-stage FlowChart subflow */
  flowChart: FlowChart;
  /** Get all exported metric results */
  getExports: () => MetricResult[];
  /** Get the full export history with results */
  getHistory: () => MetricExportResult[];
  /** Get the underlying window strategy (for direct inspection) */
  getStrategy: () => WindowStrategy;
  /** Clear all stored exports */
  clear: () => void;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a Mock metric adapter for testing.
 *
 * @param options - Configuration options
 * @returns MockMetricAdapterResult with flowChart and inspection methods
 */
export function MockMetricAdapter(options?: MockMetricAdapterOptions): MockMetricAdapterResult {
  const windowConfig = options?.windowConfig ?? { type: 'ringBuffer', maxSize: 1000 };
  const onExport = options?.onExport;

  // Create the window strategy based on config
  const strategy = createStrategy(windowConfig);

  // Storage for test assertions
  const exportedResults: MetricResult[] = [];
  const exportHistory: MetricExportResult[] = [];

  // --------------------------------------------------------------------------
  // Stage 1: CollectMetric — Read entries from scope, validate, push to strategy
  // --------------------------------------------------------------------------
  const collectMetric = async (scope: StageContext): Promise<void> => {
    const entries = scope.getValue(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INPUT.ENTRIES,
    ) as MetricEntry[] | undefined;

    if (!entries || entries.length === 0) {
      scope.setObject(
        [METRIC_PATHS.NAMESPACE],
        METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES,
        [],
      );
      return;
    }

    // Validate and push each entry into the strategy
    const validated: MetricEntry[] = [];
    for (const entry of entries) {
      if (entry.stageName && entry.metric && typeof entry.value === 'number') {
        strategy.push(entry);
        validated.push(entry);
      }
    }

    scope.setObject(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES,
      validated,
    );
  };

  // --------------------------------------------------------------------------
  // Stage 2: ApplyStrategy — Compute aggregates from the window
  // --------------------------------------------------------------------------
  const applyStrategy = async (scope: StageContext): Promise<void> => {
    const metricResult = strategy.getMetricResult();

    scope.setObject(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INTERNAL.METRIC_RESULT,
      metricResult,
    );
  };

  // --------------------------------------------------------------------------
  // Stage 3: ExportMetric — Store in memory (mock — no real backend)
  // --------------------------------------------------------------------------
  const exportMetric = async (scope: StageContext): Promise<void> => {
    const metricResult = scope.getValue(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INTERNAL.METRIC_RESULT,
    ) as MetricResult | undefined;

    if (metricResult) {
      exportedResults.push(metricResult);

      if (onExport) {
        try {
          onExport(metricResult);
        } catch {
          // Swallow callback errors
        }
      }
    }

    const exportResult: MetricExportResult = {
      success: true,
      destination: 'mock://in-memory',
      entriesExported: metricResult?.windowInfo.entryCount ?? 0,
      exportedAt: Date.now(),
    };

    exportHistory.push(exportResult);

    scope.setObject(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.OUTPUT.RESULT,
      exportResult,
    );
  };

  // --------------------------------------------------------------------------
  // Build the subflow
  // --------------------------------------------------------------------------
  const flowChart = createMetricSubflow({
    name: 'Mock',
    collectMetric: collectMetric as any,
    applyStrategy: applyStrategy as any,
    exportMetric: exportMetric as any,
    capabilities: {
      supportsHistograms: true,
      supportsLabels: true,
      supportsPush: true,
    },
  });

  return {
    flowChart,
    getExports: () => [...exportedResults],
    getHistory: () => [...exportHistory],
    getStrategy: () => strategy,
    clear: () => {
      exportedResults.length = 0;
      exportHistory.length = 0;
      strategy.clear();
    },
  };
}

// ============================================================================
// Helper
// ============================================================================

function createStrategy(config: WindowConfig): WindowStrategy {
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
