import { build } from "esbuild";
import { mkdir, copyFile, rm, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const out = new URL("../.extension-build/", import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const entry of ["background", "content", "capture", "bridge", "popup"]) {
  await build({
    entryPoints: [
      new URL(`../extension/src/${entry}.js`, import.meta.url).pathname,
    ],
    outfile: new URL(`${entry}.js`, out).pathname,
    bundle: true,
    format: "iife",
    target: "chrome111",
    minify: false,
  });
}
for (const file of ["manifest.json", "popup.html", "README.md"])
  await copyFile(
    new URL(`../extension/${file}`, import.meta.url),
    new URL(file, out),
  );
await mkdir(new URL("../public/downloads/", import.meta.url), {
  recursive: true,
});
const zip = new URL("../public/downloads/daily-extension.zip", import.meta.url)
  .pathname;
await rm(zip, { force: true });
execFileSync("zip", ["-q", zip, ...(await readdir(out))], { cwd: out });
console.log("Built public/downloads/daily-extension.zip");
