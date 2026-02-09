#!/usr/bin/env node
// Patches outetts to remove Node.js `fs` import that breaks Turbopack browser builds.
// The fs import is in a Node-only code path (save to file) that never runs in the browser.
const { readFileSync, writeFileSync } = require("fs");
const { resolve } = require("path");

const filePath = resolve(__dirname, "../node_modules/outetts/outetts.js/version/v1/interface.js");

try {
  let content = readFileSync(filePath, "utf-8");
  if (content.includes('await import("fs")')) {
    content = content.replace(
      'const fs = await import("fs");',
      'const fs = { writeFileSync: () => { throw new Error("fs not available in browser"); } };'
    );
    writeFileSync(filePath, content);
    console.log("Patched outetts: replaced fs import with browser stub");
  } else {
    console.log("outetts already patched or fs import not found");
  }
} catch (e) {
  console.warn("Could not patch outetts:", e.message);
}
