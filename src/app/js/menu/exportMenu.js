/**
 * Contains the logic for the export button.
 * @returns {{}}
 */
import {
  WebVowlOperationError,
  toPublicWebVowlError,
} from "../controller/webVowlControllerContracts.js";

function legacyCopyInputValue(inputNode, documentNode) {
  const popoverNode = inputNode.closest
    ? inputNode.closest(".modern-popover")
    : null;
  const contentNode = inputNode.closest
    ? inputNode.closest(".popover-content")
    : null;
  const previousFocus = documentNode.activeElement;
  const popoverScrollTop = popoverNode ? popoverNode.scrollTop : 0;
  const contentScrollTop = contentNode ? contentNode.scrollTop : 0;
  let copied;

  try {
    inputNode.focus({ preventScroll: true });
    inputNode.select();
    copied =
      typeof documentNode.execCommand === "function" &&
      documentNode.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    if (
      previousFocus &&
      previousFocus !== inputNode &&
      typeof previousFocus.focus === "function"
    ) {
      try {
        previousFocus.focus({ preventScroll: true });
      } catch {
        previousFocus.focus();
      }
    }
    if (popoverNode) {
      popoverNode.scrollTop = popoverScrollTop;
    }
    if (contentNode) {
      contentNode.scrollTop = contentScrollTop;
    }
  }

  return copied;
}

async function copyInputValue(inputNode, clipboardApi, documentNode) {
  const resolvedClipboard =
    clipboardApi === undefined && typeof navigator !== "undefined"
      ? navigator.clipboard
      : clipboardApi;
  const resolvedDocument = documentNode || document;

  if (resolvedClipboard && typeof resolvedClipboard.writeText === "function") {
    try {
      await resolvedClipboard.writeText(inputNode.value);
      return true;
    } catch {
      /* use the synchronous fallback below */
    }
  }

  return legacyCopyInputValue(inputNode, resolvedDocument);
}

function nextCopyFeedback(copied, successfulCopyCount = 0) {
  if (!copied) {
    return { successfulCopyCount: 0, text: "Copy failed" };
  }

  const nextSuccessfulCopyCount = successfulCopyCount + 1;
  return {
    successfulCopyCount: nextSuccessfulCopyCount,
    text:
      nextSuccessfulCopyCount === 1
        ? "Copied!"
        : `Copied ×${nextSuccessfulCopyCount}`,
  };
}

function createExportMenu({
  documentObject = globalThis.document,
  readShareLinkPresentation = () => ({}),
  webVowlController,
  visualizationArtifactDownloadAdapter,
} = {}) {
  const exportMenu = {};

  /**
   * Adds the export button to the website.
   */
  exportMenu.setup = function () {
    documentObject
      .querySelector("#exportSvg")
      .addEventListener("click", (event) =>
        exportMenu.exportVisualizationArtifact(event, "svg"),
      );
    documentObject
      .querySelector("#exportJson")
      .addEventListener("click", (event) =>
        exportMenu.exportVisualizationArtifact(event, "vowl-json"),
      );

    documentObject.querySelector("#copyBt").addEventListener("click", copyUrl);

    documentObject
      .querySelector("#exportTex")
      .addEventListener("click", (event) =>
        exportMenu.exportVisualizationArtifact(event, "latex"),
      );

    documentObject
      .querySelector("#exportTurtle")
      .addEventListener("click", (event) =>
        exportMenu.exportVisualizationArtifact(event, "turtle"),
      );
  };
  let copyFeedbackTimer;
  let successfulCopyCount = 0;
  async function copyUrl() {
    const urlInputNode = documentObject.querySelector("#exportedUrl");
    if (!urlInputNode) {
      return;
    }

    const copied = await copyInputValue(urlInputNode);
    const copyButtonNode = documentObject.querySelector("#copyBt");
    const feedback = nextCopyFeedback(copied, successfulCopyCount);
    successfulCopyCount = feedback.successfulCopyCount;
    copyButtonNode.classList.toggle("copied", copied);
    copyButtonNode.classList.toggle("copy-failed", !copied);
    copyButtonNode.querySelector(".copy-text").textContent = feedback.text;
    copyButtonNode
      .querySelector(".copy-icon path")
      .setAttribute(
        "d",
        copied
          ? "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
          : "M18.3 5.71 12 12l-6.3-6.29-1.4 1.42L10.59 13.4 4.3 19.7l1.4 1.4 6.3-6.29 6.3 6.29 1.4-1.4-6.29-6.3 6.29-6.29z",
      );

    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(function () {
      successfulCopyCount = 0;
      copyButtonNode.classList.remove("copied", "copy-failed");
      copyButtonNode.querySelector(".copy-text").textContent = "Copy URL";
      copyButtonNode
        .querySelector(".copy-icon path")
        .setAttribute(
          "d",
          "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
        );
    }, 2000);
  }

  exportMenu.exportAsUrl = function () {
    const urlInput = documentObject.querySelector("#exportedUrl");
    const copyButton = documentObject.querySelector("#copyBt");
    const errorMessage = documentObject.querySelector("#exportUrlError");
    if (!urlInput) {
      return;
    }
    try {
      urlInput.value = webVowlController.getVisualizationShareLink({
        presentation: readShareLinkPresentation(),
      }).url;
      urlInput.title = urlInput.value;
      if (copyButton) {
        copyButton.disabled = false;
      }
      if (errorMessage) {
        errorMessage.textContent = "";
        errorMessage.classList.toggle("hidden", true);
      }
    } catch (error) {
      urlInput.value = "";
      urlInput.title = "";
      if (copyButton) {
        copyButton.disabled = true;
      }
      if (errorMessage) {
        errorMessage.textContent = error.message;
        errorMessage.classList.toggle("hidden", false);
      }
    }
  };

  // One element is both the control a reader clicks and the link the artifact
  // is published onto. This says which of the two a click is, because the
  // handler finishes by clicking that element to save the file: without it the
  // click re-enters this handler, which prevents the download and starts
  // another export, without end.
  let isSavingArtifact = false;

  // The controller owns serialization and publishes the artifact's download URL.
  exportMenu.exportVisualizationArtifact = async function (
    exportEvent,
    format = "svg",
  ) {
    // Our own click, asking the browser to save the published artifact. Let it
    // through untouched.
    if (isSavingArtifact) {
      return;
    }
    // The link carries the previous artifact, so navigation waits for this one.
    exportEvent?.preventDefault?.();
    const popover = documentObject.querySelector("#m_export");
    if (popover?.matches(":popover-open")) {
      popover.hidePopover();
    }

    try {
      await webVowlController.exportVisualization({ format });
    } catch (exportError) {
      const failure =
        exportError instanceof WebVowlOperationError
          ? toPublicWebVowlError(exportError)
          : {
              message:
                "The visualization could not be exported. Try again or choose another format.",
            };
      visualizationArtifactDownloadAdapter.presentArtifactFailure(failure);
      if (popover && !popover.matches(":popover-open")) {
        popover.showPopover();
      }
      if (!(exportError instanceof WebVowlOperationError)) {
        console.error(exportError);
      }
      return;
    }

    const downloadLinkElement = documentObject.querySelector(
      {
        svg: "#exportSvg",
        "vowl-json": "#exportJson",
        turtle: "#exportTurtle",
        latex: "#exportTex",
      }[format],
    );
    if (downloadLinkElement?.href) {
      isSavingArtifact = true;
      try {
        downloadLinkElement.click();
      } finally {
        isSavingArtifact = false;
      }
    }
  };

  return exportMenu;
}

export {
  copyInputValue,
  createExportMenu,
  legacyCopyInputValue,
  nextCopyFeedback,
};
