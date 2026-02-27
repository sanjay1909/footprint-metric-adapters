/**
 * Strategy Types — Shared configuration types for all window strategies.
 * @module strategies/types
 */

/**
 * Configuration for RingBufferStrategy.
 */
export interface RingBufferConfig {
  /** Strategy type */
  type: 'ringBuffer';
  /** Maximum number of entries to retain (default: 1000) */
  maxSize: number;
}

/**
 * Configuration for TumblingWindowStrategy.
 */
export interface TumblingWindowConfig {
  /** Strategy type */
  type: 'tumbling';
  /** Window duration in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
}

/**
 * Configuration for SlidingWindowStrategy.
 */
export interface SlidingWindowConfig {
  /** Strategy type */
  type: 'sliding';
  /** Window duration in milliseconds (default: 300000 = 5 minutes) */
  windowMs: number;
}

/**
 * Union of all strategy configurations.
 */
export type StrategyConfig = RingBufferConfig | TumblingWindowConfig | SlidingWindowConfig;
