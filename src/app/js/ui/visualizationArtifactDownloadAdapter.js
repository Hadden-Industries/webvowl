export const VISUALIZATION_ARTIFACT_DOWNLOAD_ELEMENT_IDS = Object.freeze({
  svgDownloadLink: "exportSvg",
  vowlJsonDownloadLink: "exportJson",
  turtleDownloadLink: "exportTurtle",
  latexDownloadLink: "exportTex",
  publicationStatus: "artifactPublicationStatus",
});

const VISUALIZATION_ARTIFACT_DOWNLOAD_DEPENDENCY_FIELD_NAMES = Object.freeze([
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
  assertPlainRecord(
    dependencies,
    "Visualization artifact download dependencies",
  );
  const actualFieldNames = Object.keys(dependencies).sort();
  const expectedFieldNames = [
    ...VISUALIZATION_ARTIFACT_DOWNLOAD_DEPENDENCY_FIELD_NAMES,
  ].sort();
  if (
    actualFieldNames.length !== expectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== expectedFieldNames[index],
    )
  ) {
    throw new TypeError(
      "Visualization artifact download dependencies have an invalid dependency field set.",
    );
  }
}

export function createVisualizationArtifactDownloadAdapter(dependencies) {
  assertExactDependencyFieldNames(dependencies);
  const { documentObject } = dependencies;
  if (typeof documentObject?.getElementById !== "function") {
    throw new TypeError("documentObject.getElementById must be a function.");
  }

  const downloadLinksByFormat = Object.fromEntries(
    Object.entries({
      svg: "svgDownloadLink",
      "vowl-json": "vowlJsonDownloadLink",
      turtle: "turtleDownloadLink",
      latex: "latexDownloadLink",
    }).map(([format, name]) => [
      format,
      documentObject.getElementById(
        VISUALIZATION_ARTIFACT_DOWNLOAD_ELEMENT_IDS[name],
      ),
    ]),
  );
  const publicationStatusElement = documentObject.getElementById(
    VISUALIZATION_ARTIFACT_DOWNLOAD_ELEMENT_IDS.publicationStatus,
  );

  let isDisposed = false;

  function presentStatusText(statusText) {
    if (publicationStatusElement === null) {
      return;
    }
    publicationStatusElement.textContent = statusText;
    publicationStatusElement.hidden = false;
  }

  function clearPublishedDownloads() {
    for (const downloadLinkElement of Object.values(downloadLinksByFormat)) {
      if (downloadLinkElement === null) {
        continue;
      }
      if (isDisposed) {
        downloadLinkElement.removeAttribute("href");
      } else {
        // These anchors are also the native keyboard controls for starting an
        // export. Retire the artifact URL without retiring their activation.
        downloadLinkElement.setAttribute("href", "#");
      }
      downloadLinkElement.removeAttribute("download");
    }
  }

  return Object.freeze({
    // The sole presentation recipient of the page-local artifact URL. The
    // artifact service remains the lifecycle owner and is the only place that
    // creates or releases that URL.
    publishPageLocalArtifact({ metadata, objectUrl }) {
      if (isDisposed) {
        return;
      }
      clearPublishedDownloads();
      const downloadLinkElement = downloadLinksByFormat[metadata.format];
      if (downloadLinkElement !== null && downloadLinkElement !== undefined) {
        downloadLinkElement.setAttribute("href", objectUrl);
        downloadLinkElement.setAttribute("download", metadata.filename);
      }
      presentStatusText(
        `${metadata.filename} is ready to save (${metadata.byteLength} bytes).`,
      );
    },

    presentArtifactFailure(publicWebVowlError) {
      if (isDisposed) {
        return;
      }
      clearPublishedDownloads();
      presentStatusText(publicWebVowlError.message);
    },

    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      clearPublishedDownloads();
      if (publicationStatusElement !== null) {
        publicationStatusElement.textContent = "";
        publicationStatusElement.hidden = true;
      }
    },
  });
}
