// Application-owned registry of user-interface modules.
//
// Several interface modules legitimately collaborate: the export menu reports
// through the warning module, the search menu opens the ontology menu, and the
// zoom slider repositions docked controls in the sidebar. Before the D3 cutover
// those references were reached through the renderer's settings object, which
// made the renderer hold user-interface modules it never used itself. They live
// here instead, in the interface layer that actually owns them.
const registeredUiModules = new Map();

export function registerApplicationUiModule(moduleName, uiModule) {
  registeredUiModules.set(moduleName, uiModule);
}

export function applicationUiModule(moduleName) {
  return registeredUiModules.get(moduleName);
}

export function clearApplicationUiModules() {
  registeredUiModules.clear();
}
