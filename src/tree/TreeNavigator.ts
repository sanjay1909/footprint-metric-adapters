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
import type {
  TreeSummary,
  TreeNodeSummary,
  DrillDownResult,
  NavigationResult,
  DataOperation,
  ErrorDetail,
  StageMetricsSummary,
} from './types';

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
export class TreeNavigator {
  private readonly tree: ExecutionTree;

  constructor(tree: ExecutionTree) {
    this.tree = tree;
  }

  // ==========================================================================
  // Primary API — What the LLM calls
  // ==========================================================================

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
  getSummary(): TreeSummary {
    const allNodes = this.tree.getAllSummaries();
    const errorNodes = this.tree.getErrorNodes();
    const slowNodes = this.tree.getSlowestNodes(3);
    const totalDuration = this.tree.getTotalDuration();

    // Build text summary
    const lines: string[] = [];
    lines.push(
      'Execution completed in ' + totalDuration.toFixed(0) + 'ms across ' +
      allNodes.length + ' stages.'
    );

    if (errorNodes.length > 0) {
      const errorIds = errorNodes.map((n) => '[' + n.id + ']').join(', ');
      lines.push(errorNodes.length + ' error(s) in: ' + errorIds);
    }

    if (slowNodes.length > 0) {
      const slowParts = slowNodes.map(
        (n) => '[' + n.id + '] ' + (n.durationMs ?? 0).toFixed(0) + 'ms'
      );
      lines.push('Slowest: ' + slowParts.join(', '));
    }

    lines.push('');
    lines.push('Stages:');
    for (const node of allNodes) {
      const status = node.status === 'error' ? ' [ERROR]' : '';
      const duration = node.durationMs !== undefined ? ' (' + node.durationMs.toFixed(0) + 'ms)' : '';
      lines.push(
        '  [' + node.id + '] ' + node.name + duration + status +
        ' — ' + node.description
      );
    }

    return {
      nodes: allNodes,
      totalStages: allNodes.length,
      totalDurationMs: totalDuration,
      errorCount: errorNodes.length,
      errorNodeIds: errorNodes.map((n) => n.id),
      slowNodeIds: slowNodes.map((n) => n.id),
      textSummary: lines.join('\n'),
    };
  }

  /**
   * Drill down into a specific node for full details.
   *
   * Returns everything the LLM needs to understand what happened:
   * reads, writes, metrics, errors, narrative, and context (siblings, parent).
   */
  drillDown(id: string): DrillDownResult | undefined {
    const node = this.tree.getNode(id);
    if (!node) return undefined;

    const stageData = this.tree.getStageData(id);
    const path = this.tree.getPath(id);

    // Get siblings (other nodes at same level)
    const siblings: TreeNodeSummary[] = [];
    if (stageData?.parentId) {
      const parentChildren = this.tree.getChildren(stageData.parentId);
      for (const sibling of parentChildren) {
        if (sibling.id !== id) {
          siblings.push({
            id: sibling.id,
            name: sibling.name,
            description: sibling.description,
            hasChildren: sibling.children.length > 0,
            childCount: sibling.children.length,
            status: sibling.status,
            durationMs: sibling.durationMs,
          });
        }
      }
    }

    // Get parent summary
    let parent: TreeNodeSummary | undefined;
    if (stageData?.parentId) {
      const parentNode = this.tree.getNode(stageData.parentId);
      if (parentNode) {
        parent = {
          id: parentNode.id,
          name: parentNode.name,
          description: parentNode.description,
          hasChildren: parentNode.children.length > 0,
          childCount: parentNode.children.length,
          status: parentNode.status,
          durationMs: parentNode.durationMs,
        };
      }
    }

    const reads: DataOperation[] = stageData?.reads ?? [];
    const writes: DataOperation[] = stageData?.writes ?? [];
    const errors: ErrorDetail[] = stageData?.errors ?? [];
    const metrics: StageMetricsSummary = stageData?.metrics ?? {
      readCount: reads.length,
      writeCount: writes.length,
      commitCount: 0,
      errorCount: errors.length,
      durationMs: node.durationMs,
    };

    // Build text detail
    const lines: string[] = [];
    const status = node.status === 'error' ? 'ERROR' : 'SUCCESS';
    const duration = node.durationMs !== undefined ? node.durationMs.toFixed(0) + 'ms' : 'N/A';

    lines.push('[' + node.id + '] ' + node.name + ' — ' + duration + ' — ' + status);
    lines.push('Path: ' + path.join(' → '));

    if (node.builderDescription) {
      lines.push('Purpose: ' + node.builderDescription);
    }
    if (node.narrativeSummary) {
      lines.push('What happened: ' + node.narrativeSummary);
    }

    if (errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      for (const err of errors) {
        lines.push('  - ' + err.message + ' (during ' + err.operation + ')');
      }
    }

    if (reads.length > 0) {
      lines.push('');
      lines.push('Reads:');
      for (const read of reads) {
        lines.push(
          '  - ' + read.path.join('.') + '.' + read.key + ' = ' + read.valueSummary
        );
      }
    }

    if (writes.length > 0) {
      lines.push('');
      lines.push('Writes:');
      for (const write of writes) {
        const op = write.operation === 'update' ? '(merge)' : '(set)';
        lines.push(
          '  - ' + write.path.join('.') + '.' + write.key + ' = ' + write.valueSummary + ' ' + op
        );
      }
    }

    if (node.children.length > 0) {
      lines.push('');
      lines.push('Children (' + node.children.length + '):');
      for (const child of node.children) {
        lines.push('  [' + child.id + '] ' + child.name + ' — ' + child.description);
      }
    }

    return {
      node,
      path,
      reads,
      writes,
      metrics,
      errors,
      siblings,
      parent,
      textDetail: lines.join('\n'),
    };
  }

  /**
   * Get children of a node (for exploring subflows, forks, parallel branches).
   */
  getChildren(id: string): NavigationResult {
    const children = this.tree.getChildren(id);
    const summaries: TreeNodeSummary[] = children.map((child) => ({
      id: child.id,
      name: child.name,
      description: child.description,
      hasChildren: child.children.length > 0,
      childCount: child.children.length,
      status: child.status,
      durationMs: child.durationMs,
    }));

    const lines = summaries.map(
      (s) => '[' + s.id + '] ' + s.name + ' — ' + s.description
    );

    return {
      nodes: summaries,
      totalResults: summaries.length,
      textResult: summaries.length > 0
        ? 'Children of [' + id + ']:\n' + lines.join('\n')
        : 'No children for [' + id + ']',
    };
  }

  /**
   * Search for nodes by query (matches name, description, or ID).
   */
  search(query: string): NavigationResult {
    const matches = this.tree.search(query);
    const summaries: TreeNodeSummary[] = matches.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      hasChildren: node.children.length > 0,
      childCount: node.children.length,
      status: node.status,
      durationMs: node.durationMs,
    }));

    const lines = summaries.map(
      (s) => '[' + s.id + '] ' + s.name + ' — ' + s.description
    );

    return {
      nodes: summaries,
      totalResults: summaries.length,
      textResult: summaries.length > 0
        ? 'Found ' + summaries.length + ' result(s) for "' + query + '":\n' + lines.join('\n')
        : 'No results found for "' + query + '"',
    };
  }

  /**
   * Get all error nodes — quick diagnosis.
   */
  getErrors(): NavigationResult {
    const errorNodes = this.tree.getErrorNodes();
    const summaries: TreeNodeSummary[] = errorNodes.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description + (node.errorMessage ? ' — Error: ' + node.errorMessage : ''),
      hasChildren: node.children.length > 0,
      childCount: node.children.length,
      status: node.status,
      durationMs: node.durationMs,
    }));

    const lines = summaries.map(
      (s) => '[' + s.id + '] ' + s.name + ' — ' + s.description
    );

    return {
      nodes: summaries,
      totalResults: summaries.length,
      textResult: summaries.length > 0
        ? summaries.length + ' error(s) found:\n' + lines.join('\n')
        : 'No errors found — all stages completed successfully.',
    };
  }

  /**
   * Get slow stages — nodes exceeding a latency threshold.
   */
  getSlowStages(thresholdMs = 1000): NavigationResult {
    const nodes = this.tree.getAllNodesInOrder()
      .filter((n) => n.durationMs !== undefined && n.durationMs > thresholdMs);

    const summaries: TreeNodeSummary[] = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description + ' — ' + (node.durationMs ?? 0).toFixed(0) + 'ms',
      hasChildren: node.children.length > 0,
      childCount: node.children.length,
      status: node.status,
      durationMs: node.durationMs,
    }));

    const lines = summaries.map(
      (s) => '[' + s.id + '] ' + s.name + ' — ' + (s.durationMs ?? 0).toFixed(0) + 'ms'
    );

    return {
      nodes: summaries,
      totalResults: summaries.length,
      textResult: summaries.length > 0
        ? summaries.length + ' stage(s) slower than ' + thresholdMs + 'ms:\n' + lines.join('\n')
        : 'No stages slower than ' + thresholdMs + 'ms.',
    };
  }

  /**
   * Get the breadcrumb path to a node (human-readable).
   */
  getPathText(id: string): string {
    const path = this.tree.getPath(id);
    if (path.length === 0) return 'Node [' + id + '] not found.';

    const parts = path.map((nodeId) => {
      const node = this.tree.getNode(nodeId);
      return node ? '[' + nodeId + '] ' + node.name : '[' + nodeId + ']';
    });

    return 'Path: ' + parts.join(' → ');
  }
}
