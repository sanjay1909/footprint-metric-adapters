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
import type { WindowConfig } from '../../core/types';
import type { WindowStrategy } from '../../core/types';
import type { FlowChart } from 'footprint';
/** CloudWatch metric datum — mirrors AWS SDK PutMetricData format */
export interface CloudWatchMetricDatum {
    MetricName: string;
    Dimensions: Array<{
        Name: string;
        Value: string;
    }>;
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
export declare function MockCloudWatchAdapter(options?: MockCloudWatchAdapterOptions): MockCloudWatchAdapterResult;
