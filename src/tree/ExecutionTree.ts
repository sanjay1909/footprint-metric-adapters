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

import type {
  TreeNode,
  TreeNodeType,
  TreeNodeSummary,
  DataOperation,
  ErrorDetail,
  StageMetricsSummary,
} from './types';

// ============================================================================
// Stage Data — Raw data collected during execution
// ============================================================================

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

// ============================================================================
// ExecutionTree Implementation
// ============================================================================

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
export class ExecutionTree {
  /** All stages indexed by ID */
  private stages: Map<string, StageData> = new Map();

  /** Tree nodes indexed by ID */
  private nodes: Map<string, TreeNode> = new Map();

  /** Root node IDs (stages with no parent) */
  private rootIds: string[] = [];

  /** Insertion order (for flat traversal) */
  private insertionOrder: string[] = [];

  // ==========================================================================
  // Building the Tree
  // ==========================================================================

  /**
   * Add a stage to the tree.
   *
   * Call this during or after execution to populate the tree.
   * Stages can be added in any order — the tree is built from parentId references.
   */
  addStage(data: StageData): void {
    this.stages.set(data.id, data);
    this.insertionOrder.push(data.id);

    const node = this.createNode(data);
    this.nodes.set(data.id, node);

    if (data.parentId) {
      const parent = this.nodes.get(data.parentId);
      if (parent) {
        parent.children.push(node);
        parent.hasDetails = true;
      }
    } else {
      this.rootIds.push(data.id);
    }
  }

  /**
   * Update an existing stage with additional data.
   * Useful when narrative/metrics become available after initial stage registration.
   */
  updateStage(id: string, updates: Partial<StageData>): void {
    const existing = this.stages.get(id);
    if (!existing) return;

    const updated = { ...existing, ...updates };
    this.stages.set(id, updated);

    // Rebuild the node
    const node = this.nodes.get(id);
    if (node) {
      const newNode = this.createNode(updated);
      // Preserve children
      newNode.children = node.children;
      newNode.hasDetails = node.hasDetails || newNode.hasDetails;
      this.nodes.set(id, newNode);

      // Update parent's child reference
      if (updated.parentId) {
        const parent = this.nodes.get(updated.parentId);
        if (parent) {
          const idx = parent.children.findIndex((c) => c.id === id);
          if (idx >= 0) {
            parent.children[idx] = newNode;
          }
        }
      }
    }
  }

  // ==========================================================================
  // Querying the Tree
  // ==========================================================================

  /**
   * Get all root nodes of the tree.
   */
  getRoots(): TreeNode[] {
    return this.rootIds.map((id) => this.nodes.get(id)).filter(Boolean) as TreeNode[];
  }

  /**
   * Get a specific node by ID.
   */
  getNode(id: string): TreeNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get the raw stage data for a node.
   */
  getStageData(id: string): StageData | undefined {
    return this.stages.get(id);
  }

  /**
   * Get all nodes in insertion (execution) order.
   */
  getAllNodesInOrder(): TreeNode[] {
    return this.insertionOrder
      .map((id) => this.nodes.get(id))
      .filter(Boolean) as TreeNode[];
  }

  /**
   * Get all node summaries in execution order.
   */
  getAllSummaries(): TreeNodeSummary[] {
    return this.getAllNodesInOrder().map((node) => this.toSummary(node));
  }

  /**
   * Get children of a node.
   */
  getChildren(id: string): TreeNode[] {
    const node = this.nodes.get(id);
    return node?.children ?? [];
  }

  /**
   * Get the breadcrumb path from root to a specific node.
   */
  getPath(id: string): string[] {
    const path: string[] = [];
    let currentId: string | undefined = id;

    while (currentId) {
      path.unshift(currentId);
      const data = this.stages.get(currentId);
      currentId = data?.parentId;
    }

    return path;
  }

  /**
   * Find nodes matching a search query (by name or description).
   */
  search(query: string): TreeNode[] {
    const lower = query.toLowerCase();
    const results: TreeNode[] = [];

    for (const node of this.nodes.values()) {
      if (
        node.name.toLowerCase().includes(lower) ||
        node.description.toLowerCase().includes(lower) ||
        node.id.toLowerCase().includes(lower)
      ) {
        results.push(node);
      }
    }

    return results;
  }

  /**
   * Get all nodes that had errors.
   */
  getErrorNodes(): TreeNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.status === 'error');
  }

  /**
   * Get the slowest nodes (sorted by duration descending).
   */
  getSlowestNodes(limit = 5): TreeNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.durationMs !== undefined)
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      .slice(0, limit);
  }

  /**
   * Get total execution duration (sum of all stage durations).
   */
  getTotalDuration(): number {
    let total = 0;
    for (const node of this.nodes.values()) {
      if (node.durationMs !== undefined) {
        total += node.durationMs;
      }
    }
    return total;
  }

  /**
   * Get total number of stages.
   */
  getStageCount(): number {
    return this.nodes.size;
  }

  /**
   * Clear the tree.
   */
  clear(): void {
    this.stages.clear();
    this.nodes.clear();
    this.rootIds = [];
    this.insertionOrder = [];
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Create a TreeNode from StageData.
   */
  private createNode(data: StageData): TreeNode {
    // Combine builder description + narrative
    const parts: string[] = [];
    if (data.builderDescription) {
      parts.push(data.builderDescription);
    }
    if (data.narrativeSentences && data.narrativeSentences.length > 0) {
      parts.push(data.narrativeSentences.join(' '));
    }

    const description = parts.length > 0
      ? parts.join(' — ')
      : data.name;

    const hasDetails = !!(
      (data.reads && data.reads.length > 0) ||
      (data.writes && data.writes.length > 0) ||
      (data.errors && data.errors.length > 0) ||
      data.metrics
    );

    return {
      id: data.id,
      name: data.name,
      displayName: data.displayName,
      builderDescription: data.builderDescription,
      narrativeSummary: data.narrativeSentences?.join(' '),
      description,
      depth: data.parentId ? this.getDepth(data.parentId) + 1 : 0,
      nodeType: data.nodeType ?? 'stage',
      children: [],
      hasDetails,
      status: data.hasError ? 'error' : 'success',
      durationMs: data.durationMs,
      errorMessage: data.errorMessage,
    };
  }

  /**
   * Get the depth of a node (0 = root).
   */
  private getDepth(id: string): number {
    const node = this.nodes.get(id);
    return node?.depth ?? 0;
  }

  /**
   * Convert a TreeNode to a lightweight summary.
   */
  private toSummary(node: TreeNode): TreeNodeSummary {
    return {
      id: node.id,
      name: node.name,
      description: node.description,
      hasChildren: node.children.length > 0,
      childCount: node.children.length,
      status: node.status,
      durationMs: node.durationMs,
    };
  }
}
