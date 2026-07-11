import {
  HYDROCARBON_TOPICS,
  QUESTION_TYPES,
  questionById,
  type HydrocarbonTopic,
  type QuestionType,
} from "@/data/hydrocarbon-bank";
import { prisma } from "@/lib/prisma";
import {
  buildEmptyTopicPerformance,
  ensureTopicStats,
  type QuizProgressPayload,
} from "@/lib/quiz-engine";

export const dynamic = "force-dynamic";

interface AttemptPayload {
  browserId: string;
  questionId: string;
  questionType: QuestionType;
  topic: HydrocarbonTopic;
  correct: boolean;
  response?: string;
}

const VALID_TOPICS = new Set(HYDROCARBON_TOPICS);
const VALID_QUESTION_TYPES = new Set(QUESTION_TYPES);

async function loadProfile(browserId: string) {
  return prisma.learnerProfile.upsert({
    where: { browserId },
    create: { browserId },
    update: {},
    include: {
      attempts: {
        orderBy: { createdAt: "asc" },
        select: {
          questionId: true,
          questionType: true,
          topic: true,
          correct: true,
          createdAt: true,
        },
      },
      topicStats: {
        orderBy: { topic: "asc" },
        select: {
          topic: true,
          namingAttempts: true,
          namingCorrect: true,
          drawingAttempts: true,
          drawingCorrect: true,
          miscAttempts: true,
          miscCorrect: true,
        },
      },
    },
  });
}

function serializeProfile(profile: Awaited<ReturnType<typeof loadProfile>>): QuizProgressPayload {
  const topicStats = ensureTopicStats(profile.topicStats).map((stat) => ({
    ...buildEmptyTopicPerformance(stat.topic),
    ...stat,
  }));

  return {
    profileId: profile.id,
    attempts: profile.attempts.map((attempt) => ({
      ...attempt,
      createdAt: attempt.createdAt.toISOString(),
    })),
    topicStats,
  };
}

function isAttemptPayload(value: unknown): value is AttemptPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.browserId === "string" &&
    typeof candidate.questionId === "string" &&
    typeof candidate.questionType === "string" &&
    typeof candidate.topic === "string" &&
    typeof candidate.correct === "boolean"
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const browserId = searchParams.get("browserId");

  if (!browserId) {
    return Response.json({ error: "Missing browserId query parameter." }, { status: 400 });
  }

  const profile = await loadProfile(browserId);

  return Response.json(serializeProfile(profile));
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isAttemptPayload(payload)) {
    return Response.json({ error: "Request body is missing required attempt fields." }, { status: 400 });
  }

  if (!VALID_QUESTION_TYPES.has(payload.questionType)) {
    return Response.json({ error: "Unknown question type." }, { status: 400 });
  }

  if (!VALID_TOPICS.has(payload.topic)) {
    return Response.json({ error: "Unknown hydrocarbon topic." }, { status: 400 });
  }

  const question = questionById.get(payload.questionId);

  if (!question) {
    return Response.json({ error: "Question does not exist in the bank." }, { status: 400 });
  }

  if (question.type !== payload.questionType || question.topic !== payload.topic) {
    return Response.json(
      { error: "Question metadata does not match the submitted topic or type." },
      { status: 400 },
    );
  }

  const responseText = typeof payload.response === "string" ? payload.response.slice(0, 300) : null;

  const updatedProfile = await prisma.$transaction(async (transaction) => {
    const profile = await transaction.learnerProfile.upsert({
      where: { browserId: payload.browserId },
      create: { browserId: payload.browserId },
      update: {},
    });

    await transaction.quizAttempt.create({
      data: {
        profileId: profile.id,
        questionId: payload.questionId,
        questionType: payload.questionType,
        topic: payload.topic,
        correct: payload.correct,
        response: responseText,
      },
    });

    const topicUpdate: Record<string, { increment: number }> = {};

    if (payload.questionType === "naming") {
      topicUpdate.namingAttempts = { increment: 1 };

      if (payload.correct) {
        topicUpdate.namingCorrect = { increment: 1 };
      }
    }

    if (payload.questionType === "drawing") {
      topicUpdate.drawingAttempts = { increment: 1 };

      if (payload.correct) {
        topicUpdate.drawingCorrect = { increment: 1 };
      }
    }

    if (payload.questionType === "misc") {
      topicUpdate.miscAttempts = { increment: 1 };

      if (payload.correct) {
        topicUpdate.miscCorrect = { increment: 1 };
      }
    }

    await transaction.topicStat.upsert({
      where: {
        profileId_topic: {
          profileId: profile.id,
          topic: payload.topic,
        },
      },
      create: {
        profileId: profile.id,
        topic: payload.topic,
        namingAttempts: payload.questionType === "naming" ? 1 : 0,
        namingCorrect: payload.questionType === "naming" && payload.correct ? 1 : 0,
        drawingAttempts: payload.questionType === "drawing" ? 1 : 0,
        drawingCorrect: payload.questionType === "drawing" && payload.correct ? 1 : 0,
        miscAttempts: payload.questionType === "misc" ? 1 : 0,
        miscCorrect: payload.questionType === "misc" && payload.correct ? 1 : 0,
      },
      update: topicUpdate,
    });

    return transaction.learnerProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: {
        attempts: {
          orderBy: { createdAt: "asc" },
          select: {
            questionId: true,
            questionType: true,
            topic: true,
            correct: true,
            createdAt: true,
          },
        },
        topicStats: {
          orderBy: { topic: "asc" },
          select: {
            topic: true,
            namingAttempts: true,
            namingCorrect: true,
            drawingAttempts: true,
            drawingCorrect: true,
            miscAttempts: true,
            miscCorrect: true,
          },
        },
      },
    });
  });

  return Response.json(serializeProfile(updatedProfile));
}