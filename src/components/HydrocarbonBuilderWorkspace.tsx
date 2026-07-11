"use client";

import { useId, useRef, useState } from "react";

import type { BondOrder } from "@/data/hydrocarbon-bank";
import {
  autoFillHydrogens,
  clearHydrogens,
  countBuilderAtoms,
  type BuilderState,
  type BuilderNode,
} from "@/lib/molecule";

const CANVAS_WIDTH = 780;
const CANVAS_HEIGHT = 520;

type Tool = "move" | "carbon" | "hydrogen" | "single" | "double" | "triple" | "erase";

interface WorkspaceAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "solid" | "outline";
  disabled?: boolean;
}

interface HydrocarbonBuilderWorkspaceProps {
  kicker?: string;
  title: string;
  description: string;
  state: BuilderState;
  onChange: (nextState: BuilderState) => void;
  primaryAction?: WorkspaceAction;
  secondaryActions?: WorkspaceAction[];
  canvasHeightClassName?: string;
  footerNote?: string;
}

function toolToBondOrder(tool: Tool): BondOrder | null {
  if (tool === "single") {
    return 1;
  }

  if (tool === "double") {
    return 2;
  }

  if (tool === "triple") {
    return 3;
  }

  return null;
}

function upsertBond(state: BuilderState, from: string, to: string, order: BondOrder): BuilderState {
  const existingBond = state.bonds.find(
    (bond) =>
      (bond.from === from && bond.to === to) || (bond.from === to && bond.to === from),
  );

  if (existingBond) {
    return {
      ...state,
      bonds: state.bonds.map((bond) =>
        bond.id === existingBond.id ? { ...bond, order } : bond,
      ),
    };
  }

  return {
    ...state,
    bonds: [
      ...state.bonds,
      {
        id: `${from}-${to}`,
        from,
        to,
        order,
      },
    ],
  };
}

function removeNode(state: BuilderState, nodeId: string): BuilderState {
  return {
    nodes: state.nodes.filter((node) => node.id !== nodeId),
    bonds: state.bonds.filter((bond) => bond.from !== nodeId && bond.to !== nodeId),
  };
}

function removeBond(state: BuilderState, bondId: string): BuilderState {
  return {
    ...state,
    bonds: state.bonds.filter((bond) => bond.id !== bondId),
  };
}

function getActionClassName(variant: WorkspaceAction["variant"]) {
  const baseClassName =
    "rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

  if (variant === "solid") {
    return `${baseClassName} bg-[color:var(--accent)] text-white shadow-[0_16px_40px_rgba(15,118,110,0.28)]`;
  }

  return `${baseClassName} border border-[color:var(--line)] bg-white text-[color:var(--foreground)]`;
}

export default function HydrocarbonBuilderWorkspace({
  kicker = "Drawing board",
  title,
  description,
  state,
  onChange,
  primaryAction,
  secondaryActions = [],
  canvasHeightClassName = "h-[52vh] min-h-[380px]",
  footerNote,
}: HydrocarbonBuilderWorkspaceProps) {
  const titleId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const summary = countBuilderAtoms(state);

  function getCanvasPoint(event: React.PointerEvent<SVGElement>) {
    const svg = svgRef.current;

    if (!svg) {
      return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    }

    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformedPoint = point.matrixTransform(matrix.inverse());

    return {
      x: transformedPoint.x,
      y: transformedPoint.y,
    };
  }

  function addNode(element: BuilderNode["element"], event: React.PointerEvent<SVGSVGElement>) {
    const point = getCanvasPoint(event);
    const nextId = `${element.toLowerCase()}-${state.nodes.length + 1}`;

    onChange({
      ...state,
      nodes: [
        ...state.nodes,
        {
          id: nextId,
          element,
          x: point.x,
          y: point.y,
        },
      ],
    });
  }

  function handleCanvasPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (tool === "carbon") {
      addNode("C", event);
      return;
    }

    if (tool === "hydrogen") {
      addNode("H", event);
      return;
    }

    setSelectedNodeId(null);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!draggingNodeId) {
      return;
    }

    const point = getCanvasPoint(event);

    onChange({
      ...state,
      nodes: state.nodes.map((node) =>
        node.id === draggingNodeId ? { ...node, x: point.x, y: point.y } : node,
      ),
    });
  }

  function handleCanvasPointerUp(pointerId?: number) {
    if (pointerId !== undefined && svgRef.current?.hasPointerCapture(pointerId)) {
      svgRef.current.releasePointerCapture(pointerId);
    }

    setDraggingNodeId(null);
  }

  function handleNodePointerDown(nodeId: string, event: React.PointerEvent<SVGGElement>) {
    event.stopPropagation();

    if (tool === "move") {
      svgRef.current?.setPointerCapture(event.pointerId);
      setDraggingNodeId(nodeId);
      return;
    }

    if (tool === "erase") {
      onChange(removeNode(state, nodeId));
      setSelectedNodeId(null);
      return;
    }

    const bondOrder = toolToBondOrder(tool);

    if (!bondOrder) {
      return;
    }

    if (!selectedNodeId) {
      setSelectedNodeId(nodeId);
      return;
    }

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      return;
    }

    onChange(upsertBond(state, selectedNodeId, nodeId, bondOrder));
    setSelectedNodeId(null);
  }

  const tools: Array<{ key: Tool; label: string }> = [
    { key: "move", label: "Move" },
    { key: "carbon", label: "Add C" },
    { key: "hydrogen", label: "Add H" },
    { key: "single", label: "Single bond" },
    { key: "double", label: "Double bond" },
    { key: "triple", label: "Triple bond" },
    { key: "erase", label: "Erase" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="section-kicker">{kicker}</p>
          <h3 id={titleId} className="text-2xl font-semibold text-[color:var(--foreground)]">
            {title}
          </h3>
          <p className="max-w-3xl text-sm text-[color:var(--muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--foreground)]">
          <span className="metric-chip">C: {summary.carbonCount}</span>
          <span className="metric-chip">H: {summary.hydrogenCount}</span>
          <span className="metric-chip">Bonds: {summary.bondCount}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tools.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => {
              setTool(entry.key);
              setSelectedNodeId(null);
            }}
            className={
              tool === entry.key
                ? "rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)]"
            }
          >
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(autoFillHydrogens(state))}
          className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)]"
        >
          Auto-fill H
        </button>
        <button
          type="button"
          onClick={() => onChange(clearHydrogens(state))}
          className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)]"
        >
          Clear H
        </button>
        <button
          type="button"
          onClick={() => onChange({ nodes: [], bonds: [] })}
          className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)]"
        >
          Reset canvas
        </button>
      </div>

      <div className="overflow-hidden rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <svg
          ref={svgRef}
          aria-labelledby={titleId}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className={`canvas-grid ${canvasHeightClassName} w-full touch-none`}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={(event) => handleCanvasPointerUp(event.pointerId)}
          onPointerCancel={(event) => handleCanvasPointerUp(event.pointerId)}
          onPointerLeave={(event) => {
            if (!svgRef.current?.hasPointerCapture(event.pointerId)) {
              handleCanvasPointerUp();
            }
          }}
        >
          {state.bonds.map((bond) => {
            const from = state.nodes.find((node) => node.id === bond.from);
            const to = state.nodes.find((node) => node.id === bond.to);

            if (!from || !to) {
              return null;
            }

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.hypot(dx, dy) || 1;
            const offsetX = (-dy / distance) * 5;
            const offsetY = (dx / distance) * 5;
            const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-1, 1] : [-1.6, 0, 1.6];

            return (
              <g
                key={bond.id}
                onPointerDown={(event) => {
                  if (tool !== "erase") {
                    return;
                  }

                  event.stopPropagation();
                  onChange(removeBond(state, bond.id));
                }}
              >
                {offsets.map((multiplier) => (
                  <line
                    key={`${bond.id}-${multiplier}`}
                    x1={from.x + offsetX * multiplier}
                    y1={from.y + offsetY * multiplier}
                    x2={to.x + offsetX * multiplier}
                    y2={to.y + offsetY * multiplier}
                    stroke={tool === "erase" ? "var(--danger)" : "var(--diagram-line)"}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            );
          })}

          {state.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                onPointerDown={(event) => handleNodePointerDown(node.id, event)}
                className="cursor-pointer"
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.element === "C" ? 23 : 17}
                  fill={
                    node.element === "C"
                      ? "var(--diagram-carbon)"
                      : "var(--diagram-hydrogen)"
                  }
                  stroke={isSelected ? "var(--accent-2)" : "var(--diagram-line)"}
                  strokeWidth={isSelected ? 3.2 : 2}
                />
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="var(--font-display)"
                  fontSize={node.element === "C" ? 14 : 12}
                  fontWeight={700}
                  fill={
                    node.element === "C"
                      ? "var(--diagram-carbon-text)"
                      : "var(--diagram-line)"
                  }
                >
                  {node.element}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-[color:var(--muted)]">
          Current tool: <span className="font-semibold text-[color:var(--foreground)]">{tools.find((entry) => entry.key === tool)?.label}</span>
          {footerNote ? <span>{` • ${footerNote}`}</span> : null}
        </p>
        <div className="flex flex-wrap gap-3">
          {secondaryActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                void action.onClick();
              }}
              disabled={action.disabled}
              className={getActionClassName(action.variant ?? "outline")}
            >
              {action.label}
            </button>
          ))}
          {primaryAction ? (
            <button
              type="button"
              onClick={() => {
                void primaryAction.onClick();
              }}
              disabled={primaryAction.disabled}
              className={getActionClassName(primaryAction.variant ?? "solid")}
            >
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}