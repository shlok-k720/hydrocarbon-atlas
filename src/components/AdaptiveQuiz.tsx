"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { buildQuizIdentityPayload, buildQuizSearchParams } from "@/lib/auth";
import {
  TOPIC_LABELS,
  type HydrocarbonQuestion,
  type QuestionType,
} from "@/data/hydrocarbon-bank";
import {
  countBuilderAtoms,
  createEmptyBuilderState,
  evaluateDrawingAnswer,
  identifyDrawnHydrocarbon,
  type BuilderState,
  type DrawingIdentification,
} from "@/lib/molecule";
import {
  evaluateTextAnswer,
  getQuestionTotals,
  getWeakestTopic,
  selectNextQuestion,
  type QuizProgressPayload,
  type TopicPerformance,
} from "@/lib/quiz-engine";

import HydrocarbonBuilderModal from "@/components/HydrocarbonBuilderModal";
import HydrocarbonBuilderWorkspace from "@/components/HydrocarbonBuilderWorkspace";
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

function getModeLabel(mode: QuestionType) {
  if (mode === "naming") {
    return "Naming from diagrams";
  }

  if (mode === "drawing") {
    return "Drawing from names";
  }

  return "Misc hydrocarbon facts";
}

function getModePrompt(mode: QuestionType) {
  if (mode === "naming") {
    return "Name from diagram";
  }

  if (mode === "drawing") {
    return "Draw from name";
  }

  return "Misc";
}

function getModeCounts(stat: TopicPerformance, mode: QuestionType) {
  if (mode === "naming") {
    return {
      attempts: stat.namingAttempts,
      correct: stat.namingCorrect,
    };
  }

  if (mode === "drawing") {
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

function getMiscHint(question: HydrocarbonQuestion) {
  switch (question.miscKind) {
    case "hydrogen-count":
      return "Translate the name into its family and chain length, then use the molecular formula pattern for that family to count the hydrogens.";
    case "carbon-count":
      return "Focus on the parent prefix first, then add any branch carbons if the name includes substituents.";
    case "formula":
      return "Decide whether the molecule is an alkane, alkene, alkyne, or branched alkane, then convert the name into its carbon count and formula pattern.";
    case "family":
      return "Watch for the name ending: -ane, -ene, and -yne still do most of the classification work before you think about branches.";
    default:
      return "Use the hydrocarbon name to infer the carbon count, saturation pattern, and family before you answer.";
  }
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

    if (question.type === "drawing") {
      return {
        ...stat,
        drawingAttempts: stat.drawingAttempts + 1,
        drawingCorrect: stat.drawingCorrect + (correct ? 1 : 0),
      };
    }

    return {
      ...stat,
      miscAttempts: stat.miscAttempts + 1,
      miscCorrect: stat.miscCorrect + (correct ? 1 : 0),
    };
  });

  return {
    ...progress,
    attempts: nextAttempts,
    topicStats: nextTopicStats,
  };
}

export default function AdaptiveQuiz() {
  const { isReady: isAuthReady, openAuthModal, session } = useAuth();
  const practiceBoardRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState<QuizProgressPayload | null>(null);
  const [mode, setMode] = useState<QuestionType>("naming");
  const [currentQuestion, setCurrentQuestion] = useState<HydrocarbonQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [builderState, setBuilderState] = useState<BuilderState>(createEmptyBuilderState());
  const [practiceBuilderState, setPracticeBuilderState] = useState<BuilderState>(createEmptyBuilderState());
  const [practiceFeedback, setPracticeFeedback] = useState<DrawingIdentification | null>(null);
  const [isPracticeFullscreen, setIsPracticeFullscreen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    async function syncProgress() {
      if (!isAuthReady) {
        setLoading(true);
        return;
      }

      if (!session) {
        setProgress(null);
        setCurrentQuestion(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(`/api/quiz?${buildQuizSearchParams(session)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load saved quiz progress.");
        }

        const payload = (await response.json()) as QuizProgressPayload;

        setProgress(payload);
        setCurrentQuestion(selectNextQuestion(mode, payload.attempts, payload.topicStats));
        setError(null);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Could not load saved quiz progress.";

        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void syncProgress();
  }, [isAuthReady, mode, session]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsPracticeFullscreen(document.fullscreenElement === practiceBoardRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
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
  const practiceSummary = countBuilderAtoms(practiceBuilderState);

  function resetForQuestion(questionType: QuestionType) {
    setFeedback(null);
    setError(null);

    if (questionType === "drawing") {
      setBuilderState(createEmptyBuilderState());
      return;
    }

    setAnswer("");
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
    if (!session || !progress || !currentQuestion) {
      return;
    }

    setSaving(true);
    setError(null);

    const isDrawingQuestion = currentQuestion.type === "drawing";
    const isTextQuestion = !isDrawingQuestion;
    const textCorrect = isTextQuestion ? evaluateTextAnswer(currentQuestion, answer) : false;
    const drawingEvaluation = isDrawingQuestion
      ? evaluateDrawingAnswer(currentQuestion.structure, builderState)
      : null;
    const correct = isDrawingQuestion ? drawingEvaluation?.correct ?? false : textCorrect;

    let nextFeedback: FeedbackState;

    if (currentQuestion.type === "naming") {
      nextFeedback = correct
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
          };
    } else if (currentQuestion.type === "misc") {
      nextFeedback = correct
        ? {
            correct: true,
            headline: "Correct answer.",
            detail: `${currentQuestion.answerLabel} is correct. ${currentQuestion.studyNote}`,
            expectedAnswer: currentQuestion.answerLabel,
            note: currentQuestion.studyNote,
          }
        : {
            correct: false,
            headline: "Review that fact once more.",
            detail: `The expected answer is ${currentQuestion.answerLabel}. ${currentQuestion.studyNote}`,
            expectedAnswer: currentQuestion.answerLabel,
            note: currentQuestion.studyNote,
          };
    } else {
      nextFeedback = {
        correct,
        headline: drawingEvaluation?.message ?? "Drawing checked.",
        detail: drawingEvaluation?.detail ?? currentQuestion.studyNote,
        expectedAnswer: currentQuestion.answerLabel,
        note: currentQuestion.studyNote,
      };
    }

    setFeedback(nextFeedback);

    const responsePayload = isDrawingQuestion
      ? `C:${drawingSummary.carbonCount};H:${drawingSummary.hydrogenCount};B:${drawingSummary.bondCount}`
      : answer;
    const optimisticProgress = buildOptimisticProgress(progress, currentQuestion, correct);

    setProgress(optimisticProgress);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...buildQuizIdentityPayload(session),
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

  async function togglePracticeFullscreen() {
    if (!practiceBoardRef.current) {
      return;
    }

    if (document.fullscreenElement === practiceBoardRef.current) {
      await document.exitFullscreen();
      return;
    }

    await practiceBoardRef.current.requestFullscreen();
  }

  function handlePracticeChange(nextState: BuilderState) {
    setPracticeBuilderState(nextState);
    setPracticeFeedback(null);
  }

  function identifyPracticeDrawing() {
    setPracticeFeedback(identifyDrawnHydrocarbon(practiceBuilderState));
  }

  if (loading) {
    return (
      <div className="surface-card p-8">
        <p className="section-kicker">Adaptive quiz</p>
        <h3 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
          Loading your hydrocarbon practice workspace
        </h3>
        <p className="mt-3 max-w-2xl text-base text-[color:var(--muted)]">
          The site is opening the question bank and syncing your saved topic accuracy from SQLite.
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="surface-card p-8">
        <p className="section-kicker">Adaptive quiz</p>
        <h3 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
          Choose a profile to begin
        </h3>
        <p className="mt-3 max-w-2xl text-base text-[color:var(--muted)]">
          Sign in with a user ID to load the progress tied to that account, or continue as a guest profile stored on this browser.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="mt-5 rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,118,110,0.25)]"
        >
          Open login modal
        </button>
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
      <div className="space-y-8">
        <div className="surface-card p-6 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="section-kicker">Adaptive quiz</p>
                  <h3 className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
                    Switch between naming, drawing, and misc review
                  </h3>
                  <p className="mt-2 max-w-2xl text-base text-[color:var(--muted)]">
                    The next question is chosen from the topic with the weakest current accuracy so your revision time moves where it is needed.
                  </p>
                </div>
                <div className="inline-flex flex-wrap rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-1.5">
                  {(["naming", "drawing", "misc"] as QuestionType[]).map((questionType) => (
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
                      {getModePrompt(questionType)}
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
                          placeholder={currentQuestion.answerPlaceholder ?? "Type the IUPAC name"}
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
                ) : null}

                {mode === "drawing" ? (
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
                ) : null}

                {mode === "misc" ? (
                  <div className="mt-6 grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
                    <div className="space-y-4">
                      <div className="rounded-[1.6rem] bg-[color:var(--surface-strong)] p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                          Quick fact prompt
                        </p>
                        <p className="mt-3 text-xl font-semibold text-[color:var(--foreground)]">
                          {currentQuestion.prompt}
                        </p>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          Family context: {currentQuestion.familyLabel}. These questions check formula patterns, family recognition, and chain-length reasoning from the name alone.
                        </p>
                      </div>
                      <div className="rounded-[1.6rem] border border-dashed border-[color:var(--line)] p-5">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">Hint frame</p>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {getMiscHint(currentQuestion)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-[1.4rem] bg-[color:var(--surface-strong)] p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                          Your answer
                        </p>
                        <input
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          placeholder={currentQuestion.answerPlaceholder ?? "Type your answer"}
                          className="mt-3 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-base text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                        />
                      </div>
                      <div className="rounded-[1.4rem] border border-[color:var(--line)] bg-white p-4">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">Why this matters</p>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          Naming questions are stronger when you can instantly infer hydrogen counts, carbon counts, formulas, and families from the name before you ever touch the diagram.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={saving || (mode === "drawing" ? drawingSummary.carbonCount === 0 : answer.trim().length === 0)}
                    className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,118,110,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? "Saving result..."
                      : mode === "naming"
                        ? "Check name"
                        : mode === "drawing"
                          ? "Check drawing"
                          : "Check fact"}
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
                  {getModeLabel(mode)}
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
                  {progress.topicStats.map((stat) => {
                    const modeCounts = getModeCounts(stat, mode);

                    return (
                      <div key={stat.topic} className="rounded-[1.3rem] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[color:var(--foreground)]">
                            {TOPIC_LABELS[stat.topic]}
                          </p>
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                            {formatAccuracy(modeCounts.correct, modeCounts.attempts)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-3">
                          <p>
                            Naming: {stat.namingCorrect}/{stat.namingAttempts}
                          </p>
                          <p>
                            Drawing: {stat.drawingCorrect}/{stat.drawingAttempts}
                          </p>
                          <p>
                            Misc: {stat.miscCorrect}/{stat.miscAttempts}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
                          {attempt.questionType === "misc" ? "misc facts" : attempt.questionType}
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

        <div
          ref={practiceBoardRef}
          className={
            isPracticeFullscreen
              ? "flex h-full min-h-screen flex-col bg-[color:var(--background)] px-4 py-5 md:px-6 md:py-6"
              : "surface-card p-6 md:p-8"
          }
        >
          <div className="grid gap-8 xl:grid-cols-[1.14fr_0.86fr]">
            <div className="space-y-6">
              <HydrocarbonBuilderWorkspace
                kicker="Practice board"
                title="Draw freely and let the site identify the structure"
                description="This is the same hydrocarbon drawing board used in adaptive drawing mode, but here the board works in reverse: sketch a structure and the site will tell you what you have drawn or what it most closely matches."
                state={practiceBuilderState}
                onChange={handlePracticeChange}
                primaryAction={{
                  label: "Identify this drawing",
                  onClick: identifyPracticeDrawing,
                  variant: "solid",
                  disabled: practiceSummary.carbonCount === 0,
                }}
                secondaryActions={[
                  {
                    label: isPracticeFullscreen ? "Exit fullscreen" : "Fullscreen board",
                    onClick: togglePracticeFullscreen,
                    variant: "outline",
                  },
                ]}
                canvasHeightClassName={
                  isPracticeFullscreen ? "h-[70vh] min-h-[560px]" : "h-[52vh] min-h-[380px]"
                }
                footerNote="Use fullscreen when you want more room for longer chains and branched isomers."
              />
            </div>

            <aside className="space-y-5">
              <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                <p className="section-kicker">What you drew</p>
                {practiceFeedback ? (
                  <>
                    <h4 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                      {practiceFeedback.message}
                    </h4>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                      {practiceFeedback.detail}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {practiceFeedback.formula ? <span className="pill">{practiceFeedback.formula}</span> : null}
                      {practiceFeedback.familyGuess ? <span className="pill">{practiceFeedback.familyGuess}</span> : null}
                      {practiceFeedback.exactMatch ? <span className="pill">Exact bank match</span> : null}
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                      Use this space to experiment with structures
                    </h4>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                      Draw any hydrocarbon from the study bank, then use the identify button to see the closest named match, family, and molecular formula.
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                <p className="section-kicker">Practice suggestions</p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--foreground)]">
                  <div className="rounded-[1.2rem] bg-white px-4 py-3">Sketch a straight-chain alkane, then add one branch and identify the change.</div>
                  <div className="rounded-[1.2rem] bg-white px-4 py-3">Try drawing the same carbon skeleton with a double bond and then a triple bond to compare the formulas.</div>
                  <div className="rounded-[1.2rem] bg-white px-4 py-3">Use fullscreen when practising longer heptane derivatives or multiple branches.</div>
                </div>
              </div>

              {practiceFeedback?.matchedMolecule ? (
                <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                  <p className="section-kicker">Matched structure</p>
                  <h4 className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                    {practiceFeedback.matchedMolecule.name}
                  </h4>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {practiceFeedback.matchedMolecule.formula}
                  </p>
                  <div className="mt-4 rounded-[1.4rem] border border-[color:var(--line)] bg-white p-4">
                    <HydrocarbonDiagram
                      structure={practiceFeedback.matchedMolecule.structure}
                      className="h-52 w-full"
                    />
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
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