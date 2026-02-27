"use strict";
/**
 * footprint-metric-adapters — Metric collection, window strategies, and LLM-navigable Tree of IDs.
 *
 * Layer 0 extension of the FootPrint stack:
 *   FootPrint (core) + footprint-metric-adapters (observability)
 *
 * THREE SYSTEMS:
 *
 * 1. WINDOW STRATEGIES — Composable units for metric aggregation
 *    - RingBufferStrategy: Last N entries (fixed-size, auto-evict)
 *    - TumblingWindowStrategy: Fixed time buckets (Prometheus/CloudWatch style)
 *    - SlidingWindowStrategy: Last T seconds (Datadog style)
 *    Each strategy is a self-contained SubFlow that can be swapped at runtime.
 *
 * 2. METRIC ADAPTERS — Backend adapters for metric export
 *    - MockMetricAdapter: In-memory for testing
 *    - ConsoleMetricAdapter: Formatted console output for development
 *    - (Community: Prometheus, Datadog, CloudWatch, CustomDB)
 *    Each adapter is a 3-stage FlowChart: CollectMetric → ApplyStrategy → ExportMetric
 *
 * 3. TREE OF IDs — LLM-navigable execution tree
 *    - ExecutionTree: Builds tree from FlowChart + Narrative + Recorders
 *    - TreeNavigator: LLM-friendly API (getSummary → drillDown → getChildren)
 *    Each node has ID + Description (Builder + Narrative) for lazy-loading exploration.
 *
 * @module footprint-metric-adapters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDatadogAdapter = exports.MockPrometheusAdapter = exports.MockCloudWatchAdapter = exports.ConsoleMetricAdapter = exports.MockMetricAdapter = exports.TreeNavigator = exports.ExecutionTree = exports.MetricCollector = exports.percentile = exports.computeStageErrors = exports.computeStagePercentiles = exports.computePercentiles = exports.SlidingWindowStrategy = exports.TumblingWindowStrategy = exports.RingBufferStrategy = exports.getMetricAdapterCapabilities = exports.createMetricSubflow = exports.METRIC_PATHS = void 0;
var core_1 = require("./core");
Object.defineProperty(exports, "METRIC_PATHS", { enumerable: true, get: function () { return core_1.METRIC_PATHS; } });
Object.defineProperty(exports, "createMetricSubflow", { enumerable: true, get: function () { return core_1.createMetricSubflow; } });
Object.defineProperty(exports, "getMetricAdapterCapabilities", { enumerable: true, get: function () { return core_1.getMetricAdapterCapabilities; } });
// ============================================================================
// Window Strategies
// ============================================================================
var strategies_1 = require("./strategies");
Object.defineProperty(exports, "RingBufferStrategy", { enumerable: true, get: function () { return strategies_1.RingBufferStrategy; } });
var strategies_2 = require("./strategies");
Object.defineProperty(exports, "TumblingWindowStrategy", { enumerable: true, get: function () { return strategies_2.TumblingWindowStrategy; } });
var strategies_3 = require("./strategies");
Object.defineProperty(exports, "SlidingWindowStrategy", { enumerable: true, get: function () { return strategies_3.SlidingWindowStrategy; } });
var strategies_4 = require("./strategies");
Object.defineProperty(exports, "computePercentiles", { enumerable: true, get: function () { return strategies_4.computePercentiles; } });
Object.defineProperty(exports, "computeStagePercentiles", { enumerable: true, get: function () { return strategies_4.computeStagePercentiles; } });
Object.defineProperty(exports, "computeStageErrors", { enumerable: true, get: function () { return strategies_4.computeStageErrors; } });
Object.defineProperty(exports, "percentile", { enumerable: true, get: function () { return strategies_4.percentile; } });
// ============================================================================
// MetricCollector Recorder
// ============================================================================
var collector_1 = require("./collector");
Object.defineProperty(exports, "MetricCollector", { enumerable: true, get: function () { return collector_1.MetricCollector; } });
// ============================================================================
// Tree of IDs
// ============================================================================
var tree_1 = require("./tree");
Object.defineProperty(exports, "ExecutionTree", { enumerable: true, get: function () { return tree_1.ExecutionTree; } });
var tree_2 = require("./tree");
Object.defineProperty(exports, "TreeNavigator", { enumerable: true, get: function () { return tree_2.TreeNavigator; } });
// ============================================================================
// Adapters
// ============================================================================
var mock_1 = require("./adapters/mock");
Object.defineProperty(exports, "MockMetricAdapter", { enumerable: true, get: function () { return mock_1.MockMetricAdapter; } });
var console_1 = require("./adapters/console");
Object.defineProperty(exports, "ConsoleMetricAdapter", { enumerable: true, get: function () { return console_1.ConsoleMetricAdapter; } });
var cloudwatch_1 = require("./adapters/cloudwatch");
Object.defineProperty(exports, "MockCloudWatchAdapter", { enumerable: true, get: function () { return cloudwatch_1.MockCloudWatchAdapter; } });
var prometheus_1 = require("./adapters/prometheus");
Object.defineProperty(exports, "MockPrometheusAdapter", { enumerable: true, get: function () { return prometheus_1.MockPrometheusAdapter; } });
var datadog_1 = require("./adapters/datadog");
Object.defineProperty(exports, "MockDatadogAdapter", { enumerable: true, get: function () { return datadog_1.MockDatadogAdapter; } });
