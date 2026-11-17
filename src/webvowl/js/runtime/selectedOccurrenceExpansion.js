import {
  highestOccurrenceExpansionLevel,
  layOutOccurrenceExpansion,
  occurrenceCoverScale,
  parseSceneTransform,
  sampleCounterTransform,
} from "./occurrenceExpansionGeometry.js";

const GROW_DURATION_MS = 280;
const SHRINK_DURATION_MS = 220;
const CONTENT_FADE_DELAY_MS = 90;
// On the way back everything but the name is gone this far into the shrink, so
// what lands on the node is the node: its shape and its name.
const CONTENT_FADE_OUT_SHARE = 0.4;
const SHELL_FADE_OUT_START_SHARE = 0.7;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const AT_REST = Object.freeze({ xPx: 0, yPx: 0, scaleX: 1, scaleY: 1 });

const part = (root, name) =>
  root.querySelector(`[data-occurrence-expansion-part="${name}"]`);

const transformOf = ({ xPx, yPx, scaleX, scaleY }) =>
  `translate(${xPx}px, ${yPx}px) scale(${scaleX}, ${scaleY})`;

/** The shell transform that draws a laid-out shell over `target` instead. */
function placementOver(target, laidOut) {
  return {
    xPx: (target.xPx - laidOut.xPx) / laidOut.coverScale,
    yPx: (target.yPx - laidOut.yPx) / laidOut.coverScale,
    scaleX: target.widthPx / laidOut.widthPx,
    scaleY: target.heightPx / laidOut.heightPx,
  };
}

/** Everything in `shell` except `inner` and the elements that contain it. */
function contentAround(inner, shell) {
  const around = [];
  for (let kept = inner; kept !== shell; kept = kept.parentElement) {
    around.push(
      ...[...kept.parentElement.children].filter((child) => child !== kept),
    );
  }
  return around;
}

/**
 * Grows the selected occurrence in place inside an HTML element the
 * application supplies, and keeps that element on the occurrence by copying the
 * scene's own transform whenever it is written.
 *
 * Slot contract. `expansionElement` is a zero-size point inside the graph
 * container. It holds one `[data-occurrence-expansion-part="shell"]`, the grown
 * shape, which in turn holds the application's content, one
 * `[data-occurrence-expansion-part="level-toggle"]` button and, optionally, one
 * `[data-occurrence-expansion-part="name"]`. This module never reads that
 * content. It writes only:
 *
 * - `hidden` on the expansion element;
 * - `data-shape` (`ellipse` | `rectangle`), `data-detail` (`summary` |
 *   `complete`), `data-fills-viewport` and `data-dashed` on it;
 * - the `--occurrence-expansion-*` custom properties on it: `x`, `y` and
 *   `zoom` whenever the occurrence moves, `width`, `height`, `fill`, `stroke`,
 *   `stroke-width`, `ink`, `font-family` and `font-weight` when it is laid out;
 * - `hidden` and `aria-expanded` on the level toggle;
 * - the occurrence's name as the text of the name part, at the moment it
 *   expands.
 *
 * The stylesheet turns those properties into geometry, colour and face.
 *
 * The name part is the one piece of content that is the same text in the node
 * and in the expansion, so it is carried across instead of faded: it starts on
 * the node's own label, at the label's size, and ends where layout puts it.
 * For that the part must be one element for as long as the expansion is shown,
 * laid out as a box a transform applies to, and this module measures that box
 * and its font size. The application may replace the text with its own; the
 * text written here only makes the first frame read as the node before the
 * application has caught up with the selection.
 *
 * `occurrence` describes one drawn node or label in graph units:
 * `{ shape, widthPx, heightPx, readCenter, name, restingAppearance }`.
 * `name` is `{ text, readDrawn }`: the name the drawing was given, and a
 * reader of where its label is drawn now, as `{ clientXPx, clientYPx,
 * fontSize }` with the centre in client pixels, because only the browser's own
 * layout knows where text ended up, and the font size in graph units; it
 * returns null when no label is drawn or text cannot be measured.
 * `restingAppearance` is `{ fill, stroke, strokeWidth, isDashed, ink,
 * fontFamily, fontWeight }` as the occurrence is drawn when it is neither
 * hovered nor selected.
 */
export function createSelectedOccurrenceExpansion({
  expansionElement,
  sceneElement,
  readViewportSize,
}) {
  const view = expansionElement.ownerDocument.defaultView;
  const shell = part(expansionElement, "shell");
  const levelToggle = part(expansionElement, "level-toggle");
  const lifecycle = new AbortController();
  const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
  const sceneObserver = new view.MutationObserver(() => follow());
  const ghosts = new Set();
  let expanded;
  let running = [];
  let disposed = false;

  function animates() {
    return !reducedMotion.matches && typeof shell.animate === "function";
  }

  function cancelRunning() {
    for (const animation of running) {
      animation.cancel();
    }
    running = [];
  }

  /** Where the occurrence is drawn right now, or null when it cannot be placed. */
  function readOccurrenceOnScreen(occurrence) {
    const scene = parseSceneTransform(sceneElement.getAttribute("transform"));
    const center = occurrence.readCenter();
    if (
      !scene ||
      !center ||
      !Number.isFinite(center.x) ||
      !Number.isFinite(center.y)
    ) {
      return null;
    }
    return {
      scale: scene.scale,
      xPx: scene.xPx + scene.scale * center.x,
      yPx: scene.yPx + scene.scale * center.y,
      widthPx: occurrence.widthPx * scene.scale,
      heightPx: occurrence.heightPx * scene.scale,
    };
  }

  /** The shell's current centre and size on screen. */
  function readShellOnScreen(onScreen) {
    const { box } = expanded;
    if (!box.followsOccurrence) {
      return {
        xPx: box.centerXPx,
        yPx: box.centerYPx,
        widthPx: box.widthPx,
        heightPx: box.heightPx,
        coverScale: 1,
      };
    }
    const coverScale = occurrenceCoverScale(box, onScreen);
    return {
      xPx: onScreen.xPx + expanded.offsetXPx,
      yPx: onScreen.yPx + expanded.offsetYPx,
      widthPx: box.widthPx * coverScale,
      heightPx: box.heightPx * coverScale,
      coverScale,
    };
  }

  function writePosition(onScreen) {
    const shellOnScreen = readShellOnScreen(onScreen);
    const { style } = expansionElement;
    // On a node, whole pixels keep the text sharp and the shell still covers
    // it. Centred in the viewport, the exact centre keeps its edges flush.
    const snap = expanded.box.followsOccurrence
      ? Math.round
      : (lengthPx) => lengthPx;
    // Kept as written: the name is measured against where the shell really is.
    expanded.drawn = {
      xPx: snap(shellOnScreen.xPx),
      yPx: snap(shellOnScreen.yPx),
      coverScale: shellOnScreen.coverScale,
    };
    style.setProperty("--occurrence-expansion-x", `${expanded.drawn.xPx}px`);
    style.setProperty("--occurrence-expansion-y", `${expanded.drawn.yPx}px`);
    style.setProperty(
      "--occurrence-expansion-zoom",
      String(expanded.drawn.coverScale),
    );
  }

  /**
   * Where layout alone puts the name, from the shell's centre in the shell's
   * own pixels, and its font size. Offsets, not client rectangles: they are
   * the same whatever transform is running. Null when there is no name part
   * or it is not laid out inside the shell.
   */
  function readNameAtRest() {
    const element = part(shell, "name");
    if (!element) {
      return null;
    }
    let xPx = (element.offsetWidth - shell.offsetWidth) / 2;
    let yPx = (element.offsetHeight - shell.offsetHeight) / 2;
    for (let box = element; box !== shell; box = box.offsetParent) {
      if (!box.offsetParent) {
        return null;
      }
      xPx += box.offsetLeft + box.offsetParent.clientLeft;
      yPx += box.offsetTop + box.offsetParent.clientTop;
    }
    const fontSizePx = Number.parseFloat(
      view.getComputedStyle(element).fontSize,
    );
    return fontSizePx > 0 ? { element, xPx, yPx, fontSizePx } : null;
  }

  /** A name at rest in the shell as it is drawn now, in this layer's pixels. */
  function seeNameAtRest(atRest) {
    const { xPx, yPx, coverScale } = expanded.drawn;
    return {
      xPx: xPx + coverScale * atRest.xPx,
      yPx: yPx + coverScale * atRest.yPx,
      fontSizePx: coverScale * atRest.fontSizePx,
    };
  }

  /** The node's own label where it is drawn now, in this layer's pixels. */
  function seeDrawnName(onScreen) {
    const label = expanded.occurrence.name.readDrawn();
    if (!label) {
      return null;
    }
    // The expansion element is a point this module placed, so its client
    // position ties the label's client position to this layer.
    const point = expansionElement.getBoundingClientRect();
    return {
      xPx: expanded.drawn.xPx + label.clientXPx - point.left,
      yPx: expanded.drawn.yPx + label.clientYPx - point.top,
      fontSizePx: label.fontSize * onScreen.scale,
    };
  }

  /**
   * Keyframes that carry the name between two sightings while the shell runs
   * from one transform to another. A sighting the name is not given at an end
   * means it rests there.
   */
  function nameTravel(atRest, shellTransform, seen) {
    const resting = { xPx: atRest.xPx, yPx: atRest.yPx, scale: 1 };
    const { xPx, yPx, coverScale } = expanded.drawn;
    const placed = (sighting) =>
      sighting
        ? {
            xPx: (sighting.xPx - xPx) / coverScale,
            yPx: (sighting.yPx - yPx) / coverScale,
            scale: sighting.fontSizePx / (coverScale * atRest.fontSizePx),
          }
        : resting;
    return sampleCounterTransform({
      restingCenter: atRest,
      shell: shellTransform,
      part: { from: placed(seen.from), to: placed(seen.to) },
    }).map(({ offset, ...transform }) => ({
      offset,
      transform: transformOf(transform),
    }));
  }

  function follow() {
    if (!expanded) {
      return;
    }
    const onScreen = readOccurrenceOnScreen(expanded.occurrence);
    expansionElement.hidden = onScreen === null;
    if (onScreen) {
      writePosition(onScreen);
    }
  }

  function layOut(level, onScreen) {
    const { occurrence } = expanded;
    const box = layOutOccurrenceExpansion({
      level,
      occurrence: {
        shape: occurrence.shape,
        widthPx: onScreen.widthPx,
        heightPx: onScreen.heightPx,
      },
      anchor: onScreen,
      viewport: readViewportSize(),
    });
    Object.assign(expanded, {
      level,
      box,
      offsetXPx: box.centerXPx - onScreen.xPx,
      offsetYPx: box.centerYPx - onScreen.yPx,
    });
    expansionElement.dataset.detail = box.detail;
    expansionElement.dataset.fillsViewport = String(box.fillsViewport);
    expansionElement.style.setProperty(
      "--occurrence-expansion-width",
      `${box.widthPx}px`,
    );
    expansionElement.style.setProperty(
      "--occurrence-expansion-height",
      `${box.heightPx}px`,
    );
    levelToggle.hidden =
      highestOccurrenceExpansionLevel(occurrence.shape) === 1;
    levelToggle.setAttribute("aria-expanded", String(level > 1));
    writePosition(onScreen);
  }

  /**
   * Grows the laid-out shell out of `from.shell`, a rectangle on screen. With
   * `from.name`, a sighting of the name, the name travels from there; without
   * one it fades in with everything else.
   */
  function grow(from, onScreen) {
    cancelRunning();
    if (!animates()) {
      return;
    }
    const shellFrom = placementOver(from.shell, readShellOnScreen(onScreen));
    const timing = { duration: GROW_DURATION_MS, easing: EASING };
    const nameAtRest = from.name && readNameAtRest();
    running = [
      shell.animate(
        [{ transform: transformOf(shellFrom) }, { transform: "none" }],
        timing,
      ),
    ];
    if (nameAtRest) {
      running.push(
        nameAtRest.element.animate(
          nameTravel(
            nameAtRest,
            { from: shellFrom, to: AT_REST },
            { from: from.name },
          ),
          timing,
        ),
      );
    }
    // The content is the application's; it is only faded, never inspected.
    const fading = nameAtRest
      ? contentAround(nameAtRest.element, shell)
      : [...shell.children];
    for (const element of fading) {
      running.push(
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: GROW_DURATION_MS - CONTENT_FADE_DELAY_MS,
          delay: CONTENT_FADE_DELAY_MS,
          easing: "ease-out",
          fill: "backwards",
        }),
      );
    }
  }

  function copyAppearance({ shape, restingAppearance }) {
    expansionElement.dataset.shape = shape;
    expansionElement.dataset.dashed = String(restingAppearance.isDashed);
    // An absent colour falls back to the stylesheet's default; it must never
    // keep the previous occurrence's.
    const { style } = expansionElement;
    style.setProperty(
      "--occurrence-expansion-fill",
      restingAppearance.fill ?? "",
    );
    style.setProperty(
      "--occurrence-expansion-stroke",
      restingAppearance.stroke ?? "",
    );
    style.setProperty(
      "--occurrence-expansion-stroke-width",
      restingAppearance.strokeWidth ?? "",
    );
    style.setProperty(
      "--occurrence-expansion-ink",
      restingAppearance.ink ?? "",
    );
    style.setProperty(
      "--occurrence-expansion-font-family",
      restingAppearance.fontFamily ?? "",
    );
    style.setProperty(
      "--occurrence-expansion-font-weight",
      restingAppearance.fontWeight ?? "",
    );
  }

  function expand(occurrence) {
    if (disposed) {
      return;
    }
    if (expanded) {
      collapse();
    }
    const onScreen = readOccurrenceOnScreen(occurrence);
    if (!onScreen) {
      return;
    }
    expanded = { occurrence };
    copyAppearance(occurrence);
    const name = part(shell, "name");
    if (name) {
      // Before anything is measured, and never the previous occurrence's.
      name.textContent = occurrence.name.text;
    }
    layOut(1, onScreen);
    expansionElement.hidden = false;
    sceneObserver.observe(sceneElement, {
      attributes: true,
      attributeFilter: ["transform"],
    });
    grow(
      // Nothing is measured for a reader who will see no motion.
      { shell: onScreen, name: animates() ? seeDrawnName(onScreen) : null },
      onScreen,
    );
  }

  function setLevel(level) {
    const onScreen = expanded && readOccurrenceOnScreen(expanded.occurrence);
    if (!onScreen) {
      return;
    }
    // Both are read before the new layout replaces them.
    const nameAtRest = animates() ? readNameAtRest() : null;
    const from = {
      shell: readShellOnScreen(onScreen),
      name: nameAtRest && seeNameAtRest(nameAtRest),
    };
    layOut(level, onScreen);
    grow(from, onScreen);
  }

  /** A detached, inert copy plays the shrink so a new expansion can start now. */
  function leaveShrinkingCopy(onScreen) {
    const shellTo = placementOver(onScreen, readShellOnScreen(onScreen));
    // Read from the live expansion, which is still laid out; the copy is not
    // yet, and need not be.
    const drawnName = seeDrawnName(onScreen);
    const nameAtRest = drawnName && readNameAtRest();
    const ghost = expansionElement.cloneNode(true);
    ghost.removeAttribute("id");
    for (const identified of ghost.querySelectorAll("[id]")) {
      identified.removeAttribute("id");
    }
    ghost.inert = true;
    ghost.setAttribute("aria-hidden", "true");
    expansionElement.after(ghost);
    ghosts.add(ghost);
    const ghostShell = part(ghost, "shell");
    const timing = {
      duration: SHRINK_DURATION_MS,
      easing: EASING,
      fill: "forwards",
    };
    // The copy stays solid until it is all but the node again, then gives way
    // to the node beneath it. That share is of the time, hence linear: the
    // eased shrink has covered nearly all of its distance by then.
    ghostShell.animate(
      [
        { opacity: 1 },
        { opacity: 1, offset: SHELL_FADE_OUT_START_SHARE },
        { opacity: 0 },
      ],
      { ...timing, easing: "linear" },
    );
    const animation = ghostShell.animate(
      [{ transform: "none" }, { transform: transformOf(shellTo) }],
      timing,
    );
    const ghostName = nameAtRest && part(ghostShell, "name");
    if (ghostName) {
      ghostName.animate(
        nameTravel(
          nameAtRest,
          { from: AT_REST, to: shellTo },
          { to: drawnName },
        ),
        timing,
      );
    }
    const fading = ghostName
      ? contentAround(ghostName, ghostShell)
      : [...ghostShell.children];
    for (const element of fading) {
      element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: SHRINK_DURATION_MS * CONTENT_FADE_OUT_SHARE,
        easing: "ease-in",
        fill: "forwards",
      });
    }
    const discard = () => {
      ghosts.delete(ghost);
      ghost.remove();
    };
    animation.finished.then(discard, discard);
  }

  function collapse() {
    if (!expanded) {
      return;
    }
    const onScreen = readOccurrenceOnScreen(expanded.occurrence);
    cancelRunning();
    if (onScreen && animates() && !expansionElement.hidden) {
      leaveShrinkingCopy(onScreen);
    }
    sceneObserver.disconnect();
    expansionElement.hidden = true;
    expanded = undefined;
  }

  levelToggle.addEventListener(
    "click",
    () => {
      if (
        expanded &&
        highestOccurrenceExpansionLevel(expanded.occurrence.shape) > 1
      ) {
        setLevel(expanded.level === 1 ? 2 : 1);
      }
    },
    { signal: lifecycle.signal },
  );
  // The summary has nothing to scroll, so the wheel keeps zooming the graph
  // under the pointer. A complete view scrolls its own content natively.
  expansionElement.addEventListener(
    "wheel",
    (event) => {
      if (expanded?.box.detail !== "summary") {
        return;
      }
      event.preventDefault();
      sceneElement.ownerSVGElement.dispatchEvent(
        new view.WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        }),
      );
    },
    { passive: false, signal: lifecycle.signal },
  );

  return Object.freeze({
    expand,
    collapse,
    follow,
    viewportResized() {
      const onScreen = expanded && readOccurrenceOnScreen(expanded.occurrence);
      if (onScreen) {
        cancelRunning();
        layOut(expanded.level, onScreen);
      }
      // Nothing is re-animated: the viewport, not the selection, changed.
    },
    dispose() {
      disposed = true;
      lifecycle.abort();
      cancelRunning();
      sceneObserver.disconnect();
      for (const ghost of ghosts) {
        ghost.remove();
      }
      ghosts.clear();
      expansionElement.hidden = true;
      expanded = undefined;
    },
  });
}
