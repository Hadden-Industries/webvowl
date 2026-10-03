import { createWebVowlApplication } from "./app.js";
import { createCanonicalWebVowlController } from "./controller/canonicalWebVowlController.js";
import {
  requestCanonicalDeletionConfirmation,
  requestCanonicalInverseDetachmentConfirmation,
} from "./ui/canonicalEditConfirmation.js";
import {
  selectCanonicalLocalSource,
  createCanonicalOntologySource,
  requestCanonicalRemoteFormat,
} from "./ui/canonicalInputSelection.js";
import { requestCanonicalCreation } from "./ui/canonicalCreationDialog.js";
import { createCanonicalFactsDialog } from "./ui/canonicalFactsDialog.js";
import { canonicalExampleSource } from "./canonicalExamples.js";
import { requestCanonicalSceneReconciliation } from "./ui/canonicalMergePresentation.js";
import { createCanonicalVowlSourceAcquisition } from "./controller/canonicalVowlSourceAcquisition.js";

/** Candidate composition only. Production selects its controller in its own entry point. */
export function createCanonicalWebVowlApplication() {
  return createWebVowlApplication({
    selectLocalSource: selectCanonicalLocalSource,
    createOntologySource: createCanonicalOntologySource,
    createFactsPresentation: createCanonicalFactsDialog,
    resolvePresetSource: canonicalExampleSource,
    createController: (dependencies) =>
      createCanonicalWebVowlController({
        ...dependencies,
        sourceAcquisition: createCanonicalVowlSourceAcquisition({
          requestFormat: requestCanonicalRemoteFormat,
        }),
        requestOntologyCreation: requestCanonicalCreation,
        reconcileScene: requestCanonicalSceneReconciliation,
        requestOntologyDeletionConfirmation:
          requestCanonicalDeletionConfirmation,
        requestInverseDetachmentConfirmation:
          requestCanonicalInverseDetachmentConfirmation,
      }),
  });
}
