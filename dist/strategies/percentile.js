"use strict";
/**
 * Percentile Calculation Utility
 * ----------------------------------------------------------------------------
 * Shared by all window strategies. Uses nearest-rank with linear interpolation
 * for accurate percentile calculation on sorted arrays.
 *
 * @module strategies/percentile
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeStageErrors = exports.computeStagePercentiles = exports.computePercentiles = exports.percentile = void 0;
/**
 * Computes a single percentile from a sorted array of numbers.
 *
 * Uses linear interpolation between nearest ranks for accuracy.
 *
 * @param sorted - Pre-sorted array of numbers (ascending)
 * @param p - Percentile to compute (0–100)
 * @returns The interpolated percentile value
 */
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    if (sorted.length === 1)
        return sorted[0];
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper)
        return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
exports.percentile = percentile;
/**
 * Computes full percentile results from an array of metric entries.
 *
 * @param entries - Metric entries to compute percentiles for
 * @param metric - Optional metric type filter (default: 'latency')
 * @returns PercentileResult with min, max, p50, p95, p99, mean, count
 */
function computePercentiles(entries, metric = 'latency') {
    const values = entries
        .filter((e) => e.metric === metric)
        .map((e) => e.value)
        .sort((a, b) => a - b);
    if (values.length === 0) {
        return { min: 0, max: 0, p50: 0, p95: 0, p99: 0, mean: 0, count: 0 };
    }
    const sum = values.reduce((acc, v) => acc + v, 0);
    return {
        min: values[0],
        max: values[values.length - 1],
        p50: percentile(values, 50),
        p95: percentile(values, 95),
        p99: percentile(values, 99),
        mean: sum / values.length,
        count: values.length,
    };
}
exports.computePercentiles = computePercentiles;
/**
 * Computes percentiles grouped by stage name.
 *
 * @param entries - All metric entries
 * @param metric - Optional metric type filter (default: 'latency')
 * @returns Map of stageName → PercentileResult
 */
function computeStagePercentiles(entries, metric = 'latency') {
    const byStage = new Map();
    for (const entry of entries) {
        if (entry.metric !== metric)
            continue;
        const existing = byStage.get(entry.stageName) ?? [];
        existing.push(entry);
        byStage.set(entry.stageName, existing);
    }
    const result = new Map();
    for (const [stageName, stageEntries] of byStage) {
        result.set(stageName, computePercentiles(stageEntries, metric));
    }
    return result;
}
exports.computeStagePercentiles = computeStagePercentiles;
/**
 * Computes error counts grouped by stage name.
 *
 * @param entries - All metric entries
 * @returns Map of stageName → error count
 */
function computeStageErrors(entries) {
    const errors = new Map();
    for (const entry of entries) {
        if (entry.metric !== 'errorCount')
            continue;
        const current = errors.get(entry.stageName) ?? 0;
        errors.set(entry.stageName, current + entry.value);
    }
    return errors;
}
exports.computeStageErrors = computeStageErrors;
