"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import KnowledgePointNode from "./KnowledgePointNode";
import type { KnowledgeGraphData } from "../types";

const nodeTypes = { knowledgePoint: KnowledgePointNode };

const NODE_WIDTH = 160;
const NODE_HEIGHT = 50;
const GAP_X = 200;
const GAP_Y = 80;

function layoutNodes(data: KnowledgeGraphData): Node[] {
  const chapterGroups = new Map<string, typeof data.nodes>();
  for (const node of data.nodes) {
    const group = chapterGroups.get(node.chapter) ?? [];
    group.push(node);
    chapterGroups.set(node.chapter, group);
  }

  const nodes: Node[] = [];
  let columnIndex = 0;

  for (const [, group] of chapterGroups) {
    group.forEach((graphNode, rowIndex) => {
      nodes.push({
        id: graphNode.id,
        type: "knowledgePoint",
        position: {
          x: columnIndex * GAP_X + 40,
          y: rowIndex * GAP_Y + 40,
        },
        data: { ...graphNode },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      });
    });
    columnIndex++;
  }

  return nodes;
}

function layoutEdges(data: KnowledgeGraphData): Edge[] {
  return data.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: true,
    style: {
      strokeDasharray: "5 5",
      stroke: "#94a3b8",
    },
  }));
}

export default function KnowledgeMapGraph({
  data,
  onNodeSelect,
}: {
  data: KnowledgeGraphData;
  onNodeSelect: (nodeId: string) => void;
}) {
  const nodes = useMemo(() => layoutNodes(data), [data]);
  const edges = useMemo(() => layoutEdges(data), [data]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(node) => {
            const level = (node.data as { masteryLevel?: string }).masteryLevel;
            if (level === "strong") return "#d1fae5";
            if (level === "developing") return "#fef3c7";
            if (level === "weak") return "#fee2e2";
            if (level === "locked") return "#cbd5e1";
            return "#f1f5f9";
          }}
          style={{ borderRadius: 8 }}
        />
      </ReactFlow>
    </div>
  );
}
