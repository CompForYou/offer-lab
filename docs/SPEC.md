# Offer Lab — Specification

Status: **agreed.** Section 13 records the decisions and the reasoning, so a reader
six months from now can see what was chosen rather than guessing. Section 8 is the
adoption test, and it is a build requirement, not an aspiration.

## 1. What this is

A single-page web app that answers one question: **if I hire this person at this
salary, what does it do to the team I already have?**

Where the offer lands in the range, who it leapfrogs, which incumbents it
compresses against, what fixing that would cost, and the highest offer that would
not have caused any of it.

### Why this does not already exist

Not because it is difficult. A comp analyst can build this in a spreadsheet in
twenty minutes: sort the team by salary, see where the offer lands, count who sits
below it.

The reason nobody does it is that **twenty minutes is too expensive for one
offer.** A merit model gets built because a merit cycle is annual, high-stakes, and
amortises across two hundred people. An offer is one decision, this week, with
another on Thursday. The setup cost per offer exceeds the perceived value every
single time — so the analysis does not happen, the offer gets eyeballed, and the
times the eyeball was wrong surface six months later as a resignation.

So the proposition is not "does what a spreadsheet cannot". It is **"changes the
cost of the analysis from twenty minutes to twenty seconds, so it actually
happens."** Everything in section 8 follows from that sentence.

### The liability the offer decision hides

An offer that looks like it costs $118,000 usually costs more, because a salary
that sits too close to an incumbent's resolves in one of three ways and all three
cost money:

- **You fix it.** A base adjustment is not a one-time cost. It is in every future
  merit calculation, every bonus target, and every benchmark of that population
  from then on.
- **You do not fix it and they find out.** Posted ranges and pay transparency
  legislation make discovery the default case, not the risk case. You pay it later,
  under pressure, at a worse price, having spent trust.
- **You do not fix it and they leave.** You re-hire at market — the number you were
  avoiding — plus vacancy and recruiting cost.

The offer is a one-time decision that creates a recurring obligation. Offer Lab
puts a number on that obligation while the decision is still open.

## 2. Who it is for

Compensation analysts and managers pricing an individual offer, and the HR business
partners who have to defend it. Specifically, the practitioner sitting opposite a
hiring manager who wants to go 12% over the top of the range, who needs to say what
that costs rather than that it feels wrong.

Same governing adoption constraint as Merit Lab: **nobody in compensation is
permitted to upload pay data to a stranger's website.** So the app never receives
it. Everything runs in the browser, transmits nothing, stores nothing. That
constraint is the feature and it is stated on the landing screen.

One constraint specific to this tool: an offer concerns a named human being who has
not been hired yet, and an incumbent list concerns named humans who have. Offer Lab
takes an identifier, never a name. The offer is "Req 4412", not a candidate. This is
stated in the interface, not only here.

## 3. What it is not

- **Not a market pricing tool.** It takes one market reference number if you have
  one. It does not hold survey data, age it, blend it, or price a job.
- **Not a levelling tool.** The grade comes in as an input. If the grade is wrong,
  every number is wrong, and no tool fixes that.
- **Not an equity or pay gap analysis.** It has no demographic data and must never
  take any. Compression and pay equity are different questions with different legal
  exposure, and a tool that conflates them is dangerous.
- **Not an approval workflow.** No routing, no sign-off, no audit trail, no HRIS
  write-back.
- **Not a judgement.** It reports consequences and prices the ways through. It does
  not score the offer or pick one. See 7.9 and section 10.

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

`types/domain.ts` carries `Grade` and `CompaRatioBand` across unchanged, so a salary
structure exported from Merit Lab loads into Offer Lab without translation.

**Copied at the milestone that needs them:** `completedMonthsBetween` from
`proration.ts` (M1), the CSV parser and importers (M2), the download helper and
scenario file (M2). Nothing enters this repository before it has a reason to be here
and a test of its own.

**Not copied at all:** the merit matrix, over-max modes, budget aggregates, the
advisor. Different tool, different question.

One shared behaviour, restated because it is easy to get wrong in both tools:
**`baseSalary` is actual pay at that person's FTE.** A 0.5 FTE incumbent paid $47,500
has a `baseSalary` of $47,500. Every *comparison* — placement, gaps, medians,
compression — grosses up to full-time equivalent, because ranges and differentials
are expressed in full-time terms. Every *cost* uses actual pay, because that is what
leaves the bank. Mixing these up produces a tool that reads every part-timer as
severely underpaid and then quotes a remediation bill for money nobody would spend.

## 5. Software terms

Merit Lab's SPEC section 4 covers repository, commit, branch, dependency, build,
deploy, component, state, props, unit test, type, and pure function. Those still
apply and are not repeated. New here:

- **Fixture** — a small block of made-up data written into a test so the expected
  answer can be worked out by hand. Every compression test gets one.
- **Derived value** — a number the app calculates rather than stores. Every figure on
  the Offer Lab screen is derived; the only stored things are the team, the
  structure, the offer, and the thresholds.

### Every term is defined in the product, not only here

A practitioner who has to leave the tool to find out what a number means will not
come back. Merit Lab's `glossary.ts` and `Explain.tsx` pattern comes across: every
domain term on screen carries a one-sentence definition, in place, on demand.

Two specific requirements beyond a glossary:

1. **The denominator convention is stated inline wherever a gap is shown**, not
   buried in the glossary. "4.0% — the incumbent is 4.0% above the offer, measured
   against the offer."
2. **Where Offer Lab and Merit Lab disagree, Offer Lab says so.** The same two
   salaries produce 4.00% here and 3.85% there (see 13.1). A tool that quietly
   contradicts its own sibling is worse than one that explains the difference.

## 6. Data model

### Grade

Unchanged from Merit Lab: `id`, `name`, `order` (1 = lowest), `min`, `mid`, `max`.

### Incumbent

Someone already on the team. The population the offer lands into.

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

`hireDate` and `performanceRating` are optional because most exports do not have them
and the tool must be useful without them. But they are the two fields that separate a
real compression finding from a list of people who happen to earn less. **When either
is missing, the tool says so on screen and reports the affected rows as unqualified.**
It does not quietly assume.

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
| `tenureQualifyingMonths` | 12 | Below this, an incumbent is reported but never flagged. See 13.3. |
| `remediationTarget` | `auto` | Restore-differential within grade, compa-ratio parity across grades. See 7.6. |
| `strongRatings` | empty | The rating values you nominate as strong. |
| `currency` / `locale` | USD / en-US | Display only. |

## 7. Compensation math

Implement exactly as written. Each function gets a unit test with a hand-calculated
expected value.

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

Two subsets counted separately, because they are the ones that generate a
conversation:

```
qualifiedLeapfrogs = leapfrogged where tenureMonths >= tenureQualifyingMonths
strongLeapfrogs    = qualifiedLeapfrogs whose performanceRating is in strongRatings
```

**Grade inversion** is separate, and louder:

```
inverted = incumbents in ANY grade of higher `order` where incumbentFte < offerFte
```

Someone in a higher grade paid less than a new hire in a lower grade is a structural
problem the offer did not create but does expose. Reported distinctly from peer
leapfrog, never merged into the same count.

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
`tenureMonths >= tenureQualifyingMonths`.

The gate exists because someone hired inside the last twelve months has not been
through a merit cycle: their salary is a *market-set* number, set by the same market
setting this offer. Comparing two market-set numbers and calling the difference
compression is a category error — both are correct, they were priced on different
days. Compression lives in salaries set by internal process, because internal process
is what lags market. Twelve months is also where most merit eligibility cutoffs sit,
so the tool agrees with the policy the organisation already has.

**The gate must never shrink the population invisibly.** Three counts are permanent
on-screen figures, not drill-downs:

```
recentHiresInZone   = incumbents inside the compression zone whose tenure is
                      below tenureQualifyingMonths
gateExcluded        = incumbents excluded from flagging by the tenure gate
tenureUnknown       = incumbents with no hireDate
```

`recentHiresInZone` catches the case the gate is weakest against: two people hired
eight months apart at very different rates because the market moved between them.
Real, and suppressed by the gate, so it is shown as its own number — listed, never
flagged, never costed.

`gateExcluded` matters most in a fast-growing team. If 60% of the team is under a
year, the flagged population is small and the tool reads as falsely reassuring. "12 of
41 incumbents excluded by the tenure gate" is on screen at all times.

`tenureUnknown` rows are listed and marked. **They are not flagged and they are not
silently dropped.**

**The denominator is the offer, in every gap in this document.** The offer is the
variable under the practitioner's control and the thing on the slider; holding the
denominator fixed means every gap on screen moves together and comparably as it is
dragged, and keeps the ceiling arithmetic in 7.7 inspectable. Merit Lab uses the lower
salary, so the two tools report the same pair differently. That difference is stated
in the interface — see 5 and 13.1.

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

Flagged when `verticalGap < verticalDifferentialThreshold`. A negative `verticalGap`
means the offer exceeds the level above it, reported in its own right and not merely
as a flag. This one matters more than peer compression in one specific way: it removes
the financial reason to accept a promotion.

### 7.6 Cost to fix

Only flagged incumbents are costed. Each gets a target salary by one of three rules:

```
parityWithOffer      targetFte = offerFte
restoreDifferential  targetFte = offerFte * (1 + peerCompressionThreshold)
compaRatioParity     targetFte = offerCompaRatio * incumbentGradeMid
```

**The default is `auto`: restore-differential for incumbents in the offer's grade,
compa-ratio parity for incumbents in any other grade.** A target of "5% ahead of the
offer" applied to someone in a different grade is arithmetic without meaning — it
prices a G5 employee off a G4 offer. Compa-ratio parity treats them against their own
structure, which is the only defensible cross-grade rule.

Worked example. Offer $100,000 into G4, threshold 5%, G4 mid $100,000, G5 mid $115,000:

| Incumbent | Now | parity | restoreDifferential | compaRatioParity | `auto` |
|---|---|---|---|---|---|
| A — G4, 5 yrs | $98,000 | $100,000 | $105,000 | $100,000 | **$105,000** |
| B — G5, inverted | $101,000 | $101,000 | $105,000 | $115,000 | **$115,000** |

All three rules stay selectable and the cost updates live. `auto` is only what the
tool opens on, not a one-way door.

Then, per incumbent:

```
payableTargetFte    = min(targetFte, incumbentGradeMax)
fundedAdjustmentFte = max(0, payableTargetFte - incumbentFte)
adjustmentCost      = fundedAdjustmentFte * fte          // actual payroll dollars
adjustmentPercent   = fundedAdjustmentFte / incumbentFte
blockedFte          = max(0, targetFte - incumbentGradeMax)
```

Never negative. Remediation does not cut anyone's pay, so the floor is zero.

`blockedFte` is the part of the fix that cannot be paid without exceeding that
incumbent's range maximum. Reported separately as **the part money cannot solve inside
the structure**, with its own headcount. Rolling it into the cost would quote a bill
for an increase nobody has approved an exception for.

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

`totalFirstYearCost` is the headline. Nothing else on a comp analyst's desk computes it.

**One ripple only.** Raising incumbents in a grade can compress the grade above them.
After remediation the tool recomputes vertical gaps and reports any pair that has newly
narrowed — but it does not cost a second round and does not iterate. Chasing compression
to convergence is a structure redesign, and it converges on numbers nobody would spend.
The interface says so where the ripple is shown.

### 7.7 The clean offer ceiling

The highest offer that would flag nobody.

From 7.4, an incumbent is clear when `peerGap >= threshold`, which rearranges to
`offerFte <= incumbentFte / (1 + peerCompressionThreshold)`. So:

```
peerCeiling(population) = min over that population of
                            incumbentFte / (1 + peerCompressionThreshold)
verticalCeiling         = comparatorFte / (1 + verticalDifferentialThreshold)

gatedCeiling   = min( peerCeiling(tenure-qualified incumbents), verticalCeiling, gradeMax )
ungatedCeiling = min( peerCeiling(ALL incumbents in grade),     verticalCeiling, gradeMax )
```

**Both are computed and both are shown whenever they differ.** The gated ceiling
matches the flags exactly, so the two never contradict each other on screen. But a
gated ceiling on a young team is high *because it ignored nine people* — it would say
$130,000 is clean when it is clean only by exclusion. Showing the ungated figure
alongside is what stops the gate from producing false comfort. The rail draws the gated
ceiling as a solid tick and the ungated one as a lighter tick behind it.

Either returns null when its population is empty and there is no comparator, because
there is then no constraint, and null is not the same statement as zero.

Two results are named when they happen, because they are the tool's sharpest output:

- **`ceiling < gradeMin`** — the team and the structure already disagree. No offer
  inside the range avoids compression. The offer did not cause this and lowering it
  will not fix it.
- **`ceiling < marketReference`** — a market-competitive offer is not possible without
  paying to fix the team. The costed paths in 7.9 then carry the decision.

### 7.8 Tenure

```
tenureMonths = completed whole months from hireDate to the offer's startDate,
               or to today when no startDate is given
```

`completedMonthsBetween` already exists in Merit Lab's `proration.ts`. Copied over with
its tests at M1 rather than rewritten.

### 7.9 Costed paths

The tool names the ways through and prices each one. It does not rank them, score them,
or mark one recommended. Three paths, always in this fixed order, never sorted by cost:

```
A. Pay the offer as entered, fix every flag.
   cost = remediationCost                  total = offerActual + remediationCost

B. Pay the ceiling, fix nothing.
   cost = 0                                total = ceilingActual
   also: shortfall = offerFte - ceilingFte, and vs marketReference if given

C. Pay the offer as entered, fix inversions only (peerGap < 0).
   cost = remediationCost restricted to inverted incumbents
   total = offerActual + that cost
```

Path C exists because it is what practitioners actually do under budget pressure:
somebody being paid *less* than a new hire is indefensible, while somebody being paid
slightly more is merely uncomfortable. Pricing that middle route is more useful than
pretending the choice is binary.

Where a path is not available — no ceiling, no inversions — it is omitted rather than
shown at zero.

## 8. Adoption — the three conditions

The value proposition in section 1 is about the cost of the analysis, not its
difficulty. Three things follow, and each is a build requirement that gets tested at
its milestone. If they are not met, this is a demonstration of some correct arithmetic
that gets opened once.

### 8.1 The team must survive between sessions

If a practitioner re-pastes forty-one people every morning, they use this twice and
stop. Constraint 3 — no persistence by default — is correct and does not conflict:
**export the team and structure to a file, drop the file back tomorrow.** Save/load is
therefore at **M2, not M7**. It is the single change most likely to decide whether this
becomes routine.

*Milestone test:* load the sample team, export, reload the page, re-import, and reach
an identical screen.

### 8.2 The answer must be able to leave as text

The practitioner's actual deliverable is an email or a message to a hiring manager. If
the finding cannot leave the tool, the tool is a detour on the way to writing it by
hand. So: **a copy-to-clipboard summary in plain language**, numbers filled in, no
jargon that needs the glossary. The clipboard is local; nothing is transmitted.

The template, filled from the live scenario:

> Offer of $118,000 into G4 lands at 0.97 compa-ratio, 58% range penetration, above 7
> of 11 incumbents. It falls within 5% of 3 tenured incumbents and above 2 more.
> Restoring the differential for those 5 would cost $41,200 a year, of which $6,100
> cannot be paid inside their range maximums. Total first-year cost of this hire is
> $159,200.

This is probably the highest value-per-line-of-code feature in the product. It ships at
**M5**, with the cost figures it quotes.

*Milestone test:* the paragraph pastes into an email and needs no editing to be sent.

### 8.3 It must eat a real export

Column mapping, not a fixed template. Real HRIS exports carry junk columns, inconsistent
headers, blank rows, and salaries formatted as text with currency symbols. Merit Lab's
importer already normalises headers; that behaviour comes across and is extended rather
than replaced.

*Milestone test:* a deliberately messy synthetic export — mixed header casing, a name
column that must be dropped, `$118,000.00` as text, two blank rows, a duplicate id —
imports with clear, specific messages and no silent losses.

### 8.4 What this tool does not beat a spreadsheet at

Stated plainly so nobody is surprised later. Their data already lives in Excel. Excel is
shareable and emailable; this deliberately is not. Any practitioner *can* do the
sort-and-eyeball version in twenty minutes.

Four things are genuinely hard there, and they are where this earns its place:

1. **The ceiling is a backwards solve** across every tenured incumbent, the vertical
   comparator, and the range maximum. Goal-seek per constraint, per offer. Wanted
   constantly, computed almost never.
2. **Cost-to-fix needs a three-way join** — flagged people, their own range maximums,
   their FTE — and the *blocked* portion is exactly what gets missed in a model built at
   4pm under pressure.
3. **Live exploration in front of another person.** The analyst's job in an offer
   conversation is negotiating in real time, not producing a number. A spreadsheet in
   that meeting is a liability. Dragging the offer and watching the cost move changes the
   analyst from *the person who says no* into *the person who shows the price of yes*.
4. **The discipline that gets skipped under time pressure** — FTE gross-up, missing hire
   dates, blocked-by-max, gate exclusions. The tool never forgets; a hurried spreadsheet
   always does.

## 9. Build order

In order. Do not start the next until the previous one runs.

**M0 — Scaffold and deploy.** Project builds, test runner executes, a page saying "Offer
Lab" live at a public URL. Deploy first so deployment is never a problem later. *(The
library and its 115 tests are already in place and green.)*

**M1 — The math library.** All of section 7, in `src/lib/`, with tests and
hand-calculated expected values. No interface. This milestone decides whether the tool is
credible.

**M2 — Data in, and data out.** Paste or type the team and the structure, with column
mapping. Validate on entry: missing grades, non-numeric salaries, duplicate ids, a
`managerId` pointing at nobody, hire dates in the future, a name column (dropped, with
notice). Synthetic team of about 40 across 5 grades containing a real compression trap.
**Scenario save and load, moved here from M7 — see 8.1.**

**M3 — The offer and its placement.** Grade, salary, and the figures from 7.1 and 7.2.
First moment the tool is worth opening.

**M4 — Consequences.** Leapfrog, inversion, peer and vertical compression, the lists
behind each count, and the three standing counts from 7.4.

**M5 — Cost to fix, and the paragraph.** Remediation targets, blocked amount,
`totalFirstYearCost`, the costed paths from 7.9, and the copy-out summary from 8.2. The
milestone that makes the tool worth showing to somebody.

**M6 — The salary rail.** The drag interaction in section 10, with both ceiling ticks and
the market tick. The milestone that makes it worth talking about.

**M7 — Compare.** Hold two offers and flick between them. Findings to CSV.

**M8 — Ship it properly.** Landing copy explaining the privacy design in one sentence, a
README with a screenshot, a worked example anyone can follow.

## 10. Interaction design

### The governing rule

Same as Merit Lab, non-negotiable for the same reason: **no Calculate button, no Run, no
Submit, no wizard, no loading spinner.** Every figure recomputes on every keystroke and
every pixel of drag. There is no server, so nothing can be loading, and any step inserted
between changing the offer and seeing the consequence destroys the product.

### Layout

One screen. Offer and team on the left, consequences on the right, both always visible.

```
┌──────────────────────────┬───────────────────────────────────────┐
│  OFFER      Req 4412     │  PLACEMENT   0.97 CR    58% pen       │
│  grade   [ G4      ▾ ]   │  RANK        4th of 11 · 64th pctile  │
│  salary  [ 118,000   ]   │                                       │
│                          │  LEAPFROGS   7  (4 tenured)           │
│  ┌──────────────────────┐│  COMPRESSED  3    INVERTED  2         │
│  │ ·· ·  ·●·   ·  ·     ││  2 recent hires in zone · 3 no tenure │
│  │ min  ┊▲ceil ▲mkt  max││                                       │
│  └──────────────────────┘│  COST TO FIX       $41,200            │
│   drag the offer         │  TOTAL FIRST YEAR  $159,200           │
│                          │  $6,100 blocked by range max          │
│  TEAM   11 in grade      │                                       │
│  41 total · 12 gated out │  A pay offer, fix all   $159,200      │
│  [ load ] [ save ]       │  B pay ceiling, fix none $112,400     │
│                          │  C pay offer, fix inv.   $132,800     │
└──────────────────────────┴───────────────────────────────────────┘
```

### The salary rail

The signature interaction, and the thing a spreadsheet fundamentally cannot do.

A horizontal rail spanning the offer grade's minimum to maximum. Every incumbent in the
grade is a dot, positioned by FTE salary. The offer is a distinct, draggable marker on
the same rail.

Drag it and everything moves at once. Dots passed turn the leapfrog colour. Dots inside
the compression threshold turn the compression colour, and the threshold is drawn as a
shaded band travelling with the marker so the zone is visible rather than inferred. The
cost-to-fix figure counts as it changes.

Three ticks: the **gated ceiling** solid, the **ungated ceiling** lighter behind it, and
the **market reference**. Dragging past the ceiling tick is the moment the tool earns its
existence — the practitioner watches the price of the decision appear.

Hovering a dot shows that incumbent's id, grade, salary, tenure, gap to the offer, and
what remediating them would cost. Dots stack vertically when salaries are close, so
eleven people never render as three.

### Everything is ambient

No modals, no alerts, no red banners, no error states. Counters increment with a brief
highlight. The practitioner is exploring a decision, not making a mistake. Guardrails
inform; they never interrupt.

### Every number opens

Any count on the right is clickable and expands into the list of people behind it, in
place, with the arithmetic for each visible. A comp analyst asked "why is that seven?"
must be able to answer in one click, in front of the hiring manager. A figure that cannot
be traced back to the rows that produced it will not be trusted, and should not be.

### Every term explains itself

Per section 5. One-sentence definitions in place, on demand, including the denominator
convention wherever a gap appears.

### Visual direction

Instrument, not brochure. Identical to Merit Lab, deliberately, so the two read as one
family: dense, quiet, neutral ground, one accent for the compression zone and one for
inversion. Tabular numerals everywhere — without them, live figures jitter horizontally
and the tool feels unstable.

### Anti-patterns

Do not build these, whatever convention suggests:

- A wizard or onboarding flow.
- Tabs separating the offer from its consequences.
- A modal for editing anything.
- A loading state. There is no server.
- **A score, grade, or traffic light on the offer.** No "B−", no "Risk: High". A letter
  throws away the reasoning and invites the reader to argue with the grade instead of the
  numbers.
- **A ranked or recommended path.** 7.9 prices three routes in a fixed order. Marking one
  as the answer discards context the practitioner has and the tool does not.

## 11. What this tool must never claim

Compression here is computed from pay, grade, and tenure. That is all it has.

It does not know scope, skill, criticality, location differentials, internal mobility, or
the fact that one of the people it flagged is leaving in March. A flag means "these two
salaries are close and one of these people has been here longer." It does not mean the pay
is wrong.

The interface says this once, plainly, where the findings are — not buried in a tooltip.
Same discipline as Merit Lab calling its compression output an *indicator*. A tool that
overstates what it knows gets caught once and is never opened again.

And the hard rule from section 2, restated because it matters most: **no names, ever.**
Not for the candidate, not for incumbents. A name column in a pasted file is dropped on
import with a visible notice, not stored and hidden.

## 12. Definition of done for each milestone

- The test suite passes.
- The deployed public URL shows the new capability.
- The milestone test in section 8, where one applies, passes.
- You have used it once on the synthetic team and the numbers are right.

## 13. Decisions of record

Settled. Recorded with the reasoning so a later reader can see what was chosen rather
than reverse-engineering it.

**13.1 Every gap uses the offer as the denominator.** A $100,000 offer against a $104,000
incumbent reads 4.00% here and 3.85% in Merit Lab, which divides by the lower salary.
Chosen for consistency across this screen, because the offer is the variable being
dragged. **The cost is paid by explaining it in the interface**, per section 5 — inline
wherever a gap is shown, plus a statement of the difference from Merit Lab.

**13.2 Peer threshold 5 points, vertical 15 points.** Common practice, not policy. Both
user-editable; only the defaults are ours.

**13.3 Tenure gates the flags at 12 months**, because a sub-12-month salary is
market-set, not process-set, and comparing two market-set numbers is a category error.
Second-order effects are handled rather than ignored: `recentHiresInZone` surfaces the
case the gate is weakest against, `gateExcluded` prevents false comfort in a young team,
and 7.7 publishes the ungated ceiling alongside the gated one so the gate cannot inflate
the safe-offer number invisibly.

**13.4 Remediation defaults to `auto`** — restore-differential within the offer's grade,
compa-ratio parity across grades — because a differential target applied to another grade
prices one grade's employee off another grade's offer. All three rules remain selectable.

**13.5 Remediation stops after one ripple.** Fixing grade 4 can compress grade 5. The tool
reports newly narrowed pairs and does not cost them. Full iteration is a structure
redesign and converges on numbers nobody would spend.

**13.6 Costs are annualized, not prorated to the start date.** A remediation approved in
October costs three months this fiscal year, not twelve. Annualized is the run-rate
liability, which is what the decision is about. Proration is easy to add later.

**13.7 Base salary only in v1.** No signing bonus, no equity, no target incentive. A new
hire at a 20% target against incumbents at 10% is real compression this version cannot
see. Base is where the permanent liability lives, and total target cash roughly doubles
the model. The blind spot is stated in the interface, not hidden.

**13.8 One offer at a time.** Hiring three people into the same team compounds, and the
third offer's compression depends on the first two. A slate belongs after M7, not in the
core.

**13.9 Recommendations are priced, never ranked.** Scoring the offer is banned; naming
three costed routes is required. The distinction is that one discards the practitioner's
context and the other supplies information they lack.

## 14. Open questions

- Whether Offer Lab should read a Merit Lab scenario file directly, so you can ask what an
  offer does to a team you have already run a merit cycle on. Technically small now that
  8.1 puts scenario files at M2, and the two together tell a much longer story.
- Geographic differentials. Currently one structure, one currency, no zones.
- Whether reporting lines should be a real hierarchy rather than an optional `managerId`,
  which would let the tool find every direct-report pair instead of approximating with
  grade medians.
- Whether a rejected offer should be recordable, so the tool accumulates a history of what
  you did not do. Probably a different product.
