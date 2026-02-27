/**
 * ExecutionTree — Builds the Tree of IDs from execution data.
 * ----------------------------------------------------------------------------
 * Collects data from multiple sources and assembles a navigable tree:
 *
 *   1. FlowChart structure → stage IDs, names, descriptions (build-time)
 *   2. NarrativeGenerator → what happened at each stage (runtime)
 *   3. Recorder data → reads, writes, metrics, errors (runtime)
 *
 * Each node gets:
 *   ID (stable, from builder) + Description (builder + narrative)
 *
 * The tree mirrors the FlowChart execution structure:
 *   linear → fork → decider → subflow
 *
 * @module tree/ExecutionTree
 */
import type { TreeNode, TreeNodeType, TreeNodeSummary, DataOperation, ErrorDetail, StageMetricsSummary } from './types';
/**
 * Raw data for a single stage, collected during execution.
 * This is the input to ExecutionTree.addStage().
 */
export interface StageData {
    /** Stage ID (from FlowChart builder) */
    id: string;
    /** Stage name */
    name: string;
    /** Display name (optional) */
    displayName?: string;
    /** Builder description — what the stage is designed to do */
    builderDescription?: string;
    /** Narrative sentences — what actually happened */
    narrativeSentences?: string[];
    /** Node type in the FlowChart */
    nodeType?: TreeNodeType;
    /** Duration in ms */
    durationMs?: number;
    /** Whether the stage errored */
    hasError?: boolean;
    /** Error message */
    errorMessage?: string;
    /** Parent stage ID (for tree construction) */
    parentId?: string;
    /** Data reads */
    reads?: DataOperation[];
    /** Data writes */
    writes?: DataOperation[];
    /** Error details */
    errors?: ErrorDetail[];
    /** Metrics summary */
    metrics?: StageMetricsSummary;
}
/**
 * Builds and maintains the Tree of IDs from execution data.
 *
 * @example
 * ```typescript
 * const tree = new ExecutionTree();
 *
 * // Add stages from FlowChart execution
 * tree.addStage({
 *   id: 'validate-input',
 *   name: 'Validate Input',
 *   builderDescription: 'Checks user input format and required fields',
 *   narrativeSentences: ['The process began with Validate Input.'],
 *   durationMs: 12,
 * });
 *
 * tree.addStage({
 *   id: 'llm-call',
 *   name: 'LLM Call',
 *   builderDescription: 'Sends messages to the LLM provider',
 *   narrativeSentences: ['CallLLM sent messages to Claude.', 'Claude responded with tool_use.'],
 *   durationMs: 1234,
 * });
 *
 * // Get the tree
 * const root = tree.getRoot();
 * const summary = tree.getSummary();
 * ```
 */
export declare class ExecutionTree {
    /** All stages indexed by ID */
    private stages;
    /** Tree nodes indexed by ID */
    private nodes;
    /** Root node IDs (stages with no parent) */
    private rootIds;
    /** Insertion order (for flat traversal) */
    private insertionOrder;
    /**
     * Add a stage to the tree.
     *
     * Call this during or after execution to populate the tree.
     * Stages can be added in any order — the tree is built from parentId references.
     */
    addStage(data: StageData): void;
    /**
     * Update an existing stage with additional data.
     * Useful when narrative/metrics become available after initial stage registration.
     */
    updateStage(id: string, updates: Partial<StageData>): void;
    /**
     * Get all root nodes of the tree.
     */
    getRoots(): TreeNode[];
    /**
     * Get a specific node by ID.
     */
    getNode(id: string): TreeNode | undefined;
    /**
     * Get the raw stage data for a node.
     */
    getStageData(id: string): StageData | undefined;
    /**
     * Get all nodes in insertion (execution) order.
     */
    getAllNodesInOrder(): TreeNode[];
    /**
     * Get all node summaries in execution order.
     */
    getAllSummaries(): TreeNodeSummary[];
    /**
     * Get children of a node.
     */
    getChildren(id: string): TreeNode[];
    /**
     * Get the breadcrumb path from root to a specific node.
     */
    getPath(id: string): string[];
    /**
     * Find nodes matching a search query (by name or description).
     */
    search(query: string): TreeNode[];
    /**
     * Get all nodes that had errors.
     */
    getErrorNodes(): TreeNode[];
    /**
     * Get the slowest nodes (sorted by duration descending).
     */
    getSlowestNodes(limit?: number): TreeNode[];
    /**
     * Get total execution duration (sum of all stage durations).
     */
    getTotalDuration(): number;
    /**
     * Get total number of stages.
     */
    getStageCount(): number;
    /**
     * Clear the tree.
     */
    clear(): void;
    /**
     * Create a TreeNode from StageData.
     */
    private createNode;
    /**
     * Get the depth of a node (0 = root).
     */
    private getDepth;
    /**
     * Convert a TreeNode to a lightweight summary.
     */
    private toSummary;
}
