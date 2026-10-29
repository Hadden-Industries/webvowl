import {
  selectOwlMappingStrategy,
  owlMappingDefinitions,
} from "../controller/owlMappingStrategy.js";

/** Native radios retain the next-load preference without changing a current job. */
export function createOwlMappingControl(documentObject) {
  const { choices, defaultStrategy } = owlMappingDefinitions;
  const selected = () =>
    documentObject.querySelector?.('input[name="owl-mapping-strategy"]:checked')
      ?.value;
  const retainedChoice = selected();
  const container = documentObject.querySelector?.("#owl-mapping-choices");
  container?.replaceChildren(
    ...choices.map((choice) => {
      const label = documentObject.createElement("label");
      label.className = "owl-mapping-choice";
      const input = documentObject.createElement("input");
      input.type = "radio";
      input.name = "owl-mapping-strategy";
      input.value = choice.id;
      input.checked =
        retainedChoice === undefined
          ? choice.id === defaultStrategy
          : choice.id === retainedChoice;
      const title = documentObject.createElement("span");
      title.textContent = choice.title;
      const description = documentObject.createElement("small");
      description.textContent = choice.description;
      title.append(description);
      label.append(input, title);
      return label;
    }),
  );
  return () => {
    const id = selected();
    if (id === undefined) {
      return selectOwlMappingStrategy();
    }
    const choice = choices.find((choice) => choice.id === id);
    if (!choice) {
      throw new TypeError("Choose a supported OWL mapping strategy.");
    }
    return selectOwlMappingStrategy(choice.id);
  };
}
