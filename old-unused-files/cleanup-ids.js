// cleanup-ids.js
// Script: strip non-digit chars from the "id" field of every renderer/cards/*.json file
// Usage: node cleanup-ids.js
// It will log how many files were fixed.

const fs = require('fs');
const path = require('path');

const cardsDir = path.join(__dirname, 'renderer', 'cards');
if (!fs.existsSync(cardsDir)) {
  console.error('Cards directory not found:', cardsDir);
  process.exit(1);
}

let fixed = 0;
let skipped = 0;

for (const file of fs.readdirSync(cardsDir)) {
  if (!file.endsWith('.json')) continue;
  const fullPath = path.join(cardsDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (data && data.id != null) {
      // Convert to string in decimal form, then strip non-digits. Handles scientific notation.
      const numStr = Number(data.id).toFixed(0); // drop decimals/exponent
      const cleanId = numStr.replace(/\D/g, '');
      if (cleanId && cleanId !== String(data.id)) {
        data.id = cleanId;
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
        fixed++;
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  } catch (err) {
    console.warn('Could not process', file, err.message);
  }
}

console.log(`ID cleanup complete. Fixed ${fixed} file(s). Skipped ${skipped}.`); 