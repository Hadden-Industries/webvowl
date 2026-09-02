export const SVG_ARTIFACT_DOWNLOAD_ELEMENT_IDS = Object.freeze({
  downloadLink: "exportSvg",
  publicationStatus: "svgArtifactPublicationStatus",
});

const SVG_ARTIFACT_DOWNLOAD_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "documentObject",
]);

function assertPlainRecord(candidate, description) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

function assertExactDependencyFieldNames(dependencies) {
  assertPlainRecord(dependencies, "SVG artifact download dependencies");
  const actualFieldNames = Object.keys(dependencies).sort();
  const expectedFieldNames = [
    ...SVG_ARTIFACT_DOWNLOAD_DEPENDENCY_FIELD_NAMES,
  ].sort();
  if (
    actualFieldNames.length !== expectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== expectedFieldNames[index],
    )
  ) {
    throw new TypeError(
      "SVG artifact download dependencies have an invalid dependency field set.",
    );
  }
}

export function createSvgArtifactDownloadAdapter(dependencies) {
  assertExactDependencyFieldNames(dependencies);
  const { documentObject } = dependencies;
  if (typeof documentObject?.getElementById !== "function") {
    throw new TypeError("documentObject.getElementById must be a function.");
  }

  const downloadLinkElement = documentObject.getElementById(
    SVG_ARTIFACT_DOWNLOAD_ELEMENT_IDS.downloadLink,
  );
  const publicationStatusElement = documentObject.getElementById(
    SVG_ARTIFACT_DOWNLOAD_ELEMENT_IDS.publicationStatus,
  );

  let isDisposed = false;

  function presentStatusText(statusText) {
    if (publicationStatusElement === null) {
      return;
    }
    publicationStatusElement.textContent = statusText;
    publicationStatusElement.hidden = false;
  }

  function clearDownloadLink() {
    if (downloadLinkElement === null) {
      return;
    }
    downloadLinkElement.removeAttribute("href");
    downloadLinkElement.removeAttribute("download");
  }

  return Object.freeze({
    // The sole presentation recipient of the page-local artifact URL. The SVG
    // artifact service remains the lifecycle owner and is the only place that
    // creates or releases that URL.
    publishPageLocalSvgArtifact({ metadata, objectUrl }) {
      if (isDisposed) {
        return;
      }
      if (downloadLinkElement !== null) {
        downloadLinkElement.setAttribute("href", objectUrl);
        downloadLinkElement.setAttribute("download", metadata.filename);
      }
      presentStatusText(
        `${metadata.filename} is ready to save (${metadata.byteLength} bytes).`,
      );
    },

    presentSvgArtifactFailure(publicWebVowlError) {
      if (isDisposed) {
        return;
      }
      clearDownloadLink();
      presentStatusText(publicWebVowlError.message);
    },

    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      clearDownloadLink();
      if (publicationStatusElement !== null) {
        publicationStatusElement.textContent = "";
        publicationStatusElement.hidden = true;
      }
    },
  });
}
