import type { HydrocarbonTopic } from "@/data/hydrocarbon-bank";

export const studyPillars = [
  {
    title: "Start with the carbon skeleton",
    description:
      "Every hydrocarbon name starts by finding the longest continuous carbon chain. That parent chain decides the prefix such as meth-, hex-, or dec-.",
  },
  {
    title: "Read the bond pattern next",
    description:
      "Single bonds mean -ane, one double bond means -ene, and one triple bond means -yne. Number the parent chain from the end that gives the multiple bond the lowest number.",
  },
  {
    title: "Branches change the middle of the name",
    description:
      "Extra side chains become substituents such as methyl or ethyl. Their positions are written as locants, and repeated substituents use di-, tri-, or tetra-.",
  },
  {
    title: "Practice needs feedback loops",
    description:
      "The quiz engine tracks accuracy by topic and deliberately returns to weaker areas, so review time shifts toward the family you are missing most often.",
  },
];

export const familyReference: Array<{
  topic: HydrocarbonTopic;
  title: string;
  formula: string;
  namingCue: string;
  revisionFocus: string;
  example: string;
}> = [
  {
    topic: "alkanes",
    title: "Alkanes",
    formula: "CnH2n+2",
    namingCue: "All carbon-carbon bonds are single.",
    revisionFocus: "Count the parent chain and keep the suffix -ane.",
    example: "hexane",
  },
  {
    topic: "alkenes",
    title: "Alkenes",
    formula: "CnH2n",
    namingCue: "One carbon-carbon double bond is present.",
    revisionFocus: "Number the chain so the double bond gets the lowest locant.",
    example: "hex-2-ene",
  },
  {
    topic: "alkynes",
    title: "Alkynes",
    formula: "CnH2n-2",
    namingCue: "One carbon-carbon triple bond is present.",
    revisionFocus: "Use the same numbering logic as alkenes, but switch the suffix to -yne.",
    example: "hept-3-yne",
  },
  {
    topic: "branched_isomers",
    title: "Branched isomers",
    formula: "Depends on the parent family",
    namingCue: "Look for side chains attached to the main chain.",
    revisionFocus: "Find the longest chain first, then assign the lowest set of branch locants.",
    example: "2,4-dimethylpentane",
  },
];

export const topicGuides: Array<{
  topic: HydrocarbonTopic;
  title: string;
  summary: string;
  checkpoints: string[];
}> = [
  {
    topic: "alkanes",
    title: "Alkanes: the saturated baseline",
    summary:
      "Use alkanes to lock in chain prefixes. Once you can count and name straight and lightly branched saturated chains quickly, the rest of hydrocarbon naming becomes much easier.",
    checkpoints: [
      "Match chain length 1 through 10 with the correct prefix.",
      "Recognize that every carbon-carbon bond is single.",
      "Spot when the same molecular formula can produce different constitutional isomers.",
    ],
  },
  {
    topic: "alkenes",
    title: "Alkenes: prioritize the double bond",
    summary:
      "The parent chain must include the double bond. Then number from the nearer end so the alkene locant is as small as possible before you think about branches.",
    checkpoints: [
      "Locate the carbon-carbon double bond before numbering.",
      "Write the locant directly before the -ene ending.",
      "Check that the formula loses two hydrogens compared with the matching alkane.",
    ],
  },
  {
    topic: "alkynes",
    title: "Alkynes: one more level of unsaturation",
    summary:
      "Triple bonds count as a stronger structural feature than branches when choosing and numbering the main chain. The naming pattern mirrors alkenes, but the suffix changes to -yne.",
    checkpoints: [
      "Identify the triple bond first.",
      "Give the triple bond the lowest locant possible.",
      "Remember that a triple bond reduces the hydrogen count by four relative to the corresponding alkane.",
    ],
  },
  {
    topic: "branched_isomers",
    title: "Branched isomers: longest chain discipline",
    summary:
      "Most naming mistakes happen here. Students often name the obvious horizontal chain instead of the actual longest chain, or they choose larger branch locants than necessary.",
    checkpoints: [
      "Test more than one possible parent chain before naming branches.",
      "Sort substituent names alphabetically when writing the full name.",
      "Use di-, tri-, or tetra- when the same branch appears multiple times.",
    ],
  },
];

export const namingWorkflow = [
  "Find the longest continuous carbon chain that contains the most important multiple bond, if one exists.",
  "Number that parent chain from the end that gives the lowest possible locant to the double bond, triple bond, or first branch.",
  "Name any side chains as substituents such as methyl or ethyl and record their locants.",
  "Choose the hydrocarbon suffix: -ane, -ene, or -yne.",
  "Assemble the full name with commas between numbers and hyphens between numbers and words.",
];

export const commonPitfalls = [
  "Using the longest-looking chain instead of the actual longest chain.",
  "Numbering from the wrong end, which gives a higher locant to a multiple bond or branch.",
  "Forgetting that repeated substituents need prefixes such as di- or tri-.",
  "Calling a double bond an alkene but keeping an -ane ending by mistake.",
  "Ignoring the difference between the carbon framework and the total hydrogen count.",
];

export const builderTips = [
  "Use the builder to place carbon atoms first, then connect the parent chain before adding branches.",
  "Switch between single, double, and triple bond tools when the name tells you the bond order.",
  "Hydrogens are available in the modal, but the grading logic focuses on the carbon skeleton and bond order first.",
  "The auto-fill hydrogens action is useful after you finish the carbon framework and want to inspect valence.",
];

export const adaptiveQuizNotes = [
  "Accuracy is tracked separately for naming and drawing questions.",
  "Weaker topics are surfaced earlier, so missed alkynes or branched isomers reappear faster.",
  "New questions are preferred before repeats, but incorrect questions cycle back once the bank is exhausted.",
  "Progress is stored in SQLite so the site can resume your review history across sessions on this machine.",
];