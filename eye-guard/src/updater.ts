import * as vscode from "vscode";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readConfig } from "./config";

const GITHUB_REPO = "mquand/health-guard";
const LAST_CHECK_KEY = "eyeGuard.lastUpdateCheck";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = "eye-guard-vscode-extension";

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  assets?: { name?: string; browser_download_url?: string }[];
}

/**
 * Checks GitHub Releases for a newer .vsix and offers to install it. Silent on automatic checks;
 * `manual` (the "Kiểm tra cập nhật" command) always reports the outcome to the user.
 */
export async function checkForUpdates(
  context: vscode.ExtensionContext,
  options: { manual?: boolean } = {}
): Promise<void> {
  const manual = !!options.manual;

  try {
    if (!manual) {
      if (!readConfig().checkUpdates) return;
      const last = context.globalState.get<number>(LAST_CHECK_KEY) ?? 0;
      if (Date.now() - last < CHECK_INTERVAL_MS) return;
      void context.globalState.update(LAST_CHECK_KEY, Date.now());
    }

    const release = await getLatestRelease();
    if (!release?.tag_name) {
      if (manual) {
        void vscode.window.showInformationMessage(
          "Không tìm thấy thông tin bản phát hành trên GitHub."
        );
      }
      return;
    }

    const currentVersion = context.extension?.packageJSON?.version ?? "0.0.0";
    const latestVersion = release.tag_name.replace(/^v/, "");

    if (compareSemver(latestVersion, currentVersion) <= 0) {
      if (manual) {
        void vscode.window.showInformationMessage(
          `Eye Guard đang ở phiên bản mới nhất (v${currentVersion}).`
        );
      }
      return;
    }

    const vsix = release.assets?.find((a) => a.name?.endsWith(".vsix") && a.browser_download_url);
    if (!vsix?.browser_download_url) {
      if (manual) {
        void vscode.window
          .showWarningMessage(
            `Đã có bản cập nhật v${latestVersion} trên GitHub nhưng chưa đính kèm file .vsix.`,
            "Xem GitHub"
          )
          .then((choice) => {
            if (choice && release.html_url) {
              void vscode.env.openExternal(vscode.Uri.parse(release.html_url));
            }
          });
      }
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      `Eye Guard có bản cập nhật mới v${latestVersion} (hiện tại: v${currentVersion}).`,
      "Cập nhật ngay",
      "Xem chi tiết",
      "Để sau"
    );

    if (choice === "Xem chi tiết" && release.html_url) {
      void vscode.env.openExternal(vscode.Uri.parse(release.html_url));
    } else if (choice === "Cập nhật ngay") {
      await installVsix(vsix.browser_download_url, vsix.name ?? `eye-guard-${latestVersion}.vsix`, latestVersion);
    }
  } catch (error) {
    if (manual) {
      void vscode.window.showErrorMessage(
        `Kiểm tra cập nhật thất bại: ${error instanceof Error ? error.message : error}`
      );
    }
  }
}

async function getLatestRelease(): Promise<GitHubRelease | null> {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/vnd.github+json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API trả về mã ${response.status}`);
  return (await response.json()) as GitHubRelease;
}

async function installVsix(downloadUrl: string, fileName: string, version: string): Promise<void> {
  const destPath = path.join(os.tmpdir(), fileName);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Đang cập nhật Eye Guard lên v${version}…`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Đang tải file cài đặt từ GitHub…" });
      const response = await fetch(downloadUrl, { headers: { "User-Agent": USER_AGENT } });
      // GitHub release downloads redirect to a CDN; fetch follows redirects by default.
      if (!response.ok || !response.body) {
        throw new Error(`Tải file thất bại (HTTP ${response.status})`);
      }
      fs.writeFileSync(destPath, Buffer.from(await response.arrayBuffer()));

      progress.report({ message: "Đang cài đặt…" });
      try {
        await vscode.commands.executeCommand(
          "workbench.extensions.installExtension",
          vscode.Uri.file(destPath)
        );
      } finally {
        try {
          fs.unlinkSync(destPath);
        } catch {
          /* temp file cleanup is best-effort */
        }
      }

      const reload = await vscode.window.showInformationMessage(
        `Đã cập nhật Eye Guard lên v${version}. Tải lại cửa sổ để áp dụng.`,
        "Khởi động lại ngay"
      );
      if (reload === "Khởi động lại ngay") {
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    }
  );
}

function compareSemver(v1: string, v2: string): number {
  const p1 = v1.split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = v2.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const diff = (p1[i] || 0) - (p2[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
