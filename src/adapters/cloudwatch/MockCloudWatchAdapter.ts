/**
 * MockCloudWatchAdapter — Simulates AWS CloudWatch PutMetricData.
 * ----------------------------------------------------------------------------
 * Mimics CloudWatch behavior:
 *   - Tumbling window strategy (fixed time buckets — CloudWatch aggregates in 1-min periods)
 *   - Metrics organized by Namespace + MetricName + Dimensions
 *   - Export format mirrors PutMetricData StatisticValues
 *
 * Use this for testing CloudWatch integration without real AWS credentials.
 *
 * @module adapters/cloudwatch/MockCloudWatchAdapter
 */

import type { MetricEntry, MetricResult, MetricExportResult, WindowConfig } from '../../core/types';
import { METRIC_PATHS } from '../../core/paths';
import { createMetricSubflow } from '../../core/createMetricSubflow';
import { TumblingWindowStrategy } from '../../strategies/TumblingWindowStrategy';
import { RingBufferStrategy } from '../../strategies/RingBufferStrategy';
import { SlidingWindowStrategy } from '../../strategies/SlidingWindowStrategy';
import type { WindowStrategy } from '../../core/types';
import type { FlowChart, StageContext } from 'footprint';

// ============================================================================
// Types
// ============================================================================

/** CloudWatch metric datum — mirrors AWS SDK PutMetricData format */
export interface CloudWatchMetricDatum {
  MetricName: string;
  Dimensions: Array<{ Name: string; Value: string }>;
  Timestamp: string;
  StatisticValues: {
    SampleCount: number;
    Sum: number;
    Minimum: number;
    Maximum: number;
  };
  Unit: string;
}

export interface MockCloudWatchAdapterOptions {
  /** CloudWatch namespace (e.g., 'FootPrint/Pipeline') */
  namespace?: string;
  /** Window strategy config (default: tumbling 60s — matches CloudWatch 1-min periods) */
  windowConfig?: WindowConfig;
  /** Optional callback on each export */
  onExport?: (data: CloudWatchExportData) => void;
}

export interface CloudWatchExportData {
  Namespace: string;
  MetricData: CloudWatchMetricDatum[];
  exportedAt: number;
}

export interface MockCloudWatchAdapterResult {
  flowChart: FlowChart;
  /** Get all exported CloudWatch metric data */
  getExports: () => CloudWatchExportData[];
  /** Get the underlying strategy */
  getStrategy: () => WindowStrategy;
  /** Clear all stored exports */
  clear: () => void;
}

// ============================================================================
// Factory
// ============================================================================

export function MockCloudWatchAdapter(options?: MockCloudWatchAdapterOptions): MockCloudWatchAdapterResult {
  const namespace = options?.namespace ?? 'FootPrint/Pipeline';
  const windowConfig = options?.windowConfig ?? { type: 'tumbling', windowMs: 60_000 };
  const onExport = options?.onExport;

  const strategy = createWindowStrategy(windowConfig);
  const exports: CloudWatchExportData[] = [];

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
  // Stage 3: ExportMetric — Format as CloudWatch PutMetricData
  // --------------------------------------------------------------------------
  const exportMetric = async (scope: StageContext): Promise<void> => {
    const metricResult = scope.getValue(
      [METRIC_PATHS.NAMESPACE],
      METRIC_PATHS.INTERNAL.METRIC_RESULT,
    ) as MetricResult | undefined;

    const metricData: CloudWatchMetricDatum[] = [];

    if (metricResult) {
      // Overall latency metric
      const lp = metricResult.latencyPercentiles;
      if (lp.count > 0) {
        metricData.push({
          MetricName: 'PipelineLatency',
          Dimensions: [{ Name: 'Pipeline', Value: 'Overall' }],
          Timestamp: new Date(metricResult.computedAt).toISOString(),
          StatisticValues: {
            SampleCount: lp.count,
            Sum: lp.mean * lp.count,
            Minimum: lp.min,
            Maximum: lp.max,
          },
          Unit: 'Milliseconds',
        });
      }

      // Per-stage latency metrics
      for (const [stageName, sp] of metricResult.stagePercentiles) {
        metricData.push({
          MetricName: 'StageLatency',
          Dimensions: [
            { Name: 'Pipeline', Value: 'Overall' },
            { Name: 'StageName', Value: stageName },
          ],
          Timestamp: new Date(metricResult.computedAt).toISOString(),
          StatisticValues: {
            SampleCount: sp.count,
            Sum: sp.mean * sp.count,
            Minimum: sp.min,
            Maximum: sp.max,
          },
          Unit: 'Milliseconds',
        });
      }

      // Error count metrics
      if (metricResult.totalErrors > 0) {
        metricData.push({
          MetricName: 'ErrorCount',
          Dimensions: [{ Name: 'Pipeline', Value: 'Overall' }],
          Timestamp: new Date(metricResult.computedAt).toISOString(),
          StatisticValues: {
            SampleCount: 1,
            Sum: metricResult.totalErrors,
            Minimum: metricResult.totalErrors,
            Maximum: metricResult.totalErrors,
          },
          Unit: 'Count',
        });
      }

      // Per-stage error counts
      for (const [stageName, errorCount] of metricResult.stageErrors) {
        if (errorCount > 0) {
          metricData.push({
            MetricName: 'StageErrorCount',
            Dimensions: [
              { Name: 'Pipeline', Value: 'Overall' },
              { Name: 'StageName', Value: stageName },
            ],
            Timestamp: new Date(metricResult.computedAt).toISOString(),
            StatisticValues: {
              SampleCount: 1,
              Sum: errorCount,
              Minimum: errorCount,
              Maximum: errorCount,
            },
            Unit: 'Count',
          });
        }
      }
    }

    const exportData: CloudWatchExportData = {
      Namespace: namespace,
      MetricData: metricData,
      exportedAt: Date.now(),
    };

    exports.push(exportData);

    if (onExport) {
      try { onExport(exportData); } catch { /* swallow */ }
    }

    const exportResult: MetricExportResult = {
      success: true,
      destination: 'cloudwatch://' + namespace,
      entriesExported: metricData.length,
      exportedAt: Date.now(),
    };

    scope.setObject([METRIC_PATHS.NAMESPACE], METRIC_PATHS.OUTPUT.RESULT, exportResult);
  };

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------
  const flowChart = createMetricSubflow({
    name: 'CloudWatch',
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
    case 'tumbling':
      return new TumblingWindowStrategy({ windowMs: config.windowMs ?? 60_000 });
    case 'ringBuffer':
      return new RingBufferStrategy({ maxSize: config.maxSize ?? 1000 });
    case 'sliding':
      return new SlidingWindowStrategy({ windowMs: config.windowMs ?? 300_000 });
    default:
      return new TumblingWindowStrategy({ windowMs: 60_000 });
  }
}
