import "../../css/canonicalMergeDialog.css";

let nextDialogId = 0;
import { namespaces } from "vowl";
const SVG = namespaces.svg;

/**
 * Ask only about genuinely conflicting placements. The controller supplies
 * human-readable descriptions and binds the returned choices to its immutable
 * edit preview. This view cannot mutate ontology or scene state.
 */
export function requestCanonicalMergeResolution({
  conflicts,
  describeOccurrence,
  describeChoice,
  documentObject = document,
  signal,
}) {
  if (signal?.aborted) {
    return Promise.resolve(null);
  }
  if (conflicts.length === 0) {
    return Promise.resolve(new Map());
  }
  const doc = documentObject;
  const previousFocus = doc.activeElement;
  const dialog = doc.createElement("dialog");
  dialog.className = "canonical-merge-dialog";
  const titleId = `canonical-merge-${++nextDialogId}`;
  dialog.setAttribute("aria-labelledby", titleId);
  function element(tag, text, parent) {
    const node = doc.createElement(tag);
    if (text !== undefined) {
      node.textContent = text;
    }
    parent.append(node);
    return node;
  }
  const title = element("h2", "Choose the arrangement to keep", dialog);
  title.id = titleId;
  title.tabIndex = -1;
  element(
    "p",
    "This edit combines drawings with different arrangements. Choose which position, pin and visibility to keep for each result. Other arrangements will be discarded. Nothing changes until you apply the edit.",
    dialog,
  );
  const form = element("form", undefined, dialog);
  const choices = new Map();
  const changes = [];
  for (const [index, conflict] of conflicts.entries()) {
    const group = element("fieldset", undefined, form);
    element("legend", describeOccurrence(conflict.occurrence), group);
    const positioned = conflict.choices.filter(({ placement }) => placement);
    let preview;
    let markers = [];
    if (positioned.length > 0) {
      element("p", "Relative positions before this edit", group);
      preview = doc.createElementNS(SVG, "svg");
      preview.setAttribute("viewBox", "0 0 320 140");
      preview.setAttribute("aria-hidden", "true");
      preview.classList.add("canonical-merge-preview");
      group.append(preview);
      const xs = positioned.map(({ placement }) => placement.position.x);
      const ys = positioned.map(({ placement }) => placement.position.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const width = Math.max(1, Math.max(...xs) - minX);
      const height = Math.max(1, Math.max(...ys) - minY);
      const scale = Math.min(240 / width, 80 / height);
      markers = conflict.choices.map(({ placement }, choiceIndex) => {
        if (!placement) {
          return undefined;
        }
        const marker = doc.createElementNS(SVG, "g");
        marker.setAttribute(
          "transform",
          `translate(${40 + (placement.position.x - minX) * scale},${30 + (placement.position.y - minY) * scale})`,
        );
        const circle = doc.createElementNS(SVG, "circle");
        circle.setAttribute("r", "12");
        marker.append(circle);
        const text = doc.createElementNS(SVG, "text");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dy", "5");
        text.textContent = String(choiceIndex + 1);
        marker.append(text);
        preview.append(marker);
        return marker;
      });
    }
    for (const [choiceIndex, choice] of conflict.choices.entries()) {
      const label = element("label", undefined, group);
      label.className = "canonical-merge-choice";
      const radio = element("input", undefined, label);
      radio.type = "radio";
      radio.name = `${titleId}-group-${index}`;
      radio.required = true;
      radio.value = String(choiceIndex);
      const description = element("span", undefined, label);
      element(
        "strong",
        `${choiceIndex + 1}. ${describeChoice(choice.reference)}`,
        description,
      );
      const positionText = choice.placement
        ? `Position ${choice.placement.position.x}, ${choice.placement.position.y}; ${choice.placement.pinned ? "pinned" : "unpinned"}; `
        : "";
      element(
        "span",
        `${positionText}${choice.hidden ? "hidden" : "visible"}`,
        description,
      );
      radio.addEventListener("change", () => {
        choices.set(conflict.occurrence, choice.reference);
        for (const [markerIndex, marker] of markers.entries()) {
          marker?.classList.toggle("is-selected", markerIndex === choiceIndex);
        }
        changes.forEach((update) => update());
      });
    }
  }
  const instruction = element(
    "p",
    "Choose an arrangement for every result to enable Apply edit.",
    form,
  );
  instruction.id = `${titleId}-instruction`;
  const actions = element("div", undefined, form);
  actions.className = "canonical-merge-actions";
  const cancel = element("button", "Cancel", actions);
  cancel.type = "button";
  const apply = element("button", "Apply edit", actions);
  apply.type = "submit";
  apply.disabled = true;
  apply.setAttribute("aria-describedby", instruction.id);
  changes.push(() => {
    apply.disabled = choices.size !== conflicts.length;
  });
  return new Promise((resolve, reject) => {
    let finished = false;
    function finish(result) {
      if (finished) {
        return;
      }
      finished = true;
      signal?.removeEventListener("abort", abort);
      dialog.close();
      dialog.remove();
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      resolve(result);
    }
    function abort() {
      finish(null);
    }
    cancel.addEventListener("click", abort);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      abort();
    });
    dialog.addEventListener("close", abort);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (choices.size === conflicts.length) {
        finish(new Map(choices));
      }
    });
    signal?.addEventListener("abort", abort, { once: true });
    try {
      doc.body.append(dialog);
      dialog.showModal();
      title.focus({ preventScroll: true });
      if (signal?.aborted) {
        abort();
      }
    } catch (error) {
      signal?.removeEventListener("abort", abort);
      dialog.remove();
      reject(error);
    }
  });
}
