const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const MASTER_DIR = path.join(__dirname, '../templates/master');
const CUSTOM_DIR = path.join(__dirname, '../templates/custom');
const CONFIG_PATH = path.join(__dirname, 'templates.json');

// Ensure directories exist
function ensureDirs() {
  if (!fsSync.existsSync(MASTER_DIR)) fsSync.mkdirSync(MASTER_DIR, { recursive: true });
  if (!fsSync.existsSync(CUSTOM_DIR)) fsSync.mkdirSync(CUSTOM_DIR, { recursive: true });
}

// List all templates for a card type
async function listTemplates(cardType) {
  ensureDirs();
  const masterPath = path.join(MASTER_DIR, `${cardType}.html`);
  const customFiles = (await fs.readdir(CUSTOM_DIR)).filter(f => f.startsWith(`${cardType}-`) && f.endsWith('.html'));
  const templates = [];
  if (fsSync.existsSync(masterPath)) {
    templates.push({ name: 'master', path: masterPath, isMaster: true });
  }
  for (const file of customFiles) {
    templates.push({ name: file.replace(`${cardType}-`, '').replace('.html', ''), path: path.join(CUSTOM_DIR, file), isMaster: false });
  }
  return templates;
}

// Get template content by cardType and templateName
async function getTemplateContent(cardType, templateName) {
  ensureDirs();
  let filePath;
  if (templateName === 'master') {
    filePath = path.join(MASTER_DIR, `${cardType}.html`);
  } else {
    filePath = path.join(CUSTOM_DIR, `${cardType}-${templateName}.html`);
  }
  if (!fsSync.existsSync(filePath)) throw new Error('Template not found');
  return fs.readFile(filePath, 'utf8');
}

// Save a new custom template
async function saveCustomTemplate(cardType, name, content) {
  ensureDirs();
  const filePath = path.join(CUSTOM_DIR, `${cardType}-${name}.html`);
  await fs.writeFile(filePath, content, 'utf8');
}

// Set the active template for a card type
async function setActiveTemplate(cardType, templatePath) {
  ensureDirs();
  let config = {};
  if (fsSync.existsSync(CONFIG_PATH)) {
    config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  }
  config[cardType] = templatePath.replace(/\\/g, '/');
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

// Get the active template path for a card type
async function getActiveTemplatePath(cardType) {
  ensureDirs();
  if (!fsSync.existsSync(CONFIG_PATH)) return path.join(MASTER_DIR, `${cardType}.html`).replace(/\\/g, '/');
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  return config[cardType] || path.join(MASTER_DIR, `${cardType}.html`).replace(/\\/g, '/');
}

module.exports = {
  listTemplates,
  getTemplateContent,
  saveCustomTemplate,
  setActiveTemplate,
  getActiveTemplatePath
}; 