# Offer Lab — Specification

Status: **draft for argument.** Nothing in section 7 gets built until you have
disagreed with it at least once. Section 12 lists the calls I made that I think
you are most likely to want changed.

## 1. What this is

A single-page web app that answers one question: **if I hire this person at this
salary, what does it do to the team I already have?**

Today a comp analyst asked to sanity-check an offer does three things, none of
them together. They check the offer against the range. They check it against
market data. Then they eyeball the incumbent list and hope. Nothing on the desk
computes the consequence, and the consequence is where the money is: the offer is
a one-time decision, the compression it creates is a permanent liability that
surfaces six months later as a retention conversation with somebody who found out.

Offer Lab computes the consequence. Where the offer lands in the range, who it
leapfrogs, which incumbents it compresses against, what fixing that would cost,
and the highest offer that would not have caused any of it.

## 2. Who it is for

Compensation analysts and managers pricing an individual offer, and the HR
business partners who have to defend it. Also the practitioner sitting opposite a
hiring manager who wants to go 12% over the top of the range, and who needs to say
what that costs rather than that it feels wrong.

Same governing adoption constraint as Merit Lab: **nobody in compensation is
permitted to upload pay data to a stranger's website.** So the app never receives
it. Everything runs in the browser, transmits nothing, stores nothing. That
constraint is the feature and it is stated on the landing screen.

An additional constraint specific to this tool: an offer is about a named human
being who has not been hired yet, and an incumbent list is about named humans who
have. Offer Lab takes an identifier, never a name. The offer is "Req 4412", not a
candidate. This is stated in the interface, not just here.

## 3. What it is not

- **Not a market pricing tool.** It takes a market reference number if you have
  one. It does not hold survey data, age it, blend it, or price a job.
- **Not a levelling tool.** The grade comes in as an input. If the grade is wrong,
  every number is wrong, and no tool fixes that.
- **Not an equity or pay gap analysis.** It has no demographic data and must never
  take any. Compression and pay equity are different questions with different
  legal exposure, and a tool that conflates them is dangerous.
- **Not an approval workflow.** No routing, no sign-off, no audit trail, no HRIS
  write-back.
- **Not a judgement.** It does not grade the offer, score it, or recommend one. It
  reports consequences. The decision is the practitioner's.

## 4. Relationship to Merit Lab

Two separate repositories, two separate deployed sites, one shared body of maths.

**Decision: the shared maths is copied, not shared as a package.** A package would
mean publishing to a registry, versioning it, and keeping two projects in step with
a third thing. For a two-project codebase with one author, that is more machinery
than the problem deserves. Copying costs one manual re-copy on the rare occasion a
shared formula changes, and it keeps each repository readable end-to-end by a
compensation reviewer who should not have to go and find a dependency to check the
compa-ratio formula.

**Already copied, with tests, all 115 passing:**

| File | What it is |
|---|---|
| `compa-ratio.ts` | Base salary over grade midpoint, with FTE gross-up |
| `range-penetration.ts` | Position across the range, unclamped |
| `range-spread.ts` | Range width as a proportion of the minimum |
| `midpoint-progression.ts` | Step between adjacent grade midpoints |
| `compa-ratio-bands.ts` | Band assignment, lower bound inclusive |
| `statistics.ts` | Mean and median |
| `format.ts` | Display formatting, and the only rounding in the codebase |

`types/domain.ts` carries `Grade` and `CompaRatioBand` across unchanged, so a
salary structure exported from Merit Lab loads into Offer Lab without translation.

**Not copied yet, deliberately.** The CSV parser, the file download helper, and the
importers are plumbing rather than maths, and two of them are shaped around Merit
Lab's employee record. They get copied and adapted at the milestone that needs them
(M2), so nothing enters this repository before it has a reason to be here and a
test of its own.

**Not copied at all:** the merit matrix, proration, over-max modes, budget
aggregates, the advisor. Different tool, different question.

One shared behaviour, worth restating because it is easy to get wrong in both
tools: **`baseSalary` is actual pay at that person's FTE.** A 0.5 FTE incumbent
paid $47,500 has a `baseSalary` of $47,500. Every *comparison* — placement, gaps,
medians, compression — grosses up to full-time equivalent, because ranges and
differentials are expressed in full-time terms. Every *cost* uses actual pay,
because that is what leaves the bank. Mixing these up produces a tool that reads
every part-timer as severely underpaid and then quotes a remediation bill for money
nobody would ever spend.

## 5. Software terms

Merit Lab's SPEC section 4 covers repository, commit, branch, dependency, build,
deploy, component, state, props, unit test, type, and pure function. Those still
apply and are not repeated. New here:

- **Fixture** — a small block of made-up data written into a test so the expected
  answer can be worked out by hand. Every compression test gets one.
- **Derived value** — a number the app calculates rather than stores. Every figure
  on the Offer Lab screen is derived; the only stored things are the team, the
  structure, the offer, and the thresholds.

## 6. Data model

### Grade

Unchanged from Merit Lab: `id`, `name`, `order` (1 = lowest), `min`, `mid`, `max`.

### Incumbent

Someone already on the team. This is the population the offer lands into.

| Field | Type | Notes |
|---|---|---|
| `id` | string | An identifier. Must not be a name. |
| `gradeId` | string | Links to a grade. |
| `baseSalary` | number | Actual annualized pay at this person's FTE, in dollars. |
| `fte` | number | 0 to 1. Defaults to 1. |
| `hireDate` | string, optional | ISO date. Drives tenure. |
| `performanceRating` | string, optional | Matched against a rating scale you nominate. |
| `managerId` | string, optional | Another incumbent's `id`. |
| `attributes` | record, optional | Unrecognised import columns, kept for grouping. |

`hireDate` and `performanceRating` are optional because most exports do not have
them and the tool must be useful without them. But they are the two fields that
separate a real compression finding from a list of people who happen to earn less.
**When either is missing, the tool says so on screen and reports the affected rows
as unqualified.** It does not quietly assume.

### Offer

| Field | Type | Notes |
|---|---|---|
| `label` | string | A req number or similar. **Never a candidate name.** |
| `gradeId` | string | The grade the role has been levelled to. |
| `baseSalary` | number | Proposed annualized pay at the offer's FTE. |
| `fte` | number | Defaults to 1. |
| `startDate` | string, optional | ISO date. The "as at" date for tenure. |
| `managerId` | string, optional | Who they would report to. |
| `marketReference` | number, optional | One market number, in dollars. What it is — 50th, 75th, a competing offer — is a label you type. |

### Settings

| Field | Default | Notes |
|---|---|---|
| `peerCompressionThreshold` | 0.05 | An incumbent less than 5 points ahead of the offer is compressed. |
| `verticalDifferentialThreshold` | 0.15 | A manager or next-grade comparator less than 15 points ahead is compressed. |
| `tenureQualifyingMonths` | 12 | Below this, an incumbent is reported but never flagged. |
| `remediationTarget` | `restoreDifferential` | See 7.6. |
| `currency` / `locale` | USD / en-US | Display only. |

## 7. Compensation math

Implement exactly as written. Each function gets a unit test with a hand-calculated
expected value. Where I have made a choice you might disagree with, the reasoning
is stated so you can attack it.

Throughout: `offerFte` is the offer's salary grossed to full-time, `incumbentFte`
likewise. Costs use actual pay.

### 7.1 Offer placement

Reuses the copied library:

```
offerCompaRatio       = offerFte / gradeMid
offerRangePenetration = (offerFte - gradeMin) / (gradeMax - gradeMin)
offerBand             = the band containing offerCompaRatio
```

Plus:

```
offerVsMax = (offerFte - gradeMax) / gradeMax      // positive means over the top
offerVsMin = (offerFte - gradeMin) / gradeMin      // negative means under the floor
```

An offer above `gradeMax` is red-circled on arrival; below `gradeMin` is
green-circled on arrival. Both are reported as facts, not errors. People do hire
above the maximum and the tool should not scold them for it.

### 7.2 Where the offer sits in the team

Over the incumbents in the offer's grade:

```
gradeHeadcount  = count
countPaidLess   = count where incumbentFte <  offerFte
countPaidSame   = count where incumbentFte == offerFte
countPaidMore   = count where incumbentFte >  offerFte
offerPercentile = countPaidLess / gradeHeadcount
```

The three counts sum to the headcount, so the table always reconciles. Also report
grade median FTE salary, grade median compa-ratio, lowest paid, and highest paid.

### 7.3 Leapfrog

An incumbent is **leapfrogged** when the offer is paid more than they are.

```
leapfrogged = incumbents in the offer's grade where incumbentFte < offerFte
```

Two subsets are counted separately, because they are the ones that generate a
conversation:

```
qualifiedLeapfrogs = leapfrogged where tenureMonths >= tenureQualifyingMonths
strongLeapfrogs    = qualifiedLeapfrogs whose performanceRating is in the
                     set you nominate as strong
```

**Grade inversion** is separate, and louder:

```
inverted = incumbents in ANY grade of higher `order` where incumbentFte < offerFte
```

Someone in a higher grade paid less than a new hire in a lower grade is a
structural problem the offer did not create but does expose. Reported distinctly
from peer leapfrog, never merged into the same count.

### 7.4 Peer compression

For every incumbent in the offer's grade:

```
peerGap = (incumbentFte - offerFte) / offerFte
```

Negative means the incumbent is paid less than the new hire.

```
peerGap <  0                              ->  inverted
0 <= peerGap < peerCompressionThreshold   ->  compressed
peerGap >= peerCompressionThreshold       ->  clear
```

**Flagged** requires a status of inverted or compressed **and**
`tenureMonths >= tenureQualifyingMonths`. Someone hired last month sitting near the
new hire is not compression, it is two people hired into the same market in the
same quarter. They are still listed, marked "recent hire", never flagged.

Where `hireDate` is missing the incumbent cannot be qualified. They are listed,
marked "tenure unknown", and counted in their own total. **They are not flagged and
they are not silently dropped.** The missing-data count stays on screen at all
times.

**The denominator is the offer, in every gap in this document.** The offer is the
variable under your control and the thing on the slider; holding the denominator
fixed means every gap on screen moves together and comparably as you drag it. If
the denominator switched to whichever salary was lower, the gaps would change
convention at parity and the ceiling arithmetic in 7.7 would stop being
inspectable. This is the choice in this spec I am least sure about — see 12.1.

### 7.5 Vertical compression

The differential between the offer and the level above it.

```
verticalGap = (comparatorFte - offerFte) / offerFte
```

The comparator is chosen in this order:

1. The incumbent named by the offer's `managerId`, if given.
2. Otherwise the **median FTE salary of the grade immediately above by `order`**.

Which one was used is always stated on screen. A grade median is a proxy, not a
manager, and labelling a proxy as a manager comparison is the kind of thing that
destroys trust in a tool the first time somebody checks.

Flagged when `verticalGap < verticalDifferentialThreshold`. A negative
`verticalGap` means the offer exceeds the level above it, which is reported in its
own right and not merely as a flag.

### 7.6 Cost to fix

Only flagged incumbents are costed. For each, a target salary by the selected rule:

```
parityWithOffer      targetFte = offerFte
restoreDifferential  targetFte = offerFte * (1 + peerCompressionThreshold)
compaRatioParity     targetFte = offerCompaRatio * incumbentGradeMid
```

`restoreDifferential` is the default: parity is rarely the intent — the point is
usually to restore a defensible gap, not to level everyone to the new hire.
`compaRatioParity` is the right rule when the flagged people sit in a different
grade, because it treats them consistently against their own structure rather than
against a number from someone else's grade.

Then, per incumbent:

```
payableTargetFte    = min(targetFte, incumbentGradeMax)
fundedAdjustmentFte = max(0, payableTargetFte - incumbentFte)
adjustmentCost      = fundedAdjustmentFte * fte          // actual payroll dollars
adjustmentPercent   = fundedAdjustmentFte / incumbentFte
blockedFte          = max(0, targetFte - incumbentGradeMax)
```

Never negative. Remediation does not cut anyone's pay, so the floor is zero.

`blockedFte` is the part of the fix that cannot be paid without going over that
incumbent's range maximum. It is reported separately as **the part money cannot
solve inside the structure**, with its own headcount. Rolling it into the cost
would quote a bill for an increase nobody has approved an exception for.

Aggregates:

```
remediationCost      = sum of adjustmentCost
remediationHeadcount = count where adjustmentCost > 0
blockedHeadcount     = count where blockedFte > 0
gradePayroll         = sum of actual baseSalary in the offer's grade
costAsPercentOfGrade = remediationCost / gradePayroll
totalFirstYearCost   = offerActualSalary + remediationCost
remediationPremium   = remediationCost / offerActualSalary
```

`totalFirstYearCost` is the headline. It is the number this tool exists to produce
and nothing else on a comp analyst's desk computes it.

**One ripple only.** Raising incumbents in a grade can compress the grade above
them. After remediation the tool recomputes vertical gaps and reports any pair that
has newly narrowed — but it does not cost a second round and does not iterate.
Chasing compression to convergence is a structure redesign, and this tool is not a
structure designer. The interface says so where the ripple is shown.

### 7.7 The clean offer ceiling

The highest offer that would flag nobody.

From 7.4, an incumbent is clear when `peerGap >= threshold`, which rearranges to
`offerFte <= incumbentFte / (1 + peerCompressionThreshold)`. So:

```
peerCeiling       = min over FLAGGABLE incumbents in the offer's grade of
                      incumbentFte / (1 + peerCompressionThreshold)
verticalCeiling   = comparatorFte / (1 + verticalDifferentialThreshold)
cleanOfferCeiling = min(peerCeiling, verticalCeiling, gradeMax)
```

Flaggable means tenure-qualified, matching 7.4 exactly — a ceiling computed on a
different population from the flags would contradict them on screen.

Returns null when there are no flaggable incumbents and no comparator, because
there is then no constraint, and null is not the same statement as zero.

Two results are worth naming when they happen, because they are the tool's sharpest
output:

- **`cleanOfferCeiling < gradeMin`** — your team and your structure already
  disagree. No offer inside the range avoids compression. The offer did not cause
  this and lowering it will not fix it.
- **`cleanOfferCeiling < marketReference`** — you cannot make a market-competitive
  offer without paying to fix the team. The tool then shows the two costed paths
  side by side: pay market and spend `remediationCost`, or pay the ceiling and
  spend nothing but go to market below the rate. It does not choose.

### 7.8 Tenure

```
tenureMonths = completed whole months from hireDate to the offer's startDate,
               or to today when no startDate is given
```

`completedMonthsBetween` already exists in Merit Lab's `proration.ts`. It gets
copied over with its tests at M1 rather than rewritten.

## 8. Build order

In order. Do not start the next until the previous one runs.

**M0 — Scaffold and deploy.** Project builds, test runner executes, a page saying
"Offer Lab" is live at a public URL. Deploy first so deployment is never a problem
later. *(The library and its 115 tests are already in place and green.)*

**M1 — The math library.** Everything in section 7, in `src/lib/`, with tests and
hand-calculated expected values. No interface at all. This milestone decides
whether the tool is credible.

**M2 — Data in.** Paste or type the team and the structure. Validate on entry:
missing grades, non-numeric salaries, duplicate ids, a `managerId` pointing at
nobody, hire dates in the future. Ship a synthetic team of about 40 people across 5
grades, built to contain a real compression trap so the tool demonstrates itself
before anyone types anything.

**M3 — The offer and its placement.** Grade, salary, and the figures from 7.1 and
7.2. First moment the tool is worth opening.

**M4 — Consequences.** Leapfrog, inversion, peer and vertical compression, the
lists behind each count, and the missing-data counts.

**M5 — Cost to fix.** Remediation targets, the blocked amount, and
`totalFirstYearCost`. The milestone that makes the tool worth showing to somebody.

**M6 — The salary rail.** The drag interaction in section 9, with the ceiling tick
and the market tick. The milestone that makes it worth talking about.

**M7 — Export and compare.** Scenario to a JSON file and back. Findings to CSV.
Hold two offers and flick between them.

**M8 — Ship it properly.** Landing copy explaining the privacy design in one
sentence, a README with a screenshot, a worked example anyone can follow.

## 9. Interaction design

### The governing rule

Same as Merit Lab, and non-negotiable for the same reason: **no Calculate button,
no Run, no Submit, no wizard, no loading spinner.** Every figure recomputes on
every keystroke and every pixel of drag. There is no server, so nothing can be
loading, and any step inserted between changing the offer and seeing the
consequence destroys the product.

### Layout

One screen. Offer and team on the left, consequences on the right, both always
visible.

```
┌──────────────────────────┬───────────────────────────────────────┐
│  OFFER      Req 4412     │  PLACEMENT   0.97 CR    58% pen       │
│  grade   [ G4      ▾ ]   │  RANK        4th of 11 · 64th pctile  │
│  salary  [ 118,000   ]   │                                       │
│                          │  LEAPFROGS   7  (4 tenured)           │
│  ┌──────────────────────┐│  COMPRESSED  3    INVERTED  2         │
│  │ ·· ·  ·●·   ·  ·     ││                                       │
│  │ min   ▲ceil ▲mkt  max││  COST TO FIX       $41,200            │
│  └──────────────────────┘│  TOTAL FIRST YEAR  $159,200           │
│   drag the offer         │  2 blocked by range max               │
│                          │                                       │
│  TEAM   11 in grade      │  ceiling $112,400 — below market      │
│  41 total · 3 no tenure  │  you cannot pay market without        │
│  [ load sample team ]    │  spending $41,200 on the team         │
└──────────────────────────┴───────────────────────────────────────┘
```

### The salary rail

The signature interaction, and the thing a spreadsheet fundamentally cannot do.

A horizontal rail spanning the offer grade's minimum to maximum. Every incumbent in
the grade is a dot, positioned by FTE salary. The offer is a distinct, draggable
marker on the same rail.

Drag it, and everything moves at once. Dots you pass turn the leapfrog colour. Dots
that fall inside the compression threshold turn the compression colour, and the
threshold itself is drawn as a shaded band travelling with the marker, so you see
the zone rather than infer it. The cost-to-fix figure counts as it changes.

Two static ticks on the rail: the **clean offer ceiling** and the **market
reference**. Dragging past the ceiling tick is the moment the tool earns its
existence — the practitioner watches the price of the decision appear.

Hovering a dot shows that incumbent's id, grade, salary, tenure, gap to the offer,
and what remediating them would cost. Dots stack vertically when salaries are
close, so eleven people never render as three.

### Everything is ambient

No modals, no alerts, no red banners, no error states. Counters increment with a
brief highlight. The practitioner is exploring a decision, not making a mistake.
Guardrails inform; they never interrupt.

### Every number opens

Any count on the right is clickable and expands into the list of people behind it,
in place, with the arithmetic for each one visible. A comp analyst asked "why is
that seven?" must be able to answer in one click, in front of the hiring manager. A
figure that cannot be traced back to the rows that produced it will not be trusted,
and should not be.

### Visual direction

Instrument, not brochure. Identical to Merit Lab, deliberately, so the two read as
one family: dense, quiet, neutral ground, one accent for the compression zone and
one for inversion. Tabular numerals everywhere — without them, live figures jitter
horizontally and the tool feels unstable.

### Anti-patterns

Do not build these, whatever convention suggests:

- A wizard or onboarding flow.
- Tabs separating the offer from its consequences.
- A modal for editing anything.
- A loading state. There is no server.
- **A score, grade, or traffic light on the offer.** No "B−", no "Risk: High". The
  tool reports consequences and costs them. Compressing the whole finding into one
  letter throws away the reasoning and invites the reader to argue with the grade
  instead of the numbers.
- **Any recommendation to lower the offer.** Show the ceiling and show the cost. The
  trade-off is the practitioner's to make and they have context the tool does not.

## 10. What this tool must never claim

Compression here is computed from pay, grade, and tenure. That is all it has.

It does not know scope, skill, criticality, location differentials, internal
mobility, or the fact that one of the people it flagged is leaving in March. A flag
means "these two salaries are close and one of these people has been here longer."
It does not mean the pay is wrong.

The interface says this once, plainly, where the findings are — not buried in a
tooltip. Same discipline as Merit Lab calling its compression output an *indicator*.
A tool that overstates what it knows gets caught once and is never opened again.

And the hard rule from section 2, restated because it matters most: **no names,
ever.** Not for the candidate, not for incumbents. If a pasted file contains a name
column it is dropped on import with a visible notice, not stored and hidden.

## 11. Definition of done for each milestone

- The test suite passes.
- The deployed public URL shows the new capability.
- You have used it once on the synthetic team and the numbers are right.

## 12. Decisions I made that you should argue with

These are the calls where I picked a default rather than asking, because you told me
to. Each has a real consequence you can evaluate.

**12.1 Every gap uses the offer as the denominator.** So a $100k offer against a
$104k incumbent reads as a 4.00% gap. Merit Lab expresses its differentials over the
*lower* salary, so the same pair reads 3.85% there. I chose consistency across this
screen over consistency with the sibling tool, because the offer is the thing you
are dragging. If you would rather the two tools agree, say so — it is a one-line
change now and a painful one after M4.

**12.2 Default peer threshold 5 points, vertical 15 points.** Common practice, not
your policy. Both are user-editable; only the defaults are mine.

**12.3 Tenure gates the flags, at 12 months.** An incumbent below 12 months is
listed and never flagged. The alternative is to flag everyone and let you filter. I
think flagging a colleague hired three weeks ago as compressed against a new hire is
noise that trains people to ignore the flags.

**12.4 `restoreDifferential` is the default remediation rule, not parity.** Parity
is almost never the intent and it produces a scarier number. If you would rather the
tool open on the worst case, that is defensible — it just is not what I would
default to.

**12.5 Remediation stops after one ripple.** Fixing grade 4 can compress grade 5.
The tool reports the newly narrowed pairs and does not cost them. Full iteration is
a structure redesign, and it converges on numbers nobody would ever spend.

**12.6 Costs are annualized, not prorated to the start date.** A remediation
approved in October costs three months this fiscal year, not twelve. I chose the
annualized figure because it is the run-rate liability, which is what the decision is
actually about. Proration is easy to add if you want both.

**12.7 Base salary only in v1.** No signing bonus, no equity, no target incentive. A
new hire with a 20% target against incumbents at 10% is real compression this version
cannot see. I left it out because total target cash roughly doubles the model, and
base is where the permanent liability lives. This is the largest scope call in the
document and the one I would most expect you to overturn.

**12.8 One offer at a time.** Hiring three people into the same team compounds, and
the third offer's compression depends on the first two. v1 models one. I would add a
slate at M7 rather than build it into the core now.

## 13. Open questions

- Whether Offer Lab should read a Merit Lab scenario file directly, so you can ask
  what an offer does to a team you have already run a merit cycle on. Technically
  small, and the two together tell a much longer story.
- Geographic differentials. Currently one structure, one currency, no zones.
- Whether reporting lines should be a real hierarchy rather than an optional
  `managerId`, which would let the tool find every direct-report pair instead of
  approximating with grade medians.
- Whether a rejected offer should be recordable, so the tool accumulates a history of
  what you did not do. Probably a different product.
