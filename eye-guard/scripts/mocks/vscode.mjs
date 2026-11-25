// A small fake of the parts of the VS Code API Eye Guard touches, so the extension host code can be
// exercised in plain Node (scripts/extension.test.mjs).

export class Disposable {
  constructor(fn) {
    this.fn = fn;
  }
  dispose() {
    this.fn?.();
  }
}

export const StatusBarAlignment = { Left: 1, Right: 2 };
export const ViewColumn = { Active: -1, Beside: -2 };
export const ConfigurationTarget = { Global: 1, Workspace: 2 };
export const QuickPickItemKind = { Separator: -1, Default: 0 };

export class ThemeColor {
  constructor(id) {
    this.id = id;
  }
}

export const Uri = {
  joinPath(base, ...parts) {
    return { path: [base.path, ...parts].join("/"), toString: () => "vscode-resource://" + [base.path, ...parts].join("/") };
  },
  file(path) {
    return { path, toString: () => "file://" + path };
  },
};

export const testState = {
  config: {},
  statusItems: [],
  panels: [],
  commands: new Map(),
  infoCalls: [],
  warningCalls: [],
  statusMessages: [],
  executedCommands: [],
  quickPickQueue: [],
  infoChoice: undefined,
  warningChoice: undefined,
  focused: true,
};

class FakeWebview {
  constructor() {
    this.html = "";
    this.cspSource = "vscode-webview://test";
    this.sent = [];
    this.receive = undefined;
  }
  asWebviewUri(uri) {
    return uri;
  }
  postMessage(message) {
    this.sent.push(message);
    return Promise.resolve(true);
  }
  onDidReceiveMessage(cb) {
    this.receive = cb;
    return new Disposable();
  }
}

class FakePanel {
  constructor(viewType, title) {
    this.viewType = viewType;
    this.title = title;
    this.webview = new FakeWebview();
    this.disposed = false;
    this.disposeListeners = [];
    this.revealed = 0;
    this.iconPath = undefined;
  }
  reveal() {
    this.revealed++;
  }
  onDidDispose(cb) {
    this.disposeListeners.push(cb);
    return new Disposable();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const cb of this.disposeListeners) cb();
  }
}

export const workspace = {
  getConfiguration(section) {
    return {
      get(key, fallback) {
        const full = `${section}.${key}`;
        return full in testState.config ? testState.config[full] : fallback;
      },
      update(key, value) {
        testState.config[`${section}.${key}`] = value;
        for (const listener of configListeners) listener({ affectsConfiguration: () => true });
        return Promise.resolve();
      },
    };
  },
  onDidChangeConfiguration(cb) {
    configListeners.push(cb);
    return new Disposable(() => {
      const i = configListeners.indexOf(cb);
      if (i >= 0) configListeners.splice(i, 1);
    });
  },
};

const configListeners = [];

export const window = {
  state: {
    get focused() {
      return testState.focused;
    },
  },
  createStatusBarItem() {
    const item = {
      text: "",
      tooltip: "",
      command: "",
      name: "",
      backgroundColor: undefined,
      shown: false,
      disposed: false,
      show() {
        this.shown = true;
      },
      hide() {
        this.shown = false;
      },
      dispose() {
        this.disposed = true;
        this.shown = false;
      },
    };
    testState.statusItems.push(item);
    return item;
  },
  createWebviewPanel(viewType, title) {
    const panel = new FakePanel(viewType, title);
    testState.panels.push(panel);
    return panel;
  },
  showQuickPick(items) {
    const next = testState.quickPickQueue.shift();
    return Promise.resolve(next === undefined ? undefined : next);
  },
  showInformationMessage(message, ...actions) {
    testState.infoCalls.push({ message, actions });
    return Promise.resolve(testState.infoChoice);
  },
  showWarningMessage(message, ...actions) {
    testState.warningCalls.push({ message, actions });
    return Promise.resolve(testState.warningChoice);
  },
  setStatusBarMessage(message) {
    testState.statusMessages.push(message);
    return new Disposable();
  },
};

export const commands = {
  registerCommand(id, handler) {
    testState.commands.set(id, handler);
    return new Disposable(() => testState.commands.delete(id));
  },
  executeCommand(id, ...args) {
    testState.executedCommands.push({ id, args });
    const handler = testState.commands.get(id);
    return Promise.resolve(handler ? handler(...args) : undefined);
  },
};

/** Helpers for tests. */
export const testHelpers = {
  setConfig(key, value) {
    testState.config[key] = value;
    for (const listener of configListeners) listener({ affectsConfiguration: () => true });
  },
  reset() {
    testState.config = {};
    testState.statusItems = [];
    testState.panels = [];
    testState.commands.clear();
    testState.infoCalls = [];
    testState.warningCalls = [];
    testState.statusMessages = [];
    testState.executedCommands = [];
    testState.quickPickQueue = [];
    testState.infoChoice = undefined;
    testState.warningChoice = undefined;
    testState.focused = true;
    configListeners.length = 0;
  },
};
