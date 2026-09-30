import type { PopulatedNode } from "./node-info";

export interface TopologyNode {
  id: string;
  label: string;
  kind: "node" | "subnet";
  x: number;
  y: number;
  group: string;
  color: string;
  isExitNode: boolean;
  isOnline: boolean;
  isExpired: boolean;
  machineId?: string;
}

export interface TopologyEdge {
  from: string;
  to: string;
  kind: "subnet" | "exit";
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  width: number;
  height: number;
}

// A deterministic palette for grouping nodes by owner. Colors are assigned by
// hashing the group name so the same user always gets the same color.
const GROUP_COLORS = [
  "#6366f1", // indigo-500
  "#0ea5e9", // sky-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
];

const CLUSTER_GAP_X = 240;
const CLUSTER_GAP_Y = 220;
const NODE_GAP_X = 130;
const NODE_RADIUS = 24;
const SUBNET_RADIUS = 14;
const SUBNET_GAP_X = 90;
const SUBNET_OFFSET_Y = 70;
const PADDING = 60;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function colorForGroup(group: string): string {
  return GROUP_COLORS[hashString(group) % GROUP_COLORS.length];
}

/**
 * Builds a deterministic, layered topology graph from the tailnet's nodes.
 *
 * Nodes are grouped by owner (user name or "Tag-owned"), each group is placed
 * in a grid cell, and nodes within a group are laid out in a row. Subnet
 * routers get small "subnet" nodes connected below them; exit nodes are
 * flagged so the renderer can highlight them.
 */
export function buildTopology(nodes: PopulatedNode[]): TopologyGraph {
  const graph: TopologyGraph = { nodes: [], edges: [], width: 0, height: 0 };

  const groups = new Map<string, PopulatedNode[]>();
  for (const node of nodes) {
    const group = node.user ? node.user.name : "Tag-owned";
    const list = groups.get(group) ?? [];
    list.push(node);
    groups.set(group, list);
  }

  const groupNames = Array.from(groups.keys()).sort();
  const cols = Math.max(1, Math.ceil(Math.sqrt(groupNames.length)));

  let maxX = 0;
  let maxY = 0;

  groupNames.forEach((groupName, index) => {
    const groupNodes = groups.get(groupName) ?? [];
    const col = index % cols;
    const row = Math.floor(index / cols);
    const clusterX = col * CLUSTER_GAP_X;
    const clusterY = row * CLUSTER_GAP_Y;

    const sorted = [...groupNodes].sort((a, b) => a.givenName.localeCompare(b.givenName));

    sorted.forEach((node, nodeIndex) => {
      const x = clusterX + nodeIndex * NODE_GAP_X;
      const y = clusterY;
      const isExitNode = node.customRouting.exitRoutes.length > 0;
      const isOnline = node.online && !node.expired;

      graph.nodes.push({
        id: node.id,
        label: node.givenName,
        kind: "node",
        x,
        y,
        group: groupName,
        color: colorForGroup(groupName),
        isExitNode,
        isOnline,
        isExpired: node.expired,
        machineId: node.id,
      });

      const subnets = node.customRouting.subnetApprovedRoutes;
      subnets.forEach((subnet, subnetIndex) => {
        const subnetId = `${node.id}:${subnet}`;
        graph.nodes.push({
          id: subnetId,
          label: subnet,
          kind: "subnet",
          x: x + (subnetIndex - (subnets.length - 1) / 2) * SUBNET_GAP_X,
          y: y + SUBNET_OFFSET_Y,
          group: groupName,
          color: colorForGroup(groupName),
          isExitNode: false,
          isOnline,
          isExpired: node.expired,
        });
        graph.edges.push({ from: node.id, to: subnetId, kind: "subnet" });
      });

      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y + (subnets.length > 0 ? SUBNET_OFFSET_Y : 0));
    });
  });

  graph.width = maxX + NODE_RADIUS * 2 + PADDING;
  graph.height = maxY + SUBNET_RADIUS * 2 + PADDING;

  return graph;
}
