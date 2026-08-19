const path = require("path");
const fs = require("fs");
const mammothPkg = path.resolve(__dirname, "../artifacts/api-server/node_modules/mammoth");
const mammoth = require(mammothPkg);

async function inspectDoc(filename) {
  const filePath = path.resolve(__dirname, `../${filename}`);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }
  const res = await mammoth.extractRawText({ path: filePath });
  const lines = res.value.split("\n").map(l => l.trim()).filter(Boolean);
  console.log(`=== ${filename} (Total non-empty lines: ${lines.length}) ===`);
  
  // Find all lines that mention MODULE, Section, or Key functional areas
  const moduleLines = lines.filter(l => /^(MODULE|SECTION|\d+\.\d+|\d+\s*[\.\-]\s*[A-Z]|PART)/i.test(l) || l.includes("MODULE "));
  console.log("Detected Modules / Sections:");
  moduleLines.forEach(m => console.log("  -", m));
}

async function main() {
  await inspectDoc("NISIT_Integrated_HR_Portal_PRD_v1.0.docx");
  await inspectDoc("NISIT HR Portal.docx");
}

main().catch(console.error);
