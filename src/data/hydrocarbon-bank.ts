export type HydrocarbonTopic =
  | "alkanes"
  | "alkenes"
  | "alkynes"
  | "branched_isomers";

export type QuestionType = "naming" | "drawing" | "misc";

export type MiscQuestionKind =
  | "hydrogen-count"
  | "carbon-count"
  | "formula"
  | "family";

export type BondOrder = 1 | 2 | 3;

export interface CarbonNode {
  id: string;
  x: number;
  y: number;
}

export interface CarbonBond {
  id: string;
  from: string;
  to: string;
  order: BondOrder;
}

export interface CarbonStructure {
  carbons: CarbonNode[];
  bonds: CarbonBond[];
}

interface BranchSpec {
  parent: number;
  length: number;
  direction: "up" | "down";
}

interface MoleculeSpec {
  id: string;
  topic: HydrocarbonTopic;
  name: string;
  chainLength: number;
  familyLabel: string;
  unsaturations?: Array<{
    position: number;
    order: 2 | 3;
  }>;
  branches?: BranchSpec[];
  aliases?: string[];
  studyNote?: string;
}

export interface MoleculeDefinition {
  id: string;
  topic: HydrocarbonTopic;
  name: string;
  aliases: string[];
  formula: string;
  familyLabel: string;
  studyNote: string;
  structure: CarbonStructure;
}

export interface HydrocarbonQuestion {
  id: string;
  type: QuestionType;
  topic: HydrocarbonTopic;
  prompt: string;
  answerLabel: string;
  acceptedAnswers: string[];
  formula: string;
  familyLabel: string;
  studyNote: string;
  structure: CarbonStructure;
  answerPlaceholder?: string;
  miscKind?: MiscQuestionKind;
}

const CHAIN_PREFIXES: Record<number, string> = {
  1: "meth",
  2: "eth",
  3: "prop",
  4: "but",
  5: "pent",
  6: "hex",
  7: "hept",
  8: "oct",
  9: "non",
  10: "dec",
};

const ALKYL_NAMES: Record<number, string> = {
  1: "methyl",
  2: "ethyl",
  3: "propyl",
};

export const TOPIC_LABELS: Record<HydrocarbonTopic, string> = {
  alkanes: "Alkanes",
  alkenes: "Alkenes",
  alkynes: "Alkynes",
  branched_isomers: "Branched isomers",
};

export const HYDROCARBON_TOPICS = Object.keys(TOPIC_LABELS) as HydrocarbonTopic[];

export const QUESTION_TYPES: QuestionType[] = ["naming", "drawing", "misc"];

const FAMILY_ANSWERS: Record<
  HydrocarbonTopic,
  { label: string; acceptedAnswers: string[] }
> = {
  alkanes: {
    label: "alkane",
    acceptedAnswers: ["alkane", "alkanes"],
  },
  alkenes: {
    label: "alkene",
    acceptedAnswers: ["alkene", "alkenes"],
  },
  alkynes: {
    label: "alkyne",
    acceptedAnswers: ["alkyne", "alkynes"],
  },
  branched_isomers: {
    label: "branched isomer",
    acceptedAnswers: [
      "branched isomer",
      "branched isomers",
      "branched alkane",
      "branched alkanes",
    ],
  },
};

const MAIN_CHAIN_X_STEP = 96;
const MAIN_CHAIN_Y_SWING = 34;
const BRANCH_X_STEP = 54;
const BRANCH_Y_STEP = 76;

function slugifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createUnsaturatedCanonicalName(
  chainLength: number,
  position: number,
  order: 2 | 3,
) {
  const prefix = CHAIN_PREFIXES[chainLength];
  const suffix = order === 2 ? "ene" : "yne";

  if (position === 1 && chainLength <= 3) {
    return `${prefix}${suffix}`;
  }

  return `${prefix}-${position}-${suffix}`;
}

function createUnsaturatedAliases(
  chainLength: number,
  position: number,
  order: 2 | 3,
  canonicalName: string,
) {
  const prefix = CHAIN_PREFIXES[chainLength];
  const suffix = order === 2 ? "ene" : "yne";
  const aliases = [canonicalName, `${position}-${prefix}${suffix}`];

  if (position === 1 && chainLength <= 3) {
    aliases.push(`${prefix}-1-${suffix}`);
  }

  return Array.from(new Set(aliases));
}

function normalizeCoordinates(structure: CarbonStructure): CarbonStructure {
  const minX = Math.min(...structure.carbons.map((carbon) => carbon.x));
  const minY = Math.min(...structure.carbons.map((carbon) => carbon.y));

  return {
    carbons: structure.carbons.map((carbon) => ({
      ...carbon,
      x: carbon.x - minX + 72,
      y: carbon.y - minY + 96,
    })),
    bonds: structure.bonds,
  };
}

function buildStructure(spec: MoleculeSpec): CarbonStructure {
  const carbons: CarbonNode[] = [];
  const bonds: CarbonBond[] = [];

  for (let index = 0; index < spec.chainLength; index += 1) {
    carbons.push({
      id: `c${index + 1}`,
      x: index * MAIN_CHAIN_X_STEP,
      y: index % 2 === 0 ? 0 : MAIN_CHAIN_Y_SWING,
    });
  }

  for (let index = 0; index < spec.chainLength - 1; index += 1) {
    const order =
      spec.unsaturations?.find((unsaturation) => unsaturation.position === index + 1)
        ?.order ?? 1;

    bonds.push({
      id: `c${index + 1}-c${index + 2}`,
      from: `c${index + 1}`,
      to: `c${index + 2}`,
      order,
    });
  }

  spec.branches?.forEach((branch, branchIndex) => {
    let previousId = `c${branch.parent}`;
    let previousPosition = carbons.find((carbon) => carbon.id === previousId);

    if (!previousPosition) {
      return;
    }

    for (let segment = 1; segment <= branch.length; segment += 1) {
      const id = `b${branchIndex + 1}_${segment}`;
      const directionMultiplier = branch.direction === "up" ? -1 : 1;
      const node: CarbonNode = {
        id,
        x: previousPosition.x + BRANCH_X_STEP,
        y: previousPosition.y + BRANCH_Y_STEP * directionMultiplier,
      };

      carbons.push(node);
      bonds.push({
        id: `${previousId}-${id}`,
        from: previousId,
        to: id,
        order: 1,
      });

      previousId = id;
      previousPosition = node;
    }
  });

  return normalizeCoordinates({ carbons, bonds });
}

function getCarbonValence(structure: CarbonStructure, carbonId: string) {
  return structure.bonds.reduce((sum, bond) => {
    if (bond.from === carbonId || bond.to === carbonId) {
      return sum + bond.order;
    }

    return sum;
  }, 0);
}

function calculateFormula(structure: CarbonStructure) {
  const carbonCount = structure.carbons.length;
  const hydrogenCount = structure.carbons.reduce((sum, carbon) => {
    return sum + (4 - getCarbonValence(structure, carbon.id));
  }, 0);

  return `C${carbonCount}H${hydrogenCount}`;
}

function describeBranches(branches: BranchSpec[]) {
  const grouped = new Map<string, number[]>();

  branches.forEach((branch) => {
    const label = ALKYL_NAMES[branch.length] ?? `${CHAIN_PREFIXES[branch.length]}yl`;
    const positions = grouped.get(label) ?? [];

    positions.push(branch.parent);
    grouped.set(label, positions);
  });

  return Array.from(grouped.entries())
    .map(([label, positions]) => {
      const orderedPositions = [...positions].sort((left, right) => left - right);
      const suffix = orderedPositions.length > 1 ? "s" : "";

      return `${label} branch${suffix} at carbon ${orderedPositions.join(" and ")}`;
    })
    .join("; ");
}

function buildStudyNote(spec: MoleculeSpec, formula: string) {
  if (spec.unsaturations?.length) {
    const unsaturation = spec.unsaturations[0];
    const bondWord = unsaturation.order === 2 ? "double" : "triple";

    return `Use the ${spec.chainLength}-carbon parent chain, then number from the nearest end so the ${bondWord} bond starts at carbon ${unsaturation.position}. The molecular formula is ${formula}.`;
  }

  if (spec.branches?.length) {
    return `Find the ${spec.chainLength}-carbon parent chain first, then assign the lowest possible locants to the substituents. Here the structure has ${describeBranches(spec.branches)}. The molecular formula is ${formula}.`;
  }

  return `Count the longest unbroken chain: ${spec.chainLength} carbon${spec.chainLength === 1 ? "" : "s"}. Every carbon-carbon bond is single, so the suffix is -ane. The molecular formula is ${formula}.`;
}

function createMolecule(spec: MoleculeSpec): MoleculeDefinition {
  const structure = buildStructure(spec);
  const formula = calculateFormula(structure);
  const aliases = Array.from(new Set([spec.name, ...(spec.aliases ?? [])]));

  return {
    id: spec.id,
    topic: spec.topic,
    name: spec.name,
    aliases,
    formula,
    familyLabel: spec.familyLabel,
    studyNote: spec.studyNote ?? buildStudyNote(spec, formula),
    structure,
  };
}

const alkaneSpecs: MoleculeSpec[] = [
  { id: slugifyName("methane"), topic: "alkanes", name: "methane", chainLength: 1, familyLabel: "alkane" },
  { id: slugifyName("ethane"), topic: "alkanes", name: "ethane", chainLength: 2, familyLabel: "alkane" },
  { id: slugifyName("propane"), topic: "alkanes", name: "propane", chainLength: 3, familyLabel: "alkane" },
  { id: slugifyName("butane"), topic: "alkanes", name: "butane", chainLength: 4, familyLabel: "alkane" },
  { id: slugifyName("pentane"), topic: "alkanes", name: "pentane", chainLength: 5, familyLabel: "alkane" },
  { id: slugifyName("hexane"), topic: "alkanes", name: "hexane", chainLength: 6, familyLabel: "alkane" },
  { id: slugifyName("heptane"), topic: "alkanes", name: "heptane", chainLength: 7, familyLabel: "alkane" },
  { id: slugifyName("octane"), topic: "alkanes", name: "octane", chainLength: 8, familyLabel: "alkane" },
  { id: slugifyName("nonane"), topic: "alkanes", name: "nonane", chainLength: 9, familyLabel: "alkane" },
  { id: slugifyName("decane"), topic: "alkanes", name: "decane", chainLength: 10, familyLabel: "alkane" },
  {
    id: slugifyName("2-methylpropane"),
    topic: "alkanes",
    name: "2-methylpropane",
    chainLength: 3,
    familyLabel: "alkane",
    branches: [{ parent: 2, length: 1, direction: "up" }],
    aliases: ["isobutane"],
  },
  {
    id: slugifyName("2-methylbutane"),
    topic: "alkanes",
    name: "2-methylbutane",
    chainLength: 4,
    familyLabel: "alkane",
    branches: [{ parent: 2, length: 1, direction: "up" }],
    aliases: ["isopentane"],
  },
  {
    id: slugifyName("2,2-dimethylpropane"),
    topic: "alkanes",
    name: "2,2-dimethylpropane",
    chainLength: 3,
    familyLabel: "alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
    ],
    aliases: ["neopentane"],
  },
  {
    id: slugifyName("2-methylpentane"),
    topic: "alkanes",
    name: "2-methylpentane",
    chainLength: 5,
    familyLabel: "alkane",
    branches: [{ parent: 2, length: 1, direction: "up" }],
  },
  {
    id: slugifyName("3-methylpentane"),
    topic: "alkanes",
    name: "3-methylpentane",
    chainLength: 5,
    familyLabel: "alkane",
    branches: [{ parent: 3, length: 1, direction: "up" }],
  },
  {
    id: slugifyName("2,2-dimethylbutane"),
    topic: "alkanes",
    name: "2,2-dimethylbutane",
    chainLength: 4,
    familyLabel: "alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,3-dimethylbutane"),
    topic: "alkanes",
    name: "2,3-dimethylbutane",
    chainLength: 4,
    familyLabel: "alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2-methylhexane"),
    topic: "alkanes",
    name: "2-methylhexane",
    chainLength: 6,
    familyLabel: "alkane",
    branches: [{ parent: 2, length: 1, direction: "up" }],
  },
  {
    id: slugifyName("3-methylhexane"),
    topic: "alkanes",
    name: "3-methylhexane",
    chainLength: 6,
    familyLabel: "alkane",
    branches: [{ parent: 3, length: 1, direction: "up" }],
  },
  {
    id: slugifyName("2,2-dimethylpentane"),
    topic: "alkanes",
    name: "2,2-dimethylpentane",
    chainLength: 5,
    familyLabel: "alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,3-dimethylpentane"),
    topic: "alkanes",
    name: "2,3-dimethylpentane",
    chainLength: 5,
    familyLabel: "alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,4-dimethylpentane"),
    topic: "alkanes",
    name: "2,4-dimethylpentane",
    chainLength: 5,
    familyLabel: "alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 4, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3,3-dimethylpentane"),
    topic: "alkanes",
    name: "3,3-dimethylpentane",
    chainLength: 5,
    familyLabel: "alkane",
    branches: [
      { parent: 3, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3-ethylpentane"),
    topic: "alkanes",
    name: "3-ethylpentane",
    chainLength: 5,
    familyLabel: "alkane",
    branches: [{ parent: 3, length: 2, direction: "up" }],
  },
  {
    id: slugifyName("2,2,3-trimethylbutane"),
    topic: "alkanes",
    name: "2,2,3-trimethylbutane",
    chainLength: 4,
    familyLabel: "alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
      { parent: 3, length: 1, direction: "up" },
    ],
  },
];

const branchedIsomerSpecs: MoleculeSpec[] = [
  {
    id: slugifyName("2-methylheptane"),
    topic: "branched_isomers",
    name: "2-methylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [{ parent: 2, length: 1, direction: "up" }],
  },
  {
    id: slugifyName("3-methylheptane"),
    topic: "branched_isomers",
    name: "3-methylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [{ parent: 3, length: 1, direction: "up" }],
  },
  {
    id: slugifyName("4-methylheptane"),
    topic: "branched_isomers",
    name: "4-methylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [{ parent: 4, length: 1, direction: "up" }],
  },
  {
    id: slugifyName("2,2-dimethylhexane"),
    topic: "branched_isomers",
    name: "2,2-dimethylhexane",
    chainLength: 6,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,3-dimethylhexane"),
    topic: "branched_isomers",
    name: "2,3-dimethylhexane",
    chainLength: 6,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,4-dimethylhexane"),
    topic: "branched_isomers",
    name: "2,4-dimethylhexane",
    chainLength: 6,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 4, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,5-dimethylhexane"),
    topic: "branched_isomers",
    name: "2,5-dimethylhexane",
    chainLength: 6,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 5, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3,3-dimethylhexane"),
    topic: "branched_isomers",
    name: "3,3-dimethylhexane",
    chainLength: 6,
    familyLabel: "branched alkane",
    branches: [
      { parent: 3, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3,4-dimethylhexane"),
    topic: "branched_isomers",
    name: "3,4-dimethylhexane",
    chainLength: 6,
    familyLabel: "branched alkane",
    branches: [
      { parent: 3, length: 1, direction: "up" },
      { parent: 4, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3-ethylhexane"),
    topic: "branched_isomers",
    name: "3-ethylhexane",
    chainLength: 6,
    familyLabel: "branched alkane",
    branches: [{ parent: 3, length: 2, direction: "up" }],
  },
  {
    id: slugifyName("2,2,3-trimethylpentane"),
    topic: "branched_isomers",
    name: "2,2,3-trimethylpentane",
    chainLength: 5,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
      { parent: 3, length: 1, direction: "up" },
    ],
  },
  {
    id: slugifyName("2,2,4-trimethylpentane"),
    topic: "branched_isomers",
    name: "2,2,4-trimethylpentane",
    chainLength: 5,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
      { parent: 4, length: 1, direction: "up" },
    ],
  },
  {
    id: slugifyName("2,3,3-trimethylpentane"),
    topic: "branched_isomers",
    name: "2,3,3-trimethylpentane",
    chainLength: 5,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,3,4-trimethylpentane"),
    topic: "branched_isomers",
    name: "2,3,4-trimethylpentane",
    chainLength: 5,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
      { parent: 4, length: 1, direction: "up" },
    ],
  },
  {
    id: slugifyName("3-ethyl-2-methylpentane"),
    topic: "branched_isomers",
    name: "3-ethyl-2-methylpentane",
    chainLength: 5,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 3, length: 2, direction: "down" },
    ],
  },
  {
    id: slugifyName("3-ethyl-3-methylpentane"),
    topic: "branched_isomers",
    name: "3-ethyl-3-methylpentane",
    chainLength: 5,
    familyLabel: "branched alkane",
    branches: [
      { parent: 3, length: 2, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,2-dimethylheptane"),
    topic: "branched_isomers",
    name: "2,2-dimethylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,3-dimethylheptane"),
    topic: "branched_isomers",
    name: "2,3-dimethylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,4-dimethylheptane"),
    topic: "branched_isomers",
    name: "2,4-dimethylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 4, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,5-dimethylheptane"),
    topic: "branched_isomers",
    name: "2,5-dimethylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 5, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3,3-dimethylheptane"),
    topic: "branched_isomers",
    name: "3,3-dimethylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [
      { parent: 3, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3,4-dimethylheptane"),
    topic: "branched_isomers",
    name: "3,4-dimethylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [
      { parent: 3, length: 1, direction: "up" },
      { parent: 4, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3,5-dimethylheptane"),
    topic: "branched_isomers",
    name: "3,5-dimethylheptane",
    chainLength: 7,
    familyLabel: "branched alkane",
    branches: [
      { parent: 3, length: 1, direction: "up" },
      { parent: 5, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("2,2,3,3-tetramethylbutane"),
    topic: "branched_isomers",
    name: "2,2,3,3-tetramethylbutane",
    chainLength: 4,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
      { parent: 3, length: 1, direction: "up" },
      { parent: 3, length: 1, direction: "down" },
    ],
  },
  {
    id: slugifyName("3-ethyl-2,2-dimethylpentane"),
    topic: "branched_isomers",
    name: "3-ethyl-2,2-dimethylpentane",
    chainLength: 5,
    familyLabel: "branched alkane",
    branches: [
      { parent: 2, length: 1, direction: "up" },
      { parent: 2, length: 1, direction: "down" },
      { parent: 3, length: 2, direction: "up" },
    ],
  },
];

function buildUnsaturatedSeries(topic: HydrocarbonTopic, order: 2 | 3) {
  const familyLabel = order === 2 ? "alkene" : "alkyne";
  const molecules: MoleculeDefinition[] = [];

  for (let chainLength = 2; chainLength <= 10; chainLength += 1) {
    for (let position = 1; position <= Math.floor(chainLength / 2); position += 1) {
      const name = createUnsaturatedCanonicalName(chainLength, position, order);

      molecules.push(
        createMolecule({
          id: slugifyName(`${topic}-${name}`),
          topic,
          name,
          aliases: createUnsaturatedAliases(chainLength, position, order, name),
          chainLength,
          familyLabel,
          unsaturations: [{ position, order }],
        }),
      );
    }
  }

  return molecules;
}

export const moleculeBank: MoleculeDefinition[] = [
  ...alkaneSpecs.map(createMolecule),
  ...buildUnsaturatedSeries("alkenes", 2),
  ...buildUnsaturatedSeries("alkynes", 3),
  ...branchedIsomerSpecs.map(createMolecule),
];

if (moleculeBank.length !== 100) {
  throw new Error(`Expected 100 molecules in the bank, received ${moleculeBank.length}.`);
}

function parseFormula(formula: string) {
  const match = /^C(\d+)H(\d+)$/i.exec(formula);

  if (!match) {
    throw new Error(`Unexpected molecular formula format: ${formula}`);
  }

  return {
    carbonCount: Number(match[1]),
    hydrogenCount: Number(match[2]),
  };
}

const namingAndDrawingQuestions: HydrocarbonQuestion[] = moleculeBank.flatMap(
  (molecule) => [
    {
      id: `${molecule.id}-naming`,
      type: "naming" as const,
      topic: molecule.topic,
      prompt: "Name the hydrocarbon shown in the structure diagram.",
      answerLabel: molecule.name,
      acceptedAnswers: molecule.aliases,
      formula: molecule.formula,
      familyLabel: molecule.familyLabel,
      studyNote: molecule.studyNote,
      structure: molecule.structure,
      answerPlaceholder: "Type the IUPAC name",
    },
    {
      id: `${molecule.id}-drawing`,
      type: "drawing" as const,
      topic: molecule.topic,
      prompt: `Draw ${molecule.name}.`,
      answerLabel: molecule.name,
      acceptedAnswers: molecule.aliases,
      formula: molecule.formula,
      familyLabel: molecule.familyLabel,
      studyNote: molecule.studyNote,
      structure: molecule.structure,
    },
  ],
);

export const miscQuestions: HydrocarbonQuestion[] = moleculeBank.map((molecule, index) => {
  const formulaParts = parseFormula(molecule.formula);
  const familyAnswer = FAMILY_ANSWERS[molecule.topic];
  const questionIndex = index % 4;

  if (questionIndex === 0) {
    return {
      id: `${molecule.id}-misc-hydrogens`,
      type: "misc",
      topic: molecule.topic,
      prompt: `How many hydrogens are in ${molecule.name}?`,
      answerLabel: String(formulaParts.hydrogenCount),
      acceptedAnswers: [String(formulaParts.hydrogenCount), `H${formulaParts.hydrogenCount}`],
      formula: molecule.formula,
      familyLabel: molecule.familyLabel,
      studyNote: `${molecule.name} has molecular formula ${molecule.formula}, so it contains ${formulaParts.hydrogenCount} hydrogen atoms.`,
      structure: molecule.structure,
      answerPlaceholder: "Enter the hydrogen count",
      miscKind: "hydrogen-count",
    };
  }

  if (questionIndex === 1) {
    return {
      id: `${molecule.id}-misc-carbons`,
      type: "misc",
      topic: molecule.topic,
      prompt: `How many carbon atoms are in ${molecule.name}?`,
      answerLabel: String(formulaParts.carbonCount),
      acceptedAnswers: [String(formulaParts.carbonCount), `C${formulaParts.carbonCount}`],
      formula: molecule.formula,
      familyLabel: molecule.familyLabel,
      studyNote: `${molecule.name} contains ${formulaParts.carbonCount} carbon atoms, which is also visible in the formula ${molecule.formula}.`,
      structure: molecule.structure,
      answerPlaceholder: "Enter the carbon count",
      miscKind: "carbon-count",
    };
  }

  if (questionIndex === 2) {
    return {
      id: `${molecule.id}-misc-formula`,
      type: "misc",
      topic: molecule.topic,
      prompt: `What is the molecular formula of ${molecule.name}?`,
      answerLabel: molecule.formula,
      acceptedAnswers: [molecule.formula],
      formula: molecule.formula,
      familyLabel: molecule.familyLabel,
      studyNote: `${molecule.name} follows the structural pattern summarised by ${molecule.formula}.`,
      structure: molecule.structure,
      answerPlaceholder: "Type the molecular formula",
      miscKind: "formula",
    };
  }

  return {
    id: `${molecule.id}-misc-family`,
    type: "misc",
    topic: molecule.topic,
    prompt: `Which hydrocarbon family does ${molecule.name} belong to?`,
    answerLabel: familyAnswer.label,
    acceptedAnswers: familyAnswer.acceptedAnswers,
    formula: molecule.formula,
    familyLabel: molecule.familyLabel,
    studyNote: `${molecule.name} belongs to the ${familyAnswer.label} family. ${molecule.studyNote}`,
    structure: molecule.structure,
    answerPlaceholder: "Type the hydrocarbon family",
    miscKind: "family",
  };
});

export const hydrocarbonQuestions: HydrocarbonQuestion[] = [
  ...namingAndDrawingQuestions,
  ...miscQuestions,
];

export const namingQuestions = hydrocarbonQuestions.filter(
  (question) => question.type === "naming",
);

export const drawingQuestions = hydrocarbonQuestions.filter(
  (question) => question.type === "drawing",
);

export const miscQuestionSet = hydrocarbonQuestions.filter(
  (question) => question.type === "misc",
);

if (
  namingQuestions.length !== 100 ||
  drawingQuestions.length !== 100 ||
  miscQuestionSet.length !== 100
) {
  throw new Error("Expected exactly 100 naming, 100 drawing, and 100 misc questions.");
}

export const questionById = new Map(
  hydrocarbonQuestions.map((question) => [question.id, question]),
);

function getMoleculeByName(name: string) {
  const molecule = moleculeBank.find((entry) => entry.name === name);

  if (!molecule) {
    throw new Error(`Missing featured molecule: ${name}`);
  }

  return molecule;
}

export const featuredExamples = [
  getMoleculeByName("hexane"),
  getMoleculeByName("hex-2-ene"),
  getMoleculeByName("hex-2-yne"),
  getMoleculeByName("2,4-dimethylpentane"),
];

export const namingQuestionCount = namingQuestions.length;
export const drawingQuestionCount = drawingQuestions.length;
export const miscQuestionCount = miscQuestionSet.length;