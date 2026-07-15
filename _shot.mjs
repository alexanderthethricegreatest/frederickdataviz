import { chromium } from "playwright";
const OUT = "/tmp/claude-1000/-home-alext-fredcoplans/8d69b298-e3fd-4e63-a978-dd650bab5bf5/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));
await p.goto("http://localhost:3013/valley-link", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(3500);
// switch parcel coloring to Karst impact via the Select
await p.click("text=Impact tier");
await p.waitForTimeout(400);
await p.click("text=Karst impact");
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/valley-karst.png` });
// click a parcel near center to open the info panel (shows scores)
const map = await p.$(".gis-map");
const box = await map.boundingBox();
await p.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.5);
await p.waitForTimeout(1000);
await p.screenshot({ path: `${OUT}/valley-info.png` });
console.log("CONSOLE ERRORS:", errs.length ? errs.slice(0, 10).join("\n  ") : "none");
await b.close();
