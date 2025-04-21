import fs from "fs";
import path from "path";

// 🔧 Adjust these paths to your setup
const inputDir = "/YOUR_Syncthings-Highlights-on-your-Device"; //CHANGE
const outputDir = "/YOUR_Obsidian-Path"; //CHANGE

function logStart() {
  console.log("🟡 KOReader Lua Notes → Markdown");
  console.log("📂 Input Dir:", path.resolve(inputDir));
  console.log("📄 Output Dir:", path.resolve(outputDir));
  console.log("───────────────────────────────────────────");
}

function getAllLuaFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllLuaFiles(fullPath));
    } else if (file.endsWith(".lua")) {
      results.push(fullPath);
    }
  });
  return results;
}

function parseLua(content) {
  const annotations = [];
  const matches = [...content.matchAll(/\[\d+\] = \{([\s\S]*?)\},/g)];

  for (const match of matches) {
    const block = match[1];
    const entry = {};
    const pairs = [...block.matchAll(/\["(.*?)"\]\s*=\s*"(.*?)"/g)];
    for (const [, key, val] of pairs) entry[key] = val;
    const pageMatch = block.match(/\["pageno"\]\s*=\s*(\d+)/);
    if (pageMatch) entry.pageno = parseInt(pageMatch[1]);
    annotations.push(entry);
  }

  const title = (content.match(/\["title"\]\s*=\s*"([^"]+)"/) || [])[1]?.trim();
  const authorsRaw = (content.match(/\["authors"\]\s*=\s*"([\s\S]*?)"/) || [])[1]?.trim();
  const pages = parseInt((content.match(/\["stats"\]\s*=\s*\{[^}]*?"pages"\]\s*=\s*(\d+)/) || [])[1]) || 0;
  const status = (content.match(/\["summary"\]\s*=\s*\{[^}]*?"status"\]\s*=\s*"([^"]+)"/) || [])[1] || "unknown";

  return { title, authorsRaw, pages, status, entries: annotations };
}

function percent(page, total) {
  return page && total ? `${((page / total) * 100).toFixed(2)}%` : "";
}

function formatDatetime(datetimeStr) {
  try {
    const date = new Date(datetimeStr);
    if (isNaN(date.getTime())) return "unknown time";

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `[[${yyyy}-${mm}-${dd}]] (${hh}:${min})`;
  } catch {
    return "unknown time";
  }
}

function smartSplitAuthors(raw) {
  const parts = raw.split(",").map(p => p.trim());
  const authors = [];

  let buffer = "";

  for (let i = 0; i < parts.length; i++) {
    buffer += buffer ? `, ${parts[i]}` : parts[i];

    const wordCountLeft = buffer.trim().split(/\s+/).length;
    const wordCountRight = parts[i + 1]?.split(/\s+/).length || 0;

    if (wordCountLeft > 1 && wordCountRight > 1) {
      authors.push(buffer);
      buffer = "";
    }
  }

  if (buffer) authors.push(buffer);
  return authors;
}

function toMarkdown(data) {
  const authors = smartSplitAuthors(data.authorsRaw);

  let out = "---\n";
  out += `title: ${data.title}\n`;
  if (authors.length > 1) {
    out += `author:\n${authors.map(a => `  - ${a}`).join("\n")}\n`;
  } else {
    out += `author: ${authors[0] || "Unknown"}\n`;
  }
  out += `pages: ${data.pages}\n`;
  out += `status: ${data.status}\n`;
  out += "---";

  for (const entry of data.entries) {
    if (!entry.text) continue;
    if (entry.chapter) out += `\n\n## ${entry.chapter}`;
    const timeFormatted = entry.datetime ? formatDatetime(entry.datetime) : "unknown time";
    out += `\n\n### Page: ${entry.pageno || "?"} (${percent(entry.pageno, data.pages)}) @ ${timeFormatted}`;
    out += `\n${entry.text}`;
  }

  return out;
}

function convert(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = parseLua(content);

    if (!parsed.title || !parsed.authorsRaw) {
      console.warn(`⚠️ Skipping file (missing title/author): ${filePath}`);
      return;
    }

    const markdown = toMarkdown(parsed);
    const filename = parsed.title.replace(/[\\/:"*?<>|]+/g, "_") + ".md";
    const dest = path.join(outputDir, filename);
    fs.writeFileSync(dest, markdown);
    console.log(`✅ Saved: ${filename}`);
  } catch (err) {
    console.error("❌ Error processing:", filePath, "\n", err.message);
  }
}

function run() {
  logStart();

  if (!fs.existsSync(inputDir)) {
    console.error("❌ Input directory does not exist:", inputDir);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    console.log("📁 Creating output directory:", outputDir);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const luaFiles = getAllLuaFiles(inputDir);

  if (luaFiles.length === 0) {
    console.warn("⚠️ No .lua files found in input folder (including subfolders).");
    return;
  }

  console.log("🔍 Found .lua files:", luaFiles.length);
  luaFiles.forEach(file => {
    console.log("📝 Converting:", file);
    convert(file);
  });

  console.log("✅ All done.");
}

// 🔁 START
run();
