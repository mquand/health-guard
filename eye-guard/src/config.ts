import * as vscode from "vscode";

export type ReminderKind = "eye" | "water" | "walk";

export interface FeatureConfig {
  enabled: boolean;
  intervalMinutes: number;
  effect: string;
  message: string;
}

export interface EyeBreakConfig extends FeatureConfig {
  durationSeconds: number;
}

export type Appearance = "clean" | "pixel";

export interface EyeGuardConfig {
  enabled: boolean;
  startPaused: boolean;
  onlyWhenFocused: boolean;
  sound: boolean;
  focusOnReminder: boolean;
  appearance: Appearance;
  popupStyle: "panel" | "notification";
  snoozeMinutes: number;
  eyeBreak: EyeBreakConfig;
  water: FeatureConfig;
  walk: FeatureConfig;
}

export const CONFIG_SECTION = "eyeGuard";

/** Read the whole configuration in one go. Defaults mirror package.json. */
export function readConfig(): EyeGuardConfig {
  const c = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const feature = (key: string, effect: string, message: string, interval: number): FeatureConfig => ({
    enabled: c.get<boolean>(`${key}.enabled`, true),
    intervalMinutes: clampNumber(c.get<number>(`${key}.intervalMinutes`, interval), 1, 480),
    effect: c.get<string>(`${key}.effect`, effect),
    message: c.get<string>(`${key}.message`, message).trim() || message,
  });

  return {
    enabled: c.get<boolean>("enabled", true),
    startPaused: c.get<boolean>("startPaused", false),
    onlyWhenFocused: c.get<boolean>("onlyWhenFocused", true),
    sound: c.get<boolean>("sound", true),
    focusOnReminder: c.get<boolean>("focusOnReminder", true),
    appearance: c.get<string>("appearance", "clean") === "pixel" ? "pixel" : "clean",
    popupStyle: c.get<string>("popupStyle", "panel") === "notification" ? "notification" : "panel",
    snoozeMinutes: clampNumber(c.get<number>("snoozeMinutes", 5), 1, 120),
    eyeBreak: {
      ...feature(
        "eyeBreak",
        "eyeball",
        "Nhìn ra xa 6 mét (20 feet) trong 20 giây để mắt được nghỉ.",
        20
      ),
      durationSeconds: clampNumber(c.get<number>("eyeBreak.durationSeconds", 20), 5, 300),
    },
    water: feature(
      "water",
      "water-orb",
      "Uống một ly nước nào! Cơ thể và đôi mắt đều cần nước.",
      45
    ),
    walk: feature(
      "walk",
      "bird",
      "Đứng dậy, đi lại vài phút hoặc đi vệ sinh nhé. Ngồi lâu không tốt cho lưng và mắt.",
      90
    ),
  };
}

/** Called whenever any `eyeGuard.*` setting changes. */
export function onConfigChanged(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(CONFIG_SECTION)) {
      listener();
    }
  });
}

export function featureOf(config: EyeGuardConfig, kind: ReminderKind): FeatureConfig {
  return kind === "eye" ? config.eyeBreak : kind === "water" ? config.water : config.walk;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
