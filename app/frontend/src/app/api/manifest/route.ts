import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { manifestPath } from "@/lib/serverPaths";
import type { Manifest } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath(), "utf8")) as Manifest;
    return NextResponse.json(manifest, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The speech sample manifest could not be loaded." }, { status: 500 });
  }
}
