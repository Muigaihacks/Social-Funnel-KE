"use client";

import { useMemo } from "react";

type StageNode = {
  stage: string;
  count: number;
  x: number;
  y: number;
  id: string;
};

type FunnelCanvasProps = {
  stages: Array<{ stage: string; count: number }>;
  selectedStage: string | null;
  onSelectStage: (stage: string | null) => void;
};

const STAGE_ORDER = [
  "new",
  "contacted",
  "nurture",
  "booked",
  "audit_booked",
  "no_show",
  "closed",
  "dead",
  "reactivated",
];

function formatStageLabel(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function FunnelCanvas({ stages, selectedStage, onSelectStage }: FunnelCanvasProps) {
  const nodes = useMemo<StageNode[]>(() => {
    // Create node layout in a flowing pattern like n8n
    const orderedStages = stages
      .slice()
      .sort((a, b) => {
        const aIdx = STAGE_ORDER.indexOf(a.stage);
        const bIdx = STAGE_ORDER.indexOf(b.stage);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });

    // Layout: flowing left-to-right, top-to-bottom pattern
    const baseX = 80;
    const baseY = 60;
    const xStep = 200;
    const yStep = 140;
    const maxPerRow = 4;

    return orderedStages.map((s, i) => {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      
      // Create a flowing pattern
      let x = baseX + col * xStep;
      let y = baseY + row * yStep;

      // Add slight vertical offset for alternate rows to create flow
      if (row % 2 === 1) {
        x += xStep / 2;
      }

      return {
        stage: s.stage,
        count: s.count,
        x,
        y,
        id: `node-${s.stage}`,
      };
    });
  }, [stages]);

  const connections = useMemo(() => {
    // Create connections between sequential stages
    const conns: Array<{ from: StageNode; to: StageNode }> = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      conns.push({ from: nodes[i], to: nodes[i + 1] });
    }
    return conns;
  }, [nodes]);

  const viewBox = useMemo(() => {
    if (nodes.length === 0) return "0 0 1000 400";
    const maxX = Math.max(...nodes.map((n) => n.x)) + 160;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 120;
    return `0 0 ${Math.max(1000, maxX)} ${Math.max(400, maxY)}`;
  }, [nodes]);

  if (stages.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[#1a1a1a]">
        <p className="text-sm text-[var(--text-dim)]">No pipeline data yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--card-border)] bg-[#1a1a1a] p-4">
      <svg
        viewBox={viewBox}
        className="w-full"
        style={{ minHeight: "400px", maxHeight: "600px" }}
      >
        <defs>
          {/* Arrow marker */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            fill="#4a5568"
          >
            <polygon points="0 0, 10 3, 0 6" />
          </marker>

          {/* Gradient for active nodes */}
          <linearGradient id="activeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00d1c1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00d1c1" stopOpacity="0.1" />
          </linearGradient>

          {/* Gradient for normal nodes */}
          <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2d3748" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1a202c" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Draw connections first (behind nodes) */}
        {connections.map((conn, i) => {
          const dx = conn.to.x - conn.from.x;
          const dy = conn.to.y - conn.from.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Start and end points accounting for node radius
          const nodeRadius = 60;
          const startX = conn.from.x + (dx / dist) * nodeRadius;
          const startY = conn.from.y + (dy / dist) * nodeRadius;
          const endX = conn.to.x - (dx / dist) * nodeRadius;
          const endY = conn.to.y - (dy / dist) * nodeRadius;

          // Create a curved path
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          const curvature = 20;
          const controlX = midX;
          const controlY = midY - curvature;

          return (
            <path
              key={`conn-${i}`}
              d={`M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`}
              stroke="#4a5568"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
              opacity="0.5"
            />
          );
        })}

        {/* Draw nodes */}
        {nodes.map((node) => {
          const isActive = selectedStage === node.stage;
          const isHot = node.count > 10;
          
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onSelectStage(isActive ? null : node.stage)}
              style={{ cursor: "pointer" }}
              className="transition-all duration-200"
            >
              {/* Node background circle */}
              <circle
                r="56"
                fill={isActive ? "url(#activeGradient)" : "url(#nodeGradient)"}
                stroke={isActive ? "#00d1c1" : isHot ? "#f59e0b" : "#4a5568"}
                strokeWidth={isActive ? "3" : "2"}
                className="transition-all duration-200"
              />
              
              {/* Icon background */}
              <circle
                r="20"
                cy="-15"
                fill={isActive ? "#00d1c1" : "#4a5568"}
                opacity="0.3"
              />

              {/* Stage icon (simplified) */}
              <text
                textAnchor="middle"
                y="-10"
                fontSize="20"
                fill={isActive ? "#00d1c1" : "#9ca3af"}
              >
                {node.stage === "new" && "📥"}
                {node.stage === "contacted" && "📞"}
                {node.stage === "nurture" && "🌱"}
                {node.stage === "booked" && "📅"}
                {node.stage === "audit_booked" && "✅"}
                {node.stage === "no_show" && "❌"}
                {node.stage === "closed" && "🎉"}
                {node.stage === "dead" && "💀"}
                {node.stage === "reactivated" && "🔄"}
                {!["new", "contacted", "nurture", "booked", "audit_booked", "no_show", "closed", "dead", "reactivated"].includes(node.stage) && "📊"}
              </text>

              {/* Stage name */}
              <text
                textAnchor="middle"
                y="18"
                fontSize="12"
                fontWeight="600"
                fill={isActive ? "#00d1c1" : "#e5e7eb"}
                className="transition-colors"
              >
                {formatStageLabel(node.stage)}
              </text>

              {/* Lead count */}
              <text
                textAnchor="middle"
                y="38"
                fontSize="20"
                fontWeight="700"
                fill={isActive ? "#00d1c1" : "#f59e0b"}
                className="transition-colors"
              >
                {node.count}
              </text>

              {/* Pulse effect for active node */}
              {isActive && (
                <circle
                  r="56"
                  fill="none"
                  stroke="#00d1c1"
                  strokeWidth="2"
                  opacity="0.5"
                  className="animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              )}

              {/* Hover hint */}
              {isActive && (
                <text
                  textAnchor="middle"
                  y="65"
                  fontSize="9"
                  fill="#9ca3af"
                  opacity="0.7"
                >
                  Click to collapse
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--text-dim)]">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-[var(--sf-teal)]" />
          <span>Selected stage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-amber-500" />
          <span>High volume (&gt;10)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-gray-600" />
          <span>Standard</span>
        </div>
      </div>
    </div>
  );
}
