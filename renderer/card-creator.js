/**
 * Card Creator Application
 * 
 * This script manages the card creation page, including:
 * - Loading bike configurations
 * - Handling card type selection
 * - Dynamically updating form fields based on card type
 * - Generating a live preview of the card
 * - Saving card data to the server
 * - Managing saved cards
 */

// Utility function for showing toast notifications
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

class CardCreator {
    constructor() {
        this.selectedCardType = 'feature';
        this.configurations = [];
        this.savedCards = [];
        this.editingCardId = null; // Track the card being edited
        this.editingCardFilename = null; // Track the filename of the card being edited
        this.pendingCardType = null; // Track a pending card type switch
        this.justCancelledEdit = false; // Track if cancel was just pressed
        // Map card types to the form fields they use. This helps in showing/hiding fields.
        this.cardFields = {
            'feature': ['title', 'subtitle', 'description', 'image'],
            'product-options': ['title', 'price', 'description', 'image'],
            'specification-table': ['title', 'htmlContent'],
            'weather-protection': ['title', 'price', 'description', 'image'],
            'cargo-options': ['title', 'price', 'description', 'image']
        };
        this.init();
    }

    async init() {
        await this.loadConfigurations();
        this.setupEventListeners();
        this.selectCardType('feature'); // Set initial state
        this.updatePreview(); // Initial preview update
        this.loadSavedCards(); // Load existing cards on page load
    }

    async loadConfigurations() {
        try {
            // Try to load from server first
            const response = await fetch('/api/configurations');
            if (response.ok) {
                const serverData = await response.json();
                // Handle both formats: direct array or { configurations: [...] }
                const serverConfigs = Array.isArray(serverData) ? serverData : (serverData.configurations || []);
                if (serverConfigs.length > 0) {
                    this.configurations = serverConfigs;
                    console.log('Loaded configurations from server:', serverConfigs.length, 'configurations');
                } else {
                    // Server returned empty array, try localStorage
                    const storedConfigs = localStorage.getItem('bikeConfigurations');
                    this.configurations = storedConfigs ? JSON.parse(storedConfigs) : [];
                    console.log('Loaded configurations from localStorage:', this.configurations.length, 'configurations');
                }
            } else {
                // Server error, fall back to localStorage
                const storedConfigs = localStorage.getItem('bikeConfigurations');
                this.configurations = storedConfigs ? JSON.parse(storedConfigs) : [];
                console.log('Server error, loaded configurations from localStorage:', this.configurations.length, 'configurations');
            }
            
            this.populateBrandSelect();
            this.loadSavedCards(); // Refresh the saved cards list
        } catch (error) {
            console.error('Error loading configurations:', error);
            // Final fallback to localStorage
            const storedConfigs = localStorage.getItem('bikeConfigurations');
            this.configurations = storedConfigs ? JSON.parse(storedConfigs) : [];
            this.populateBrandSelect();
            this.loadSavedCards();
        }
    }

    // Add method to refresh configurations
    async refreshConfigurations() {
        console.log('Refreshing configurations...');
        await this.loadConfigurations();
        this.checkConfigurationAvailability();
        showToast('Configurations refreshed', 'success');
    }

    setupEventListeners() {
        // Card type selection
        document.querySelectorAll('.card-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.closest('.card-type-btn').dataset.type;
                this.selectCardType(type);
                this.renderSavedCards(); // Update saved cards list when card type changes
                this.checkConfigurationAvailability(); // Check availability
            });
        });

        // Form field changes
        const brandSelect = document.getElementById('brand');
        if (brandSelect) {
            brandSelect.addEventListener('change', (e) => {
            this.populateModelSelect(e.target.value);
            this.renderSavedCards(); // Update saved cards list when brand changes
            this.checkConfigurationAvailability(); // Check availability
        });
        } else {
            console.warn('Element with id "brand" not found during event listener setup');
        }

        const modelSelect = document.getElementById('model');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
            this.populateGenerationSelect(e.target.value);
            this.renderSavedCards(); // Update saved cards list when model changes
            this.checkConfigurationAvailability(); // Check availability
        });
        } else {
            console.warn('Element with id "model" not found during event listener setup');
        }

        const generationSelect = document.getElementById('generation');
        if (generationSelect) {
            generationSelect.addEventListener('change', () => {
            this.populateVariantCheckboxes();
            this.renderSavedCards(); // Update saved cards list when generation changes
            this.checkConfigurationAvailability(); // Check availability
        });
        } else {
            console.warn('Element with id "generation" not found during event listener setup');
        }

        // Variant checkbox changes
        const variantCheckboxes = document.getElementById('variantCheckboxes');
        if (variantCheckboxes) {
            variantCheckboxes.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.renderSavedCards(); // Update saved cards list when variants change
                this.checkConfigurationAvailability(); // Check availability
            }
        });
        } else {
            console.warn('Element with id "variantCheckboxes" not found during event listener setup');
        }

        // Form submission
        const cardForm = document.getElementById('cardForm');
        if (cardForm) {
            cardForm.addEventListener('submit', (e) => {
            this.handleFormSubmit(e);
        });
        } else {
            console.warn('Element with id "cardForm" not found during event listener setup');
        }

        // Saved card actions
        const savedCardsList = document.getElementById('savedCardsList');
        if (savedCardsList) {
            savedCardsList.addEventListener('click', (e) => {
            this.handleSavedCardAction(e);
        });
        } else {
            console.warn('Element with id "savedCardsList" not found during event listener setup');
        }

        // WebDAV upload
        const uploadToWebDAVBtn = document.getElementById('uploadToWebDAV');
        if (uploadToWebDAVBtn) {
            uploadToWebDAVBtn.addEventListener('click', () => {
            this.uploadImagesToWebDAV();
        });
        } else {
            console.warn('Element with id "uploadToWebDAV" not found during event listener setup');
        }

        // Real-time preview updates
        ['title', 'subtitle', 'description', 'price', 'imageUrl'].forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.addEventListener('input', () => {
                this.updatePreview();
            });
            } else {
                console.warn(`Element with id '${fieldId}' not found during event listener setup`);
            }
        });

        // Listener for the preview's "More Information" button
        const livePreviewWrapper = document.getElementById('live-preview-wrapper');
        if (livePreviewWrapper) {
            livePreviewWrapper.addEventListener('click', (e) => {
            if (e.target.classList.contains('more-info-btn')) {
                e.preventDefault();
                console.log('[Preview] .more-info-btn clicked, data-target:', e.target.getAttribute('data-target'));
                this.toggleCardDescription(e.target);
            }
        });
        } else {
            console.warn('Element with id "live-preview-wrapper" not found during event listener setup');
        }

        // Reset Form button
        const resetFormBtn = document.getElementById('resetFormBtn');
        if (resetFormBtn) {
            resetFormBtn.addEventListener('click', () => {
            this.editingCardId = null;
            document.getElementById('cardForm').reset();
            // Clear variant checkboxes
            document.querySelectorAll('input[name="variant"]').forEach(chk => chk.checked = false);
            // Keep the current card type
            this.updatePreview();
        });
        } else {
            console.warn('Element with id "resetFormBtn" not found during event listener setup');
        }

        // Cancel Edit button
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                console.log('[Cancel Button] Clicked');
                this.cancelEditMode();
                this.updateCancelBtnState();
            });
        } else {
            // Fallback: attach after DOMContentLoaded if not found
            document.addEventListener('DOMContentLoaded', () => {
                const btn = document.getElementById('cancelEditBtn');
                if (btn) {
                    btn.addEventListener('click', () => {
                        console.log('[Cancel Button] Clicked (DOMContentLoaded fallback)');
                        this.cancelEditMode();
                        this.updateCancelBtnState();
                    });
                }
            });
        }
    }

    selectCardType(type) {
        console.log('selectCardType called with:', type, 'previous value was:', this.selectedCardType);
        console.log('[selectCardType] editingCardId:', this.editingCardId, 'justCancelledEdit:', this.justCancelledEdit, 'pendingCardType:', this.pendingCardType);
        // If just cancelled edit, allow switch and clear flag
        if (this.justCancelledEdit) {
            console.log('[selectCardType] justCancelledEdit is true, allowing card type switch to', type);
            this.justCancelledEdit = false;
        } else if (this.editingCardId) {
            showToast('You are currently editing a card. Please save or cancel editing before switching card type.', 'warning');
            this.pendingCardType = type; // Store the requested type
            console.log('[selectCardType] Blocked card type switch, set pendingCardType to', type);
            return;
        }
        this.pendingCardType = null; // Clear pending if not editing
        // If not editing, clear the form when switching card types
        if (!this.editingCardId) {
            document.getElementById('cardForm').reset();
            // Clear variant checkboxes
            document.querySelectorAll('input[name="variant"]').forEach(chk => chk.checked = false);
            // Also clear dynamically inserted price field if present
            const priceField = document.getElementById('price');
            if (priceField) priceField.value = '';
            // Clear subtitle field if present
            const subtitleInput = document.getElementById('subtitle');
            if (subtitleInput) subtitleInput.value = '';
        }
        this.selectedCardType = type;
        console.log('selectedCardType set to:', this.selectedCardType);
        // Update active button
        document.querySelectorAll('.card-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        // Show/hide form sections based on card type
        this.updateFormFields(type);
        // Update the preview
        this.updatePreview();
        
        // Debug: Check if renderSavedCards is being called
        console.log('[selectCardType] About to call renderSavedCards...');
        this.renderSavedCards();
        console.log('[selectCardType] renderSavedCards called');
    }

    updateFormFields(cardType) {
        // Get form field containers and inputs
        const titleInput = document.getElementById('title');
        const subtitleInput = document.getElementById('subtitle');
        const descriptionInput = document.getElementById('description');
        const priceInput = document.getElementById('price');
        const imageUrlInput = document.getElementById('imageUrl');

        const titleField = titleInput.parentElement;
        const subtitleField = subtitleInput.parentElement;
        const descriptionField = descriptionInput.parentElement;
        const priceField = priceInput?.parentElement;
        const imageUrlField = imageUrlInput.parentElement;

        // Hide all fields and remove required
        titleField.style.display = 'none';
        titleInput.removeAttribute('required');
        titleInput.removeAttribute('readonly');
        titleInput.removeAttribute('disabled');
        subtitleField.style.display = 'none';
        subtitleInput.removeAttribute('required');
        subtitleInput.removeAttribute('readonly');
        subtitleInput.removeAttribute('disabled');
        descriptionField.style.display = 'none';
        descriptionInput.removeAttribute('required');
        descriptionInput.removeAttribute('readonly');
        descriptionInput.removeAttribute('disabled');
        if (priceField) {
            priceField.style.display = 'none';
            priceInput?.removeAttribute('required');
            priceInput?.removeAttribute('readonly');
            priceInput?.removeAttribute('disabled');
        }
        imageUrlField.style.display = 'none';
        imageUrlInput.removeAttribute('required');
        imageUrlInput.removeAttribute('readonly');
        imageUrlInput.removeAttribute('disabled');

        // Remove any existing price field before inserting a new one
        const oldPriceField = document.getElementById('price-field-dynamic');
        if (oldPriceField) oldPriceField.remove();

        // Show fields and set required as needed
        switch (cardType) {
            case 'feature':
                titleField.style.display = 'block';
                titleInput.setAttribute('required', 'required');
                subtitleField.style.display = 'block';
                descriptionField.style.display = 'block';
                descriptionInput.setAttribute('required', 'required');
                imageUrlField.style.display = 'block';
                if (descriptionInput.tagName !== 'TEXTAREA') {
                    this.convertToTextarea(descriptionInput);
                }
                break;
            case 'product-options':
            case 'cargo-options':
            case 'weather-protection':
            case 'weather':
                // Insert price field before setting value
                const priceFieldDiv = document.createElement('div');
                priceFieldDiv.className = 'mb-3';
                priceFieldDiv.id = 'price-field-dynamic';
                priceFieldDiv.innerHTML = `
                    <label class="form-label">Price</label>
                    <div class="input-group">
                        <span class="input-group-text">£</span>
                        <input type="text" class="form-control" id="price" name="price" placeholder="e.g. 1999 or TBC">
                    </div>
                    <div class="form-text">Enter a price (numbers only), TBC, or leave blank for no extra cost.</div>
                `;
                subtitleField.insertAdjacentElement('afterend', priceFieldDiv);
                // Remove readonly/disabled from all relevant fields
                titleInput.removeAttribute('readonly');
                titleInput.removeAttribute('disabled');
                descriptionInput.removeAttribute('readonly');
                descriptionInput.removeAttribute('disabled');
                imageUrlInput.removeAttribute('readonly');
                imageUrlInput.removeAttribute('disabled');
                // Show other fields
                titleField.style.display = 'block';
                titleInput.setAttribute('required', 'required');
                descriptionField.style.display = 'block';
                descriptionInput.setAttribute('required', 'required');
                imageUrlField.style.display = 'block';
                if (descriptionInput.tagName !== 'TEXTAREA') {
                    this.convertToTextarea(descriptionInput);
                }
                break;
            case 'specification-table':
                descriptionField.style.display = 'block';
                descriptionInput.setAttribute('required', 'required');
                if (descriptionInput.tagName !== 'INPUT') {
                    this.convertToTextInput(descriptionInput);
                }
                const descriptionLabel = descriptionField.querySelector('label');
                if (descriptionLabel) {
                    descriptionLabel.textContent = 'HTML Content (paste specification table HTML here)';
                }
                break;
            default:
                titleField.style.display = 'block';
                titleInput.setAttribute('required', 'required');
                subtitleField.style.display = 'block';
                descriptionField.style.display = 'block';
                descriptionInput.setAttribute('required', 'required');
                imageUrlField.style.display = 'block';
                if (descriptionInput.tagName !== 'TEXTAREA') {
                    this.convertToTextarea(descriptionInput);
                }
        }
        if (cardType === 'feature' && priceField) priceField.style.display = 'none';
    }

    convertToTextInput(textareaElement) {
        const parent = textareaElement.parentElement;
        const label = parent.querySelector('label');
        const labelText = label ? label.textContent : 'Description';
        
        // Create new input element
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = textareaElement.className;
        inputElement.id = textareaElement.id;
        inputElement.name = textareaElement.name;
        inputElement.value = textareaElement.value;
        inputElement.required = textareaElement.required;
        inputElement.placeholder = textareaElement.placeholder;
        
        // Replace textarea with input
        parent.replaceChild(inputElement, textareaElement);
        
        // Update label if needed
        if (label && labelText === 'Description') {
            label.textContent = 'HTML Content (paste specification table HTML here)';
        }
    }

    convertToTextarea(inputElement) {
        const parent = inputElement.parentElement;
        const label = parent.querySelector('label');
        const labelText = label ? label.textContent : 'Description';
        
        // Create new textarea element
        const textareaElement = document.createElement('textarea');
        textareaElement.className = inputElement.className;
        textareaElement.id = inputElement.id;
        textareaElement.name = inputElement.name;
        textareaElement.value = inputElement.value;
        textareaElement.required = inputElement.required;
        textareaElement.placeholder = inputElement.placeholder;
        textareaElement.rows = 4;
        
        // Replace input with textarea
        parent.replaceChild(textareaElement, inputElement);
        
        // Update label if needed
        if (label && labelText === 'HTML Content (paste specification table HTML here)') {
            label.textContent = 'Description';
        }
    }

    populateBrandSelect() {
        const brandSelect = document.getElementById('brand');
        brandSelect.innerHTML = '<option value="">Select Brand</option>';
        const brands = [...new Set(this.configurations.map(c => c.brand))].sort((a, b) => a.localeCompare(b));
        brands.forEach(brand => {
            const option = new Option(brand, brand);
            brandSelect.add(option);
        });
    }

    populateModelSelect(brand) {
        const modelSelect = document.getElementById('model');
        const generationSelect = document.getElementById('generation');
        modelSelect.innerHTML = '<option value="">Select Model</option>';
        generationSelect.innerHTML = '<option value="">Select Generation</option>';
        document.getElementById('variantCheckboxes').innerHTML = '<p class="text-muted">Select brand, model, and generation to see available variants.</p>';

        if (!brand) return;

        const models = [...new Set(this.configurations.filter(c => c.brand === brand).map(c => c.model))].sort((a, b) => a.localeCompare(b));
        models.forEach(model => {
            const option = new Option(model, model);
            modelSelect.add(option);
        });
        this.updatePreview();
    }

    populateGenerationSelect(model) {
        const generationSelect = document.getElementById('generation');
        generationSelect.innerHTML = '<option value="">Select Generation</option>';
        document.getElementById('variantCheckboxes').innerHTML = '<p class="text-muted">Select brand, model, and generation to see available variants.</p>';

        const brand = document.getElementById('brand').value;
        if (!brand || !model) return;

        const generations = [...new Set(this.configurations.filter(c => c.brand === brand && c.model === model).map(c => c.generation))].sort((a, b) => a.localeCompare(b));
        generations.forEach(gen => {
            const option = new Option(gen, gen);
            generationSelect.add(option);
        });
        this.updatePreview();
    }

    populateVariantCheckboxes() {
        const container = document.getElementById('variantCheckboxes');
        
        container.innerHTML = '';

        const brand = document.getElementById('brand').value;
        const model = document.getElementById('model').value;
        const generation = document.getElementById('generation').value;

        console.log('Populating variants for:', { brand, model, generation });

        if (!brand || !model || !generation) {
            container.innerHTML = '<p class="text-muted">Select brand, model, and generation to see available variants.</p>';
            return;
        }

        // Find ALL matching configurations to get SKUs
        const matchingConfigs = this.configurations.filter(c => 
            c.brand === brand && c.model === model && c.generation === generation
        );
        
        // Merge all variants from matching configurations
        const allConfigVariants = [];
        matchingConfigs.forEach(config => {
            if (config.variants && Array.isArray(config.variants)) {
                allConfigVariants.push(...config.variants);
            }
        });
        
        console.log('Found matching configs:', matchingConfigs);
        console.log('All variants array:', allConfigVariants);
        console.log('Number of variants:', allConfigVariants.length);
        
        if (allConfigVariants.length === 0) {
            container.innerHTML = '<p class="text-muted">No variants found for this configuration.</p>';
            return;
        }

        if (allConfigVariants.length > 1) {
             container.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="selectAllVariants">
                    <label class="form-check-label" for="selectAllVariants">Select All</label>
                </div>`;
        }
        
        allConfigVariants.forEach(variant => {
            // Handle both old string format and new object format
            const variantName = typeof variant === 'string' ? variant : variant.name;
            const variantSku = typeof variant === 'string' ? '' : variant.sku;
            const variantId = variantName.replace(/[^a-zA-Z0-9]/g, '_');
            
            // Display variant with SKU as read-only text
            const skuDisplay = variantSku ? ` <span class="text-muted">(${variantSku})</span>` : '';
            
            container.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="variant" value="${variantName}" id="variant-${variantId}">
                    <label class="form-check-label" for="variant-${variantId}">${variantName}${skuDisplay}</label>
                </div>`;
        });
        
        console.log('Final HTML content:', container.innerHTML);
        
        // Count actual checkboxes in DOM
        const actualCheckboxes = container.querySelectorAll('input[name="variant"]');
        console.log('Actual checkboxes found in DOM:', actualCheckboxes.length);
        console.log('Checkbox values:', Array.from(actualCheckboxes).map(cb => cb.value));
        
        // Add event listeners for variant checkboxes
        actualCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                console.log(`Variant checkbox changed: ${e.target.value}, checked: ${e.target.checked}`);
                this.updatePreview();
            });
        });
        
        if (allConfigVariants.length > 1) {
            document.getElementById('selectAllVariants').addEventListener('change', (e) => {
                document.querySelectorAll('input[name="variant"]').forEach(chk => {
                    chk.checked = e.target.checked;
                });
                this.updatePreview();
            });
        }
        this.updatePreview();
    }
    
    // Utility to remove duplicate price fields
    removeDuplicatePriceFields() {
        const priceFields = document.querySelectorAll('#price-field-dynamic');
        if (priceFields.length > 1) {
            priceFields.forEach((field, idx) => {
                if (idx > 0) field.remove();
            });
        }
    }

    async populateForm(card) {
        console.log('[populateForm] card:', card);
        this.editingCardId = card.id;
        this.editingCardFilename = card.filename;
        let cardType = card.cardType || card.type;
        if (cardType === 'spec') cardType = 'specification-table';
        if (cardType === 'weather') cardType = 'weather-protection';
        if (cardType) this.selectCardType(cardType);
        this.removeDuplicatePriceFields();
        if (card.configuration) {
            document.getElementById('brand').value = card.configuration.brand || '';
            this.populateModelSelect(card.configuration.brand);
            document.getElementById('model').value = card.configuration.model || '';
            this.populateGenerationSelect(card.configuration.model);
            document.getElementById('generation').value = card.configuration.generation || '';
            this.populateVariantCheckboxes();
            const variants = card.configuration.variants || [];
            document.querySelectorAll('input[name="variant"]').forEach(checkbox => {
                const variantNames = variants.map(v => typeof v === 'string' ? v : v.name);
                checkbox.checked = variantNames.includes(checkbox.value);
                checkbox.dispatchEvent(new Event('change'));
            });
            if (card.configuration.variantSkus) {
                Object.keys(card.configuration.variantSkus).forEach(variantName => {
                    const variantId = variantName.replace(/[^a-zA-Z0-9]/g, '_');
                    const skuInput = document.getElementById(`sku-input-${variantId}`);
                    if (skuInput) {
                        skuInput.value = card.configuration.variantSkus[variantName];
                    }
                });
            } else {
                variants.forEach(variant => {
                    if (typeof variant === 'object' && variant.name && variant.sku) {
                        const variantId = variant.name.replace(/[^a-zA-Z0-9]/g, '_');
                        const skuInput = document.getElementById(`sku-input-${variantId}`);
                        if (skuInput) {
                            skuInput.value = variant.sku;
                        }
                    }
                });
            }
        }
        document.getElementById('title').value = card.title || '';
        document.getElementById('description').value = card.description || card.htmlContent || '';
        document.getElementById('imageUrl').value = card.imageUrl || '';
        console.log('[populateForm] imageUrl set to:', card.imageUrl);
        if (cardType === 'feature') {
            document.getElementById('subtitle').value = card.subtitle || '';
            this.updatePreview();
        } else if (cardType === 'product-options' || cardType === 'cargo-options' || cardType === 'weather-protection') {
            setTimeout(() => {
                const priceField = document.getElementById('price');
                if (priceField) {
                    priceField.removeAttribute('readonly');
                    priceField.removeAttribute('disabled');
                    priceField.value = card.price || '';
                    console.log('[populateForm] price set to:', card.price);
                }
                this.updatePreview();
            }, 0);
        } else if (cardType === 'specification-table') {
            document.getElementById('description').value = card.htmlContent || card.description || '';
            this.updatePreview();
        } else {
            this.updatePreview();
        }
    }

    getFormData() {
        const rawImageUrl = document.getElementById('imageUrl').value.trim();
        const cleanedImageUrl = rawImageUrl.startsWith('@') ? rawImageUrl.substring(1) : rawImageUrl;
        console.log('[getFormData] rawImageUrl:', rawImageUrl);
        console.log('[getFormData] cleanedImageUrl:', cleanedImageUrl);
        console.log('[getFormData] selectedCardType:', this.selectedCardType);

        // Map UI card types to short folder names
        const cardTypeMap = {
            'feature': 'feature',
            'product-options': 'option',
            'cargo-options': 'cargo',
            'weather-protection': 'weather',
            'specification-table': 'specification-table'
        };
        const shortCardType = cardTypeMap[this.selectedCardType];

        // Get selected variants with their SKUs from configuration
        const selectedVariants = [];
        const brand = document.getElementById('brand').value;
        const model = document.getElementById('model').value;
        const generation = document.getElementById('generation').value;
        
        // Find ALL matching configurations to get SKUs
        const matchingConfigs = this.configurations.filter(c => 
            c.brand === brand && c.model === model && c.generation === generation
        );
        
        // Merge all variants from matching configurations
        const allConfigVariants = [];
        matchingConfigs.forEach(config => {
            if (config.variants && Array.isArray(config.variants)) {
                allConfigVariants.push(...config.variants);
            }
        });
        
        document.querySelectorAll('input[name="variant"]:checked').forEach(checkbox => {
            const variantName = checkbox.value;
            
            // Find the variant in all configurations to get its SKU
            const configVariant = allConfigVariants.find(v => {
                const vName = typeof v === 'string' ? v : v.name;
                return vName === variantName;
            });
            
            const sku = configVariant && typeof configVariant === 'object' ? configVariant.sku : '';
            
            selectedVariants.push({
                name: variantName,
                sku: sku
            });
        });

        const cardData = {
            configuration: {
                brand: brand,
                model: model,
                generation: generation,
                variants: selectedVariants
            },
            description: document.getElementById('description').value
        };
        if (shortCardType) {
            cardData.cardType = shortCardType;
        }
        // Add card type specific fields
        if (this.selectedCardType === 'feature') {
            cardData.title = document.getElementById('title').value;
            cardData.subtitle = document.getElementById('subtitle').value;
            cardData.imageUrl = cleanedImageUrl;
        } else if (this.selectedCardType === 'product-options' || this.selectedCardType === 'cargo-options' || this.selectedCardType === 'weather-protection') {
            cardData.title = document.getElementById('title').value;
            cardData.price = document.getElementById('price')?.value || '';
            cardData.imageUrl = cleanedImageUrl;
        } else if (this.selectedCardType === 'specification-table') {
            cardData.title = "Specification Table";
            cardData.htmlContent = document.getElementById('description').value;
        }
        
        console.log('[getFormData] Final cardData:', cardData);
        return cardData;
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        console.log('[handleFormSubmit] editingCardId:', this.editingCardId, 'editingCardFilename:', this.editingCardFilename);
        const form = document.getElementById('cardForm');
        const formData = new FormData(form);
        const cardData = this.getFormData();

        // Get selected variants
        const selectedVariants = Array.from(document.querySelectorAll('input[name="variant"]:checked')).map(el => el.value);
        
        if (selectedVariants.length === 0) {
            showToast('Please select at least one variant.', 'warning');
            return;
        }

        // Validate that we have the required fields for the card type
        if (this.selectedCardType === 'feature') {
            if (!cardData.title.trim()) {
                showToast('Title is required for feature cards.', 'warning');
                return;
            }
            if (!cardData.description.trim()) {
                showToast('Description is required for feature cards.', 'warning');
                return;
            }
        } else if (this.selectedCardType === 'product-options' || this.selectedCardType === 'cargo-options' || this.selectedCardType === 'weather-protection') {
            if (!cardData.title.trim()) {
                showToast('Title is required for this card type.', 'warning');
                return;
            }
            if (!cardData.description.trim()) {
                showToast('Description is required for this card type.', 'warning');
                return;
            }
        } else if (this.selectedCardType === 'specification-table') {
            if (!cardData.htmlContent.trim()) {
                showToast('HTML content is required for specification table cards.', 'warning');
                return;
            }
        }

        // If editing, preserve id and filename
        if (this.editingCardId && this.editingCardFilename) {
            cardData.id = this.editingCardId;
            cardData.filename = this.editingCardFilename;
            cardData.originalFilename = this.editingCardFilename; // Send original filename for backend deletion
        }
        console.log('[handleFormSubmit] cardData sent to backend:', cardData);
        formData.append('cardData', JSON.stringify(cardData));
        // If an image file is selected, append it
        const imageInput = document.getElementById('imageFile');
        if (imageInput && imageInput.files.length > 0) {
            formData.append('image', imageInput.files[0]);
        }
        try {
            const response = await fetch('/api/save-card', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                showToast('Card saved successfully!', 'success');
                form.reset();
                this.updatePreview();
                if (this.editingCardId) {
                    // Update the card in the list by id
                    const idx = this.savedCards.findIndex(card => card.id === this.editingCardId);
                    if (idx !== -1) {
                        this.savedCards[idx] = result.card;
                        console.log('[handleFormSubmit] Updated card in list (edit mode):', result.card);
                    } else {
                        // If not found, add it (should not happen, but safe fallback)
                        this.savedCards.unshift(result.card);
                        console.log('[handleFormSubmit] Card not found in list, added as new (edit mode):', result.card);
                    }
                    // Only clear edit state after successful save
                    this.editingCardId = null;
                    this.editingCardFilename = null;
                    this.updateCancelBtnState();
                } else {
                    // Add the new card to the list
                    this.savedCards.unshift(result.card);
                    console.log('[handleFormSubmit] Added new card:', result.card);
                }
                // Sort cards so most recently updated is first
                this.savedCards = this.savedCards.sort((a, b) => Number(b.id) - Number(a.id));
                // Debug: show the full list after update
                console.log('[handleFormSubmit] savedCards after update:', this.savedCards);
                // Force sync with server after save
                await this.loadSavedCards();
                this.renderSavedCards();
            } else {
                throw new Error(result.error || 'Failed to save card.');
            }
        } catch (error) {
            console.error('Error saving card:', error);
            showToast(error.message, 'danger');
        }
    }

    updatePreview() {
        const data = this.getFormData();
        console.log('[updatePreview] data:', data);
        const previewWrapper = document.getElementById('live-preview-wrapper');
        
        if (previewWrapper) {
            let html = '';
            
            switch (this.selectedCardType) {
                case 'feature':
                    html = this.generateFeatureCardHtml(data);
                    break;
                case 'product-options':
                    html = this.generateProductOptionsCardHtml(data);
                    break;
                case 'cargo-options':
                    html = this.generateCargoOptionsCardHtml(data);
                    break;
                case 'weather-protection':
                    html = this.generateWeatherProtectionCardHtml(data);
                    break;
                case 'specification-table':
                    html = this.generateSpecificationTableHtml(data);
                    break;
                default:
                    html = this.generateFeatureCardHtml(data); // Default fallback
            }
            
            previewWrapper.innerHTML = html;
        } else {
            console.error('Preview wrapper element not found!');
        }
    }
    
    generateFeatureCardHtml(data) {
        const title = data.title || '';
        const subtitle = data.subtitle || '';
        const description = data.description || '';
        // Use the server proxy for the image URL
        const imageSrc = data.imageUrl ? `/api/image-proxy?url=${encodeURIComponent(data.imageUrl)}` : '';

        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div style="width: 100%; height: 100%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Enter an image URL to see a preview</div>`;

        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border: 1px solid #e5e7eb; border-radius: 0.5rem; background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem;">
                    <!-- Text content -->
                    <div style="flex: 1 1 55%;">
                        <h2 style="font-size: 1rem; font-weight: 500; margin: 0 0 0.25rem 0; color: #111827; letter-spacing: -0.025em;">${title}</h2>
                        ${subtitle ? `<h3 style=\"font-size: 0.875rem; font-weight: 500; margin: 0 0 0.75rem 0; color: #374151;\">${subtitle}</h3>` : ''}
                        <p style="font-size: 0.75rem; line-height: 1.4; margin: 0; color: #4b5563;">${description}</p>
                    </div>
                    <!-- Image -->
                    <div style="flex: 1 1 40%; aspect-ratio: 16 / 10;">
                        ${imageHtml}
                    </div>
                </div>
            </div>`;
    }

    generateProductOptionsCardHtml(data) {
        const title = data.title || '';
        const description = data.description || '';
        let price = (data.price || '').trim();
        // Use the server proxy for the image URL
        const imageSrc = data.imageUrl ? `/api/image-proxy?url=${encodeURIComponent(data.imageUrl)}` : '';

        // Format price
        let priceHtml = '';
        if (price === '' || price === '0' || price === '0.00') {
            priceHtml = `<span style="font-size: 1rem; font-weight: 600; color: #222;">No extra cost</span>`;
        } else if (typeof price === 'string' && price.toLowerCase() === 'tbc') {
            priceHtml = `<span style="font-size: 1rem; font-weight: 600; color: #888;">TBC</span>`;
        } else if (!isNaN(Number(price)) && Number(price) > 0) {
            priceHtml = `<span style="font-size: 1rem; font-weight: 600; color: #222;">£${Number(price).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`;
        } else {
            priceHtml = `<span style="font-size: 1rem; font-weight: 600; color: #222;">${price}</span>`;
        }

        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${title}" style="width: 100%; height: 160px; object-fit: cover; border-top-left-radius: 8px; border-top-right-radius: 8px;">`
            : `<div style="width: 100%; height: 160px; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-size: 0.9rem; border-top-left-radius: 8px; border-top-right-radius: 8px;">No image</div>`;

        // Unique ID for description toggle
        const descId = `desc-${Math.random().toString(36).substr(2, 9)}`;

        return `
            <div class="card-info" style="border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.04); max-width: 340px; margin: 0 auto;">
                ${imageHtml}
                <div style="padding: 1rem; border-top: 1px solid #eee; display: flex; flex-direction: column; align-items: flex-start;">
                    <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; color: #222;">${title}</div>
                    <div style="margin-bottom: 0.5rem;">${priceHtml}</div>
                    <button type="button" class="more-info-btn" data-target="${descId}" style="background: #198754; color: #fff; border: none; padding: 0.5rem 1.2rem; border-radius: 4px; font-size: 1rem; font-weight: 500; cursor: pointer; margin-bottom: 0.5rem;">More Information</button>
                    <div id="${descId}" class="card-description" style="display:none; margin-top:0.5rem; font-size:0.97rem; color:#444;">${description}</div>
                </div>
            </div>`;
    }

    generateCargoOptionsCardHtml(data) {
        const title = data.title || '';
        const subtitle = data.subtitle || '';
        const description = data.description || '';
        const price = data.price || '';
        const buttonText = data.buttonText || 'Learn More';
        
        // Use the server proxy for the image URL
        const imageSrc = data.imageUrl ? `/api/image-proxy?url=${encodeURIComponent(data.imageUrl)}` : '';
        
        console.log('Cargo Options - Image URL:', data.imageUrl);
        console.log('Cargo Options - Proxied URL:', imageSrc);

        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="width: 100%; height: 100%; background-color: #f3f4f6; display: none; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Image failed to load</div>`
            : `<div style="width: 100%; height: 100%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Enter an image URL to see a preview</div>`;

        // Unique ID for description toggle
        const descId = `desc-${Math.random().toString(36).substr(2, 9)}`;

        return `
            <div class="card-info" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem;">
                    <!-- Text content -->
                    <div style="flex: 1 1 55%;">
                        <h2 style="font-size: 1rem; font-weight: 500; margin: 0 0 0.25rem 0; color: #111827; letter-spacing: -0.025em;">${title}</h2>
                        ${subtitle ? `<h3 style="font-size: 0.875rem; font-weight: 500; margin: 0 0 0.75rem 0; color: #374151;">${subtitle}</h3>` : ''}
                        <p style="font-size: 0.75rem; line-height: 1.4; margin: 0 0 1rem 0; color: #4b5563;">${description}</p>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            ${price ? `<span style="font-size: 1rem; font-weight: 600; color: #059669;">${price}</span>` : ''}
                            <button type="button" class="more-info-btn" data-target="${descId}" style="background: #198754; color: #fff; border: none; padding: 0.5rem 1.2rem; border-radius: 4px; font-size: 1rem; font-weight: 500; cursor: pointer; margin-bottom: 0.5rem;">More Information</button>
                            <div id="${descId}" class="card-description" style="display:none; margin-top:0.5rem; font-size:0.97rem; color:#444;">${description}</div>
                        </div>
                    </div>
                    <!-- Image -->
                    <div style="flex: 1 1 40%; aspect-ratio: 16 / 10;">
                        ${imageHtml}
                    </div>
                </div>
            </div>`;
    }

    generateWeatherProtectionCardHtml(data) {
        const title = data.title || '';
        const subtitle = data.subtitle || '';
        const description = data.description || '';
        const price = data.price || '';
        const buttonText = data.buttonText || 'Learn More';
        
        // Use the server proxy for the image URL
        const imageSrc = data.imageUrl ? `/api/image-proxy?url=${encodeURIComponent(data.imageUrl)}` : '';
        
        console.log('Weather Protection - Image URL:', data.imageUrl);
        console.log('Weather Protection - Proxied URL:', imageSrc);

        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="width: 100%; height: 100%; background-color: #f3f4f6; display: none; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Image failed to load</div>`
            : `<div style="width: 100%; height: 100%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Enter an image URL to see a preview</div>`;

        // Unique ID for description toggle
        const descId = `desc-${Math.random().toString(36).substr(2, 9)}`;

        return `
            <div class="card-info" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem;">
                    <!-- Text content -->
                    <div style="flex: 1 1 55%;">
                        <h2 style="font-size: 1rem; font-weight: 500; margin: 0 0 0.25rem 0; color: #111827; letter-spacing: -0.025em;">${title}</h2>
                        ${subtitle ? `<h3 style="font-size: 0.875rem; font-weight: 500; margin: 0 0 0.75rem 0; color: #374151;">${subtitle}</h3>` : ''}
                        <p style="font-size: 0.75rem; line-height: 1.4; margin: 0 0 1rem 0; color: #4b5563;">${description}</p>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            ${price ? `<span style="font-size: 1rem; font-weight: 600; color: #059669;">${price}</span>` : ''}
                            <button type="button" class="more-info-btn" data-target="${descId}" style="background: #198754; color: #fff; border: none; padding: 0.5rem 1.2rem; border-radius: 4px; font-size: 1rem; font-weight: 500; cursor: pointer; margin-bottom: 0.5rem;">More Information</button>
                            <div id="${descId}" class="card-description" style="display:none; margin-top:0.5rem; font-size:0.97rem; color:#444;">${description}</div>
                        </div>
                    </div>
                    <!-- Image -->
                    <div style="flex: 1 1 40%; aspect-ratio: 16 / 10;">
                        ${imageHtml}
                    </div>
                </div>
            </div>`;
    }

    generateSpecificationTableHtml(data) {
        const htmlContent = data.htmlContent || data.description || '';
        
        if (!htmlContent.trim()) {
            return `
                <div style="border: 1px solid #e0e0e0; border-radius: 4px; padding: 20px; text-align: center; background: #fff; font-family: sans-serif;">
                    <p style="color: #666; margin: 0;">Paste specification table HTML content above to see preview</p>
                </div>
            `;
        }
        
        // Wrap the HTML content with CSS styling without modifying the original HTML
        return `
            <div style="
                border: 1px solid #e0e0e0; 
                border-radius: 8px; 
                padding: 20px; 
                background: #fff; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 100%;
                max-height: 600px;
                overflow-y: auto;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
                <style>
                    /* CSS for specification table styling */
                    .specs {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                    }
                    .specs__table {
                        border-collapse: collapse;
                        width: 100%;
                    }
                    .specs__item {
                        border-bottom: 1px solid #e0e0e0;
                        padding: 12px 0;
                    }
                    .specs__item:last-child {
                        border-bottom: none;
                    }
                    .specs__item-inner {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 20px;
                    }
                    .specs__name {
                        font-weight: 600;
                        color: #333;
                        min-width: 150px;
                        flex-shrink: 0;
                    }
                    .specs__value {
                        color: #666;
                        text-align: right;
                        flex: 1;
                    }
                    .specs__footer {
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #e0e0e0;
                        font-size: 0.875rem;
                        color: #666;
                    }
                    .specs__footer small {
                        line-height: 1.5;
                    }
                    .addition {
                        color: #007bff;
                        font-weight: 500;
                        margin-bottom: 8px;
                    }
                    h2 {
                        color: #333;
                        margin-bottom: 24px;
                        font-size: 1.5rem;
                        font-weight: 600;
                    }
                    .grid {
                        display: block;
                    }
                    .text-spaces {
                        margin: 0;
                        padding: 0;
                    }
                    .s-12, .m-12, .l-12 {
                        width: 100%;
                        margin-bottom: 16px;
                    }
                    .m30-layer-content {
                        margin: 0;
                        padding: 0;
                    }
                    .background-grey {
                        background: transparent;
                    }
                    .module {
                        margin: 0;
                        padding: 0;
                    }
                    .container-center {
                        margin: 0 auto;
                        max-width: 100%;
                    }
                </style>
                ${htmlContent}
            </div>
        `;
    }

    async loadSavedCards() {
        try {
            const response = await fetch('/api/load-cards');
            if (!response.ok) throw new Error('Failed to fetch cards.');
            let cards = await response.json();
            console.log('[loadSavedCards] Raw cards from server:', cards.map(c => ({ id: c.id, cardType: c.cardType, type: c.type, title: c.title })));
            
            // Migrate any 'option' type cards to 'product-options'
            cards = cards.map(card => {
                if (card.cardType === 'option' || card.type === 'option') {
                    console.log(`[loadSavedCards] Migrating card ${card.id} from 'option' to 'product-options'`);
                    card.cardType = 'product-options';
                }
                return card;
            });
            
            console.log('[loadSavedCards] Cards after migration:', cards.map(c => ({ id: c.id, cardType: c.cardType, type: c.type, title: c.title })));
            this.savedCards = cards;
            this.renderSavedCards();
            this.checkConfigurationAvailability(); // Check availability after loading cards
        } catch (error) {
            console.error('Error loading saved cards:', error);
            showToast(error.message, 'danger');
        }
    }

    renderSavedCards() {
        console.log('[renderSavedCards] Method called');
        const listContainer = document.getElementById('savedCardsList');
        if (!listContainer) {
            console.error('[renderSavedCards] savedCardsList element not found!');
            return;
        }
        listContainer.innerHTML = '';

        if (this.savedCards.length === 0) {
            listContainer.innerHTML = '<p class="text-muted">No cards saved yet.</p>';
            return;
        }

        // Consistent card type mapping
        const cardTypeMap = {
            'feature': ['feature'],
            'product-options': ['product-options', 'option'],
            'specification-table': ['specification-table', 'spec'],
            'weather-protection': ['weather-protection', 'weather'],
            'cargo-options': ['cargo-options', 'cargo']
        };
        const currentCardType = this.selectedCardType;
        const validTypes = cardTypeMap[currentCardType] || [currentCardType];

        // Only filter by card type
        console.log('[renderSavedCards] Current card type:', currentCardType);
        console.log('[renderSavedCards] Valid types for filtering:', validTypes);
        console.log('[renderSavedCards] All saved cards:', this.savedCards.map(c => ({ id: c.id, cardType: c.cardType, type: c.type, title: c.title })));
        
        const filteredCards = this.savedCards.filter(card => {
            const cardType = card.cardType || card.type;
            const isIncluded = validTypes.includes(cardType);
            console.log(`[renderSavedCards] Card ${card.id} (${card.title}): cardType=${cardType}, included=${isIncluded}`);
            return isIncluded;
        });
        
        console.log('[renderSavedCards] Filtered cards:', filteredCards.length);

        if (filteredCards.length === 0) {
            listContainer.innerHTML = '<p class="text-muted">No cards of this type saved yet.</p>';
            return;
        }

        filteredCards.forEach(card => {
            // Unified display name
            const cardTypeNames = {
                'feature': 'Feature Card',
                'product-options': 'Product Options',
                'specification-table': 'Specification Table',
                'spec': 'Specification Table',
                'weather-protection': 'Weather Protection',
                'cargo-options': 'Cargo Options'
            };
            // Always use 'Product Options' for both 'option' and 'product-options'
            const cardType = card.cardType || card.type || 'Unknown';
            const cardTypeName = cardTypeNames[cardType] || (cardType === 'option' ? 'Product Options' : cardType);
            console.log(`[renderSavedCards] Card ${card.id}: cardType=${cardType}, displayName=${cardTypeName}`);
            
            // For specification table cards, extract the meaningful title from HTML content
            let displayTitle = card.title;
            if (cardType === 'specification-table' || cardType === 'spec') {
                const htmlContent = card.htmlContent || card.description || '';
                // Try to extract the h2 title from the HTML content
                const h2Match = htmlContent.match(/<h2[^>]*>([^<]+)<\/h2>/);
                if (h2Match && h2Match[1]) {
                    displayTitle = h2Match[1].trim();
                }
            }
            
            // Format variants for display
            const variants = (card.configuration && card.configuration.variants) ? card.configuration.variants : [];
            let variantsText = 'No variants selected';
            
            if (variants.length > 0) {
                if (typeof variants[0] === 'string') {
                    // Old format: array of strings
                    variantsText = variants.join(', ');
                } else {
                    // New format: array of objects with name and sku
                    variantsText = variants.map(v => `${v.name} (${v.sku || 'No SKU'})`).join(', ');
                }
            }
            
            // Create card element
            const cardElement = document.createElement('div');
            cardElement.className = 'p-3 mb-3 bg-light rounded border saved-card-item';
            cardElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="badge bg-primary me-2 card-type-badge">${cardTypeName}</span>
                            <strong>${displayTitle}</strong>
                        </div>
                        <div class="text-muted small">
                            <strong>Configuration:</strong> ${card.configuration ? `${card.configuration.brand || 'Unknown'} - ${card.configuration.model || 'Unknown'} - ${card.configuration.generation || 'Unknown'}` : 'No configuration'}
                        </div>
                        ${variants.length > 0 ? `<div class="variants-info"><small><strong>Variants:</strong> ${variantsText}</small></div>` : ''}
                        ${cardType === 'product-options' && card.price ? `<div class="text-success small mt-1"><strong>${card.price}</strong></div>` : ''}
                        ${cardType !== 'product-options' && card.subtitle ? `<div class="text-muted small mt-1"><em>${card.subtitle}</em></div>` : ''}
                    </div>
                    <div class="ms-3">
                        <button class="btn btn-sm btn-outline-primary me-2" data-action="edit" data-card-id="${card.id}" title="Edit Card">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-card-id="${card.id}" title="Delete Card">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            listContainer.appendChild(cardElement);
        });
    }

    handleSavedCardAction(e) {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const cardId = button.dataset.cardId;

        if (action === 'delete') {
            this.handleDeleteClick(cardId);
        } else if (action === 'edit') {
            this.handleEditClick(cardId);
        }
    }

    async handleDeleteClick(cardId) {
        if (!confirm('Are you sure you want to delete this card?')) return;

        // Find the card to get its filename
        const cardToDelete = this.savedCards.find(card => card.id === cardId);
        if (!cardToDelete || !cardToDelete.filename) {
            showToast('Could not delete card: filename is missing.', 'danger');
            return;
        }

        try {
            const response = await fetch(`/api/delete-card/${cardToDelete.filename}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete card.');
            }
            showToast('Card deleted successfully.', 'success');
            this.loadSavedCards(); // Refresh the list
        } catch (error) {
            console.error('Error deleting card:', error);
            showToast(error.message, 'danger');
        }
    }

    async handleEditClick(cardId) {
        const cardToEdit = this.savedCards.find(card => card.id === cardId);
        if (cardToEdit) {
            this.editingCardId = cardToEdit.id; // Set edit mode
            this.editingCardFilename = cardToEdit.filename; // Ensure filename is set
            console.log('[handleEditClick] editingCardId:', this.editingCardId, 'editingCardFilename:', this.editingCardFilename);
            await this.populateForm(cardToEdit);
            this.updateCancelBtnState();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast('Editing card. Make your changes and click "Save Card".', 'info');
        } else {
            showToast('Could not find card data to edit.', 'warning');
        }
    }

    clearFilter() {
        // Clear form selections to show all cards
        document.getElementById('brand').value = '';
        document.getElementById('model').value = '';
        document.getElementById('generation').value = '';
        
        // Clear variant checkboxes
        document.querySelectorAll('input[name="variant"]').forEach(chk => chk.checked = false);
        
        // Reset card type to default
        this.selectCardType('feature');
        
        // Re-render the saved cards list
        this.renderSavedCards();
        
        // Update preview
        this.updatePreview();
    }

    checkConfigurationAvailability() {
        const currentBrand = document.getElementById('brand').value;
        const currentModel = document.getElementById('model').value;
        const currentGeneration = document.getElementById('generation').value;
        const currentCardType = this.selectedCardType;

        if (!currentBrand || !currentModel || !currentGeneration || !currentCardType) {
            return; // Not enough selections to check
        }

        // Check if any cards exist with this exact configuration and card type
        const existingCards = this.savedCards.filter(card => {
            const existingCardType = card.cardType || card.type;
            return card.configuration.brand === currentBrand &&
                   card.configuration.model === currentModel &&
                   card.configuration.generation === currentGeneration &&
                   existingCardType === currentCardType;
        });

        // Update the save button to show availability
        const saveButton = document.querySelector('#cardForm button[type="submit"]');
        if (existingCards.length > 0) {
            saveButton.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>Save Card (${existingCards.length} existing)`;
            saveButton.className = 'btn btn-warning';
            saveButton.title = `${existingCards.length} card(s) already exist for this configuration and card type`;
        } else {
            saveButton.innerHTML = `<i class="fas fa-save me-2"></i>Save Card`;
            saveButton.className = 'btn btn-primary';
            saveButton.title = 'This configuration is available for a new card';
        }
    }

    toggleCardDescription(button) {
        // Use data-target to find the correct description div
        const descId = button.getAttribute('data-target');
        console.log('[toggleCardDescription] Called for descId:', descId);
        if (!descId) return;
        const description = document.getElementById(descId);
        console.log('[toggleCardDescription] Found description div:', !!description);
        if (!description) return;
        // Use display block/none for preview toggle
        if (description.style.display === 'block') {
            description.style.display = 'none';
            button.textContent = 'More Information';
        } else {
            description.style.display = 'block';
            button.textContent = 'Less Information';
        }
    }

    cancelEditMode() {
        console.log('[cancelEditMode] called. Before clear: editingCardId:', this.editingCardId, 'pendingCardType:', this.pendingCardType);
        this.editingCardId = null;
        this.editingCardFilename = null;
        this.updateCancelBtnState();
        this.justCancelledEdit = true;
        // Reset the form
        const form = document.getElementById('cardForm');
        if (form) form.reset();
        // Clear variant checkboxes
        document.querySelectorAll('input[name="variant"]').forEach(chk => chk.checked = false);
        // Optionally clear dynamic price field
        const oldPriceField = document.getElementById('price-field-dynamic');
        if (oldPriceField) oldPriceField.remove();
        // Optionally clear subtitle
        const subtitleInput = document.getElementById('subtitle');
        if (subtitleInput) subtitleInput.value = '';
        // Optionally clear imageUrl
        const imageUrlInput = document.getElementById('imageUrl');
        if (imageUrlInput) imageUrlInput.value = '';
        // Optionally clear description
        const descriptionInput = document.getElementById('description');
        if (descriptionInput) descriptionInput.value = '';
        // Optionally clear title
        const titleInput = document.getElementById('title');
        if (titleInput) titleInput.value = '';
        // Update preview
        this.updatePreview();
        showToast('Edit cancelled. Switched to new card type.', 'info');
        // If there was a pending card type switch, perform it now
        if (this.pendingCardType) {
            const typeToSwitch = this.pendingCardType;
            this.pendingCardType = null;
            console.log('[cancelEditMode] Performing pending card type switch to', typeToSwitch);
            this.selectCardType(typeToSwitch);
        }
        console.log('[cancelEditMode] after clear: editingCardId:', this.editingCardId, 'justCancelledEdit:', this.justCancelledEdit, 'pendingCardType:', this.pendingCardType);
    }

    // Call this after any edit state change
    updateCancelBtnState() {
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) {
            cancelBtn.disabled = !this.editingCardId;
        }
    }
}

// Initialize the card creator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.cardCreator = new CardCreator();
});