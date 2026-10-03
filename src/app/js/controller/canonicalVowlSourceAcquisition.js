import { OWLDocumentFormats } from "owlapi/formats";
import { OWLOntologyLoaderConfiguration } from "owlapi/model";
import { WebVowlImportResolver } from "../../../owl2vowl/js/importResolver.js";

function formatRequired(candidates) {
  const error = new Error(
    "Choose the document's OWL syntax before loading it.",
  );
  error.code = "OWL_FORMAT_SELECTION_REQUIRED";
  error.formats = candidates.map(({ key }) => key);
  return error;
}

/** Choose only from the owning package's public metadata, without syntax probes. */
export function selectCanonicalOwlMediaType({
  format,
  contentType,
  fileName,
} = {}) {
  const formats = Object.values(OWLDocumentFormats);
  if (format !== undefined) {
    const selected = formats.find(({ key }) => key === format);
    if (!selected) {
      throw formatRequired(formats);
    }
    return selected.mediaTypes[0];
  }
  const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase();
  const byMediaType = formats.filter(({ mediaTypes }) =>
    mediaTypes.includes(mediaType),
  );
  if (byMediaType.length === 1) {
    return mediaType;
  }
  if (byMediaType.length > 1) {
    throw formatRequired(byMediaType);
  }
  const extension = fileName?.split(".").at(-1).toLowerCase();
  const byExtension = formats.filter(({ extensions }) =>
    extensions.includes(extension),
  );
  if (byExtension.length === 1) {
    return byExtension[0].mediaTypes[0];
  }
  throw formatRequired(byExtension.length ? byExtension : formats);
}

/**
 * Application acquisition for the worker's explicit bytes/context contract.
 * The package remains responsible for parsing, closure identity and admission.
 */
export function createCanonicalVowlSourceAcquisition({
  resolver = new WebVowlImportResolver(),
} = {}) {
  function options(signal) {
    return { signal, config: new OWLOntologyLoaderConfiguration({ signal }) };
  }
  async function acquire(documentIri, signal, format) {
    signal?.throwIfAborted();
    const acquired = await resolver.loadBytes(documentIri, options(signal));
    signal?.throwIfAborted();
    return {
      bytes: acquired.bytes,
      documentIri: acquired.documentIri,
      mediaType: selectCanonicalOwlMediaType({ ...acquired, format }),
    };
  }
  async function resolveImport(importIri, { signal } = {}) {
    const documentIri = resolver.getDocumentIRI(importIri).value;
    return acquire(documentIri, signal);
  }
  return Object.freeze({
    resolveImport,
    async remote(documentIri, { signal, format } = {}) {
      const acquired = await acquire(documentIri, signal, format);
      return { operation: "open-owl-model", ...acquired };
    },
    local(bytes, { documentIri, format, contentType, fileName } = {}) {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError("OWL acquisition requires bytes.");
      }
      if (
        bytes.byteLength >
        OWLOntologyLoaderConfiguration.defaults().maxInputBytes
      ) {
        throw new RangeError(
          "The local document exceeds the owning parser's input byte limit.",
        );
      }
      if (typeof documentIri !== "string" || !documentIri) {
        throw new TypeError(
          "A local document requires its explicit parsing base IRI.",
        );
      }
      const mediaType = selectCanonicalOwlMediaType({
        format,
        contentType,
        fileName,
      });
      return {
        operation: "open-owl-model",
        bytes: bytes.slice(),
        documentIri,
        mediaType,
      };
    },
  });
}
