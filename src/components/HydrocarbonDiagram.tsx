import type { CarbonNode, CarbonStructure } from "@/data/hydrocarbon-bank";
import {
  expandStructureWithHydrogens,
  getHydrogenCountMap,
  planHydrogenPlacements,
} from "@/lib/molecule";

type RenderMode = "counts" | "atoms";

interface HydrocarbonDiagramProps {
  structure: CarbonStructure;
  className?: string;
  renderMode?: RenderMode;
}

interface LabelPlacement {
  id: string;
  label: string;
  x: number;
  y: number;
}

function getBondLines(
  from: { x: number; y: number },
  to: { x: number; y: number },
  order: 1 | 2 | 3,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / distance) * 5;
  const offsetY = (dx / distance) * 5;
  const offsets =
    order === 1 ? [0] : order === 2 ? [-1, 1] : [-1.6, 0, 1.6];

  return offsets.map((multiplier) => ({
    x1: from.x + offsetX * multiplier,
    y1: from.y + offsetY * multiplier,
    x2: to.x + offsetX * multiplier,
    y2: to.y + offsetY * multiplier,
  }));
}

function buildHydrogenLabels(structure: CarbonStructure) {
  const hydrogenCounts = getHydrogenCountMap(structure);
  const carbonMap = new Map(structure.carbons.map((carbon) => [carbon.id, carbon]));

  return structure.carbons.flatMap((carbon): LabelPlacement[] => {
    const hydrogenCount = hydrogenCounts[carbon.id] ?? 0;

    if (hydrogenCount === 0) {
      return [];
    }

    const neighborIds = structure.bonds.flatMap((bond) => {
      if (bond.from === carbon.id) {
        return [bond.to];
      }

      if (bond.to === carbon.id) {
        return [bond.from];
      }

      return [];
    });
    const neighbors = neighborIds
      .map((neighborId) => carbonMap.get(neighborId))
      .filter((neighbor): neighbor is CarbonNode => Boolean(neighbor));
    const placements = planHydrogenPlacements(carbon, neighbors, hydrogenCount);
    const center = placements.reduce(
      (accumulator, placement) => ({
        x: accumulator.x + placement.x / placements.length,
        y: accumulator.y + placement.y / placements.length,
      }),
      { x: 0, y: 0 },
    );

    return [
      {
        id: `${carbon.id}-label`,
        label: hydrogenCount === 1 ? "H" : `H${hydrogenCount}`,
        x: center.x,
        y: center.y,
      },
    ];
  });
}

export default function HydrocarbonDiagram({
  structure,
  className,
  renderMode = "counts",
}: HydrocarbonDiagramProps) {
  const expanded = renderMode === "atoms" ? expandStructureWithHydrogens(structure) : null;
  const diagramNodes = expanded
    ? expanded.nodes
    : structure.carbons.map((carbon) => ({ ...carbon, element: "C" as const }));
  const diagramBonds = expanded ? expanded.bonds : structure.bonds;
  const labels = renderMode === "counts" ? buildHydrogenLabels(structure) : [];
  const points = [
    ...diagramNodes.map((node) => ({ x: node.x, y: node.y })),
    ...labels.map((label) => ({ x: label.x, y: label.y })),
  ];
  const minX = Math.min(...points.map((point) => point.x)) - 56;
  const minY = Math.min(...points.map((point) => point.y)) - 56;
  const maxX = Math.max(...points.map((point) => point.x)) + 56;
  const maxY = Math.max(...points.map((point) => point.y)) + 56;
  const width = maxX - minX;
  const height = maxY - minY;
  const nodeMap = new Map(diagramNodes.map((node) => [node.id, node]));

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className={className ?? "h-full w-full"}
      role="img"
      aria-label="Hydrocarbon structure diagram"
      preserveAspectRatio="xMidYMid meet"
    >
      {diagramBonds.flatMap((bond) => {
        const from = nodeMap.get(bond.from);
        const to = nodeMap.get(bond.to);

        if (!from || !to) {
          return [];
        }

        return getBondLines(from, to, bond.order).map((line, index) => (
          <line
            key={`${bond.id}-${index}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--diagram-line)"
            strokeWidth={2.8}
            strokeLinecap="round"
          />
        ));
      })}

      {diagramNodes.map((node) => {
        const isHydrogen = node.element === "H";

        return (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={isHydrogen ? 16 : 21}
              fill={isHydrogen ? "var(--diagram-hydrogen)" : "var(--diagram-carbon)"}
              stroke="var(--diagram-line)"
              strokeWidth={isHydrogen ? 1.6 : 2}
            />
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-display)"
              fontSize={isHydrogen ? 12 : 13.5}
              fontWeight={700}
              fill={isHydrogen ? "var(--diagram-line)" : "var(--diagram-carbon-text)"}
            >
              {node.element}
            </text>
          </g>
        );
      })}

      {labels.map((label) => (
        <g key={label.id}>
          <rect
            x={label.x - 18}
            y={label.y - 12}
            width={36}
            height={24}
            rx={12}
            fill="var(--diagram-hydrogen)"
            stroke="var(--diagram-line)"
            strokeWidth={1.4}
          />
          <text
            x={label.x}
            y={label.y + 0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-display)"
            fontSize={11.5}
            fontWeight={700}
            fill="var(--diagram-line)"
          >
            {label.label}
          </text>
        </g>
      ))}
    </svg>
  );
}