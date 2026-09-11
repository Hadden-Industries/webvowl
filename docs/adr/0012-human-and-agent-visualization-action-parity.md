# ADR 0012: Human and agent callers share visualization actions

Status: accepted scope amendment from the repository owner's 2026-09-09 task
instructions. Implementation is in progress. Amends ADR 0010 decisions 5 and 8
and the original WebMCP design/plan exclusions. It retains ADR 0010's ontology
ownership, immutable observations and prohibition on live renderer objects in UI.

The owner requires all human application actions to be available through WebMCP
except experimental ontology editing. Display choices, force distances, reset,
arrangement and all supported export formats therefore belong to the shared
application contract. The original five-tool ceiling no longer applies.

Pause stops automatic layout motion while retaining the arrangement. Resume
restarts motion. Zoom and center frames the visible graph without rearranging it.
Omission leaves the corresponding activity alone. Retire preserve and fit without
aliases. Standing language, visibility, focus, modes and force distances are
separate from transient layout/viewport commands and actual renderer observations.

Three identities have distinct meanings:

- An OntologyElementReference describes an ontology entity by kind and IRI, or
  an anonymous entity within its load generation. Focusing a named entity can
  highlight several drawn occurrences.
- A VOWL document record target identifies a record already present in the
  application-owned document. Human editing must retain the existing ability to
  edit that selected record when several records share an IRI. A renderer object
  is neither the target nor the document's system of record.
- A rendered occurrence reference is opaque and generation-scoped. Arrangement
  actions can move or pin one drawn occurrence. Such a reference conveys no new
  ontology fact and cannot be used as an ontology-editing authority.

Experimental editing remains available to humans and has no WebMCP registration.
The owner's subsequent clarification limits this work to preserving existing
human behavior: retain completed useful work, add no editor capabilities, and do
not expand this integration into an editor redesign or general editor repair.
Preserving it during the ownership cutover requires application-owned document
updates, immutable editor descriptions, explicit operations and confirmed deletion
proposals. Inspection, recovery and semantic exports must observe accepted human
edits. Moving the exporter to an unchanged original model would silently lose them.

Reset restores visualization defaults, clears focus and selection and resumes
layout. It retains the current ontology and label-language choice. Both callers
use one operation; menus present its observed values rather than dispatching
synthetic input/click events to reconstruct the reset. Saved-view decoding belongs
to the application; imported false and zero values are meaningful.

Domain requests do not require browser gestures, menu opening or file dialogs.
Input adapters express the corresponding source or visualization request. Actual
behavior, accepted bounds, completion and visible state must agree. There is no
reachable server-upload workflow in the inspected application, so this amendment
does not invent one.

The broader contract follows R2 using the accepted committed design/plan and the
owner's current amendment. Independent review, scoped native security review and
real-browser action/artifact evidence remain required. Passing tests or this
decision record do not establish completed implementation or product publication.
