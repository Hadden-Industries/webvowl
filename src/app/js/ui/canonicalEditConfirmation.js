import "../../css/canonicalMergeDialog.css";

let nextId = 0;

/** Present a retained semantic edit proposal. This view cannot authorize another revision. */
function confirmEdit({
  title,
  explanation,
  action,
  records,
  inspection,
  documentObject = document,
  signal,
}) {
  if (signal?.aborted) {
    return Promise.resolve(false);
  }
  const doc = documentObject;
  const previousFocus = doc.activeElement;
  const dialog = doc.createElement("dialog");
  dialog.className = "canonical-merge-dialog";
  dialog.setAttribute("closedby", "any");
  const id = `canonical-edit-confirmation-${++nextId}`;
  dialog.setAttribute("aria-labelledby", id);
  function append(tag, text, parent = dialog) {
    const node = doc.createElement(tag);
    if (text !== undefined) {
      node.textContent = text;
    }
    parent.append(node);
    return node;
  }
  const heading = append("h2", title);
  heading.id = id;
  heading.tabIndex = -1;
  append("p", explanation);
  const indexed = new Map(
    ["subjects", "roles", "expressions", "constructs"].flatMap((collection) =>
      inspection.records[collection].map((record) => [record.id, record]),
    ),
  );
  function describe(value) {
    if (Array.isArray(value)) {
      return value.map(describe).join(", ");
    }
    if (value && typeof value === "object") {
      if (typeof value.lexical === "string") {
        return `${JSON.stringify(value.lexical)}${value.language ? ` @${value.language}` : value.datatype ? ` ^^<${value.datatype}>` : ""}`;
      }
      return Object.entries(value)
        .map(([key, entry]) => `${key}: ${describe(entry)}`)
        .join("; ");
    }
    const record = indexed.get(value);
    const iri = record?.iri ?? indexed.get(record?.subject)?.iri;
    if (iri) {
      return `<${iri}>${record.kind ? ` (${record.kind.replaceAll("-", " ")})` : ""}`;
    }
    if (record) {
      return `${record.kind ?? "anonymous subject"} (${record.id})`;
    }
    return String(value);
  }
  const details = append("details");
  append("summary", `Review all ${records.length} affected records`, details);
  const list = append("ol", undefined, details);
  for (const record of records) {
    const item = append("li", undefined, list);
    append("strong", record.kind?.replaceAll("-", " ") ?? "subject", item);
    const values = append("dl", undefined, item);
    for (const [key, value] of Object.entries(record)) {
      if (["id", "kind"].includes(key)) {
        continue;
      }
      append("dt", key.replaceAll("-", " "), values);
      append("dd", describe(value), values);
    }
  }
  const actions = append("div");
  actions.className = "canonical-merge-actions";
  const cancel = append("button", "Cancel", actions);
  cancel.type = "button";
  const apply = append("button", action, actions);
  apply.type = "button";
  return new Promise((resolve, reject) => {
    let finished = false;
    function finish(accepted) {
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
      resolve(accepted);
    }
    function abort() {
      finish(false);
    }
    cancel.addEventListener("click", abort);
    apply.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      abort();
    });
    dialog.addEventListener("close", abort);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      doc.body.append(dialog);
      dialog.showModal();
      cancel.focus({ preventScroll: true });
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

export function requestCanonicalDeletionConfirmation(proposal, options = {}) {
  const annotations = proposal.annotationLosses.length;
  return confirmEdit({
    ...options,
    title: "Delete ontology facts?",
    explanation: `This removes ${proposal.removedRecords.length} records from the current document, including ${annotations} annotation records. The list includes related facts that depend on the selected elements. Cancel to keep the document unchanged.`,
    action: "Delete facts",
    records: proposal.removedRecords.map(({ record }) => record),
    inspection: proposal.inspection,
  });
}

export function requestCanonicalInverseDetachmentConfirmation(
  proposal,
  options = {},
) {
  return confirmEdit({
    ...options,
    title: "Detach the inverse relationship?",
    explanation:
      "Changing this endpoint removes the listed inverse relationships. The partner property's asserted endpoints stay unchanged. Cancel to keep the current relationships.",
    action: "Detach and change endpoint",
    records: proposal.relationships,
    inspection: proposal.inspection,
  });
}
