import { OWLDocumentFormats } from "owlapi/formats";
import { OWLOntologyLoaderConfiguration } from "owlapi/model";
import { profiles, migrationDialect as LEGACY_DIALECT } from "vowl";
import { isIri } from "@hyperjump/uri";
import "../../css/canonicalMergeDialog.css";
import { requestCanonicalCreation } from "./canonicalCreationDialog.js";

let nextId = 0;

/** Document identity is explicit; OWL syntax defaults to owning-parser detection. */
export function requestCanonicalInputSelection({
  documentObject = document,
  displayName = "Direct input",
  signal,
  owlFormats,
  knownDocumentIri,
  requireReader = false,
} = {}) {
  signal?.throwIfAborted();
  const doc = documentObject;
  const previousFocus = doc.activeElement;
  const dialog = doc.createElement("dialog");
  dialog.className = "canonical-merge-dialog canonical-input-dialog";
  dialog.setAttribute("closedby", "any");
  const id = `canonical-input-${++nextId}`;
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  function append(tag, text, parent = dialog) {
    const element = doc.createElement(tag);
    if (text !== undefined) {
      element.textContent = text;
    }
    parent.append(element);
    return element;
  }
  append("h2", "Open ontology").id = `${id}-title`;
  append("p", displayName);
  const form = append("form");
  const syntaxLabel = append("label", "Document format", form);
  syntaxLabel.htmlFor = `${id}-syntax`;
  const syntax = append("select", undefined, form);
  syntax.id = syntaxLabel.htmlFor;
  syntax.required = true;
  const placeholder = append("option", "Choose a format", syntax);
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  if (!owlFormats) {
    const automatic = append("option", "Auto-detect OWL format", syntax);
    automatic.value = "owl:auto";
    automatic.selected = !requireReader;
    placeholder.selected = requireReader;
    const canonical = append("option", "Canonical VOWL", syntax);
    canonical.value = "canonical";
    const legacy = append(
      "option",
      "Legacy WebVOWL (supported exporter only)",
      syntax,
    );
    legacy.value = "legacy";
  }
  const group = append("optgroup", undefined, syntax);
  group.label = "OWL document formats";
  for (const format of Object.values(OWLDocumentFormats)) {
    if (owlFormats && !owlFormats.includes(format.key)) {
      continue;
    }
    const option = append(
      "option",
      `${format.key} (${format.mediaTypes[0]})`,
      group,
    );
    option.value = `owl:${format.key}`;
  }
  const context = append("div", undefined, form);
  context.hidden = true;
  const baseLabel = append("label", "Original document IRI", context);
  baseLabel.htmlFor = `${id}-base`;
  const base = append("input", undefined, context);
  base.id = baseLabel.htmlFor;
  base.type = "text";
  base.autocomplete = "url";
  base.spellcheck = false;
  if (knownDocumentIri !== undefined) {
    base.value = knownDocumentIri;
    base.readOnly = true;
  }
  const help = append(
    "p",
    knownDocumentIri === undefined
      ? "Enter the document's original absolute IRI. Relative names and imports resolve against this address unless the document declares its own base. The address is not fetched to open this local input."
      : "The server did not identify a unique OWL syntax. Choose the format of this document. Its retrieved address is retained for relative names and imports.",
    context,
  );
  help.id = `${id}-help`;
  base.setAttribute("aria-describedby", help.id);
  const legacyNotice = append(
    "p",
    "Use this only for the supported historical WebVOWL exporter. Older exporter dialects require separate migration; their JSON is not interpreted as canonical data.",
    form,
  );
  legacyNotice.hidden = true;
  const actions = append("div", undefined, form);
  actions.className = "canonical-merge-actions";
  const cancel = append("button", "Cancel", actions);
  cancel.type = "button";
  const submit = append("button", "Open", actions);
  submit.type = "submit";
  function updateContext() {
    const owl = syntax.value.startsWith("owl:");
    context.hidden = !owl;
    base.disabled = !owl;
    base.required = owl;
    legacyNotice.hidden = syntax.value !== "legacy";
  }
  syntax.addEventListener("change", updateContext);
  updateContext();
  base.addEventListener("input", () => base.setCustomValidity(""));
  return new Promise((resolve, reject) => {
    let finished = false;
    const abort = () => finish(undefined, signal.reason);
    function finish(value, error) {
      if (finished) {
        return;
      }
      finished = true;
      signal?.removeEventListener("abort", abort);
      dialog.close();
      dialog.remove();
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }
    cancel.addEventListener("click", () => finish(null));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (syntax.value.startsWith("owl:")) {
        if (!isIri(base.value)) {
          base.setCustomValidity(
            "Enter an absolute document IRI, such as https://example.org/ontology.",
          );
          base.reportValidity();
          return;
        }
        finish({
          kind: "owl",
          ...(syntax.value === "owl:auto"
            ? {}
            : { format: syntax.value.slice(4) }),
          documentIri: base.value,
        });
      } else if (syntax.value === "canonical") {
        finish({ kind: "canonical" });
      } else if (syntax.value === "legacy") {
        finish({
          kind: "legacy",
          dialect: LEGACY_DIALECT,
          profile: profiles.structuralContent,
        });
      }
    });
    signal?.addEventListener("abort", abort, { once: true });
    doc.body.append(dialog);
    dialog.showModal();
    syntax.focus();
  });
}

export async function requestCanonicalRemoteFormat(
  { documentIri, formats },
  { signal } = {},
) {
  const selection = await requestCanonicalInputSelection({
    displayName: documentIri,
    knownDocumentIri: documentIri,
    owlFormats: formats,
    signal,
  });
  return selection?.format ?? null;
}

function requiresJsonReader(content) {
  const bytes = content.bytes;
  const length = bytes?.length ?? content.text?.length ?? 0;
  const codeAt = bytes
    ? (index) => bytes[index]
    : (index) => content.text?.charCodeAt(index);
  let index =
    bytes?.[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
      ? 3
      : codeAt(0) === 0xfeff
        ? 1
        : 0;
  for (; index < length; index++) {
    const code = codeAt(index);
    if ([9, 10, 13, 32].includes(code)) {
      continue;
    }
    // A prefix suggests a reader choice; it does not validate JSON or assign
    // canonical/legacy/JSON-LD meaning. Their owning readers do that later.
    if (
      [0x7b, 0x5b, 0x22, 0x2d].includes(code) ||
      (code >= 0x30 && code <= 0x39)
    ) {
      return true;
    }
    for (const token of ["true", "false", "null"]) {
      if (
        [...token].every(
          (character, offset) =>
            codeAt(index + offset) === character.charCodeAt(0),
        ) &&
        (index + token.length === length ||
          [9, 10, 13, 32].includes(codeAt(index + token.length)))
      ) {
        return true;
      }
    }
    return false;
  }
  return false;
}

/** Acquire bytes first; JSON reader admission stays explicit, OWL detection is native. */
export async function selectCanonicalLocalSource({
  file,
  text,
  signal,
  select = requestCanonicalInputSelection,
} = {}) {
  const displayName = file?.name ?? "Direct input";
  signal?.throwIfAborted();
  if (file?.size > OWLOntologyLoaderConfiguration.defaults().maxInputBytes) {
    const error = new RangeError("The document exceeds the input byte limit.");
    error.code = "RESOURCE_LIMIT_EXCEEDED";
    error.details = { stage: "acquisition", resource: "maxInputBytes" };
    throw error;
  }
  const content = file
    ? { bytes: new Uint8Array(await file.arrayBuffer()) }
    : { text };
  signal?.throwIfAborted();
  const requireReader = requiresJsonReader(content);
  const selection = await select({ displayName, signal, requireReader });
  signal?.throwIfAborted();
  if (!selection) {
    return null;
  }
  const { kind, ...context } = selection;
  return {
    kind: `${kind === "owl" ? "ontology" : "vowl-json"}-${file ? "bytes" : "text"}`,
    ...content,
    ...context,
    displayName,
  };
}

/** A new document starts with the identity supplied by its author. */
export async function createCanonicalOntologySource({
  signal,
  request = requestCanonicalCreation,
} = {}) {
  const created = await request(
    {
      type: "owl:Ontology",
      properties: [],
      resolveIri(input) {
        const iri = input.trim();
        if (!isIri(iri)) {
          throw new TypeError("Enter an absolute IRI for the new ontology.");
        }
        return iri;
      },
    },
    { signal },
  );
  signal?.throwIfAborted();
  if (created === null) {
    return null;
  }
  return {
    kind: "ontology-text",
    format: "turtle",
    documentIri: created.iri,
    displayName: "New ontology",
    text:
      `<${created.iri}> a <http://www.w3.org/2002/07/owl#Ontology> .\n` +
      (created.text
        ? `<${created.iri}> <http://purl.org/dc/elements/1.1/title> ${JSON.stringify(created.text)} .\n`
        : ""),
  };
}
