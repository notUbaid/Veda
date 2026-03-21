/**
 * Run once: node copyLogo.mjs
 * Copies the uploaded logo to public/logo.png
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dest = join(__dirname, 'public', 'logo.png');

// Source: wherever you saved the Veda.png upload
// Replace this path with where your file is, e.g. Downloads folder
const src = process.argv[2] || join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'Veda.png');

if (!existsSync(src)) {
  console.error(`\n❌  Source file not found: ${src}`);
  console.error('Usage: node copyLogo.mjs "C:\\path\\to\\Veda.png"\n');
  process.exit(1);
}

mkdirSync(join(__dirname, 'public'), { recursive: true });
copyFileSync(src, dest);
console.log(`\n✅  Logo copied to public/logo.png\n`);
