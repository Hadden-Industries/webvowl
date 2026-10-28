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
import { ONTOLOGY_CACHE_CONFIGURATION } from "../../ontology-loading/ontologyLoadingConfiguration.js";

/** Canonical composition shared by production and isolated qualification builds. */
export function createCanonicalWebVowlApplication({
  ontologyLoadingConfiguration = ONTOLOGY_CACHE_CONFIGURATION,
} = {}) {
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
          cache: ontologyLoadingConfiguration,
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
