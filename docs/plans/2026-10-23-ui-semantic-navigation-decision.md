# UI-DEC-022: Inspecting related entities without a drawn occurrence

Status: accepted on 23 October 2026; option 1.

## Decision needed

Use description navigation inside full Details for relation links, including entities hidden by a filter.
Keep the graph's selected occurrence unchanged.
Closing Details returns to the original selection preview.

This is the recommended bounded design.
It uses the existing `describeOntologyElements` operation and requires no public controller or WebMCP contract change.

## Evidence and concrete behavior

The accepted UI plan's section 4 identifies this integration gap: “If it does not, accept a narrow semantic-description navigation design or separately approve a public selection contract with parity tests.”

`selectVisualizationElement` accepts an occurrence reference, while semantic descriptions and their relations carry ontology-element references.
They are different identities.
A hidden class may have no occurrence to select; a repeated class may have several.
`setVisualizationView` changes focus and presentation, and is not a semantic selection operation.

Example: select the drawn **Person** class, open Details, then follow its **Agent** relation while Agent is filtered out.
Under the recommendation, Details shows every returned Agent role and “Related entity details”; a **Back to selected Person** control returns to Person.
The graph, filter, camera and Person preview do not change.
Closing Details returns to the Person preview.
A new graph selection, load or incompatible revision invalidates the related-entity page.

## Options

| Option                       | Experience                                                                                                                                             | Cost and risk                                                                                                                                       | Recommendation                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Description navigation    | Relation links inspect related meaning inside Details. The original graph selection remains explicit and recoverable. Hidden entities remain readable. | Small UI navigation state scoped to generation/revision. Must label the subject clearly and avoid implying a new graph selection.                   | Select now.                                                              |
| 2. Public semantic selection | Relation links replace controller selection even without a drawn occurrence. Human and agent consumers could share that operation.                     | New public operation, error/ambiguity rules, lifecycle classification, renderer reconciliation and WebMCP parity work. Wider compatibility surface. | A valid later capability if semantic selection is wanted beyond Details. |

## Limits and sceptical assessment

Option 1 deliberately distinguishes inspecting a relation from selecting a graph object.
Poor labeling would be confusing, so the related subject and return action are mandatory.
It does not add graph keyboard navigation, reveal hidden nodes, move the camera or invent an occurrence.
Direct graph selection continues to use the existing controller operation.

Option 2 is more consistent if every inspected subject must become the application's shared selection, but that behavior is a product/API expansion, not a necessary prerequisite for complete reading.

## Acceptance evidence

- Independent fixtures for visible, hidden, repeated and multi-role related entities.
- All description fields and retained ontology facts remain available.
- No calls to view, arrangement, pinning or occurrence selection while following a relation.
- Clear subject heading, keyboard-operable return action, stable focus and no unbounded navigation history.
- Generation/revision validation before reading and before displaying; new graph selection resets navigation.
- Closing Details returns to the current selected preview; closing that preview clears controller selection.

## Disposition

The owner selected **1: Description navigation (recommended)**.
Implement the bounded Details navigation and its acceptance evidence.
No public semantic-selection operation is authorized by this decision.
