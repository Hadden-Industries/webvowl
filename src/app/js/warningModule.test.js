import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule } from "node:vm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "@jest/globals";

let createWarningModule;
let warningModuleContext;

beforeAll(async () => {
  const moduleUrl = new URL("./warningModule.js", import.meta.url);
  warningModuleContext = createContext({
    AbortController,
    document: undefined,
  });
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { context: warningModuleContext, identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected warning-module dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  ({ createWarningModule } = sourceModule.namespace);
});

class WarningElement extends EventTarget {
  constructor(tagName = "div") {
    super();
    this.tagName = tagName;
    this.children = [];
    this.id = "";
    this.innerHTML = "";
    this.textContent = "";
    this.parentNode = null;
    this.classes = new Set();
    this.classList = {
      add: (...classNames) =>
        classNames.forEach((className) => this.classes.add(className)),
      remove: (...classNames) =>
        classNames.forEach((className) => this.classes.delete(className)),
      toggle: (className, isPresent) => {
        if (isPresent) {
          this.classes.add(className);
        } else {
          this.classes.delete(className);
        }
      },
    };
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    const childIndex = this.parentNode?.children.indexOf(this) ?? -1;
    if (childIndex >= 0) {
      this.parentNode.children.splice(childIndex, 1);
    }
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this[name] = value;
  }
}

function findDescendantById(element, id) {
  if (element.id === id) {
    return element;
  }
  for (const child of element.children) {
    const matchingDescendant = findDescendantById(child, id);
    if (matchingDescendant !== undefined) {
      return matchingDescendant;
    }
  }
  return undefined;
}

function descendantsWithClass(element, className) {
  const matchingDescendants = element.classes.has(className) ? [element] : [];
  return matchingDescendants.concat(
    ...element.children.map((child) => descendantsWithClass(child, className)),
  );
}

describe("warning presentation listener ownership", () => {
  let messageList;
  let warningModule;
  let interactionBlock;

  beforeEach(() => {
    messageList = new WarningElement();
    interactionBlock = new WarningElement();
    interactionBlock.classList.add("hidden");
    global.document = {
      createElement: (tagName) => new WarningElement(tagName),
      querySelector: (selector) => {
        if (selector === "#blockGraphInteractions") {
          return interactionBlock;
        }
        if (selector === "#WarningErrorMessages") {
          return messageList;
        }
        return findDescendantById(messageList, selector.slice(1));
      },
    };
    warningModuleContext.document = global.document;
    warningModule = createWarningModule({});
  });

  afterEach(() => {
    warningModule?.dispose();
    warningModuleContext.document = undefined;
    delete global.document;
  });

  test("a native button click closes its own warning message", () => {
    const messageId = warningModule.addMessageBox();
    warningModule.createMessageContext(messageId);
    const messageContainer = findDescendantById(
      messageList,
      `messageContainerId_${messageId}`,
    );
    const closeButton = findDescendantById(
      messageList,
      `killWarningErrorMessages_${messageId}`,
    );

    closeButton.dispatchEvent(new Event("click"));

    expect(messageContainer.classes).toContain("warn-collapsed");
  });

  test.each([true, false])(
    "settles the existing native deletion dialog with accepted=%s",
    async (accepted) => {
      const confirmation = warningModule.confirmOntologyDeletion({
        recordTargets: [
          { collection: "class", recordId: "a" },
          { collection: "property", recordId: "p" },
        ],
      });
      expect(interactionBlock.classes).not.toContain("hidden");
      findDescendantById(
        messageList,
        accepted ? "killWarningErrorMessages_0" : "cancelButton_0",
      ).dispatchEvent(new Event("click"));
      await expect(confirmation).resolves.toBe(accepted);
      expect(interactionBlock.classes).toContain("hidden");
    },
  );

  test("cancels a deletion dialog when its document generation is retired", async () => {
    const generation = new AbortController();
    const confirmation = warningModule.confirmOntologyDeletion(
      { recordTargets: [{ collection: "class", recordId: "a" }] },
      { signal: generation.signal },
    );
    generation.abort();
    await expect(confirmation).resolves.toBe(false);
    expect(interactionBlock.classes).toContain("hidden");
  });

  test("disposal detaches dynamic warning listeners and is idempotent", () => {
    const messageId = warningModule.addMessageBox();
    warningModule.createMessageContext(messageId);
    const messageContainer = findDescendantById(
      messageList,
      `messageContainerId_${messageId}`,
    );
    const closeButton = findDescendantById(
      messageList,
      `killWarningErrorMessages_${messageId}`,
    );
    messageContainer.classList.remove("warn-collapsed");
    warningModule.dispose();
    warningModule.dispose();

    closeButton.dispatchEvent(new Event("click"));

    expect(messageContainer.classes).not.toContain("warn-collapsed");
  });

  test("renders ontology-derived warning fields as inert text", () => {
    const warningFields = [
      '<img src=x onerror="alert(1)">',
      "Reason <script>unsafe()</script>",
      "Action <b>without markup</b>",
    ];

    warningModule.showWarning(...warningFields, 1, false);

    const renderedWarningFields = descendantsWithClass(
      messageList,
      "warning-msg-content",
    );
    expect(renderedWarningFields.map(({ textContent }) => textContent)).toEqual(
      warningFields,
    );
    expect(renderedWarningFields.map(({ innerHTML }) => innerHTML)).toEqual([
      "",
      "",
      "",
    ]);
  });
});
