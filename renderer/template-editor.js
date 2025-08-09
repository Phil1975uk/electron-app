// Template Editor JavaScript
let currentCardType = null;
let currentTemplate = null;
let editor = null;

// Card types and their display names
const CARD_TYPES = {
    'feature': 'Feature Cards',
    'product-options': 'Product Options',
    'cargo-options': 'Cargo Options',
    'specification-table': 'Specification Tables',
    'weather-protection': 'Weather Protection'
};

// Initialize the template editor
document.addEventListener('DOMContentLoaded', function() {
    loadCardTypes();
    initializeEditor();
    initializeTooltips();
});

// Initialize simple textarea editor
function initializeEditor() {
    const textarea = document.getElementById('templateEditor');
    if (textarea) {
        // Set up the textarea for HTML editing
        textarea.style.width = '100%';
        textarea.style.height = '500px';
        textarea.style.fontFamily = 'monospace';
        textarea.style.fontSize = '14px';
        textarea.style.padding = '10px';
        textarea.style.border = '1px solid #ccc';
        textarea.style.borderRadius = '4px';
        
        // Add event listener for content changes
        textarea.addEventListener('input', function() {
            updatePreview();
        });
        
        // Store reference to textarea
        editor = textarea;
    }
}

// Load card types into the sidebar
function loadCardTypes() {
    const cardTypeList = document.getElementById('cardTypeList');
    cardTypeList.innerHTML = '';

    Object.entries(CARD_TYPES).forEach(([type, displayName]) => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <div>
                <strong>${displayName}</strong>
                <br><small class="text-muted">${type}</small>
            </div>
            <span class="badge bg-primary rounded-pill">0</span>
        `;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            selectCardType(type);
        });
        cardTypeList.appendChild(item);
    });
}

// Select a card type and load its templates
async function selectCardType(cardType) {
    currentCardType = cardType;
    
    // Update active state
    document.querySelectorAll('#cardTypeList a').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('a').classList.add('active');
    
    // Load templates for this card type
    await loadTemplates(cardType);
}

// Load templates for a card type
async function loadTemplates(cardType) {
    try {
        const response = await fetch(`/api/templates/${cardType}`);
        if (response.ok) {
            const data = await response.json();
            displayTemplates(data.templates);
        } else {
            console.error('Failed to load templates');
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

// Display templates in the sidebar
function displayTemplates(templates) {
    const templateList = document.getElementById('templateList');
    templateList.innerHTML = '';

    templates.forEach(template => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        
        let badgeClass = 'bg-secondary';
        if (template.isReference) badgeClass = 'bg-info';
        else if (template.isMaster) badgeClass = 'bg-primary';
        else if (template.isCustom) badgeClass = 'bg-success';
        
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${template.displayName}</strong>
                    <br><small class="text-muted">${template.name}</small>
                </div>
                <span class="badge ${badgeClass} rounded-pill">
                    ${template.isReference ? 'Reference' : template.isMaster ? 'Master' : 'Custom'}
                </span>
            </div>
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            selectTemplate(template);
        });
        
        templateList.appendChild(item);
    });
}

// Select a template and load its content
async function selectTemplate(template) {
    currentTemplate = template;
    
    // Update active state
    document.querySelectorAll('#templateList a').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('a').classList.add('active');
    
    try {
        const response = await fetch(`/api/template/${currentCardType}?path=${encodeURIComponent(template.path)}`);
        if (response.ok) {
            const data = await response.json();
            loadTemplateContent(data.content);
            updatePreview();
        } else {
            console.error('Failed to load template content');
        }
    } catch (error) {
        console.error('Error loading template content:', error);
    }
}

// Load template content into the editor
function loadTemplateContent(content) {
    if (editor) {
        editor.value = content;
        updatePreview();
    } else {
        // If editor isn't ready yet, wait a bit and try again
        setTimeout(() => loadTemplateContent(content), 100);
    }
}

// Update the preview with current editor content
function updatePreview() {
    if (!editor) return;
    
    const content = editor.value;
    const preview = document.getElementById('templatePreview');
    
    // Create sample data for preview
    const sampleData = {
        title: 'Sample Card Title',
        subtitle: '£199.99',
        content: 'This is a sample description that shows how the card will look with real content. It includes multiple sentences to demonstrate the layout.',
        imageUrl: 'https://via.placeholder.com/400x300/007bff/ffffff?text=Sample+Image',
        price: '£199.99',
        filename: 'sample-image.jpg'
    };
    
    // Replace placeholders with sample data
    let previewContent = content;
    Object.entries(sampleData).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        previewContent = previewContent.replace(new RegExp(placeholder, 'g'), value);
    });
    
    preview.innerHTML = previewContent;
}

// Show placeholders modal
function showPlaceholders() {
    const modal = new bootstrap.Modal(document.getElementById('placeholdersModal'));
    modal.show();
}

// Reset template to reference version
async function resetToReference() {
    if (!currentCardType) return;
    
    try {
        const response = await fetch(`/api/template/${currentCardType}?path=${encodeURIComponent('reference')}`);
        if (response.ok) {
            const data = await response.json();
            loadTemplateContent(data.content);
            updatePreview();
        }
    } catch (error) {
        console.error('Error resetting to reference template:', error);
    }
}

// Save template as custom
async function saveTemplate() {
    if (!currentCardType || !editor) return;
    
    const templateName = prompt('Enter a name for your custom template:');
    if (!templateName) return;
    
    const content = editor.value;
    
    try {
        const response = await fetch(`/api/template/${currentCardType}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: templateName,
                content: content
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Template saved successfully!');
            // Reload templates to show the new one
            await loadTemplates(currentCardType);
        } else if (result.exists) {
            // Template exists, ask for confirmation
            const confirmOverwrite = confirm(`Template "${templateName}" already exists. Do you want to overwrite it?\n\nThis action cannot be undone.`);
            
            if (confirmOverwrite) {
                // Confirm the overwrite
                const writeResponse = await fetch(`/api/template/${currentCardType}/write`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filePath: result.filePath,
                        content: content
                    })
                });
                
                if (writeResponse.ok) {
                    alert('Template overwritten successfully!');
                    // Reload templates to show the updated one
                    await loadTemplates(currentCardType);
                } else {
                    alert('Failed to overwrite template');
                }
            }
        } else {
            alert('Failed to save template');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        alert('Error saving template');
    }
}

// Save current template (global function for button)
function saveCurrentTemplate() {
    saveTemplate();
}

// Initialize Bootstrap tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Show help modal
function showHelp() {
    const modal = new bootstrap.Modal(document.getElementById('helpModal'));
    modal.show();
} 