import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const htmlFiles = readdirSync(root).filter((file) => extname(file) === '.html');
const jsonFiles = [
  'i18n/de.json',
  'i18n/en.json',
  'i18n/fr.json',
  'i18n/it.json',
  'ai-index.json'
];

let failed = false;

for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch (error) {
    failed = true;
    console.error(`${file}: invalid JSON`);
    console.error(error.message);
  }
}

for (const file of htmlFiles) {
  const html = readFileSync(join(root, file), 'utf8');
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scriptMatches) {
    try {
      JSON.parse(match[1].trim());
    } catch (error) {
      failed = true;
      console.error(`${file}: invalid JSON-LD`);
      console.error(error.message);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Static checks passed for ${htmlFiles.length} HTML files and ${jsonFiles.length} JSON files.`);
