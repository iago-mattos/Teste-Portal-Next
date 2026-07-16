import { expect, type Locator, type Page } from "@playwright/test";
import type { SimulatorInteractions } from "../pages/portal/portal-simulator.page";

export const DEMO_TIMING = Object.freeze({
  smoothScrollMs: 180,
  highlightMs: 70,
  navigationClickIntervalMs: 1_400,
  formClickIntervalMs: 900,
  advanceClickIntervalMs: 1_800,
  decisiveClickIntervalMs: 5_000,
  beforeSelectMs: 250,
  afterActionMs: 90,
  typingDelayMinMs: 22,
  typingDelayMaxMs: 48,
  punctuationPauseMs: 20,
  mouseSegmentMs: 14,
  finalScreenMs: 5_000,
});

const CURSOR_ID = "playwright-demo-cursor";
const cursorPositions = new WeakMap<Page, Readonly<{ x: number; y: number }>>();
const lastClickTimes = new WeakMap<Page, number>();
const timelineStarts = new WeakMap<Page, number>();
const clickTimelines = new WeakMap<Page, number[]>();

function injectCursor(cursorId: string): void {
  const mountCursor = (): void => {
    if (document.getElementById(cursorId) || !document.documentElement) return;

    const cursor = document.createElement("div");
    cursor.id = cursorId;
    cursor.setAttribute("aria-hidden", "true");
    Object.assign(cursor.style, {
      position: "fixed",
      left: "50%",
      top: "50%",
      width: "19px",
      height: "27px",
      background: "#111827",
      clipPath: "polygon(0 0, 0 88%, 27% 67%, 43% 100%, 58% 92%, 42% 60%, 78% 60%)",
      filter:
        "drop-shadow(0 0 1px #ffffff) drop-shadow(0 2px 2px rgba(15, 23, 42, 0.35))",
      pointerEvents: "none",
      zIndex: "2147483647",
      transform: "translate(-2px, -2px) scale(1)",
      transformOrigin: "2px 2px",
      transition:
        "left 35ms ease-out, top 35ms ease-out, transform 90ms ease-out",
    });
    document.documentElement.append(cursor);

    document.addEventListener(
      "mousemove",
      (event) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      },
      { passive: true },
    );

    document.addEventListener(
      "mousedown",
      () => {
        cursor.style.transform = "translate(-2px, -2px) scale(0.82)";
      },
      { passive: true },
    );
    document.addEventListener(
      "mouseup",
      () => {
        cursor.style.transform = "translate(-2px, -2px) scale(1)";
      },
      { passive: true },
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountCursor, { once: true });
    return;
  }
  mountCursor();
}

async function pause(page: Page, milliseconds: number): Promise<void> {
  await page.waitForTimeout(milliseconds);
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function cubicBezier(
  start: number,
  controlA: number,
  controlB: number,
  end: number,
  progress: number,
): number {
  const inverse = 1 - progress;
  return (
    inverse ** 3 * start +
    3 * inverse ** 2 * progress * controlA +
    3 * inverse * progress ** 2 * controlB +
    progress ** 3 * end
  );
}

async function moveCursorNaturally(
  page: Page,
  target: Readonly<{ x: number; y: number }>,
): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
  const start = cursorPositions.get(page) ?? {
    x: viewport.width / 2,
    y: viewport.height / 2,
  };
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  const arc = Math.min(72, distance * 0.1);
  const length = distance || 1;
  const perpendicularX = -deltaY / length;
  const perpendicularY = deltaX / length;
  const direction = target.x >= start.x ? 1 : -1;
  const controlA = {
    x: start.x + deltaX * 0.34 + perpendicularX * arc * direction,
    y: start.y + deltaY * 0.34 + perpendicularY * arc * direction,
  };
  const controlB = {
    x: start.x + deltaX * 0.76 - perpendicularX * arc * 0.28 * direction,
    y: start.y + deltaY * 0.76 - perpendicularY * arc * 0.28 * direction,
  };

  const segments = distance > 700 ? 4 : 3;
  for (let segment = 1; segment <= segments; segment += 1) {
    const progress = easeInOutCubic(segment / segments);
    await page.mouse.move(
      cubicBezier(start.x, controlA.x, controlB.x, target.x, progress),
      cubicBezier(start.y, controlA.y, controlB.y, target.y, progress),
      { steps: 5 },
    );
    await pause(page, DEMO_TIMING.mouseSegmentMs);
  }

  cursorPositions.set(page, target);
}

async function prepareElement(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const requiresScroll = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const margin = 48;
    return (
      bounds.top < margin ||
      bounds.left < margin ||
      bounds.bottom > window.innerHeight - margin ||
      bounds.right > window.innerWidth - margin
    );
  });

  if (requiresScroll) {
    await locator.evaluate((element) => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await pause(page, DEMO_TIMING.smoothScrollMs);
  }

  const box = await locator.boundingBox();
  if (!box) throw new Error("O elemento da demonstração não possui área visível.");

  await moveCursorNaturally(page, {
    x: box.x + box.width * 0.52,
    y: box.y + box.height * 0.54,
  });

  await locator.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.dataset.demoOriginalBoxShadow = htmlElement.style.boxShadow;
    htmlElement.dataset.demoOriginalFilter = htmlElement.style.filter;
    htmlElement.dataset.demoOriginalTransition = htmlElement.style.transition;
    htmlElement.style.transition =
      "box-shadow 160ms ease-out, filter 160ms ease-out";
    htmlElement.style.boxShadow =
      "0 0 0 3px rgba(37, 99, 235, 0.14), 0 10px 28px rgba(15, 23, 42, 0.12)";
    htmlElement.style.filter = "brightness(1.025)";
  });
  await pause(page, DEMO_TIMING.highlightMs);
}

async function removeHighlight(locator: Locator): Promise<void> {
  await locator
    .evaluate((element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.boxShadow =
        htmlElement.dataset.demoOriginalBoxShadow ?? "";
      htmlElement.style.filter = htmlElement.dataset.demoOriginalFilter ?? "";
      htmlElement.style.transition =
        htmlElement.dataset.demoOriginalTransition ?? "";
      delete htmlElement.dataset.demoOriginalBoxShadow;
      delete htmlElement.dataset.demoOriginalFilter;
      delete htmlElement.dataset.demoOriginalTransition;
    })
    .catch(() => undefined);
}

async function resolveClickInterval(locator: Locator): Promise<number> {
  const contract = await locator.evaluate((element) => ({
    role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
    text: element.textContent?.replace(/\s+/gu, " ").trim() ?? "",
    type: element.getAttribute("type") ?? "",
  }));

  if (/^(Enviar Proposta|Enviar)$/iu.test(contract.text)) {
    return DEMO_TIMING.decisiveClickIntervalMs;
  }
  if (/^(Avan[cç]ar|MAPFRE)/iu.test(contract.text)) {
    return DEMO_TIMING.advanceClickIntervalMs;
  }
  if (contract.role === "radio" || contract.type === "radio") {
    return DEMO_TIMING.formClickIntervalMs;
  }
  return DEMO_TIMING.navigationClickIntervalMs;
}

export async function installDemoCursor(page: Page): Promise<void> {
  await page.addInitScript(injectCursor, CURSOR_ID);
  await page.evaluate(injectCursor, CURSOR_ID).catch(() => undefined);
  const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
  cursorPositions.set(page, {
    x: viewport.width / 2,
    y: viewport.height / 2,
  });
  lastClickTimes.delete(page);
  timelineStarts.set(page, Date.now());
  clickTimelines.set(page, []);
}

function recordDemoClick(page: Page): void {
  const clickedAt = Date.now();
  lastClickTimes.set(page, clickedAt);
  clickTimelines.get(page)?.push(clickedAt);
}

export function getDemoClickTimeline(page: Page): readonly number[] {
  const startedAt = timelineStarts.get(page);
  if (!startedAt) return [];
  return (clickTimelines.get(page) ?? []).map(
    (clickedAt) => (clickedAt - startedAt) / 1_000,
  );
}

export async function demoClick(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeEnabled();
  await prepareElement(page, locator);
  const clickInterval = await resolveClickInterval(locator);
  const previousClickAt = lastClickTimes.get(page);
  const elapsedSincePreviousClick = previousClickAt
    ? Date.now() - previousClickAt
    : 0;
  await pause(
    page,
    Math.max(0, clickInterval - elapsedSincePreviousClick),
  );
  await locator.click();
  recordDemoClick(page);
  await removeHighlight(locator);
  await pause(page, DEMO_TIMING.afterActionMs);
}

export async function demoType(
  page: Page,
  locator: Locator,
  value: string,
  options: Readonly<{ clear?: boolean }> = {},
): Promise<void> {
  await expect(locator).toBeEditable();
  await prepareElement(page, locator);
  await locator.click();
  recordDemoClick(page);

  if (options.clear !== false) {
    await locator.press("ControlOrMeta+A");
    await locator.press("Backspace");
  }

  const delayRange =
    DEMO_TIMING.typingDelayMaxMs - DEMO_TIMING.typingDelayMinMs + 1;
  for (const [index, character] of [...value].entries()) {
    await locator.pressSequentially(character);
    const naturalDelay =
      DEMO_TIMING.typingDelayMinMs +
      ((character.codePointAt(0) ?? 0) + index * 17) % delayRange;
    const punctuationDelay = /[\s@.,/-]/u.test(character)
      ? DEMO_TIMING.punctuationPauseMs
      : 0;
    await pause(page, naturalDelay + punctuationDelay);
  }
  await removeHighlight(locator);
  await pause(page, DEMO_TIMING.afterActionMs);
}

async function demoSelectOption(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  await expect(locator).toBeEnabled();
  await prepareElement(page, locator);
  await locator.click();
  recordDemoClick(page);
  await pause(page, DEMO_TIMING.beforeSelectMs);
  await locator.selectOption({ label });
  await removeHighlight(locator);
  await pause(page, DEMO_TIMING.afterActionMs);
}

async function demoSetChecked(
  page: Page,
  locator: Locator,
  checked: boolean,
): Promise<void> {
  if ((await locator.isChecked()) !== checked) await demoClick(page, locator);
  await expect(locator).toBeChecked({ checked });
}

export function createDemoInteractions(page: Page): SimulatorInteractions {
  return {
    click: (locator) => demoClick(page, locator),
    type: (locator, value, options) =>
      demoType(page, locator, value, options),
    selectOption: (locator, label) => demoSelectOption(page, locator, label),
    setChecked: (locator, checked) =>
      demoSetChecked(page, locator, checked),
  };
}

export async function holdDemoFinalScreen(page: Page): Promise<void> {
  await pause(page, DEMO_TIMING.finalScreenMs);
}
