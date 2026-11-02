import { at } from "./errors.js";
import { resolveDescriptor } from "./modelContract.js";
import { descriptorFor } from "./typedValues.js";

// The authored grammar is fixed during an operation, just as it is for the
// owning shape validators. These plans describe grammar reachability only;
// they never certify a document or survive the operation that uses them.
const plansByOperation = new WeakMap();

function wanted(shape, selection) {
  return Boolean(
    shape.reference ||
    (selection === "handles" && shape.id) ||
    (selection === "references-and-sets" && shape.items && !shape.sequence),
  );
}

function planFor(descriptor, budget, selection) {
  let selections = plansByOperation.get(budget);
  if (!selections) {
    selections = new Map();
    plansByOperation.set(budget, selections);
  }
  let plans = selections.get(selection);
  if (!plans) {
    plans = new WeakMap();
    selections.set(selection, plans);
  }
  const root = resolveDescriptor(descriptor);
  if (!root || typeof root !== "object") {
    return undefined;
  }
  if (plans.has(root)) {
    return plans.get(root);
  }
  const nodes = new Map();
  const parents = new Map();
  function collect(shape) {
    budget.poll();
    shape = resolveDescriptor(shape);
    if (!shape || typeof shape !== "object") {
      return undefined;
    }
    if (nodes.has(shape)) {
      return nodes.get(shape);
    }
    const node = { shape, selected: wanted(shape, selection) };
    nodes.set(shape, node);
    parents.set(node, []);
    const child = (descriptor) => {
      const next = collect(descriptor);
      if (next) {
        parents.get(next).push(node);
      }
      return next;
    };
    if (shape.fields) {
      node.fields = Object.keys(shape.fields)
        .sort()
        .map((name) => [name, child(shape.fields[name])]);
    } else if (shape.items) {
      node.items = child(shape.items);
    } else if (shape.branches) {
      Object.values(shape.branches).forEach(child);
    }
    return node;
  }
  const result = collect(root);
  // Propagate positive reachability to a fixed point. Recursive annotations
  // must not acquire a false negative from a depth-first cycle shortcut.
  const pending = [...nodes.values()].filter((node) => node.selected);
  for (let index = 0; index < pending.length; index++) {
    budget.poll();
    for (const parent of parents.get(pending[index])) {
      if (!parent.selected) {
        parent.selected = true;
        pending.push(parent);
      }
    }
  }
  for (const [shape, node] of nodes) {
    if (node.fields) {
      node.fields = node.fields.filter(([, child]) => child?.selected);
    }
    plans.set(shape, node);
  }
  return result;
}

/**
 * Select typed references/handles/set positions after COMPLETE shape validation.
 * Literal-only branches need no reference visit. Safety, field and scalar
 * validation remain separate prerequisites, never replaced by this traversal.
 */
export function walkTypedSelected(
  value,
  descriptor,
  visit,
  budget,
  selection = "references",
) {
  budget.check();
  const root = planFor(descriptor, budget, selection);
  function walk(value, node, pointer, parent, key) {
    if (!node?.selected) {
      return;
    }
    budget.poll();
    const shape = descriptorFor(value, node.shape, pointer);
    const current =
      shape === node.shape ? node : planFor(shape, budget, selection);
    if (wanted(shape, selection)) {
      visit(value, shape, pointer, parent, key);
    }
    if (current.fields) {
      for (const [name, child] of current.fields) {
        budget.poll();
        if (Object.hasOwn(value, name)) {
          walk(value[name], child, at(pointer, name), value, name);
        }
      }
    } else if (current.items?.selected) {
      for (let index = 0; index < value.length; index++) {
        walk(value[index], current.items, at(pointer, index), value, index);
      }
    }
  }
  walk(value, root, "");
  budget.check();
}
