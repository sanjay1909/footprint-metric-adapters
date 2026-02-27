/**
 * MockPrometheusAdapter — Simulates Prometheus exposition format.
 * ----------------------------------------------------------------------------
 * Mimics Prometheus behavior:
 *   - Ring buffer strategy (Prometheus scrapes latest data — fixed window)
 *   - Pull-based: generates exposition text format on export
 *   - Metric names use snake_case with labels in {key="value"} format
 *   - Supports histogram buckets (le), summary quantiles, counters, gauges
 *
 * Use this for testing Prometheus/Grafana integration without real Prometheus.
 *
 * @module adapters/prometheus/MockPrometheusAdapter
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

export interface MockPrometheusAdapterOptions {
  /** Metric name prefix (default: 'footprint_pipeline') */
  prefix?: string;
  /** Window strategy config (default: ringBuffer 1000 — Prometheus scrapes latest) */
  windowConfig?: WindowConfig;
  /** Optional callback when exposition text is generated */
  onExport?: (data: PrometheusExportData) => void;
}

export interface PrometheusExportData {
  /** Prometheus exposition format text */
  expositionText: string;
  /** Parsed metric lines for inspection */
  metricLines: PrometheusMetricLine[];
  exportedAt: number;
}

export interface PrometheusMetricLine {
  name: string;
  labels: Record<string, string>;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help?: string;
}

export interface MockPrometheusAdapterResult {
  flowChart: FlowChart;
  /** Get all exported exposition texts */
  getExports: () => PrometheusExportData[];
  /** Get the latest exposition text (for /metrics endpoint) */
  getLatestExposition: () => string;
  /** Get the underlying strategy */
  getStrategy: () => WindowStrategy;
  /** Clear all stored exports */
  clear: () => void;
}

// ============================================================================
// Factory
// ============================================================================

export function MockPrometheusAdapter(options?: MockPrometheusAdapterOptions): MockPrometheusAdapterResult {
  const prefix = options?.prefix ?? 'footprint_pipeline';
  const windowConfig = options?.windowConfig ?? { type: 'ringBuffer', maxSize: 1000 };
  const onExport = options?.onExport;

  const strategy = createWindowStrategy(windowConfig);
  const exportData: PrometheusExportData[] = [];

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
  // Stage 3: ExportMetric — Format as Prometheus exposition text
  // --------------------------------------------------------------------------
  const exportMetric = async (scope: StageContext): Promise<void> => {
    const metricResult = scope.getValue(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INTERNAL.METRIC_RESULT,
    ) as MetricResult | undefined;

    const lines: string[] = [];
    const metricLines: PrometheusMetricLine[] = [];

    if (metricResult) {
      // ── Overall latency summary ──
      const lp = metricResult.latencyPercentiles;
      if (lp.count > 0) {
        const metricName = prefix + '_latency_milliseconds';
        lines.push('# HELP ' + metricName + ' Pipeline stage latency in milliseconds');
        lines.push('# TYPE ' + metricName + ' summary');

        const quantiles: Array<[string, number]> = [
          ['0.5', lp.p50], ['0.95', lp.p95], ['0.99', lp.p99],
        ];
        for (const [q, v] of quantiles) {
          lines.push(metricName + '{quantile="' + q + '"} ' + v.toFixed(3));
          metricLines.push({
            name: metricName,
            labels: { quantile: q },
            value: v,
            type: 'summary',
            help: 'Pipeline stage latency in milliseconds',
          });
        }
        lines.push(metricName + '_sum ' + (lp.mean * lp.count).toFixed(3));
        lines.push(metricName + '_count ' + lp.count);
      }

      // ── Per-stage latency ──
      for (const [stageName, sp] of metricResult.stagePercentiles) {
        const metricName = prefix + '_stage_latency_milliseconds';
        const safe = sanitizeLabel(stageName);

        const quantiles: Array<[string, number]> = [
          ['0.5', sp.p50], ['0.95', sp.p95], ['0.99', sp.p99],
        ];
        for (const [q, v] of quantiles) {
          lines.push(metricName + '{stage="' + safe + '",quantile="' + q + '"} ' + v.toFixed(3));
          metricLines.push({
            name: metricName,
            labels: { stage: safe, quantile: q },
            value: v,
            type: 'summary',
          });
        }
        lines.push(metricName + '_sum{stage="' + safe + '"} ' + (sp.mean * sp.count).toFixed(3));
        lines.push(metricName + '_count{stage="' + safe + '"} ' + sp.count);
      }

      // ── Error counter ──
      if (metricResult.totalErrors > 0) {
        const metricName = prefix + '_errors_total';
        lines.push('# HELP ' + metricName + ' Total error count');
        lines.push('# TYPE ' + metricName + ' counter');
        lines.push(metricName + ' ' + metricResult.totalErrors);
        metricLines.push({
          name: metricName,
          labels: {},
          value: metricResult.totalErrors,
          type: 'counter',
          help: 'Total error count',
        });
      }

      // ── Per-stage errors ──
      for (const [stageName, errorCount] of metricResult.stageErrors) {
        if (errorCount > 0) {
          const metricName = prefix + '_stage_errors_total';
          const safe = sanitizeLabel(stageName);
          lines.push(metricName + '{stage="' + safe + '"} ' + errorCount);
          metricLines.push({
            name: metricName,
            labels: { stage: safe },
            value: errorCount,
            type: 'counter',
          });
        }
      }

      // ── Invocation gauge ──
      const invocMetric = prefix + '_invocations_total';
      lines.push('# HELP ' + invocMetric + ' Total stage invocations');
      lines.push('# TYPE ' + invocMetric + ' counter');
      lines.push(invocMetric + ' ' + metricResult.totalInvocations);
      metricLines.push({
        name: invocMetric,
        labels: {},
        value: metricResult.totalInvocations,
        type: 'counter',
        help: 'Total stage invocations',
      });
    }

    const expositionText = lines.join('\n') + '\n';

    const data: PrometheusExportData = {
      expositionText,
      metricLines,
      exportedAt: Date.now(),
    };

    exportData.push(data);

    if (onExport) {
      try { onExport(data); } catch { /* swallow */ }
    }

    const exportResult: MetricExportResult = {
      success: true,
      destination: 'prometheus:///metrics',
      entriesExported: metricLines.length,
      exportedAt: Date.now(),
    };

    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.OUTPUT.RESULT, exportResult);
  };

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------
  const flowChart = createMetricSubflow({
    name: 'Prometheus',
    collectMetric: collectMetric as any,
    applyStrategy: applyStrategy as any,
    exportMetric: exportMetric as any,
    capabilities: {
      supportsHistograms: true,
      supportsLabels: true,
      supportsPush: false, // Prometheus is pull-based
    },
  });

  return {
    flowChart,
    getExports: () => [...exportData],
    getLatestExposition: () => exportData.length > 0 ? exportData[exportData.length - 1].expositionText : '',
    getStrategy: () => strategy,
    clear: () => {
      exportData.length = 0;
      strategy.clear();
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeLabel(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

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
