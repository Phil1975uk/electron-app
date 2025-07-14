// Template Editor Logic for loading, previewing, and saving templates

const TEMPLATE_DIR = 'renderer/reference-templates';

async function populateCardTypeDropdown() {
  const select = document.getElementById('cardTypeSelect');
  select.innerHTML = '';
  const files = await window.electronAPI.listTemplateFiles(TEMPLATE_DIR);
  // Only show .html files (not .css)
  files.filter(f => f.endsWith('.html')).forEach(file => {
    const option = document.createElement('option');
    option.value = file;
    option.textContent = file.replace('-card-template.html', '').replace('-template.html', '').replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    select.appendChild(option);
  });
}

async function loadSelectedTemplate() {
  const select = document.getElementById('cardTypeSelect');
  const file = select.value;
  if (!file) return;
  const baseName = file.replace(/\.html$/, '');
  const htmlFilePath = `${TEMPLATE_DIR}/${baseName}.html`;
  const cssFilePath = `${TEMPLATE_DIR}/${baseName}.css`;

  // Load HTML
  let html = '';
  try {
    html = await window.electronAPI.readTemplateFile(htmlFilePath);
  } catch (e) {
    html = '';
  }

  // Load CSS (if missing, use empty)
  let css = '';
  try {
    css = await window.electronAPI.readTemplateFile(cssFilePath);
  } catch (e) {
    css = '';
  }

  tinymce.get('templateEditor').setContent(html);
  document.getElementById('customCss').value = css;
  document.getElementById('templateStatus').textContent = `Loaded: ${baseName}.html and ${baseName}.css`;
}

function showPreviewModal() {
  const select = document.getElementById('cardTypeSelect');
  const file = select.value;
  const html = tinymce.get('templateEditor').getContent();
  const modal = document.getElementById('previewModal');
  const content = document.getElementById('previewContent');
  const customCss = document.getElementById('customCss').value || '';

  // CSS for specification table, scoped to .template-preview-area
  const specTableCss = `<style>
.template-preview-area .container-center {
  background-color: #f9f9f9;
  padding: 15px;
}
.template-preview-area .specs__table {
  column-count: 3;
  column-gap: 0;
  margin-left: -12.5px;
  margin-right: -12.5px;
}
.template-preview-area .specs__item {
  break-inside: avoid-column;
  padding: 0 12.5px;
}
.template-preview-area .specs__item-inner {
  flex-direction: column;
  display: flex;
  border-bottom: 1px solid #000;
  padding: 16px 0 3px;
  flex-wrap: nowrap;
  justify-content: space-between;
}
.template-preview-area .specs__name {
  font-family: inherit;
  margin-bottom: 2px;
  flex: 0 0 auto;
  margin-right: 10px;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.03em;
}
.template-preview-area .specs__value {
  margin-bottom: 3px;
  flex: 0 1 auto;
}
.template-preview-area .specs__footer {
  margin-top: 50px;
  font-size: 22px;
}
@media (max-width: 850px) {
  .template-preview-area .specs__table {
    column-count: 2;
    column-gap: 0;
    margin-left: -12.5px;
    margin-right: -12.5px;
  }
}
@media (max-width: 425px) {
  .template-preview-area .specs__table {
    column-count: 1;
    column-gap: 0;
    margin-left: -12.5px;
    margin-right: -12.5px;
  }
}
.template-preview-area .addition {
  font-size: 20px;
}
</style>`;

  // Scope custom CSS to .template-preview-area
  let customCssBlock = '';
  if (customCss.trim()) {
    customCssBlock = `<style>\n.template-preview-area { }\n${customCss.replace(/([^{}/]+)\s*{/g, '.template-preview-area $1 {')}</style>`;
  }

  let previewHtml = html;
  if (file && file.toLowerCase().includes('specification-table')) {
    previewHtml = specTableCss + customCssBlock + `<div class=\"template-preview-area\">` + html + `</div>`;
  } else {
    previewHtml = customCssBlock + `<div class=\"template-preview-area\">` + html + `</div>`;
  }
  content.innerHTML = previewHtml;
  modal.style.display = 'flex';
}

function closePreviewModal() {
  document.getElementById('previewModal').style.display = 'none';
}

let pendingSaveBaseFile = '';

document.addEventListener('DOMContentLoaded', async function () {
  tinymce.init({
    selector: '#templateEditor',
    height: 500,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'charmap', 'preview', 'anchor',
      'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'table', 'help', 'wordcount',
      'image', 'media', 'emoticons', 'codesample'
      // Add/remove plugins as needed
    ],
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | code removeformat',
    menubar: 'file edit view insert format tools table help',
    content_style: "body { font-family:Arial,sans-serif; font-size:14px }"
  });

  await populateCardTypeDropdown();

  document.getElementById('loadTemplateBtn').addEventListener('click', loadSelectedTemplate);
  document.getElementById('previewBtn').addEventListener('click', showPreviewModal);
  document.getElementById('closePreview').addEventListener('click', closePreviewModal);

  document.getElementById('saveBtn').addEventListener('click', function () {
    const select = document.getElementById('cardTypeSelect');
    pendingSaveBaseFile = select.value.replace('.html', '');
    document.getElementById('newTemplateName').value = pendingSaveBaseFile + '-custom';
    document.getElementById('saveAsModal').style.display = 'flex';
  });

  document.getElementById('confirmSaveAs').addEventListener('click', async function () {
    let newName = document.getElementById('newTemplateName').value.trim();
    if (!newName) return;
    newName = newName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const htmlFilePath = `${TEMPLATE_DIR}/${newName}.html`;
    const cssFilePath = `${TEMPLATE_DIR}/${newName}.css`;
    const html = tinymce.get('templateEditor').getContent();
    const css = document.getElementById('customCss').value || '';
    await window.electronAPI.writeTemplateFile(htmlFilePath, html);
    await window.electronAPI.writeTemplateFile(cssFilePath, css);
    document.getElementById('templateStatus').textContent = `Saved as: ${newName}.html and ${newName}.css`;
    await populateCardTypeDropdown();
    // Optionally, select the new file in the dropdown
    const select = document.getElementById('cardTypeSelect');
    Array.from(select.options).forEach(opt => {
      if (opt.value === `${newName}.html`) select.value = opt.value;
    });
    document.getElementById('saveAsModal').style.display = 'none';
  });

  document.getElementById('closeSaveAs').addEventListener('click', function () {
    document.getElementById('saveAsModal').style.display = 'none';
  });

  // Optional: close modal on background click
  document.getElementById('previewModal').addEventListener('click', function (e) {
    if (e.target === this) closePreviewModal();
  });
}); 