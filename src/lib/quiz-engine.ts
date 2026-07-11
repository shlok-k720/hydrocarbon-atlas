import {
  HYDROCARBON_TOPICS,
  TOPIC_LABELS,
  hydrocarbonQuestions,
  type HydrocarbonQuestion,
  type HydrocarbonTopic,
  type QuestionType,
} from "@/data/hydrocarbon-bank";

export interface AttemptSummary {
  questionId: string;
  questionType: QuestionType;
  topic: HydrocarbonTopic;
  correct: boolean;
  createdAt: string;
}

export interface TopicPerformance {
  topic: HydrocarbonTopic;
  namingAttempts: number;
  namingCorrect: number;
  drawingAttempts: number;
  drawingCorrect: number;
  miscAttempts: number;
  miscCorrect: number;
}

export interface QuizProgressPayload {
  profileId: string;
  attempts: AttemptSummary[];
  topicStats: TopicPerformance[];
}

function getQuestionsByType(questionType: QuestionType) {
  return hydrocarbonQuestions.filter((question) => question.type === questionType);
}

export function buildEmptyTopicPerformance(topic: HydrocarbonTopic): TopicPerformance {
  return {
    topic,
    namingAttempts: 0,
    namingCorrect: 0,
    drawingAttempts: 0,
    drawingCorrect: 0,
    miscAttempts: 0,
    miscCorrect: 0,
  };
}

export function ensureTopicStats(topicStats: TopicPerformance[]) {
  const byTopic = new Map(topicStats.map((stat) => [stat.topic, stat]));

  return HYDROCARBON_TOPICS.map(
    (topic) => byTopic.get(topic) ?? buildEmptyTopicPerformance(topic),
  );
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function evaluateTextAnswer(question: HydrocarbonQuestion, answer: string) {
  const normalizedAnswer = normalizeName(answer);

  return question.acceptedAnswers.some(
    (acceptedAnswer) => normalizeName(acceptedAnswer) === normalizedAnswer,
  );
}

export const evaluateNamingAnswer = evaluateTextAnswer;

function getAccuracyCounts(stat: TopicPerformance, questionType: QuestionType) {
  if (questionType === "naming") {
    return {
      attempts: stat.namingAttempts,
      correct: stat.namingCorrect,
    };
  }

  if (questionType === "drawing") {
    return {
      attempts: stat.drawingAttempts,
      correct: stat.drawingCorrect,
    };
  }

  return {
    attempts: stat.miscAttempts,
    correct: stat.miscCorrect,
  };
}

function getTopicAccuracy(stat: TopicPerformance, questionType: QuestionType) {
  const { attempts, correct } = getAccuracyCounts(stat, questionType);

  if (attempts === 0) {
    return 0.52;
  }

  return correct / attempts;
}

function getTopicAttemptCount(stat: TopicPerformance, questionType: QuestionType) {
  return getAccuracyCounts(stat, questionType).attempts;
}

function sortTopicsForAdaptiveReview(
  questionType: QuestionType,
  topicStats: TopicPerformance[],
) {
  return [...ensureTopicStats(topicStats)].sort((left, right) => {
    const leftAccuracy = getTopicAccuracy(left, questionType);
    const rightAccuracy = getTopicAccuracy(right, questionType);

    if (leftAccuracy !== rightAccuracy) {
      return leftAccuracy - rightAccuracy;
    }

    const leftAttempts = getTopicAttemptCount(left, questionType);
    const rightAttempts = getTopicAttemptCount(right, questionType);

    if (leftAttempts !== rightAttempts) {
      return leftAttempts - rightAttempts;
    }

    return TOPIC_LABELS[left.topic].localeCompare(TOPIC_LABELS[right.topic]);
  });
}

interface QuestionHistory {
  attempts: number;
  incorrectCount: number;
  lastCorrect: boolean;
  lastSeenAt: number;
}

function buildQuestionHistory(attempts: AttemptSummary[], questionType: QuestionType) {
  const history = new Map<string, QuestionHistory>();

  attempts
    .filter((attempt) => attempt.questionType === questionType)
    .forEach((attempt) => {
      const existing = history.get(attempt.questionId);
      const lastSeenAt = new Date(attempt.createdAt).getTime();

      if (!existing) {
        history.set(attempt.questionId, {
          attempts: 1,
          incorrectCount: attempt.correct ? 0 : 1,
          lastCorrect: attempt.correct,
          lastSeenAt,
        });

        return;
      }

      existing.attempts += 1;
      existing.lastCorrect = attempt.correct;
      existing.lastSeenAt = lastSeenAt;

      if (!attempt.correct) {
        existing.incorrectCount += 1;
      }
    });

  return history;
}

function getQuestionPoolsByTopic(questionType: QuestionType) {
  return ensureTopicStats([]).reduce<Record<HydrocarbonTopic, HydrocarbonQuestion[]>>(
    (accumulator, stat) => {
      accumulator[stat.topic] = getQuestionsByType(questionType).filter(
        (question) => question.topic === stat.topic,
      );

      return accumulator;
    },
    {
      alkanes: [],
      alkenes: [],
      alkynes: [],
      branched_isomers: [],
    },
  );
}

export function selectNextQuestion(
  questionType: QuestionType,
  attempts: AttemptSummary[],
  topicStats: TopicPerformance[],
  currentQuestionId?: string,
) {
  const history = buildQuestionHistory(attempts, questionType);
  const rankedTopics = sortTopicsForAdaptiveReview(questionType, topicStats);
  const pools = getQuestionPoolsByTopic(questionType);

  for (const topicStat of rankedTopics) {
    const unattempted = pools[topicStat.topic].filter(
      (question) => !history.has(question.id) && question.id !== currentQuestionId,
    );

    if (unattempted.length > 0) {
      return unattempted[0];
    }
  }

  for (const topicStat of rankedTopics) {
    const incorrect = pools[topicStat.topic]
      .filter((question) => history.get(question.id)?.lastCorrect === false)
      .sort((left, right) => {
        const leftHistory = history.get(left.id);
        const rightHistory = history.get(right.id);

        if (!leftHistory || !rightHistory) {
          return 0;
        }

        if (leftHistory.incorrectCount !== rightHistory.incorrectCount) {
          return rightHistory.incorrectCount - leftHistory.incorrectCount;
        }

        return leftHistory.lastSeenAt - rightHistory.lastSeenAt;
      });

    const firstIncorrect = incorrect.find((question) => question.id !== currentQuestionId);

    if (firstIncorrect) {
      return firstIncorrect;
    }
  }

  const fallback = getQuestionsByType(questionType)
    .slice()
    .sort((left, right) => {
      const leftHistory = history.get(left.id);
      const rightHistory = history.get(right.id);

      if (!leftHistory || !rightHistory) {
        return 0;
      }

      return leftHistory.lastSeenAt - rightHistory.lastSeenAt;
    })
    .find((question) => question.id !== currentQuestionId);

  return fallback ?? getQuestionsByType(questionType)[0];
}

export function getWeakestTopic(
  questionType: QuestionType,
  topicStats: TopicPerformance[],
) {
  return sortTopicsForAdaptiveReview(questionType, topicStats)[0];
}

export function getQuestionTotals(questionType: QuestionType, attempts: AttemptSummary[]) {
  const filteredAttempts = attempts.filter((attempt) => attempt.questionType === questionType);

  return {
    attempts: filteredAttempts.length,
    correct: filteredAttempts.filter((attempt) => attempt.correct).length,
    totalQuestions: getQuestionsByType(questionType).length,
  };
}