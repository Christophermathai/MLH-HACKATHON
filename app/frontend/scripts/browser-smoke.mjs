import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDirectory = new URL("../test-results/", import.meta.url);

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Whisper Evidence Desk" }).waitFor();
  await page.getByText("simulated", { exact: true }).first().waitFor();
  if (await page.locator(".case-button").count() !== 5) throw new Error("Expected five speech scenarios.");

  await page.locator('input[type="file"]').setInputFiles({
    name: "smoke.webm",
    mimeType: "audio/webm;codecs=opus",
    buffer: Buffer.alloc(44),
  });
  await page.getByRole("button", { name: "Run Whisper pass" }).click();
  await page.getByText("0.0%", { exact: true }).waitFor();
  await page.getByRole("radio", { name: "yes" }).check();
  await page.getByRole("button", { name: "Add to evidence log" }).click();
  await page.getByText("1 saved passes", { exact: true }).waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("desktop.png", outputDirectory)), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("1 saved passes", { exact: true }).waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("mobile.png", outputDirectory)), fullPage: true });

  if (errors.length) throw new Error(`Browser console errors:\n${errors.join("\n")}`);
  console.log("Browser smoke test passed: five scenarios, simulated transcription, scoring, persistence, desktop and mobile layouts.");
} finally {
  await browser.close();
}
