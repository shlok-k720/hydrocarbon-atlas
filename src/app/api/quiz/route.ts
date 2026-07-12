import {
  HYDROCARBON_TOPICS,
  QUESTION_TYPES,
  questionById,
  type HydrocarbonTopic,
  type QuestionType,
} from "@/data/hydrocarbon-bank";
import { normalizeUsername } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildEmptyTopicPerformance,
  ensureTopicStats,
  type QuizProgressPayload,
} from "@/lib/quiz-engine";

export const dynamic = "force-dynamic";

interface AttemptPayload {
  browserId?: string;
  profileMode?: "guest" | "account";
  username?: string;
  questionId: string;
  questionType: QuestionType;
  topic: HydrocarbonTopic;
  correct: boolean;
  response?: string;
}

type ProfileIdentity =
  | {
      profileMode: "guest";
      browserId: string;
    }
  | {
      profileMode: "account";
      username: string;
    };

const VALID_TOPICS = new Set(HYDROCARBON_TOPICS);
const VALID_QUESTION_TYPES = new Set(QUESTION_TYPES);

function getProfileInclude() {
  return {
    attempts: {
      orderBy: { createdAt: "asc" as const },
      select: {
        questionId: true,
        questionType: true,
        topic: true,
        correct: true,
        createdAt: true,
      },
    },
    topicStats: {
      orderBy: { topic: "asc" as const },
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
  };
}

async function loadProfile(identity: ProfileIdentity) {
  if (identity.profileMode === "account") {
    const account = await prisma.userAccount.findUnique({
      where: { username: identity.username },
      select: { id: true },
    });

    if (!account) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }

    return prisma.learnerProfile.upsert({
      where: { userId: account.id },
      create: { userId: account.id },
      update: {},
      include: getProfileInclude(),
    });
  }

  return prisma.learnerProfile.upsert({
    where: { browserId: identity.browserId },
    create: { browserId: identity.browserId },
    update: {},
    include: getProfileInclude(),
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
    typeof candidate.questionId === "string" &&
    typeof candidate.questionType === "string" &&
    typeof candidate.topic === "string" &&
    typeof candidate.correct === "boolean" &&
    (typeof candidate.browserId === "string" || typeof candidate.username === "string")
  );
}

function resolveIdentityFromSearchParams(searchParams: URLSearchParams): ProfileIdentity | null {
  const profileMode = searchParams.get("profileMode");
  const browserId = searchParams.get("browserId");
  const username = searchParams.get("username");

  if ((profileMode === "account" || username) && username) {
    return {
      profileMode: "account",
      username: normalizeUsername(username),
    };
  }

  if (browserId) {
    return {
      profileMode: "guest",
      browserId,
    };
  }

  return null;
}

function resolveIdentityFromAttempt(payload: AttemptPayload): ProfileIdentity | null {
  if ((payload.profileMode === "account" || payload.username) && payload.username) {
    return {
      profileMode: "account",
      username: normalizeUsername(payload.username),
    };
  }

  if (payload.browserId) {
    return {
      profileMode: "guest",
      browserId: payload.browserId,
    };
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const identity = resolveIdentityFromSearchParams(searchParams);

  if (!identity) {
    return Response.json({ error: "Missing browserId or account username." }, { status: 400 });
  }

  try {
    const profile = await loadProfile(identity);

    return Response.json(serializeProfile(profile));
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
      return Response.json({ error: "The saved account no longer exists." }, { status: 404 });
    }

    throw error;
  }
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
  const identity = resolveIdentityFromAttempt(payload);

  if (!identity) {
    return Response.json({ error: "Missing guest browser ID or account username." }, { status: 400 });
  }

  try {
    const updatedProfile = await prisma.$transaction(async (transaction) => {
      let profile;

      if (identity.profileMode === "account") {
        const account = await transaction.userAccount.findUnique({
          where: { username: identity.username },
          select: { id: true },
        });

        if (!account) {
          throw new Error("ACCOUNT_NOT_FOUND");
        }

        profile = await transaction.learnerProfile.upsert({
          where: { userId: account.id },
          create: { userId: account.id },
          update: {},
        });
      } else {
        profile = await transaction.learnerProfile.upsert({
          where: { browserId: identity.browserId },
          create: { browserId: identity.browserId },
          update: {},
        });
      }

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
        include: getProfileInclude(),
      });
    });

    return Response.json(serializeProfile(updatedProfile));
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
      return Response.json({ error: "The account for this session no longer exists." }, { status: 404 });
    }

    throw error;
  }
}