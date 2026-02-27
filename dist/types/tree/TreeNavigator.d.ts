/**
 * TreeNavigator — LLM-friendly API for navigating the Tree of IDs.
 * ----------------------------------------------------------------------------
 * Provides the interface that an LLM calls to explore execution traces.
 *
 * WORKFLOW:
 *   1. LLM calls getSummary() → gets list of stage IDs + descriptions
 *   2. LLM identifies interesting nodes (errors, slow stages)
 *   3. LLM calls drillDown(id) → gets full details for that node
 *   4. LLM calls getChildren(id) → explores subflows or parallel branches
 *   5. LLM calls getErrors() → quick diagnosis of all failures
 *
 * DESIGN PRINCIPLE: Lazy loading for LLM context windows.
 *   - getSummary() returns minimal tokens (IDs + short descriptions)
 *   - drillDown(id) returns full details only for requested nodes
 *   - Each method returns both structured data AND human-readable text
 *
 * VISION: This is what makes FootPrint LLM-friendly:
 *   - Customer asks "What happened to my request?"
 *   - Provider asks "Why did this fail?"
 *   - LLM navigates the tree, finds the answer, explains it
 *
 * @module tree/TreeNavigator
 */
import { ExecutionTree } from './ExecutionTree';
import type { TreeSummary, DrillDownResult, NavigationResult } from './types';
/**
 * TreeNavigator — LLM-friendly navigation over an ExecutionTree.
 *
 * @example
 * ```typescript
 * const tree = new ExecutionTree();
 * // ... populate tree with stage data ...
 *
 * const navigator = new TreeNavigator(tree);
 *
 * // Step 1: LLM gets the overview
 * const summary = navigator.getSummary();
 * console.log(summary.textSummary);
 * // "Execution completed in 1,234ms across 7 stages. 1 error in [execute-tools]."
 *
 * // Step 2: LLM drills into the error
 * const detail = navigator.drillDown('execute-tools');
 * console.log(detail.textDetail);
 * // "execute-tools (Execute Tools) — 456ms — ERROR
 * //  Description: Runs tool functions requested by the LLM
 * //  Error: TypeError: Cannot read property 'userId' of undefined
 * //  Reads: scope.agent.toolCalls = [{name: 'getUserDetails', ...}]
 * //  Writes: scope.agent.toolResults = [error]"
 *
 * // Step 3: LLM explains to customer
 * // "Your request failed because the getUserDetails tool couldn't find
 * //  the userId field. This is likely because..."
 * ```
 */
export declare class TreeNavigator {
    private readonly tree;
    constructor(tree: ExecutionTree);
    /**
     * Get the top-level execution summary.
     *
     * This is the FIRST thing the LLM sees. Contains:
     *   - List of all stages with IDs and descriptions
     *   - Aggregate stats (duration, errors)
     *   - Quick indicators of problems
     *
     * The LLM reads this, identifies nodes to explore, calls drillDown(id).
     */
    getSummary(): TreeSummary;
    /**
     * Drill down into a specific node for full details.
     *
     * Returns everything the LLM needs to understand what happened:
     * reads, writes, metrics, errors, narrative, and context (siblings, parent).
     */
    drillDown(id: string): DrillDownResult | undefined;
    /**
     * Get children of a node (for exploring subflows, forks, parallel branches).
     */
    getChildren(id: string): NavigationResult;
    /**
     * Search for nodes by query (matches name, description, or ID).
     */
    search(query: string): NavigationResult;
    /**
     * Get all error nodes — quick diagnosis.
     */
    getErrors(): NavigationResult;
    /**
     * Get slow stages — nodes exceeding a latency threshold.
     */
    getSlowStages(thresholdMs?: number): NavigationResult;
    /**
     * Get the breadcrumb path to a node (human-readable).
     */
    getPathText(id: string): string;
}
