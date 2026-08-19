const path = require("path");
const fs = require("fs");
const mammothPkg = path.resolve(__dirname, "../artifacts/api-server/node_modules/mammoth");
const mammoth = require(mammothPkg);

async function main() {
  const filePath = path.resolve(__dirname, "../NISIT_Integrated_HR_Portal_PRD_v1.0.docx");
  const res = await mammoth.extractRawText({ path: filePath });
  const lines = res.value.split("\n").map(l => l.trim()).filter(Boolean);

  let currentSection = "";
  const sections = {};

  for (const line of lines) {
    if (/^\d+\.\s+[A-Z\s\/]+/.test(line)) {
      currentSection = line;
      sections[currentSection] = [];
    } else if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  for (const [title, content] of Object.entries(sections)) {
    if (/^\d+\.\s+(ONBOARDING|OFFBOARDING|CONTRACT|LEAVE|ATTENDANCE|BENEFITS|HOUSING|TRAINING|PERFORMANCE|RECRUITMENT|EMPLOYEE SELF|MANAGER SELF|DOCUMENT|HR LETTER|NOTIFICATION|DASHBOARD|REPORTING|AUDIT)/i.test(title)) {
      console.log(`\n========================================`);
      console.log(title);
      console.log(`========================================`);
      console.log(content.slice(0, 15).join("\n"));
    }
  }
}

main().catch(console.error);
