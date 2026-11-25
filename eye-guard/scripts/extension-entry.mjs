// Test entry: bundles the extension together with the fake `vscode` module so both share one module
// instance (the extension's `vscode` alias and the test's mock must be the same object).
export * as ext from "../src/extension";
export * as mock from "./mocks/vscode.mjs";
