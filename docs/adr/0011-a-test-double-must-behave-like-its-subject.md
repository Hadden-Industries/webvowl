# 0011. A test double must behave like its subject

- Status: Accepted
- Date: 2026-09-04

## Context

Three defects in one session were each hidden by a test double that was more
polite than the thing it stood for. Every one of them passed a green suite and
was found only by a person using the application.

**Exporting an SVG never saved a file.** `#exportSvg` is both the control a
reader clicks and the link the artifact is published onto, so the handler
finished by clicking that element to trigger the save — which re-entered the
handler. Each pass called `preventDefault()`, so the download never happened,
and `hideAllMenus()`, so menus flashed open and vanished. The recursion was
unbounded. The test double for that element was `click: jest.fn()`: it recorded
the call and dispatched nothing, so the handler never re-entered and the test
asserted, quite happily, that exactly one download had been triggered. Once the
double dispatched to its own listener the way a real element does, the test
failed by exhausting a four-gigabyte heap.

**Exporting set a settled graph moving again.** Exporting pauses the layout and
restores the previous state, and resuming re-energises the simulation, so every
export re-ran the whole layout on a graph the reader had watched come to rest.
The renderer double recorded `paused(isPaused)` into an array and touched no
simulation, so no test could see that pausing and resuming had any effect at
all.

**Exported SVGs carried no styling.** The export serialized a bare clone of the
live SVG, which takes none of the stylesheet with it, and opened as black shapes
in a corner. The element double had no `remove()` — a method every real element
has — which is a smaller instance of the same thing: a double that answers a
narrower interface than its subject.

The common shape is not "insufficient coverage". Each of these had a test
written for exactly the behaviour that was broken. The double simply could not
express the failure.

## Decision

A test double must reproduce the behaviour its subject is relied upon for, not
merely record that it was called.

1. **A double that stands for a DOM element performs the element's own
   behaviour.** `click()` dispatches to registered listeners and, when nothing
   calls `preventDefault()`, performs the default action the test can then
   observe. The double implements the members its subject has, including the
   ones the code under test does not currently call.
2. **A double that stands for a module reproduces the effects the caller depends
   on.** Where a real method starts, stops or changes something the caller later
   relies on, the double changes the corresponding observable state. Recording
   the call is additional, not a substitute.
3. **Where a double cannot reproduce an effect, the test says so.** A comment at
   the double states what it does not model, so a later reader knows the
   protection has a hole rather than assuming it does not.
4. **When a defect is found behind a double, the double is corrected first.**
   The failing test comes from making the double honest; only then is the
   production code changed. A fix that leaves the double polite has removed the
   symptom and kept the blind spot.
5. **A double is not a place to encode the current implementation.** It stands
   for the contract. Where the subject's real behaviour is unclear, that is a
   question about the contract, and the answer belongs in the contract's own
   test.

## Consequences

Doubles become larger and more like the things they replace, which is a real
cost in reading and maintenance. That cost is accepted: the alternative is a
suite whose green result carries less information than it appears to.

Some effects cannot be reproduced outside a browser — resolving computed styles,
painting, and the timing of animation frames among them. Those are named at the
double and verified behaviourally instead, in a visible browser window rather
than a background tab, because a hidden tab suspends animation frames and makes
a load or an export appear to hang.

This decision does not add a lint rule or an automated check. Whether a double
is honest is a judgement about what its subject is relied upon for, and a rule
that could be checked mechanically would be satisfied by doubles that are still
misleading. It is enforced in review, and by the habit in point 4.

## Verification obligations

- A test that drives an element through a click asserts the outcome a reader
  would see — a file saved, a menu still open — and not only that a handler ran.
- A test that pauses or resumes something asserts the state afterwards, not the
  request that was made.
- A defect found in the application is reproduced by making the relevant double
  honest before the production change, and the resulting test is kept.

## Related

- [0010](0010-rendered-graph-is-a-projection-not-the-store.md) puts the renderer
  behind a seam whose two implementations are held to one shared contract; that
  contract is only as good as the double on the far side of it.
- [`docs/evaluations/webmcp-integration.md`](../evaluations/webmcp-integration.md)
  records the three defects above as they were found.
