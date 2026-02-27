"use strict";
/**
 * Window Strategies — Barrel Export
 * ----------------------------------------------------------------------------
 * Each strategy is a self-contained, composable unit that can be used
 * independently or plugged into a metric adapter subflow.
 *
 * @module strategies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.percentile = exports.computeStageErrors = exports.computeStagePercentiles = exports.computePercentiles = exports.SlidingWindowStrategy = exports.TumblingWindowStrategy = exports.RingBufferStrategy = void 0;
var RingBufferStrategy_1 = require("./RingBufferStrategy");
Object.defineProperty(exports, "RingBufferStrategy", { enumerable: true, get: function () { return RingBufferStrategy_1.RingBufferStrategy; } });
var TumblingWindowStrategy_1 = require("./TumblingWindowStrategy");
Object.defineProperty(exports, "TumblingWindowStrategy", { enumerable: true, get: function () { return TumblingWindowStrategy_1.TumblingWindowStrategy; } });
var SlidingWindowStrategy_1 = require("./SlidingWindowStrategy");
Object.defineProperty(exports, "SlidingWindowStrategy", { enumerable: true, get: function () { return SlidingWindowStrategy_1.SlidingWindowStrategy; } });
var percentile_1 = require("./percentile");
Object.defineProperty(exports, "computePercentiles", { enumerable: true, get: function () { return percentile_1.computePercentiles; } });
Object.defineProperty(exports, "computeStagePercentiles", { enumerable: true, get: function () { return percentile_1.computeStagePercentiles; } });
Object.defineProperty(exports, "computeStageErrors", { enumerable: true, get: function () { return percentile_1.computeStageErrors; } });
Object.defineProperty(exports, "percentile", { enumerable: true, get: function () { return percentile_1.percentile; } });
