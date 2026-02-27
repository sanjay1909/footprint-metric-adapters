/**
 * Window Strategies — Barrel Export
 * ----------------------------------------------------------------------------
 * Each strategy is a self-contained, composable unit that can be used
 * independently or plugged into a metric adapter subflow.
 *
 * @module strategies
 */

export { RingBufferStrategy } from './RingBufferStrategy';
export { TumblingWindowStrategy, type MetricBucket } from './TumblingWindowStrategy';
export { SlidingWindowStrategy } from './SlidingWindowStrategy';
export type { RingBufferConfig, TumblingWindowConfig, SlidingWindowConfig, StrategyConfig } from './types';
export { computePercentiles, computeStagePercentiles, computeStageErrors, percentile } from './percentile';
