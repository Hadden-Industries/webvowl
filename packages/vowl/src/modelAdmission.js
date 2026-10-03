import { fail } from "./errors.js";

// A root-instance-specific adapter capability. Nothing here is a public surface.
const admissions = new WeakMap();
export function registerOwlAdmission(binding, admit) {
  admissions.set(binding, admit);
}
export function admitOwlModel(binding, source, archive, documentIri, budget) {
  const admit = admissions.get(binding);
  if (!admit) {
    fail("MODEL_NOT_ADMITTED");
  }
  return admit(source, archive, documentIri, budget);
}
