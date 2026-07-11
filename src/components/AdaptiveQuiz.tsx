"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
  TOPIC_LABELS,
  type HydrocarbonQuestion,
  type QuestionType,
} from "@/data/hydrocarbon-bank";
import {
  countBuilderAtoms,
  createEmptyBuilderState,
  evaluateDrawingAnswer,
  type BuilderState,
} from "@/lib/molecule";
import {
  evaluateNamingAnswer,
  getQuestionTotals,
  getWeakestTopic,
  selectNextQuestion,
  type QuizProgressPayload,
} from "@/lib/quiz-engine";

import HydrocarbonBuilderModal from "@/components/HydrocarbonBuilderModal";
import HydrocarbonDiagram from "@/components/HydrocarbonDiagram";

interface FeedbackState {
  correct: boolean;
  headline: string;
  detail: string;
  expectedAnswer: string;
  note: string;
}

function formatAccuracy(correct: number, attempts: number) {
  if (attempts === 0) {
    return "No attempts yet";
  }

  return `${Math.round((correct / attempts) * 100)}% accuracy`;
}

function buildOptimisticProgress(
  progress: QuizProgressPayload,
  question: HydrocarbonQuestion,
  correct: boolean,
) {
  const nextAttempts = [
    ...progress.attempts,
    {
      questionId: question.id,
      questionType: question.type,
      topic: question.topic,
      correct,
      createdAt: new Date().toISOString(),
    },
  ];
  const nextTopicStats = progress.topicStats.map((stat) => {
    if (stat.topic !== question.topic) {
      return stat;
    }

    if (question.type === "naming") {
      return {
        ...stat,
        namingAttempts: stat.namingAttempts + 1,
        namingCorrect: stat.namingCorrect + (correct ? 1 : 0),
      };
    }

    return {
      ...stat,
      drawingAttempts: stat.drawingAttempts + 1,
      drawingCorrect: stat.drawingCorrect + (correct ? 1 : 0),
    };
  });

  return {
    ...progress,
    attempts: nextAttempts,
    topicStats: nextTopicStats,
  };
}

export default function AdaptiveQuiz() {
  const browserIdRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<QuizProgressPayload | null>(null);
  const [mode, setMode] = useState<QuestionType>("naming");
  const [currentQuestion, setCurrentQuestion] = useState<HydrocarbonQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [builderState, setBuilderState] = useState<BuilderState>(createEmptyBuilderState());
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    const savedBrowserId = window.localStorage.getItem("hydrocarbon-browser-id");
    const nextBrowserId = savedBrowserId ?? crypto.randomUUID();

    if (!savedBrowserId) {
      window.localStorage.setItem("hydrocarbon-browser-id", nextBrowserId);
    }

    browserIdRef.current = nextBrowserId;

    void (async () => {
      try {
        const response = await fetch(
          `/api/quiz?browserId=${encodeURIComponent(nextBrowserId)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Could not load saved quiz progress.");
        }

        const payload = (await response.json()) as QuizProgressPayload;

        setProgress(payload);
        setCurrentQuestion(selectNextQuestion("naming", payload.attempts, payload.topicStats));
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Could not load saved quiz progress.";

        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weakestTopic = useMemo(() => {
    if (!progress) {
      return null;
    }

    return getWeakestTopic(mode, progress.topicStats);
  }, [mode, progress]);

  const totals = useMemo(() => {
    if (!progress) {
      return { attempts: 0, correct: 0, totalQuestions: 100 };
    }

    return getQuestionTotals(mode, progress.attempts);
  }, [mode, progress]);

  const recentAttempts = useMemo(() => {
    return progress?.attempts.slice(-6).reverse() ?? [];
  }, [progress]);

  const drawingSummary = countBuilderAtoms(builderState);

  function resetForQuestion(questionType: QuestionType) {
    setFeedback(null);
    setError(null);

    if (questionType === "naming") {
      setAnswer("");
    }

    if (questionType === "drawing") {
      setBuilderState(createEmptyBuilderState());
    }
  }

  function moveToNextQuestion(nextMode: QuestionType, nextProgress: QuizProgressPayload) {
    const nextQuestion = selectNextQuestion(
      nextMode,
      nextProgress.attempts,
      nextProgress.topicStats,
      currentQuestion?.id,
    );

    resetForQuestion(nextMode);
    setBuilderOpen(false);
    setCurrentQuestion(nextQuestion);
  }

  function handleModeChange(nextMode: QuestionType) {
    if (!progress) {
      return;
    }

    startTransition(() => {
      setMode(nextMode);
      setCurrentQuestion(selectNextQuestion(nextMode, progress.attempts, progress.topicStats));
      setAnswer("");
      setBuilderState(createEmptyBuilderState());
      setFeedback(null);
      setBuilderOpen(false);
      setError(null);
    });
  }

  async function handleSubmit() {
    if (!browserIdRef.current || !progress || !currentQuestion) {
      return;
    }

    setSaving(true);
    setError(null);

    const isNamingQuestion = currentQuestion.type === "naming";
    const namingCorrect = isNamingQuestion
      ? evaluateNamingAnswer(currentQuestion, answer)
      : false;
    const drawingEvaluation = isNamingQuestion
      ? null
      : evaluateDrawingAnswer(currentQuestion.structure, builderState);
    const correct = isNamingQuestion ? namingCorrect : drawingEvaluation?.correct ?? false;
    const nextFeedback: FeedbackState = isNamingQuestion
      ? namingCorrect
        ? {
            correct: true,
            headline: "Correct name.",
            detail: `${currentQuestion.answerLabel} matches the structure. ${currentQuestion.studyNote}`,
            expectedAnswer: currentQuestion.answerLabel,
            note: currentQuestion.studyNote,
          }
        : {
            correct: false,
            headline: "Not quite yet.",
            detail: `The correct name is ${currentQuestion.answerLabel}. ${currentQuestion.studyNote}`,
            expectedAnswer: currentQuestion.answerLabel,
            note: currentQuestion.studyNote,
          }
      : {
          correct,
          headline: drawingEvaluation?.message ?? "Drawing checked.",
          detail: drawingEvaluation?.detail ?? currentQuestion.studyNote,
          expectedAnswer: currentQuestion.answerLabel,
          note: currentQuestion.studyNote,
        };

    setFeedback(nextFeedback);

    const responsePayload = isNamingQuestion
      ? answer
      : `C:${drawingSummary.carbonCount};H:${drawingSummary.hydrogenCount};B:${drawingSummary.bondCount}`;
    const optimisticProgress = buildOptimisticProgress(progress, currentQuestion, correct);

    setProgress(optimisticProgress);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          browserId: browserIdRef.current,
          questionId: currentQuestion.id,
          questionType: currentQuestion.type,
          topic: currentQuestion.topic,
          correct,
          response: responsePayload,
        }),
      });

      if (!response.ok) {
        throw new Error("The answer was checked, but progress could not be saved.");
      }

      const payload = (await response.json()) as QuizProgressPayload;

      setProgress(payload);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "The answer was checked, but progress could not be saved.";

      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-card p-8">
        <p className="section-kicker">Adaptive quiz</p>
        <h3 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
          Loading your hydrocarbon practice workspace
        </h3>
        <p className="mt-3 max-w-2xl text-base text-[color:var(--muted)]">
          The site is opening the 200-question bank and syncing your saved topic accuracy from SQLite.
        </p>
      </div>
    );
  }

  if (!progress || !currentQuestion) {
    return (
      <div className="surface-card p-8">
        <p className="section-kicker">Adaptive quiz</p>
        <h3 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
          Quiz data could not be loaded
        </h3>
        <p className="mt-3 text-base text-[color:var(--muted)]">
          {error ?? "The quiz bank or saved progress is unavailable right now."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="surface-card p-6 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="section-kicker">Adaptive quiz</p>
                <h3 className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
                  Switch between naming and drawing practice
                </h3>
                <p className="mt-2 max-w-2xl text-base text-[color:var(--muted)]">
                  The next question is chosen from the topic with the weakest current accuracy so your revision time moves where it is needed.
                </p>
              </div>
              <div className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-1.5">
                {(["naming", "drawing"] as QuestionType[]).map((questionType) => (
                  <button
                    key={questionType}
                    type="button"
                    onClick={() => handleModeChange(questionType)}
                    className={
                      mode === questionType
                        ? "rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
                        : "rounded-full px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)]"
                    }
                  >
                    {questionType === "naming" ? "Name from diagram" : "Draw from name"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill">{TOPIC_LABELS[currentQuestion.topic]}</span>
                <span className="pill">{currentQuestion.familyLabel}</span>
                <span className="pill">
                  {totals.attempts + 1} of {totals.totalQuestions} in this mode
                </span>
              </div>

              <h4 className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]">
                {currentQuestion.prompt}
              </h4>

              {mode === "naming" ? (
                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-4">
                    <HydrocarbonDiagram structure={currentQuestion.structure} className="h-72 w-full" />
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-[1.4rem] bg-[color:var(--surface-strong)] p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                        Your answer
                      </p>
                      <input
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        placeholder="Type the IUPAC name"
                        className="mt-3 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-base text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                      />
                    </div>
                    <div className="rounded-[1.4rem] border border-dashed border-[color:var(--line)] p-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">Hint frame</p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        Name the parent chain first, then decide whether the suffix should be -ane, -ene, or -yne before checking for branches.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="space-y-4">
                    <div className="rounded-[1.6rem] bg-[color:var(--surface-strong)] p-5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                        Build target
                      </p>
                      <p className="mt-3 text-xl font-semibold text-[color:var(--foreground)]">
                        {currentQuestion.answerLabel}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        Formula: {currentQuestion.formula}. Build the carbon framework, then assign the correct single, double, or triple bond order.
                      </p>
                    </div>
                    <div className="rounded-[1.6rem] border border-dashed border-[color:var(--line)] p-5">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">Current drawing snapshot</p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        {drawingSummary.carbonCount} carbons, {drawingSummary.hydrogenCount} hydrogens, {drawingSummary.bondCount} bonds placed.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                      Drawing workspace
                    </p>
                    <p className="mt-3 text-sm text-[color:var(--muted)]">
                      Open the modal to place C and H atoms, drag them into position, and connect them with single, double, or triple bonds.
                    </p>
                    <button
                      type="button"
                      onClick={() => setBuilderOpen(true)}
                      className="mt-5 rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,118,110,0.25)]"
                    >
                      Open drawing board
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving || (mode === "naming" ? answer.trim().length === 0 : drawingSummary.carbonCount === 0)}
                  className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,118,110,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving result..." : mode === "naming" ? "Check name" : "Check drawing"}
                </button>
                <button
                  type="button"
                  onClick={() => moveToNextQuestion(mode, progress)}
                  className="rounded-full border border-[color:var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--foreground)]"
                >
                  Skip to next adaptive question
                </button>
                {mode === "drawing" ? (
                  <button
                    type="button"
                    onClick={() => setBuilderOpen(true)}
                    className="rounded-full border border-[color:var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--foreground)]"
                  >
                    Reopen drawing board
                  </button>
                ) : null}
              </div>

              {feedback ? (
                <div
                  className={
                    feedback.correct
                      ? "mt-6 rounded-[1.6rem] border border-[color:var(--success)]/30 bg-[color:var(--success-soft)] p-5"
                      : "mt-6 rounded-[1.6rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-5"
                  }
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--foreground)]">
                    Feedback
                  </p>
                  <h5 className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                    {feedback.headline}
                  </h5>
                  <p className="mt-2 text-sm text-[color:var(--foreground)]">Expected answer: {feedback.expectedAnswer}</p>
                  <p className="mt-3 text-sm text-[color:var(--foreground)]">{feedback.detail}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => moveToNextQuestion(mode, progress)}
                      className="rounded-full bg-[color:var(--foreground)] px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Next adaptive question
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedback(null)}
                      className="rounded-full border border-[color:var(--line)] bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--foreground)]"
                    >
                      Retry this question
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mt-5 rounded-[1.2rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--foreground)]">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <p className="section-kicker">Current mode</p>
              <h4 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {mode === "naming" ? "Naming from diagrams" : "Drawing from names"}
              </h4>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                {totals.correct} correct from {totals.attempts} attempts in this mode.
              </p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[color:var(--surface-strong)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)]"
                  style={{
                    width: `${totals.attempts === 0 ? 0 : (totals.correct / totals.attempts) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <p className="section-kicker">Adaptive focus</p>
              <h4 className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                {weakestTopic ? TOPIC_LABELS[weakestTopic.topic] : "Loading topic focus"}
              </h4>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                {weakestTopic
                  ? `This topic is currently the weakest for ${mode} practice, so the engine pushes more of it forward.`
                  : "No topic focus yet."}
              </p>
            </div>

            <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <p className="section-kicker">Topic dashboard</p>
              <div className="mt-4 space-y-4">
                {progress.topicStats.map((stat) => (
                  <div key={stat.topic} className="rounded-[1.3rem] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[color:var(--foreground)]">
                        {TOPIC_LABELS[stat.topic]}
                      </p>
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                        {mode === "naming"
                          ? formatAccuracy(stat.namingCorrect, stat.namingAttempts)
                          : formatAccuracy(stat.drawingCorrect, stat.drawingAttempts)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-2">
                      <p>
                        Naming: {stat.namingCorrect}/{stat.namingAttempts}
                      </p>
                      <p>
                        Drawing: {stat.drawingCorrect}/{stat.drawingAttempts}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <p className="section-kicker">Recent attempts</p>
              <div className="mt-4 space-y-3">
                {recentAttempts.length > 0 ? (
                  recentAttempts.map((attempt) => (
                    <div key={`${attempt.questionId}-${attempt.createdAt}`} className="rounded-[1.2rem] bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {TOPIC_LABELS[attempt.topic]}
                        </p>
                        <span
                          className={
                            attempt.correct
                              ? "rounded-full bg-[color:var(--success-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--success)]"
                              : "rounded-full bg-[color:var(--danger-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)]"
                          }
                        >
                          {attempt.correct ? "Correct" : "Review again"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        {attempt.questionType}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--muted)]">
                    No attempts yet. Your first answer will create the initial topic profile.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <HydrocarbonBuilderModal
        isOpen={builderOpen}
        questionLabel={currentQuestion.answerLabel}
        state={builderState}
        onChange={setBuilderState}
        onClose={() => setBuilderOpen(false)}
        onSubmit={() => {
          setBuilderOpen(false);
          void handleSubmit();
        }}
      />
    </>
  );
}