/**
 * MockDatadogAdapter — Simulates Datadog API metric submission.
 * ----------------------------------------------------------------------------
 * Mimics Datadog behavior:
 *   - Sliding window strategy (Datadog tracks last T seconds of data)
 *   - Metrics submitted as series with tags (key:value)
 *   - Export format mirrors Datadog v2 /api/v2/series payload
 *   - Supports distributions (DDSketch-style percentiles)
 *
 * Use this for testing Datadog integration without real Datadog API keys.
 *
 * @module adapters/datadog/MockDatadogAdapter
 */

import type { MetricEntry, MetricResult, MetricExportResult, WindowConfig } from '../../core/types';
import { METRIC_PATHS } from '../../core/paths';
import { createMetricSubflow } from '../../core/createMetricSubflow';
import { SlidingWindowStrategy } from '../../strategies/SlidingWindowStrategy';
import { RingBufferStrategy } from '../../strategies/RingBufferStrategy';
import { TumblingWindowStrategy } from '../../strategies/TumblingWindowStrategy';
import type { WindowStrategy } from '../../core/types';
import type { FlowChart, StageContext } from 'footprint';

// ============================================================================
// Types
// ============================================================================

/** Datadog series point — mirrors Datadog v2 API format */
export interface DatadogSeriesPoint {
  metric: string;
  type: 'count' | 'gauge' | 'rate' | 'distribution';
  points: Array<{ timestamp: number; value: number }>;
  tags: string[];
  interval?: number;
}

export interface MockDatadogAdapterOptions {
  /** Datadog metric prefix (default: 'footprint.pipeline') */
  prefix?: string;
  /** Default tags applied to all metrics */
  tags?: string[];
  /** Window strategy config (default: sliding 300s — Datadog uses rolling windows) */
  windowConfig?: WindowConfig;
  /** Optional callback on each export */
  onExport?: (data: DatadogExportData) => void;
}

export interface DatadogExportData {
  /** Series payload (mirrors Datadog v2 /api/v2/series body) */
  series: DatadogSeriesPoint[];
  /** API key used (mock) */
  apiKey: string;
  exportedAt: number;
}

export interface MockDatadogAdapterResult {
  flowChart: FlowChart;
  /** Get all exported Datadog payloads */
  getExports: () => DatadogExportData[];
  /** Get the underlying strategy */
  getStrategy: () => WindowStrategy;
  /** Clear all stored exports */
  clear: () => void;
}

// ============================================================================
// Factory
// ============================================================================

export function MockDatadogAdapter(options?: MockDatadogAdapterOptions): MockDatadogAdapterResult {
  const metricPrefix = options?.prefix ?? 'footprint.pipeline';
  const defaultTags = options?.tags ?? ['env:dev', 'service:footprint'];
  const windowConfig = options?.windowConfig ?? { type: 'sliding', windowMs: 300_000 };
  const onExport = options?.onExport;

  const strategy = createWindowStrategy(windowConfig);
  const exports: DatadogExportData[] = [];

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

    const validated: MetricEntry[] = [];
    for (const entry of entries) {
      if (entry.stageName && entry.metric && typeof entry.value === 'number') {
        strategy.push(entry);
        validated.push(entry);
      }
    }

    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.INTERNAL.VALIDATED_ENTRIES, validated);
  };

  // --------------------------------------------------------------------------
  // Stage 2: ApplyStrategy
  // --------------------------------------------------------------------------
  const applyStrategy = async (scope: StageContext): Promise<void> => {
    const metricResult = strategy.getMetricResult();
    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.INTERNAL.METRIC_RESULT, metricResult);
  };

  // --------------------------------------------------------------------------
  // Stage 3: ExportMetric — Format as Datadog v2 series
  // --------------------------------------------------------------------------
  const exportMetric = async (scope: StageContext): Promise<void> => {
    const metricResult = scope.getValue(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INTERNAL.METRIC_RESULT,
    ) as MetricResult | undefined;

    const series: DatadogSeriesPoint[] = [];
    const now = Math.floor(Date.now() / 1000); // Datadog uses Unix seconds

    if (metricResult) {
      // ── Overall latency distribution ──
      const lp = metricResult.latencyPercentiles;
      if (lp.count > 0) {
        series.push({
          metric: metricPrefix + '.latency',
          type: 'distribution',
          points: [
            { timestamp: now, value: lp.p50 },
            { timestamp: now, value: lp.p95 },
            { timestamp: now, value: lp.p99 },
          ],
          tags: [...defaultTags, 'metric_type:latency'],
        });

        // Also submit avg as gauge
        series.push({
          metric: metricPrefix + '.latency.avg',
          type: 'gauge',
          points: [{ timestamp: now, value: lp.mean }],
          tags: [...defaultTags],
        });
      }

      // ── Per-stage latency ──
      for (const [stageName, sp] of metricResult.stagePercentiles) {
        series.push({
          metric: metricPrefix + '.stage.latency',
          type: 'distribution',
          points: [
            { timestamp: now, value: sp.p50 },
            { timestamp: now, value: sp.p95 },
            { timestamp: now, value: sp.p99 },
          ],
          tags: [...defaultTags, 'stage:' + stageName.replace(/\s+/g, '_').toLowerCase()],
        });
      }

      // ── Error count ──
      if (metricResult.totalErrors > 0) {
        series.push({
          metric: metricPrefix + '.errors',
          type: 'count',
          points: [{ timestamp: now, value: metricResult.totalErrors }],
          tags: [...defaultTags, 'metric_type:error'],
        });
      }

      // ── Per-stage errors ──
      for (const [stageName, errorCount] of metricResult.stageErrors) {
        if (errorCount > 0) {
          series.push({
            metric: metricPrefix + '.stage.errors',
            type: 'count',
            points: [{ timestamp: now, value: errorCount }],
            tags: [...defaultTags, 'stage:' + stageName.replace(/\s+/g, '_').toLowerCase()],
          });
        }
      }

      // ── Invocation counter ──
      series.push({
        metric: metricPrefix + '.invocations',
        type: 'count',
        points: [{ timestamp: now, value: metricResult.totalInvocations }],
        tags: [...defaultTags],
      });
    }

    const data: DatadogExportData = {
      series,
      apiKey: 'mock-dd-api-key-xxx',
      exportedAt: Date.now(),
    };

    exports.push(data);

    if (onExport) {
      try { onExport(data); } catch { /* swallow */ }
    }

    const exportResult: MetricExportResult = {
      success: true,
      destination: 'datadog://api.datadoghq.com/v2/series',
      entriesExported: series.length,
      exportedAt: Date.now(),
    };

    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.OUTPUT.RESULT, exportResult);
  };

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------
  const flowChart = createMetricSubflow({
    name: 'Datadog',
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
    getExports: () => [...exports],
    getStrategy: () => strategy,
    clear: () => {
      exports.length = 0;
      strategy.clear();
    },
  };
}

// ============================================================================
// Helper
// ============================================================================

function createWindowStrategy(config: WindowConfig): WindowStrategy {
  switch (config.type) {
    case 'sliding':
      return new SlidingWindowStrategy({ windowMs: config.windowMs ?? 300_000 });
    case 'ringBuffer':
      return new RingBufferStrategy({ maxSize: config.maxSize ?? 1000 });
    case 'tumbling':
      return new TumblingWindowStrategy({ windowMs: config.windowMs ?? 60_000 });
    default:
      return new SlidingWindowStrategy({ windowMs: 300_000 });
  }
}
