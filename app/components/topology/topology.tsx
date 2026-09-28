import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";

import cn from "~/utils/cn";
import type { TopologyGraph, TopologyNode } from "~/utils/topology";

interface TopologyProps {
  graph: TopologyGraph;
  onNodeClick?: (node: TopologyNode) => void;
}

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

export default function Topology({ graph, onNodeClick }: TopologyProps) {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, tx: 40, ty: 40 });
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const [hovered, setHovered] = useState<TopologyNode | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setView((v) => ({
      ...v,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor)),
    }));
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        tx: view.tx,
        ty: view.ty,
      };
    },
    [view.tx, view.ty],
  );

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      setView((v) => ({
        ...v,
        tx: dragRef.current!.tx + dx,
        ty: dragRef.current!.ty + dy,
      }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleNodeHover = useCallback((node: TopologyNode | null, event?: React.MouseEvent) => {
    setHovered(node);
    if (event) {
      setCursor({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const handleNodeClick = useCallback(
    (node: TopologyNode) => {
      if (onNodeClick) {
        onNodeClick(node);
        return;
      }
      if (node.machineId) {
        navigate(`/machines/${node.machineId}`);
      }
    },
    [navigate, onNodeClick],
  );

  return (
    <div className="relative overflow-hidden rounded-lg border border-mist-200 bg-white dark:border-mist-800 dark:bg-mist-900/50">
      <svg
        className="h-[600px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseLeave={() => handleNodeHover(null)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${graph.width} ${graph.height}`}
      >
        <title>Tailnet topology</title>
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
          {/* Edges */}
          {graph.edges.map((edge) => {
            const from = graph.nodes.find((n) => n.id === edge.from);
            const to = graph.nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;

            return (
              <line
                className="stroke-mist-300 dark:stroke-mist-700"
                key={`${edge.from}-${edge.to}`}
                strokeDasharray={edge.kind === "subnet" ? "4 3" : undefined}
                strokeWidth={1.5}
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
              />
            );
          })}

          {/* Group labels */}
          {Array.from(new Set(graph.nodes.map((n) => n.group))).map((group) => {
            const groupNodes = graph.nodes.filter((n) => n.group === group && n.kind === "node");
            if (groupNodes.length === 0) return null;
            const minX = Math.min(...groupNodes.map((n) => n.x));
            const maxX = Math.max(...groupNodes.map((n) => n.x));
            const y = groupNodes[0].y;
            const cx = (minX + maxX) / 2;

            return (
              <text
                className="fill-mist-500 text-xs font-semibold tracking-wide uppercase dark:fill-mist-400"
                key={group}
                textAnchor="middle"
                x={cx}
                y={y - 42}
              >
                {group}
              </text>
            );
          })}
          {/* Nodes */}
          {graph.nodes.map((node) => {
            const isSubnet = node.kind === "subnet";
            const radius = isSubnet ? 14 : 24;

            return (
              <g
                className="cursor-pointer"
                key={node.id}
                onClick={(event) => {
                  event.stopPropagation();
                  handleNodeClick(node);
                }}
                onMouseEnter={(event) => handleNodeHover(node, event)}
                onMouseLeave={() => handleNodeHover(null)}
                transform={`translate(${node.x},${node.y})`}
              >
                {/* Exit node ring */}
                {node.isExitNode ? (
                  <circle
                    className="fill-none stroke-amber-400 dark:stroke-amber-500"
                    r={radius + 6}
                    strokeWidth={2}
                  />
                ) : null}

                {/* Node body */}
                <circle
                  className={cn(
                    "stroke-white dark:stroke-mist-900",
                    node.isExpired && "opacity-40",
                  )}
                  fill={node.color}
                  r={radius}
                  strokeWidth={2}
                />

                {/* Online indicator */}
                {!isSubnet ? (
                  <circle
                    className={cn(
                      node.isOnline ? "fill-green-500" : "fill-mist-300 dark:fill-mist-600",
                    )}
                    cx={radius - 6}
                    cy={radius - 6}
                    r={5}
                  />
                ) : null}

                {/* Label */}
                <text
                  className={cn(
                    "fill-mist-700 text-xs dark:fill-mist-200",
                    isSubnet && "font-mono",
                  )}
                  textAnchor="middle"
                  y={radius + 16}
                >
                  {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hovered && cursor ? (
        <div
          className="shadow-overlay pointer-events-none fixed z-50 w-56 rounded-lg border border-mist-200 bg-white p-3 text-sm dark:border-mist-800 dark:bg-mist-950"
          style={{ left: cursor.x + 12, top: cursor.y + 12 }}
        >
          <p className="font-semibold">{hovered.label}</p>
          <p className="mt-0.5 text-xs opacity-60">{hovered.group}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {hovered.kind === "subnet" ? (
              <span className="rounded-md bg-mist-100 px-1.5 py-0.5 text-xs dark:bg-mist-800">
                Subnet route
              </span>
            ) : (
              <>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-xs",
                    hovered.isOnline
                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                      : "bg-mist-100 text-mist-600 dark:bg-mist-800 dark:text-mist-400",
                  )}
                >
                  {hovered.isOnline ? "Online" : "Offline"}
                </span>
                {hovered.isExitNode ? (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    Exit node
                  </span>
                ) : null}
                {hovered.isExpired ? (
                  <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                    Expired
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Zoom controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1">
        <button
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-mist-200 bg-white text-lg font-medium hover:bg-mist-50 dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50"
          onClick={() => setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, v.scale * 1.2) }))}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-mist-200 bg-white text-lg font-medium hover:bg-mist-50 dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50"
          onClick={() => setView((v) => ({ ...v, scale: Math.max(MIN_SCALE, v.scale / 1.2) }))}
          type="button"
        >
          −
        </button>
        <button
          aria-label="Reset view"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-mist-200 bg-white text-xs font-medium hover:bg-mist-50 dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50"
          onClick={() => setView({ scale: 1, tx: 40, ty: 40 })}
          type="button"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
