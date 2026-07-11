import AdaptiveQuiz from "@/components/AdaptiveQuiz";
import HydrocarbonDiagram from "@/components/HydrocarbonDiagram";
import {
  adaptiveQuizNotes,
  builderTips,
  commonPitfalls,
  familyReference,
  namingWorkflow,
  studyPillars,
  topicGuides,
} from "@/data/hydrocarbon-content";
import {
  drawingQuestionCount,
  featuredExamples,
  miscQuestionCount,
  namingQuestionCount,
} from "@/data/hydrocarbon-bank";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-5 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10">
      <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="surface-card overflow-hidden p-6 md:p-8">
          <p className="section-kicker">Hydrocarbon atlas</p>
          <h1 className="mt-3 max-w-4xl text-5xl font-semibold leading-[1.02] text-[color:var(--foreground)] md:text-6xl">
            Learn hydrocarbon naming by reading structures and drawing them back from memory.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[color:var(--muted)]">
            This site combines concise revision notes, structural pattern recognition, and an adaptive quiz engine. You get 100 naming questions, 100 drawing questions, 100 misc fact questions, persistent progress in SQLite, and both quiz and free-practice drawing boards where you can place carbons, hydrogens, and bond orders.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#learn"
              className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,118,110,0.25)]"
            >
              Review the content
            </a>
            <a
              href="#quiz"
              className="rounded-full border border-[color:var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--foreground)]"
            >
              Jump to adaptive quiz
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.6rem] bg-white/80 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Naming bank
              </p>
              <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
                {namingQuestionCount}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Diagram-to-name prompts across alkanes, alkenes, alkynes, and branched isomers.
              </p>
            </div>
            <div className="rounded-[1.6rem] bg-white/80 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Drawing bank
              </p>
              <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
                {drawingQuestionCount}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Name-to-structure prompts checked against the carbon framework and bond order.
              </p>
            </div>
            <div className="rounded-[1.6rem] bg-white/80 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Misc bank
              </p>
              <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
                {miscQuestionCount}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Name-to-fact prompts on formulas, hydrogen counts, carbon counts, and family recognition.
              </p>
            </div>
            <div className="rounded-[1.6rem] bg-white/80 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Persistence
              </p>
              <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
                SQLite
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Progress, attempts, and topic statistics are stored locally inside the project database.
              </p>
            </div>
          </div>
        </div>

        <div className="surface-card p-6 md:p-8">
          <p className="section-kicker">Study map</p>
          <div className="mt-4 space-y-4">
            {studyPillars.map((pillar) => (
              <div key={pillar.title} className="rounded-[1.5rem] bg-white/80 p-4">
                <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
                  {pillar.title}
                </h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="learn" className="surface-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker">Reference guide</p>
            <h2 className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">
              Core hydrocarbon families at a glance
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
            Use these family cues to decide the suffix, formula trend, and the main structural feature you should spot first in a question.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {familyReference.map((family) => (
            <article key={family.title} className="rounded-[1.6rem] bg-white/80 p-5">
              <p className="section-kicker">{family.title}</p>
              <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">
                {family.formula}
              </p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                {family.namingCue}
              </p>
              <p className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">
                Revision focus: {family.revisionFocus}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Example: {family.example}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="surface-card p-6 md:p-8">
          <p className="section-kicker">Topic drill-down</p>
          <div className="mt-6 space-y-4">
            {topicGuides.map((guide) => (
              <article key={guide.title} className="rounded-[1.6rem] bg-white/80 p-5">
                <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
                  {guide.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                  {guide.summary}
                </p>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-[color:var(--foreground)]">
                  {guide.checkpoints.map((checkpoint) => (
                    <li key={checkpoint} className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3">
                      {checkpoint}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="surface-card p-6 md:p-8">
          <p className="section-kicker">Example structures</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {featuredExamples.map((example) => (
              <article key={example.id} className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                  {example.familyLabel}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                  {example.name}
                </h3>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{example.formula}</p>
                <HydrocarbonDiagram structure={example.structure} className="mt-4 h-48 w-full" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr]">
        <div className="surface-card p-6 md:p-8">
          <p className="section-kicker">Naming workflow</p>
          <h2 className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">
            A repeatable five-step naming routine
          </h2>
          <div className="mt-6 space-y-3">
            {namingWorkflow.map((step, index) => (
              <div key={step} className="rounded-[1.5rem] bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--accent)]">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-6 md:p-8">
          <p className="section-kicker">Error checking</p>
          <h2 className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">
            Common mistakes worth catching before you submit
          </h2>
          <div className="mt-6 grid gap-3">
            {commonPitfalls.map((pitfall) => (
              <div key={pitfall} className="rounded-[1.5rem] bg-white/80 p-4 text-sm leading-7 text-[color:var(--foreground)]">
                {pitfall}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="surface-card p-6 md:p-8">
          <p className="section-kicker">Builder strategy</p>
          <h2 className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">
            Use the modal as a structured drafting space
          </h2>
          <div className="mt-6 space-y-3">
            {builderTips.map((tip) => (
              <div key={tip} className="rounded-[1.5rem] bg-white/80 p-4 text-sm leading-7 text-[color:var(--foreground)]">
                {tip}
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-6 md:p-8">
          <p className="section-kicker">Adaptive behaviour</p>
          <h2 className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">
            Why the quiz changes its next question
          </h2>
          <div className="mt-6 space-y-3">
            {adaptiveQuizNotes.map((note) => (
              <div key={note} className="rounded-[1.5rem] bg-white/80 p-4 text-sm leading-7 text-[color:var(--foreground)]">
                {note}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="quiz" className="scroll-mt-6">
        <AdaptiveQuiz />
      </section>
    </main>
  );
}
