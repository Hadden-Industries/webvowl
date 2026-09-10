import { createElementTools } from "../util/elementTools.js";
export function createFocuser(graph) {
  const focuser = {};
  let focusedElement;
  const elementTools = createElementTools();
  focuser.handle = function (event, selectedElement, forced) {
    // Don't display details on a drag event, which will be prevented
    if (event && event.defaultPrevented && !forced) {
      return;
    }

    if (focusedElement !== undefined) {
      focusedElement.toggleSelection();
    }

    if (focusedElement !== selectedElement && selectedElement) {
      selectedElement.toggleSelection();
      focusedElement = selectedElement;
    } else {
      focusedElement = undefined;
    }
    if (focusedElement && focusedElement.focused()) {
      if (elementTools.isProperty(selectedElement) === true) {
        let inversed = false;
        if (
          selectedElement.inverse() &&
          selectedElement.labelElement() &&
          selectedElement.labelElement().attr("transform") === "translate(0,15)"
        ) {
          inversed = true;
        }
        graph.activateHoverElementsForProperties(
          true,
          selectedElement,
          inversed,
          graph.isTouchDevice(),
        );
      } else {
        graph.activateHoverElements(
          true,
          selectedElement,
          graph.isTouchDevice(),
        );
      }
    } else {
      graph.removeEditElements();
    }
  };

  /**
   * Removes the focus if an element is focussed.
   */
  focuser.reset = function () {
    if (focusedElement) {
      focusedElement.toggleSelection();
      focusedElement = undefined;
    }
  };

  return focuser;
}
