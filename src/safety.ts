import type { AppConfig, LocatorSpec, PageAction } from "./types.js";

function locatorText(locator: LocatorSpec): string {
  switch (locator.by) {
    case "role":
      return `${locator.role} ${locator.name}`;
    case "css":
    case "text":
    case "label":
    case "placeholder":
    case "testId":
      return locator.value;
  }
}

export function assertSafeAction(action: PageAction, safety: AppConfig["safety"]): void {
  if (action.type === "wait") return;
  const targetText = locatorText(action.target);
  const allowed = safety.allowedActionTextRegexes.some((source) => new RegExp(source, "i").test(targetText));
  const blocked = new RegExp(safety.blockedActionTextRegex, "i").test(targetText);
  if (blocked && !allowed) {
    throw new Error(
      `Safety guard blocked ${action.type} action targeting ${JSON.stringify(targetText)}. ` +
        "The monitor is read-only. If this is a navigation-only control, add a narrow exact regex to safety.allowedActionTextRegexes."
    );
  }
}
