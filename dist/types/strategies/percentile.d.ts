/**
 * Percentile Calculation Utility
 * ----------------------------------------------------------------------------
 * Shared by all window strategies. Uses nearest-rank with linear interpolation
 * for accurate percentile calculation on sorted arrays.
 *
 * @module strategies/percentile
 */
import type { PercentileResult, MetricEntry, MetricType } from '../core/types';
/**
 * Computes a single percentile from a sorted array of numbers.
 *
 * Uses linear interpolation between nearest ranks for accuracy.
 *
 * @param sorted - Pre-sorted array of numbers (ascending)
 * @param p - Percentile to compute (0–100)
 * @returns The interpolated percentile value
 */
export declare function percentile(sorted: number[], p: number): number;
/**
 * Computes full percentile results from an array of metric entries.
 *
 * @param entries - Metric entries to compute percentiles for
 * @param metric - Optional metric type filter (default: 'latency')
 * @returns PercentileResult with min, max, p50, p95, p99, mean, count
 */
export declare function computePercentiles(entries: MetricEntry[], metric?: MetricType): PercentileResult;
/**
 * Computes percentiles grouped by stage name.
 *
 * @param entries - All metric entries
 * @param metric - Optional metric type filter (default: 'latency')
 * @returns Map of stageName → PercentileResult
 */
export declare function computeStagePercentiles(entries: MetricEntry[], metric?: MetricType): Map<string, PercentileResult>;
/**
 * Computes error counts grouped by stage name.
 *
 * @param entries - All metric entries
 * @returns Map of stageName → error count
 */
export declare function computeStageErrors(entries: MetricEntry[]): Map<string, number>;
