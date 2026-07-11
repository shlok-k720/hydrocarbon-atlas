import type {
  BondOrder,
  CarbonNode,
  CarbonStructure,
  MoleculeDefinition,
} from "@/data/hydrocarbon-bank";
import { moleculeBank } from "@/data/hydrocarbon-bank";

export type BuilderAtom = "C" | "H";

export interface BuilderNode {
  id: string;
  element: BuilderAtom;
  x: number;
  y: number;
}

export interface BuilderBond {
  id: string;
  from: string;
  to: string;
  order: BondOrder;
}

export interface BuilderState {
  nodes: BuilderNode[];
  bonds: BuilderBond[];
}

export interface DrawingEvaluation {
  correct: boolean;
  message: string;
  detail: string;
}

export interface DrawingIdentification {
  valid: boolean;
  exactMatch: boolean;
  matchedMolecule: MoleculeDefinition | null;
  formula: string | null;
  familyGuess: string | null;
  message: string;
  detail: string;
}

export interface DiagramAtom {
  id: string;
  element: BuilderAtom;
  x: number;
  y: number;
}

export interface ExpandedStructure {
  nodes: DiagramAtom[];
  bonds: Array<{
    id: string;
    from: string;
    to: string;
    order: BondOrder;
  }>;
}

const HYDROGEN_DISTANCE = 46;
const HYDROGEN_ANGLES = [-90, -35, 35, 90, 145, -145];

export function createEmptyBuilderState(): BuilderState {
  return {
    nodes: [],
    bonds: [],
  };
}

function clampValence(value: number) {
  return Math.max(0, Math.min(4, value));
}

function getNodeMap(nodes: BuilderNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function getIncidentBonds<T extends { from: string; to: string; order: BondOrder }>(
  bonds: T[],
  nodeId: string,
) {
  return bonds.filter((bond) => bond.from === nodeId || bond.to === nodeId);
}

function getValence<T extends { from: string; to: string; order: BondOrder }>(
  bonds: T[],
  nodeId: string,
) {
  return getIncidentBonds(bonds, nodeId).reduce((sum, bond) => sum + bond.order, 0);
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radian: number) {
  return (radian * 180) / Math.PI;
}

function angularDistance(first: number, second: number) {
  const rawDistance = Math.abs(first - second) % 360;

  return Math.min(rawDistance, 360 - rawDistance);
}

export function planHydrogenPlacements(
  anchor: Pick<BuilderNode, "x" | "y">,
  neighbors: Array<Pick<BuilderNode, "x" | "y">>,
  count: number,
) {
  const usedAngles = neighbors.map((neighbor) =>
    toDegrees(Math.atan2(neighbor.y - anchor.y, neighbor.x - anchor.x)),
  );
  const chosenAngles: number[] = [];

  while (chosenAngles.length < count) {
    const nextAngle = HYDROGEN_ANGLES.slice().sort((left, right) => {
      const leftScore = Math.min(
        ...[...usedAngles, ...chosenAngles].map((usedAngle) => angularDistance(left, usedAngle)),
      );
      const rightScore = Math.min(
        ...[...usedAngles, ...chosenAngles].map((usedAngle) => angularDistance(right, usedAngle)),
      );

      return rightScore - leftScore;
    })[0];

    chosenAngles.push(nextAngle);
  }

  return chosenAngles.map((angle, index) => ({
    id: `h-placement-${index}`,
    x: anchor.x + Math.cos(radians(angle)) * HYDROGEN_DISTANCE,
    y: anchor.y + Math.sin(radians(angle)) * HYDROGEN_DISTANCE,
  }));
}

export function getHydrogenCountMap(structure: CarbonStructure) {
  return Object.fromEntries(
    structure.carbons.map((carbon) => [
      carbon.id,
      clampValence(4 - getValence(structure.bonds, carbon.id)),
    ]),
  ) as Record<string, number>;
}

export function expandStructureWithHydrogens(structure: CarbonStructure): ExpandedStructure {
  const hydrogenCounts = getHydrogenCountMap(structure);
  const nodes: DiagramAtom[] = structure.carbons.map((carbon) => ({
    ...carbon,
    element: "C",
  }));
  const bonds = structure.bonds.map((bond) => ({ ...bond }));
  const carbonMap = new Map(structure.carbons.map((carbon) => [carbon.id, carbon]));
  let hydrogenIndex = 1;

  structure.carbons.forEach((carbon) => {
    const neighborIds = getIncidentBonds(structure.bonds, carbon.id).map((bond) =>
      bond.from === carbon.id ? bond.to : bond.from,
    );
    const neighbors = neighborIds
      .map((neighborId) => carbonMap.get(neighborId))
      .filter((neighbor): neighbor is CarbonNode => Boolean(neighbor));
    const placements = planHydrogenPlacements(
      carbon,
      neighbors,
      hydrogenCounts[carbon.id] ?? 0,
    );

    placements.forEach((placement) => {
      const id = `h${hydrogenIndex}`;

      nodes.push({
        id,
        element: "H",
        x: placement.x,
        y: placement.y,
      });
      bonds.push({
        id: `${carbon.id}-${id}`,
        from: carbon.id,
        to: id,
        order: 1,
      });
      hydrogenIndex += 1;
    });
  });

  return { nodes, bonds };
}

export function clearHydrogens(state: BuilderState): BuilderState {
  const hydrogenIds = new Set(
    state.nodes.filter((node) => node.element === "H").map((node) => node.id),
  );

  return {
    nodes: state.nodes.filter((node) => node.element !== "H"),
    bonds: state.bonds.filter(
      (bond) => !hydrogenIds.has(bond.from) && !hydrogenIds.has(bond.to),
    ),
  };
}

export function autoFillHydrogens(state: BuilderState): BuilderState {
  const carbonOnly = clearHydrogens(state);
  const nodeMap = getNodeMap(carbonOnly.nodes);
  const nextState: BuilderState = {
    nodes: [...carbonOnly.nodes],
    bonds: [...carbonOnly.bonds],
  };
  let hydrogenIndex = 1;

  carbonOnly.nodes
    .filter((node) => node.element === "C")
    .forEach((carbon) => {
      const carbonBonds = getIncidentBonds(carbonOnly.bonds, carbon.id);
      const missingHydrogens = clampValence(4 - getValence(carbonOnly.bonds, carbon.id));
      const neighbors = carbonBonds
        .map((bond) => nodeMap.get(bond.from === carbon.id ? bond.to : bond.from))
        .filter((node): node is BuilderNode => Boolean(node));
      const placements = planHydrogenPlacements(carbon, neighbors, missingHydrogens);

      placements.forEach((placement) => {
        const hydrogenId = `builder-h${hydrogenIndex}`;

        nextState.nodes.push({
          id: hydrogenId,
          element: "H",
          x: placement.x,
          y: placement.y,
        });
        nextState.bonds.push({
          id: `${carbon.id}-${hydrogenId}`,
          from: carbon.id,
          to: hydrogenId,
          order: 1,
        });
        hydrogenIndex += 1;
      });
    });

  return nextState;
}

export function validateBuilderState(state: BuilderState) {
  if (state.nodes.length === 0) {
    return {
      valid: false,
      message: "Add at least one atom before you submit the drawing.",
    };
  }

  const nodeMap = getNodeMap(state.nodes);

  for (const bond of state.bonds) {
    const from = nodeMap.get(bond.from);
    const to = nodeMap.get(bond.to);

    if (!from || !to) {
      return {
        valid: false,
        message: "One or more bonds point to atoms that no longer exist.",
      };
    }

    if (from.element === "H" || to.element === "H") {
      if (bond.order !== 1) {
        return {
          valid: false,
          message: "Hydrogen can only make a single bond.",
        };
      }
    }
  }

  for (const node of state.nodes) {
    const valence = getValence(state.bonds, node.id);

    if (node.element === "H" && valence !== 1) {
      return {
        valid: false,
        message: "Every hydrogen should have exactly one bond.",
      };
    }

    if (node.element === "C" && valence > 4) {
      return {
        valid: false,
        message: "A carbon atom cannot exceed four total bonds.",
      };
    }
  }

  const carbonNodes = state.nodes.filter((node) => node.element === "C");

  if (carbonNodes.length === 0) {
    return {
      valid: false,
      message: "Your drawing needs at least one carbon atom.",
    };
  }

  return {
    valid: true,
    message: "Valid",
  };
}

export function extractCarbonStructure(state: BuilderState): CarbonStructure {
  const nodeMap = getNodeMap(state.nodes);

  return {
    carbons: state.nodes
      .filter((node) => node.element === "C")
      .map((node) => ({ id: node.id, x: node.x, y: node.y })),
    bonds: state.bonds
      .filter((bond) => {
        const from = nodeMap.get(bond.from);
        const to = nodeMap.get(bond.to);

        return from?.element === "C" && to?.element === "C";
      })
      .map((bond) => ({ ...bond })),
  };
}

export function isConnected(structure: CarbonStructure) {
  if (structure.carbons.length <= 1) {
    return true;
  }

  const neighbors = new Map<string, string[]>();

  structure.carbons.forEach((carbon) => {
    neighbors.set(carbon.id, []);
  });

  structure.bonds.forEach((bond) => {
    neighbors.get(bond.from)?.push(bond.to);
    neighbors.get(bond.to)?.push(bond.from);
  });

  const queue = [structure.carbons[0].id];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const nextId = queue.shift();

    if (!nextId) {
      break;
    }

    neighbors.get(nextId)?.forEach((neighborId) => {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    });
  }

  return visited.size === structure.carbons.length;
}

function adjacencyMatrix(structure: CarbonStructure, ignoreOrder: boolean) {
  const indexMap = new Map(structure.carbons.map((carbon, index) => [carbon.id, index]));
  const matrix = Array.from({ length: structure.carbons.length }, () =>
    Array.from({ length: structure.carbons.length }, () => 0),
  );

  structure.bonds.forEach((bond) => {
    const from = indexMap.get(bond.from);
    const to = indexMap.get(bond.to);

    if (from === undefined || to === undefined) {
      return;
    }

    const value = ignoreOrder ? 1 : bond.order;
    matrix[from][to] = value;
    matrix[to][from] = value;
  });

  return matrix;
}

function buildVertexSignature(matrix: number[][], index: number) {
  const row = matrix[index];
  const bonds = row.filter((value) => value > 0).sort((left, right) => left - right);
  const totalBondOrder = row.reduce((sum, value) => sum + value, 0);

  return `${bonds.join("")}|${totalBondOrder}`;
}

export function areIsomorphic(
  left: CarbonStructure,
  right: CarbonStructure,
  ignoreOrder: boolean,
) {
  if (left.carbons.length !== right.carbons.length) {
    return false;
  }

  if (left.bonds.length !== right.bonds.length) {
    return false;
  }

  const leftMatrix = adjacencyMatrix(left, ignoreOrder);
  const rightMatrix = adjacencyMatrix(right, ignoreOrder);
  const leftSignatures = leftMatrix.map((_, index) => buildVertexSignature(leftMatrix, index));
  const rightSignatures = rightMatrix.map((_, index) => buildVertexSignature(rightMatrix, index));
  const order = leftSignatures
    .map((signature, index) => ({ signature, index }))
    .sort((leftEntry, rightEntry) => leftEntry.signature.localeCompare(rightEntry.signature))
    .map((entry) => entry.index);
  const used = new Set<number>();
  const mapping = new Map<number, number>();

  function isConsistent(leftIndex: number, rightIndex: number) {
    for (const [mappedLeftIndex, mappedRightIndex] of mapping.entries()) {
      if (leftMatrix[leftIndex][mappedLeftIndex] !== rightMatrix[rightIndex][mappedRightIndex]) {
        return false;
      }
    }

    return true;
  }

  function backtrack(position: number): boolean {
    if (position === order.length) {
      return true;
    }

    const leftIndex = order[position];
    const candidates = rightSignatures
      .map((signature, index) => ({ signature, index }))
      .filter(
        (candidate) =>
          !used.has(candidate.index) && candidate.signature === leftSignatures[leftIndex],
      )
      .map((candidate) => candidate.index);

    for (const rightIndex of candidates) {
      if (!isConsistent(leftIndex, rightIndex)) {
        continue;
      }

      mapping.set(leftIndex, rightIndex);
      used.add(rightIndex);

      if (backtrack(position + 1)) {
        return true;
      }

      mapping.delete(leftIndex);
      used.delete(rightIndex);
    }

    return false;
  }

  return backtrack(0);
}

export function countBuilderAtoms(state: BuilderState) {
  const carbonCount = state.nodes.filter((node) => node.element === "C").length;
  const hydrogenCount = state.nodes.filter((node) => node.element === "H").length;

  return {
    carbonCount,
    hydrogenCount,
    bondCount: state.bonds.length,
  };
}

export function calculateCarbonStructureFormula(structure: CarbonStructure) {
  const carbonCount = structure.carbons.length;
  const hydrogenCount = structure.carbons.reduce((sum, carbon) => {
    return sum + clampValence(4 - getValence(structure.bonds, carbon.id));
  }, 0);

  return `C${carbonCount}H${hydrogenCount}`;
}

function guessFamilyLabel(structure: CarbonStructure) {
  if (structure.bonds.some((bond) => bond.order === 3)) {
    return "alkyne-like hydrocarbon";
  }

  if (structure.bonds.some((bond) => bond.order === 2)) {
    return "alkene-like hydrocarbon";
  }

  const carbonNeighborCounts = structure.carbons.map((carbon) => {
    return getIncidentBonds(structure.bonds, carbon.id).length;
  });

  if (carbonNeighborCounts.some((count) => count >= 3)) {
    return "branched alkane-like hydrocarbon";
  }

  return "alkane-like hydrocarbon";
}

export function identifyDrawnHydrocarbon(state: BuilderState): DrawingIdentification {
  const validation = validateBuilderState(state);

  if (!validation.valid) {
    return {
      valid: false,
      exactMatch: false,
      matchedMolecule: null,
      formula: null,
      familyGuess: null,
      message: validation.message,
      detail: "Add a connected hydrocarbon framework before identifying the drawing.",
    };
  }

  const carbonStructure = extractCarbonStructure(state);

  if (!isConnected(carbonStructure)) {
    return {
      valid: false,
      exactMatch: false,
      matchedMolecule: null,
      formula: null,
      familyGuess: null,
      message: "The carbon framework must be one connected molecule.",
      detail: "Reconnect any isolated fragment before asking the site to identify it.",
    };
  }

  const exactMatch =
    moleculeBank.find((molecule) => areIsomorphic(molecule.structure, carbonStructure, false)) ??
    null;

  if (exactMatch) {
    return {
      valid: true,
      exactMatch: true,
      matchedMolecule: exactMatch,
      formula: exactMatch.formula,
      familyGuess: exactMatch.familyLabel,
      message: `You have drawn ${exactMatch.name}.`,
      detail: `${exactMatch.studyNote} This matches a named structure from the study bank exactly.`,
    };
  }

  const frameworkMatch =
    moleculeBank.find((molecule) => areIsomorphic(molecule.structure, carbonStructure, true)) ??
    null;

  if (frameworkMatch) {
    return {
      valid: true,
      exactMatch: false,
      matchedMolecule: frameworkMatch,
      formula: calculateCarbonStructureFormula(carbonStructure),
      familyGuess: frameworkMatch.familyLabel,
      message: `This looks like ${frameworkMatch.name}, but the bond order is off.`,
      detail: `The carbon framework matches ${frameworkMatch.name}. Recheck whether the structure should use single, double, or triple bonds.`,
    };
  }

  return {
    valid: true,
    exactMatch: false,
    matchedMolecule: null,
    formula: calculateCarbonStructureFormula(carbonStructure),
    familyGuess: guessFamilyLabel(carbonStructure),
    message: "This structure is not in the current named study bank.",
    detail: `The drawing is still a valid ${guessFamilyLabel(carbonStructure)} with formula ${calculateCarbonStructureFormula(carbonStructure)}.`,
  };
}

export function evaluateDrawingAnswer(
  reference: CarbonStructure,
  state: BuilderState,
): DrawingEvaluation {
  const validation = validateBuilderState(state);

  if (!validation.valid) {
    return {
      correct: false,
      message: validation.message,
      detail: "Clean up the drawing and submit again.",
    };
  }

  const carbonStructure = extractCarbonStructure(state);

  if (!isConnected(carbonStructure)) {
    return {
      correct: false,
      message: "The carbon framework must be one connected molecule.",
      detail: "Reconnect any isolated carbon fragment or branch.",
    };
  }

  if (carbonStructure.carbons.length !== reference.carbons.length) {
    return {
      correct: false,
      message: `This target needs ${reference.carbons.length} carbon atoms, but your drawing has ${carbonStructure.carbons.length}.`,
      detail: "Check the parent chain length and every branch carbon.",
    };
  }

  if (areIsomorphic(reference, carbonStructure, false)) {
    return {
      correct: true,
      message: "Correct structure.",
      detail:
        "The carbon skeleton and bond orders match the target. Hydrogen placement is available in the modal, but the framework is what matters most for grading.",
    };
  }

  if (areIsomorphic(reference, carbonStructure, true)) {
    return {
      correct: false,
      message: "The carbon framework matches, but one or more bond orders are wrong.",
      detail: "Recheck whether the molecule needs a single, double, or triple bond.",
    };
  }

  return {
    correct: false,
    message: "The drawing does not match the target structure yet.",
    detail:
      "Check the longest chain, the location of each branch, and whether the unsaturation is in the right place.",
  };
}