/**
 * Milestone 0 — the deployable shell.
 *
 * Deliberately almost empty. The spec's build order puts deployment first so it
 * is never a problem later, and puts the maths before any interface at all. What
 * this page has to do is exist at a public URL, load, and state the privacy
 * design in one sentence. Everything else arrives at M1 onward.
 */

/** Where the build order currently stands. Updated as each milestone lands. */
const MILESTONES = [
  { id: 'M0', label: 'Scaffold and deploy', done: true },
  { id: 'M1', label: 'The math library', done: false },
  { id: 'M2', label: 'Data in, and data out', done: false },
  { id: 'M3', label: 'The offer and its placement', done: false },
  { id: 'M4', label: 'Consequences', done: false },
  { id: 'M5', label: 'Cost to fix, and the paragraph', done: false },
  { id: 'M6', label: 'The salary rail', done: false },
  { id: 'M7', label: 'Compare', done: false },
  { id: 'M8', label: 'Ship it properly', done: false },
]

export default function App() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-300 antialiased">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-medium tracking-tight text-neutral-100">
          Offer Lab
        </h1>

        <p className="mt-3 text-neutral-400">
          If I hire this person at this salary, what does it do to the team I
          already have?
        </p>

        {/* The privacy design, stated on the landing screen. Spec section 2. */}
        <p className="mt-8 border-l-2 border-neutral-700 pl-4 text-sm leading-relaxed text-neutral-400">
          Everything runs in your browser. Nothing you enter is transmitted,
          stored, or seen by anyone — there is no server to send it to.
        </p>

        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Build order
          </h2>
          <ol className="mt-4 space-y-1.5 text-sm">
            {MILESTONES.map((milestone) => (
              <li
                key={milestone.id}
                className={
                  milestone.done ? 'text-neutral-300' : 'text-neutral-600'
                }
              >
                <span className="inline-block w-10 text-neutral-500">
                  {milestone.id}
                </span>
                {milestone.label}
                {milestone.done && (
                  <span className="ml-2 text-neutral-500">— done</span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-12 text-sm text-neutral-500">
          A companion to{' '}
          <a
            className="text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
            href="https://compforyou.github.io/merit-lab/"
          >
            Merit Lab
          </a>
          . The compensation math is in{' '}
          <code className="text-neutral-400">src/lib</code>, and every formula
          has a unit test.
        </p>
      </div>
    </main>
  )
}
