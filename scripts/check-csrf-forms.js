#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '..', 'client', 'views');

function listEjsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listEjsFiles(fullPath);
    }
    if (entry.isFile() && fullPath.endsWith('.ejs')) {
      return [fullPath];
    }
    return [];
  });
}

function extractForms(content) {
  const forms = [];
  const regex = /<form[\s\S]*?<\/form>/gi;
  let match = regex.exec(content);
  while (match) {
    forms.push(match[0]);
    match = regex.exec(content);
  }
  return forms;
}

function formHasCsrfToken(formMarkup) {
  const normalized = formMarkup.toLowerCase();
  return normalized.includes('csrf') || normalized.includes('_csrf');
}

function main() {
  if (!fs.existsSync(VIEWS_DIR)) {
    console.error(`Views directory not found: ${VIEWS_DIR}`);
    process.exit(1);
  }

  const files = listEjsFiles(VIEWS_DIR);
  const violations = [];

  files.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const forms = extractForms(content);
    forms.forEach((form) => {
      if (!formHasCsrfToken(form)) {
        violations.push({ file: path.relative(process.cwd(), filePath), snippet: form.trim().slice(0, 80) });
      }
    });
  });

  if (violations.length > 0) {
    console.error('CSRF check failed. The following forms are missing csrfToken usage:');
    violations.forEach(({ file, snippet }) => {
      console.error(`- ${file}: ${snippet}...`);
    });
    process.exit(1);
  }

  console.log('All forms include csrfToken markup (or no forms were detected).');
}

main();
