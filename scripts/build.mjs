import { mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
const output = worker.replace("__PAGE_HTML__", JSON.stringify(html));

if (output === worker) throw new Error("Page placeholder was not found");

await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../dist/server/", import.meta.url), { recursive: true });
await mkdir(new URL("../dist/.openai/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/server/index.js", import.meta.url), output);
await cp(
  new URL("../.openai/hosting.json", import.meta.url),
  new URL("../dist/.openai/hosting.json", import.meta.url)
);
