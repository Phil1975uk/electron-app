const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const MASTER_DIR = path.join(__dirname, '../renderer/templates/master');
const CUSTOM_DIR = path.join(__dirname, '../renderer/templates/custom');
const REFERENCE_DIR = path.join(__dirname, '../renderer/reference-templates');
const CONFIG_PATH = path.join(__dirname, 'templates.json');

// Template mapping for reference templates
const TEMPLATE_MAPPING = {
  'feature': 'feature-card-template.html',
  'product-options': 'product-options-card-template.html',
  'cargo-options': 'cargo-options-card-template.html',
  'specification-table': 'specification-table-template.html',
  'weather-protection': 'weather-options-card-template.html'
};

// Ensure directories exist
function ensureDirs() {
  if (!fsSync.existsSync(MASTER_DIR)) fsSync.mkdirSync(MASTER_DIR, { recursive: true });
  if (!fsSync.existsSync(CUSTOM_DIR)) fsSync.mkdirSync(CUSTOM_DIR, { recursive: true });
}

// List all templates for a card type
async function listTemplates(cardType) {
  ensureDirs();
  const templates = [];
  
  // Check for reference template
  const referenceTemplate = TEMPLATE_MAPPING[cardType];
  if (referenceTemplate) {
    const referencePath = path.join(REFERENCE_DIR, referenceTemplate);
    if (fsSync.existsSync(referencePath)) {
      templates.push({ 
        name: 'reference', 
        path: referencePath, 
        isReference: true,
        displayName: 'Reference Template'
      });
    }
  }
  
  // Check for master template
  const masterPath = path.join(MASTER_DIR, `${cardType}.html`);
  if (fsSync.existsSync(masterPath)) {
    templates.push({ 
      name: 'master', 
      path: masterPath, 
      isMaster: true,
      displayName: 'Master Template'
    });
  }
  
  // Check for custom templates
  const customFiles = (await fs.readdir(CUSTOM_DIR)).filter(f => f.startsWith(`${cardType}-`) && f.endsWith('.html'));
  for (const file of customFiles) {
    const templateName = file.replace(`${cardType}-`, '').replace('.html', '');
    templates.push({ 
      name: templateName, 
      path: path.join(CUSTOM_DIR, file), 
      isCustom: true,
      displayName: `Custom: ${templateName}`
    });
  }
  
  return templates;
}

// Get template content by cardType and templateName
async function getTemplateContent(cardType, templateName) {
  ensureDirs();
  let filePath;
  
  if (templateName === 'reference') {
    const referenceTemplate = TEMPLATE_MAPPING[cardType];
    if (!referenceTemplate) throw new Error('No reference template found for this card type');
    filePath = path.join(REFERENCE_DIR, referenceTemplate);
  } else if (templateName === 'master') {
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
  
  // Prevent saving over master templates
  if (name === 'master') {
    throw new Error('Cannot save over master templates. Master templates are protected.');
  }
  
  // Prevent saving over reference templates
  if (name === 'reference') {
    throw new Error('Cannot save over reference templates. Reference templates are protected.');
  }
  
  const filePath = path.join(CUSTOM_DIR, `${cardType}-${name}.html`);
  
  // Check if template already exists
  const exists = fsSync.existsSync(filePath);
  
  return {
    filePath,
    exists,
    willOverwrite: exists
  };
}

// Actually write the template file
async function writeTemplateFile(filePath, content) {
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
  if (!fsSync.existsSync(CONFIG_PATH)) {
    // Default to reference template if available
    const referenceTemplate = TEMPLATE_MAPPING[cardType];
    if (referenceTemplate) {
      return path.join(REFERENCE_DIR, referenceTemplate).replace(/\\/g, '/');
    }
    return path.join(MASTER_DIR, `${cardType}.html`).replace(/\\/g, '/');
  }
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  return config[cardType] || path.join(MASTER_DIR, `${cardType}.html`).replace(/\\/g, '/');
}

// Process template with placeholders
function processTemplate(template, cardData) {
  let processedTemplate = template;
  
  // Replace placeholders with card data
  const placeholders = {
    '{title}': cardData.title || '',
    '{subtitle}': cardData.subtitle || '',
    '{content}': cardData.description || cardData.content || '',
    '{imageUrl}': cardData.imageUrl || '',
    '{price}': cardData.price || '',
    '{filename}': cardData.imageUrl ? cardData.imageUrl.split('/').pop().split('?')[0] : ''
  };
  
  Object.entries(placeholders).forEach(([placeholder, value]) => {
    processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return processedTemplate;
}

// Get template content with data processing
async function getProcessedTemplate(cardType, templateName, cardData) {
  const template = await getTemplateContent(cardType, templateName);
  return processTemplate(template, cardData);
}

module.exports = {
  listTemplates,
  getTemplateContent,
  getProcessedTemplate,
  saveCustomTemplate,
  writeTemplateFile,
  setActiveTemplate,
  getActiveTemplatePath,
  processTemplate,
  TEMPLATE_MAPPING
}; 