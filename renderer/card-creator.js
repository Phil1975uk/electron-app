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

let lastUnsavedImagePath = null;

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

// Utility: Convert file/blob to base64
async function fileOrBlobToBase64(fileOrBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrBlob);
    });
}

// Utility: Download image from URL and return as Blob
async function fetchImageAsBlob(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    return await response.blob();
}

// Utility: Check if an image is referenced by any saved card
async function isImageReferenced(imagePath) {
    try {
        const response = await fetch('/api/cards');
        if (!response.ok) return false;
        const cards = await response.json();
        return cards.some(card => card.imageUrl && card.imageUrl.endsWith(imagePath));
    } catch {
        return false;
    }
}

// Utility: Clean up last unsaved image if not referenced
async function cleanupLastUnsavedImage() {
    if (lastUnsavedImagePath) {
        const imgName = lastUnsavedImagePath.split('/').pop();
        const referenced = await isImageReferenced(imgName);
        if (!referenced) {
            await window.electronAPI.deleteImageFile(lastUnsavedImagePath);
        }
        lastUnsavedImagePath = null;
    }
}

// Main handler for image input (file, data URL, or normal URL)
async function handleImageInput(input) {
    console.log('[handleImageInput] Input received:', input);
    console.log('[handleImageInput] Input type:', typeof input);
    console.log('[handleImageInput] Input instanceof File:', input instanceof File);
    console.log('[handleImageInput] Input instanceof Blob:', input instanceof Blob);
    
    let base64Data, extension = 'png';
    try {
        // Auto-delete previous unsaved image if not referenced
        await cleanupLastUnsavedImage();
        if (typeof input === 'string') {
            if (input.startsWith('data:image/')) {
                // Data URL
                const match = input.match(/^data:image\/(\w+);base64,/);
                extension = match ? match[1] : 'png';
                base64Data = input.split(',')[1];
            } else if (input.startsWith('http')) {
                // Normal URL: fetch and convert
                const blob = await fetchImageAsBlob(input);
                extension = blob.type.split('/')[1] || 'png';
                base64Data = await fileOrBlobToBase64(blob);
            } else {
                throw new Error('Unsupported image input');
            }
        } else if (input instanceof File || input instanceof Blob) {
            extension = (input.type && input.type.split('/')[1]) || 'png';
            base64Data = await fileOrBlobToBase64(input);
        } else {
            throw new Error('Unsupported image input');
        }
        // Save to disk via Electron API
        const savedPath = await window.electronAPI.saveImageToDisk(base64Data, extension);
        lastUnsavedImagePath = savedPath;
        // Use savedPath as the card's image URL
        const imageUrlInput = document.getElementById('imageUrl');
        if (imageUrlInput) {
            console.log('[handleImageInput] Setting imageUrlInput.value to:', savedPath);
            imageUrlInput.value = savedPath;
            imageUrlInput.dataset.fileDataUrl = '';
            imageUrlInput.dataset.fileName = '';
            console.log('[handleImageInput] After setting, imageUrlInput.value is:', imageUrlInput.value);
        }
        if (typeof cardCreator !== 'undefined' && cardCreator.updatePreview) {
            cardCreator.updatePreview();
        }
    } catch (err) {
        alert('Failed to process image: ' + err.message);
    }
}

// Utility to get correct image src
function getImageSrc(url) {
    if (!url) return '';
    // Remove 'renderer/' prefix if present
    if (url.startsWith('renderer/')) url = url.replace(/^renderer\//, '').replace(/^renderer\//, '');
    if (url.startsWith('data:')) return url;
    // Use image-proxy for both local and external images
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

// Utility: Robust deep copy (uses structuredClone if available, else JSON fallback)
function deepCopy(obj) {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    } else {
        return JSON.parse(JSON.stringify(obj));
    }
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
        this.filterByDetails = true; // Track filter toggle state
        this.hasUnsavedChanges = false; // Track if there are unsaved changes
        this.originalFormData = null; // Store original form data for comparison
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
        // loadSavedCards() is already called in loadConfigurations(), so we don't need to call it again
        this.updateStatusIndicator(); // Initialize status indicator
        
        // Initialize filter toggle checkbox
        const filterToggle = document.getElementById('filterToggle');
        if (filterToggle) {
            filterToggle.checked = this.filterByDetails;
        }
    }

    async loadConfigurations() {
        try {
            // Load from server only - no localStorage fallback
            const response = await fetch('/api/configurations');
            if (response.ok) {
                const serverData = await response.json();
                // Handle both formats: direct array or { configurations: [...] }
                const serverConfigs = Array.isArray(serverData) ? serverData : (serverData.configurations || []);
                this.configurations = serverConfigs;
                console.log('Loaded configurations from server:', serverConfigs.length, 'configurations');
            } else {
                // Server error, use empty array
                console.warn('Server error loading configurations, using empty array');
                this.configurations = [];
            }
            this.populateBrandSelect();
            await this.restoreSelectionsFromLocalStorage();
            this.loadSavedCards(); // Refresh the saved cards list
        } catch (error) {
            console.error('Error loading configurations:', error);
            // Use empty array on error - no localStorage fallback
            this.configurations = [];
            this.populateBrandSelect();
            this.loadSavedCards();
        }
    }

    async restoreSelectionsFromLocalStorage() {
        const brandSelect = document.getElementById('brand');
        const modelSelect = document.getElementById('model');
        const generationSelect = document.getElementById('generation');
        const savedBrand = localStorage.getItem('cardCreatorBrand');
        const savedModel = localStorage.getItem('cardCreatorModel');
        const savedGeneration = localStorage.getItem('cardCreatorGeneration');
        const savedVariants = localStorage.getItem('cardCreatorVariants');
        if (savedBrand) {
            brandSelect.value = savedBrand;
            this.populateModelSelect(savedBrand);
            setTimeout(() => {
                if (savedModel) {
                    modelSelect.value = savedModel;
                    this.populateGenerationSelect(savedModel);
                    setTimeout(() => {
                        if (savedGeneration) {
                            generationSelect.value = savedGeneration;
                            this.populateVariantCheckboxes();
                            setTimeout(() => {
                                if (savedVariants) {
                                    try {
                                        const checked = JSON.parse(savedVariants);
                                        checked.forEach(val => {
                                            const cb = document.querySelector(`input[name="variant"][value="${val}"]`);
                                            if (cb) cb.checked = true;
                                        });
                                    } catch {}
                                }
                            }, 100);
                        }
                    }, 100);
                }
            }, 100);
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
                // (REMOVED) Do not clear remembered selections when switching card type
                // localStorage.removeItem('cardCreatorBrand');
                // localStorage.removeItem('cardCreatorModel');
                // localStorage.removeItem('cardCreatorGeneration');
                // localStorage.removeItem('cardCreatorVariants');
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
                localStorage.setItem('cardCreatorBrand', e.target.value);
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
                localStorage.setItem('cardCreatorModel', e.target.value);
            });
        } else {
            console.warn('Element with id "model" not found during event listener setup');
        }

        const generationSelect = document.getElementById('generation');
        if (generationSelect) {
            generationSelect.addEventListener('change', (e) => {
                this.populateVariantCheckboxes();
                this.renderSavedCards(); // Update saved cards list when generation changes
                this.checkConfigurationAvailability(); // Check availability
                localStorage.setItem('cardCreatorGeneration', e.target.value);
            });
        } else {
            console.warn('Element with id "generation" not found during event listener setup');
        }

        // Variant checkbox changes and filter event
        const variantCheckboxesEl = document.getElementById('variantCheckboxes');
        if (variantCheckboxesEl) {
            variantCheckboxesEl.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    this.renderSavedCards(); // Update saved cards list when variants change
                    this.checkConfigurationAvailability(); // Check availability
                    // Save checked variants to localStorage
                    const checked = Array.from(document.querySelectorAll('input[name="variant"]:checked')).map(cb => cb.value);
                    localStorage.setItem('cardCreatorVariants', JSON.stringify(checked));
                }
                if (this.filterByDetails) this.renderSavedCards();
            });
        } else {
            console.warn('Element with id "variantCheckboxes" not found during event listener setup');
        }

        // Clear selections from localStorage when navigating away from Card Creator
        document.querySelectorAll('a.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (!link.classList.contains('active')) {
                    localStorage.removeItem('cardCreatorBrand');
                    localStorage.removeItem('cardCreatorModel');
                    localStorage.removeItem('cardCreatorGeneration');
                    localStorage.removeItem('cardCreatorVariants');
                }
            });
        });

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

        // Real-time preview updates and change tracking
        ['title', 'subtitle', 'description', 'price', 'imageUrl'].forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.addEventListener('input', () => {
                    this.updatePreview();
                    this.checkForChanges();
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
        
        // Change tracking for HTML content field (specification tables)
        const htmlContentField = document.getElementById('htmlContent');
        if (htmlContentField) {
            htmlContentField.addEventListener('input', () => {
                this.updatePreview();
                this.checkForChanges();
            });
        }
        
        // Quick save button
        const quickSaveBtn = document.getElementById('quickSaveBtn');
        if (quickSaveBtn) {
            quickSaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleFormSubmit(e);
            });
        }

        // Reset Form button
        const resetFormBtn = document.getElementById('resetFormBtn');
        if (resetFormBtn) {
            resetFormBtn.addEventListener('click', async () => {
                await cleanupLastUnsavedImage(); // Clean up unsaved image on reset
                this.editingCardId = null;
                document.getElementById('cardForm').reset();
                // Clear variant checkboxes
                document.querySelectorAll('input[name="variant"]').forEach(chk => chk.checked = false);
                // Clear remembered selections from localStorage on reset
                localStorage.removeItem('cardCreatorBrand');
                localStorage.removeItem('cardCreatorModel');
                localStorage.removeItem('cardCreatorGeneration');
                localStorage.removeItem('cardCreatorVariants');
                console.log('[Reset] Cleared selection memory from localStorage');
                // Clear change tracking
                this.clearOriginalFormData();
                // Reload the list of saved cards
                this.renderSavedCards();
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

        // Drag-and-drop image support
        const imageDropArea = document.getElementById('imageDropArea');
        const imageUrlInput = document.getElementById('imageUrl');

        if (imageDropArea) {
            imageDropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                imageDropArea.style.background = '#f0f8ff';
            });
            imageDropArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                imageDropArea.style.background = '';
            });
            imageDropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                imageDropArea.style.background = '';
                const dt = e.dataTransfer;
                if (dt.files && dt.files.length > 0) {
                    const file = dt.files[0];
                    if (file.type.startsWith('image/')) {
                        handleImageInput(file);
                    }
                } else if (dt.items && dt.items.length > 0) {
                    // Try to get image URL from dragged content
                    for (let i = 0; i < dt.items.length; i++) {
                        const item = dt.items[i];
                        if (item.kind === 'string' && item.type === 'text/uri-list') {
                            item.getAsString(function(url) {
                                handleImageInput(url);
                            });
                            return;
                        }
                    }
                }
            });
        }

        // Show preview when user types/pastes a URL
        if (imageUrlInput) {
            imageUrlInput.addEventListener('input', function() {
                handleImageInput(imageUrlInput.value);
            });
        }

        // Add event listeners for filter toggle and form controls
        const filterToggle = document.getElementById('filterToggle');
        if (filterToggle) {
            filterToggle.addEventListener('change', (e) => {
                this.filterByDetails = filterToggle.checked;
                this.renderSavedCards();
            });
        }
        ['brand', 'model', 'generation'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    if (this.filterByDetails) this.renderSavedCards();
                });
            }
        });
    }

    selectCardType(type) {
        cleanupLastUnsavedImage(); // Clean up unsaved image on card type change
        console.log('selectCardType called with:', type, 'previous value was:', this.selectedCardType);
        console.log('[selectCardType] editingCardId:', this.editingCardId, 'justCancelledEdit:', this.justCancelledEdit, 'pendingCardType:', this.pendingCardType);
        // If just cancelled edit, allow switch and clear flag
        if (this.justCancelledEdit) {
            console.log('[selectCardType] justCancelledEdit is true, allowing card type switch to', type);
            this.justCancelledEdit = false;
        } else if (this.editingCardId) {
            // If we're editing and the card type is the same, don't cancel edit mode
            const currentCard = this.savedCards.find(card => String(card.id) === String(this.editingCardId));
            const currentCardType = currentCard?.cardType || currentCard?.type;
            const typeMap = {
                'option': 'product-options',
                'cargo': 'cargo-options',
                'spec': 'specification-table'
            };
            const mappedCurrentType = typeMap[currentCardType] || currentCardType;
            
            if (mappedCurrentType === type) {
                // Same card type, keep editing
                console.log('[selectCardType] Same card type during edit, preserving edit state');
            } else if (!this.hasUnsavedChanges) {
                // Different card type, no unsaved changes, auto-cancel edit and switch
                console.log('[selectCardType] Different card type, no unsaved changes, cancelling edit');
                this.cancelEditMode();
                // After cancelEditMode, proceed to switch card type
            } else {
                showToast('You have unsaved changes. Please save or cancel editing before switching card type.', 'warning');
                this.pendingCardType = type; // Store the requested type
                // --- Flash the Save button(s) ---
                const quickSaveBtn = document.getElementById('quickSaveBtn');
                if (quickSaveBtn) {
                    quickSaveBtn.classList.add('flash');
                    setTimeout(() => quickSaveBtn.classList.remove('flash'), 1400);
                }
                const mainSaveBtn = document.querySelector('#cardForm button[type="submit"]');
                if (mainSaveBtn) {
                    mainSaveBtn.classList.add('flash');
                    setTimeout(() => mainSaveBtn.classList.remove('flash'), 1400);
                }
                console.log('[selectCardType] Blocked card type switch, set pendingCardType to', type);
                return;
            }
        }
        this.pendingCardType = null; // Clear pending if not editing
        // --- Remember Brand, Model, Generation, and selected Variants ---
        const brand = document.getElementById('brand').value;
        const model = document.getElementById('model').value;
        const generation = document.getElementById('generation').value;
        const checkedVariants = Array.from(document.querySelectorAll('input[name="variant"]:checked')).map(cb => cb.value);
        // --- Reset all other fields ---
        if (!this.editingCardId) {
            // Only reset if not editing
            document.getElementById('cardForm').reset();
            // Restore remembered fields
            document.getElementById('brand').value = brand;
            this.populateModelSelect(brand);
            document.getElementById('model').value = model;
            this.populateGenerationSelect(model);
            document.getElementById('generation').value = generation;
            this.populateVariantCheckboxes();
            // Restore checked variants
            document.querySelectorAll('input[name="variant"]').forEach(cb => {
                cb.checked = checkedVariants.includes(cb.value);
            });
        }
        this.selectedCardType = type;
        console.log('selectedCardType set to:', this.selectedCardType);
        // Update active button
        document.querySelectorAll('.card-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        // Show/hide form sections based on card type
        console.log('[selectCardType] About to call updateFormFields with type:', type);
        this.updateFormFields(type);
        console.log('[selectCardType] updateFormFields completed');
        console.log('[selectCardType] Price field after updateFormFields:', document.getElementById('price'));
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
                console.log('[updateFormFields] Created price field for card type:', cardType);
                console.log('[updateFormFields] Price field element:', document.getElementById('price'));
                console.log('[updateFormFields] Price field is editable:', !document.getElementById('price')?.readOnly);
                console.log('[updateFormFields] Price field is disabled:', document.getElementById('price')?.disabled);
                
                // Ensure the price field is properly enabled
                const priceField = document.getElementById('price');
                if (priceField) {
                    priceField.removeAttribute('readonly');
                    priceField.removeAttribute('disabled');
                    priceField.style.pointerEvents = 'auto';
                    priceField.style.opacity = '1';
                    priceField.tabIndex = 0;
                    console.log('[updateFormFields] Price field after enabling - readonly:', priceField.readOnly, 'disabled:', priceField.disabled, 'pointerEvents:', priceField.style.pointerEvents);
                    
                    // Test if the field can be interacted with
                    setTimeout(() => {
                        priceField.focus();
                        console.log('[updateFormFields] Price field focus test completed');
                    }, 100);
                }
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
                // For spec sheets, only show the HTML content field - hide everything else
                descriptionField.style.display = 'block';
                descriptionInput.setAttribute('required', 'required');
                // Ensure we have a <textarea> for multi-line HTML input
                if (descriptionInput.tagName !== 'TEXTAREA') {
                    this.convertToTextarea(descriptionInput);
                }
                const descriptionLabel = descriptionField.querySelector('label');
                if (descriptionLabel) {
                    descriptionLabel.textContent = 'Specification Table HTML (paste complete HTML here)';
                }
                // Make the textarea larger for HTML content
                descriptionInput.rows = 12;
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
            // Always use variant.name if present, fallback to string
            const variantName = (typeof variant === 'object' && variant.name) ? variant.name : (typeof variant === 'string' ? variant : '');
            const variantSku = (typeof variant === 'object' && variant.sku) ? variant.sku : '';
            const variantId = variantName.replace(/[^a-zA-Z0-9]/g, '_');
            // Display variant with SKU as read-only text
            const skuDisplay = variantSku ? ` <span class="text-muted">(${variantSku})</span>` : '';
            container.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="variant" value="${variantSku}" id="variant-${variantId}">
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
        await cleanupLastUnsavedImage(); // Clean up unsaved image on card selection/edit
        
        // Reset change tracking when starting to edit a new card
        this.hasUnsavedChanges = false;
        this.clearOriginalFormData();
        
        // Clear any unsaved image data from the image URL input
        const imageUrlInput = document.getElementById('imageUrl');
        if (imageUrlInput) {
            // Clear any file data URL that might be lingering from unsaved changes
            imageUrlInput.dataset.fileDataUrl = '';
            imageUrlInput.dataset.fileName = '';
            console.log('[populateForm] Cleared unsaved image data from input');
        }
        
        console.log('[populateForm] card:', card);
        this.editingCardId = card.id;
        this.editingCardFilename = card.filename;
        let cardType = card.cardType || card.type;
        if (cardType === 'spec') cardType = 'specification-table';
        if (cardType === 'weather') cardType = 'weather-protection';
        console.log('[populateForm] Card type:', cardType, 'selectedCardType before switch:', this.selectedCardType);
        if (cardType) this.selectCardType(cardType);
        console.log('[populateForm] selectedCardType after switch:', this.selectedCardType);
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
                const variantSkus = variants.map(v => typeof v === 'string' ? v : v.sku);
                checkbox.checked = variantSkus.includes(checkbox.value);
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
        document.getElementById('description').value = card.description || card.htmlContent || card.content || '';
        
        // Handle image URL with debugging
        const imageUrlToSet = card.imageUrl || '';
        console.log('[populateForm] Original card.imageUrl:', card.imageUrl);
        console.log('[populateForm] Type of card.imageUrl:', typeof card.imageUrl);
        console.log('[populateForm] Setting imageUrl to:', imageUrlToSet);
        document.getElementById('imageUrl').value = imageUrlToSet;
        console.log('[populateForm] After setting, imageUrl.value is:', document.getElementById('imageUrl').value);
        if (cardType === 'feature') {
            document.getElementById('subtitle').value = card.subtitle || '';
            this.updatePreview();
        } else if (cardType === 'product-options' || cardType === 'cargo-options' || cardType === 'weather-protection') {
            // Ensure price field exists and is properly set up
            let priceField = document.getElementById('price');
            
            // If price field doesn't exist, it might not have been created yet
            if (!priceField) {
                console.log('[populateForm] Price field not found, waiting for it to be created...');
                // Wait a moment for the field to be created by updateFormFields
                await new Promise(resolve => setTimeout(resolve, 100));
                priceField = document.getElementById('price');
            }
            
            if (priceField) {
                priceField.removeAttribute('readonly');
                priceField.removeAttribute('disabled');
                priceField.value = card.price || '';
                console.log('[populateForm] Price field found and set to:', card.price);
            } else {
                console.error('[populateForm] Price field still not found after waiting');
            }
            this.updatePreview();
        } else if (cardType === 'specification-table') {
            document.getElementById('description').value = card.htmlContent || card.description || card.content || '';
            this.updatePreview();
        } else {
            this.updatePreview();
        }
        
        // Store original form data for change tracking
        console.log('[populateForm] About to store original form data for card type:', this.selectedCardType);
        this.storeOriginalFormData();
        console.log('[populateForm] Original form data stored');
    }

    getFormData() {
        const imageUrlInput = document.getElementById('imageUrl');
        console.log('[getFormData] imageUrlInput:', imageUrlInput);
        console.log('[getFormData] imageUrlInput.value:', imageUrlInput?.value);
        console.log('[getFormData] imageUrlInput.value type:', typeof imageUrlInput?.value);
        console.log('[getFormData] imageUrlInput.dataset:', imageUrlInput?.dataset);
        
        const rawImageUrl = imageUrlInput?.value?.trim() || '';
        const cleanedImageUrl = rawImageUrl.startsWith('@') ? rawImageUrl.substring(1) : rawImageUrl;
        console.log('[getFormData] rawImageUrl:', rawImageUrl);
        console.log('[getFormData] cleanedImageUrl:', cleanedImageUrl);
        console.log('[getFormData] selectedCardType:', this.selectedCardType);

        // Standardize cardType for weather protection
        let cardType = this.selectedCardType;
        if (cardType === 'weather') cardType = 'weather-protection';
        // Map UI card types to short folder names
        const cardTypeMap = {
            'feature': 'feature',
            'product-options': 'product-options',
            'cargo-options': 'cargo-options',
            'weather-protection': 'weather-protection',
            'specification-table': 'specification-table'
        };
        const shortCardType = cardTypeMap[cardType];

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
            const variantSku = checkbox.value;
            
            // Find the variant in all configurations to get its name
            const configVariant = allConfigVariants.find(v => {
                const vSku = typeof v === 'string' ? v : v.sku;
                return vSku === variantSku;
            });
            
            const name = configVariant && typeof configVariant === 'object' ? configVariant.name : variantSku;
            
            selectedVariants.push({
                name: name,
                sku: variantSku
            });
        });

        // Pick the first variant SKU (if any) for top-level card.sku – needed for Hypa export
        let primarySku = '';
        if (selectedVariants.length > 0) {
            primarySku = selectedVariants[0].sku || selectedVariants[0].name || '';
        }

        // Generate unique ID for new cards or preserve existing ID for edits
        let id;
        if (this.editingCardId) {
            // When editing, preserve the existing ID
            id = String(this.editingCardId).replace(/\D/g, '') || Date.now().toString();
        } else {
            // When creating new card, generate unique ID with timestamp + random suffix
            const timestamp = Date.now();
            const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            id = `${timestamp}${randomSuffix}`;
        }

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        let imageUrl = '';
        if (imageUrlInput) {
            if (imageUrlInput.dataset.fileDataUrl) {
                imageUrl = imageUrlInput.dataset.fileDataUrl;
            } else if (imageUrlInput.value) {
                imageUrl = imageUrlInput.value;
            }
        }
        const price = document.getElementById('price') ? document.getElementById('price').value : '';
        let position = 1;
        if (cardType === 'feature' || cardType === 'product-options' || cardType === 'cargo-options' || cardType === 'weather-protection') {
            // If editing, preserve position if available
            if (this.editingCardId && this.savedCards) {
                const editingCard = this.savedCards.find(card => String(card.id) === String(this.editingCardId));
                if (editingCard && editingCard.position) {
                    position = editingCard.position;
                }
            }
        } else {
            position = undefined;
        }
        // Standardize filename - preserve original filename when editing
        const safe = s => (s || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        let filename;
        
        if (this.editingCardFilename) {
            // When editing, use the original filename
            filename = this.editingCardFilename;
        } else {
            // When creating new card, generate filename
            if (cardType === 'specification-table') {
                // For spec sheets, extract title from HTML content for filename
                const htmlContent = document.getElementById('description').value;
                let extractedTitle = 'specification-table';
                if (htmlContent) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    const h2Element = doc.querySelector('h2');
                    if (h2Element && h2Element.textContent.trim()) {
                        extractedTitle = h2Element.textContent.trim();
                    }
                }
                filename = `card_${safe(brand)}_${safe(model)}_${safe(cardType)}_${safe(extractedTitle)}_${id}.json`;
            } else {
                filename = `card_${safe(brand)}_${safe(model)}_${safe(cardType)}_${safe(title)}_${id}.json`;
            }
        }
        // Build standardized cardData
        const cardData = {
            id,
            sku: primarySku,
            cardType: cardType,
            position,
            title,
            description,
            imageUrl,
            price,
            configuration: {
                brand: brand,
                model: model,
                generation: generation,
                variants: selectedVariants
            },
            filename,
            webdavPath: '',
            uploadDate: '',
            uploadMetadata: {},
            importedFromHypa: false,
            hypaUpdated: false,
            lastModified: new Date().toISOString(),
            savedAt: new Date().toISOString(), // Add savedAt property
            originalHypaData: {}
        };
        
        if (shortCardType) {
            cardData.cardType = shortCardType;
        }
        // Add card type specific fields
        if (this.selectedCardType === 'feature') {
            cardData.title = document.getElementById('title').value;
            cardData.subtitle = document.getElementById('subtitle').value;
        } else if (this.selectedCardType === 'product-options' || this.selectedCardType === 'cargo-options' || this.selectedCardType === 'weather-protection') {
            cardData.title = document.getElementById('title').value;
            cardData.price = document.getElementById('price')?.value || '';
        } else if (this.selectedCardType === 'specification-table') {
            // For spec sheets, extract title from H2 tag and store HTML content
            const htmlContent = document.getElementById('description').value;
            cardData.htmlContent = htmlContent;
            
            // Extract title from H2 tag in the HTML content
            if (htmlContent) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');
                const h2Element = doc.querySelector('h2');
                if (h2Element && h2Element.textContent.trim()) {
                    cardData.title = h2Element.textContent.trim();
                } else {
                    // Fallback title if no H2 found
                    cardData.title = 'Specification Table';
                }
            } else {
                cardData.title = 'Specification Table';
            }
        }
        
        // Handle image URL consistently for all card types
        if (imageUrlInput) {
            if (imageUrlInput.dataset.fileDataUrl) {
                cardData.imageUrl = imageUrlInput.dataset.fileDataUrl;
                console.log('[getFormData] Using fileDataUrl:', cardData.imageUrl);
            } else if (imageUrlInput.value) {
                cardData.imageUrl = imageUrlInput.value;
                console.log('[getFormData] Using imageUrlInput.value:', cardData.imageUrl);
            } else {
                cardData.imageUrl = cleanedImageUrl; // Fallback to cleaned URL
                console.log('[getFormData] Using cleanedImageUrl fallback:', cardData.imageUrl);
            }
        } else {
            cardData.imageUrl = cleanedImageUrl; // Fallback to cleaned URL
            console.log('[getFormData] Using cleanedImageUrl (no input):', cardData.imageUrl);
        }
        
        console.log('[getFormData] Final cardData:', cardData);
        return cardData;
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        console.log('[handleFormSubmit] editingCardId:', this.editingCardId, 'editingCardFilename:', this.editingCardFilename);
        console.log('[handleFormSubmit] hasUnsavedChanges:', this.hasUnsavedChanges);
        console.log('[handleFormSubmit] justCancelledEdit:', this.justCancelledEdit);
        const form = document.getElementById('cardForm');
        const formData = new FormData(form);
        const cardData = this.getFormData();
        
        console.log('[handleFormSubmit] Form data collected, cardData:', {
            id: cardData.id,
            filename: cardData.filename,
            editingCardId: this.editingCardId,
            editingCardFilename: this.editingCardFilename
        });

        // Auto-assign position for card types that need it (feature / product / cargo / weather)
        const positionRequiredTypes = ['feature', 'product-options', 'cargo-options', 'weather-protection'];
        if (positionRequiredTypes.includes(this.selectedCardType) && !cardData.position) {
            const nextPos = this.getNextAvailablePosition(cardData.cardType || this.selectedCardType, cardData.sku);
            if (nextPos) {
                cardData.position = nextPos;
                console.log('[handleFormSubmit] Auto-assigned position', nextPos, 'to card');
            }
        }

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

        // If editing, preserve original card metadata and update status fields
        if (this.editingCardId && this.editingCardFilename) {
            // Find the original card to preserve its metadata
            const originalCard = this.savedCards.find(card => String(card.id) === String(this.editingCardId));
            
            if (originalCard) {
                // Preserve all original metadata fields
                cardData.importedFromHypa = originalCard.importedFromHypa || false;
                cardData.hypaUpdated = originalCard.hypaUpdated || false;
                cardData.originalHypaData = originalCard.originalHypaData || {};
                cardData.validationInfo = originalCard.validationInfo || { hasWarnings: false, warnings: [] };
                cardData.webdavPath = originalCard.webdavPath || '';
                cardData.uploadDate = originalCard.uploadDate || '';
                cardData.uploadMetadata = originalCard.uploadMetadata || {};
                cardData.savedAt = originalCard.savedAt || new Date().toISOString();
                
                // Preserve original content field structure to prevent nesting
                // For specification tables, preserve the original structure but update with new content
                if (this.selectedCardType === 'specification-table') {
                    // For spec tables, always use the new content from the description field
                    const newContent = document.getElementById('description').value;
                    cardData.htmlContent = newContent;
                    cardData.description = newContent;
                    // Clear old content to prevent structure issues
                    cardData.content = undefined;
                } else {
                    // For other card types, preserve original content if not provided
                    if (originalCard.content && !cardData.content) {
                        cardData.content = originalCard.content;
                    }
                    if (originalCard.htmlContent && !cardData.htmlContent) {
                        cardData.htmlContent = originalCard.htmlContent;
                    }
                }
                
                // Preserve the original ID but strip non-digits; fallback to new timestamp if empty
                cardData.id = String(this.editingCardId).replace(/\D/g, '') || Date.now().toString();
                cardData.filename = this.editingCardFilename;
                cardData.originalFilename = this.editingCardFilename; // Send original filename for backend deletion
                
                // Update status for edited cards
                cardData.lastModified = new Date().toISOString();
                
                // If this was originally a Hypa import, mark it as manually updated
                if (cardData.importedFromHypa) {
                    cardData.hypaUpdated = true;
                    // Clear validation warnings since user has manually edited the card
                    if (cardData.validationInfo) {
                        cardData.validationInfo.hasWarnings = false;
                        cardData.validationInfo.warnings = [];
                    }
                }
            } else {
                // Fallback if original card not found
                cardData.id = String(this.editingCardId).replace(/\D/g, '') || Date.now().toString();
                cardData.filename = this.editingCardFilename;
                cardData.originalFilename = this.editingCardFilename;
                cardData.lastModified = new Date().toISOString();
            }
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
                // --- Remember Brand, Model, Generation, and selected Variants ---
                const brand = document.getElementById('brand').value;
                const model = document.getElementById('model').value;
                const generation = document.getElementById('generation').value;
                const checkedVariants = Array.from(document.querySelectorAll('input[name="variant"]:checked')).map(cb => cb.value);
                form.reset();
                // Restore remembered fields
                document.getElementById('brand').value = brand;
                this.populateModelSelect(brand);
                document.getElementById('model').value = model;
                this.populateGenerationSelect(model);
                document.getElementById('generation').value = generation;
                this.populateVariantCheckboxes();
                // Restore checked variants
                document.querySelectorAll('input[name="variant"]').forEach(cb => {
                    cb.checked = checkedVariants.includes(cb.value);
                });
                this.updatePreview();
                // ALWAYS reload from server to ensure consistency
                console.log('[handleFormSubmit] Reloading cards from server after save...');
                await this.loadSavedCards();
                
                // Clear edit state after successful save AND reload
                if (this.editingCardId) {
                    console.log('[handleFormSubmit] Clearing edit state after successful save');
                    this.editingCardId = null;
                    this.editingCardFilename = null;
                    this.hasUnsavedChanges = false; // Clear unsaved changes flag
                    this.clearOriginalFormData(); // Clear original form data for change tracking
                    this.updateCancelBtnState();
                }
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
        let imageSrc = getImageSrc(data.imageUrl);
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
        let imageSrc = getImageSrc(data.imageUrl);

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
        let imageSrc = getImageSrc(data.imageUrl);
        console.log('Cargo Options - Image URL:', data.imageUrl);
        console.log('Cargo Options - Proxied URL:', imageSrc);

        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="width: 100%; height: 100%; background-color: #f3f4f6; display: none; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Image failed to load</div>`
            : `<div style="width: 100%; height: 100%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Enter an image URL to see a preview</div>`;

        return `
            <div class="card-info" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem;">
                    <!-- Text content -->
                    <div style="flex: 1 1 55%;">
                        <h2 style="font-size: 1rem; font-weight: 500; margin: 0 0 0.25rem 0; color: #111827; letter-spacing: -0.025em;">${title}</h2>
                        ${subtitle ? `<h3 style="font-size: 0.875rem; font-weight: 500; margin: 0 0 0.75rem 0; color: #374151;">${subtitle}</h3>` : ''}
                        <p style="font-size: 0.75rem; line-height: 1.4; margin: 0 0 1rem 0; color: #4b5563;">${description}</p>
                        ${price ? `<span style="font-size: 1rem; font-weight: 600; color: #059669;">${price}</span>` : ''}
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
        let imageSrc = getImageSrc(data.imageUrl);
        console.log('Weather Protection - Image URL:', data.imageUrl);
        console.log('Weather Protection - Proxied URL:', imageSrc);

        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="width: 100%; height: 100%; background-color: #f3f4f6; display: none; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Image failed to load</div>`
            : `<div style="width: 100%; height: 100%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Enter an image URL to see a preview</div>`;

        return `
            <div class="card-info" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem;">
                    <!-- Text content -->
                    <div style="flex: 1 1 55%;">
                        <h2 style="font-size: 1rem; font-weight: 500; margin: 0 0 0.25rem 0; color: #111827; letter-spacing: -0.025em;">${title}</h2>
                        ${subtitle ? `<h3 style="font-size: 0.875rem; font-weight: 500; margin: 0 0 0.75rem 0; color: #374151;">${subtitle}</h3>` : ''}
                        <p style="font-size: 0.75rem; line-height: 1.4; margin: 0 0 1rem 0; color: #4b5563;">${description}</p>
                        ${price ? `<span style="font-size: 1rem; font-weight: 600; color: #059669;">${price}</span>` : ''}
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
        
        // For spec sheets, show the raw HTML content exactly as it will be uploaded to Hypa
        return `
            <div style="
                border: 1px solid #e0e0e0; 
                border-radius: 8px; 
                padding: 20px; 
                background: #fff; 
                max-width: 100%;
                max-height: 600px;
                overflow-y: auto;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
                <div style="margin-bottom: 10px; font-size: 12px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                    <strong>Preview (HTML will be uploaded exactly as shown):</strong><br>
                    <small>Title will be extracted from H2 tag for card management</small>
                </div>
                ${htmlContent}
            </div>
        `;
    }

    async loadSavedCards() {
        try {
            const response = await fetch('/api/cards');
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

            // Auto-edit or duplicate if URL contains parameters
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const editParam = urlParams.get('edit');
                const duplicateParam = urlParams.get('duplicate');
                
                if (editParam) {
                    console.log('[loadSavedCards] Detected edit param:', editParam);
                    await this.handleCardAction(editParam, 'edit');
                } else if (duplicateParam) {
                    console.log('[loadSavedCards] Detected duplicate param:', duplicateParam);
                    await this.handleCardAction(duplicateParam, 'duplicate');
                }
            } catch (err) {
                console.error('[loadSavedCards] Error processing URL params:', err);
            }
        } catch (error) {
            console.error('Error loading saved cards:', error);
            showToast(error.message, 'danger');
        }
    }

    renderSavedCards() {
        const savedCardsList = document.getElementById('savedCardsList');
        if (!savedCardsList) return;
        if (this.savedCards.length === 0) {
            savedCardsList.innerHTML = '<p class="text-muted">No cards saved yet.</p>';
            return;
        }

        // Get current filter values
        const currentBrand = document.getElementById('brand')?.value || '';
        const currentModel = document.getElementById('model')?.value || '';
        const currentGeneration = document.getElementById('generation')?.value || '';
        const currentCardType = this.selectedCardType;
        const checkedVariants = Array.from(document.querySelectorAll('input[name="variant"]:checked')).map(cb => cb.value);
        

        


        // Filter cards based on current selections
        let filteredCards = this.savedCards;
        

        
        // ALWAYS filter by current card type first (regardless of toggle state)
        filteredCards = this.savedCards.filter(card => {
            const cardType = card.cardType || card.type;
            // Handle card type mapping for both old and new formats
            const typeMap = {
                'option': 'product-options',
                'cargo': 'cargo-options',  // Map old 'cargo' to 'cargo-options'
                'spec': 'specification-table'
            };
            const mappedCardType = typeMap[cardType] || cardType;
            

            
            if (mappedCardType !== currentCardType) {
                return false;
            }
            return true;
        });
        
        console.log('[renderSavedCards] After card type filtering:', filteredCards.length, 'cards');

        
        // If toggle is ON, also filter by brand/model/generation/variants
        if (this.filterByDetails) {
            console.log('[renderSavedCards] Detailed filtering is ON');
            console.log('[renderSavedCards] Current selections:', {
                brand: currentBrand,
                model: currentModel,
                generation: currentGeneration,
                variants: checkedVariants
            });
            
            filteredCards = filteredCards.filter(card => {
                
                // Filter by brand
                if (currentBrand && card.configuration?.brand !== currentBrand) {
                    return false;
                }

                // Filter by model
                if (currentModel && card.configuration?.model !== currentModel) {
                    return false;
                }

                // Filter by generation
                if (currentGeneration && card.configuration?.generation !== currentGeneration) {
                    return false;
                }

                // Filter by variants (if any variants are selected)
                if (checkedVariants.length > 0 && card.configuration?.variants) {
                    const cardVariants = card.configuration.variants;
                    
                    // Extract card variant SKUs
                    const cardVariantSkus = cardVariants.map(variant => {
                        if (typeof variant === 'string') {
                            return variant;
                        } else if (typeof variant === 'object' && variant.sku) {
                            return variant.sku;
                        }
                        return null;
                    }).filter(sku => sku !== null);
                    
                    // Get all available variant SKUs for this configuration
                    const allAvailableVariants = this.getAllAvailableVariants(currentBrand, currentModel, currentGeneration);
                    
                    // Check if all available variants are selected
                    const allVariantsSelected = allAvailableVariants.length > 0 && 
                        allAvailableVariants.every(variant => checkedVariants.includes(variant));
                    
                    if (allVariantsSelected) {
                        // If all variants are selected, show cards with ANY of those variants (OR logic)
                        const hasAnySelectedVariant = checkedVariants.some(selectedVariant => 
                            cardVariantSkus.includes(selectedVariant)
                        );
                        if (!hasAnySelectedVariant) {
                            return false;
                        }
                    } else {
                        // If some variants are selected, show only cards with EXACTLY those variants (exact match)
                        // Check if card has exactly the selected variants (no more, no less)
                        if (cardVariantSkus.length !== checkedVariants.length) {
                            return false;
                        }
                        
                        const hasExactMatch = checkedVariants.every(selectedVariant => 
                            cardVariantSkus.includes(selectedVariant)
                        );
                        
                        if (!hasExactMatch) {
                            return false;
                        }
                    }
                }

                return true;
            });
        }
        

        


        console.log('[renderSavedCards] Final filtered cards:', filteredCards.length, 'cards');
        console.log('[renderSavedCards] Target card 1752931025649 in final filtered cards:', filteredCards.find(card => String(card.id) === '1752931025649'));
        
        // Clear the list
        savedCardsList.innerHTML = '';

        // Show filter status if filtering is active
        if (this.filterByDetails && (currentBrand || currentModel || currentGeneration || checkedVariants.length > 0 || currentCardType)) {
            const filterStatusDiv = document.createElement('div');
            filterStatusDiv.className = 'filter-status mb-3';
            
            const filterCriteria = [];
            if (currentBrand) filterCriteria.push(`Brand: ${currentBrand}`);
            if (currentModel) filterCriteria.push(`Model: ${currentModel}`);
            if (currentGeneration) filterCriteria.push(`Generation: ${currentGeneration}`);
            if (checkedVariants.length > 0) filterCriteria.push(`Variants: ${checkedVariants.join(', ')}`);
            if (currentCardType) filterCriteria.push(`Card Type: ${this.getCardTypeLabel(currentCardType)}`);
            
            filterStatusDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="fas fa-filter me-2"></i>
                        <strong>Filtered Results:</strong> ${filteredCards.length} of ${this.savedCards.length} cards
                        <br><small class="text-muted">${filterCriteria.join(' | ')}</small>
                    </div>
                    <button class="btn btn-outline-info btn-sm" onclick="cardCreator.clearFilter()">
                        <i class="fas fa-times me-1"></i>Clear Filter
                    </button>
                </div>
            `;
            savedCardsList.appendChild(filterStatusDiv);
        }

        // Show message if no cards match the filter
        if (filteredCards.length === 0) {
            if (this.filterByDetails && (currentBrand || currentModel || currentGeneration || checkedVariants.length > 0 || currentCardType)) {
                savedCardsList.innerHTML += '<p class="text-muted">No cards match the current filter criteria.</p>';
            } else {
                savedCardsList.innerHTML = '<p class="text-muted">No cards saved yet.</p>';
            }
            return;
        }

        // Render filtered cards
        filteredCards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'saved-card-item mb-3 p-3 border rounded d-flex justify-content-between align-items-center';
            
            // Format price display - only show for card types that have price fields
            let priceDisplay = '';
            const cardType = card.cardType || card.type;
            const hasPriceField = ['product-options', 'cargo-options', 'weather-protection'].includes(cardType);
            
            if (hasPriceField) {
                if (card.price) {
                    if (card.price.toLowerCase() === 'tbc') {
                        priceDisplay = '<span class="badge bg-warning text-dark me-2">TBC</span>';
                    } else if (card.price.trim() === '') {
                        priceDisplay = '<span class="badge bg-success me-2">No Extra Cost</span>';
                    } else {
                        priceDisplay = `<span class="badge bg-info me-2">£${card.price}</span>`;
                    }
                } else {
                    priceDisplay = '<span class="badge bg-success me-2">No Extra Cost</span>';
                }
            }
            // For feature cards and spec table cards, don't show any price badge
            
            cardDiv.innerHTML = `
                <div>
                    <span class="badge bg-primary card-type-badge me-2">${this.getCardTypeLabel(card.cardType || card.type)}</span>
                    <strong>${card.title || '(Untitled Card)'}</strong>
                    ${priceDisplay}<br>
                    <span class="text-muted">Configuration:</span> ${card.configuration ? `${card.configuration.brand} - ${card.configuration.model} - ${card.configuration.generation}` : ''}<br>
                    <span class="text-muted">Variants:</span> ${card.configuration && card.configuration.variants ? card.configuration.variants.map(v => typeof v === 'object' ? v.name + (v.sku ? ` (${v.sku})` : '') : v).join(', ') : ''}
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-primary btn-sm" title="Edit" onclick="cardCreator.handleSavedCardAction('${card.id}', 'edit')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-success btn-sm" title="Duplicate" onclick="cardCreator.handleSavedCardAction('${card.id}', 'duplicate')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" title="Delete" onclick="cardCreator.handleSavedCardAction('${card.id}', 'delete')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            savedCardsList.appendChild(cardDiv);
        });
    }

    handleSavedCardAction(eOrId, action) {
        let cardId, actionType;
        if (typeof eOrId === 'object' && eOrId !== null && eOrId.target) {
            // Called as an event handler
            const btn = eOrId.target.closest('button[data-card-id]');
            cardId = btn ? btn.getAttribute('data-card-id') : null;
            actionType = btn ? btn.getAttribute('data-action') : null;
        } else {
            // Called directly with cardId and action
            cardId = eOrId;
            actionType = action;
        }
        if (!cardId) return;
        const card = this.savedCards.find(c => String(c.id) === String(cardId));
        if (!card) return;
        if (actionType === 'edit') {
            this.handleEditClick(cardId);
        } else if (actionType === 'duplicate') {
            this.duplicateCard(card);
        } else if (actionType === 'delete') {
            this.handleDeleteClick(cardId);
        }
    }

    async handleDeleteClick(cardId) {
        if (!confirm('Are you sure you want to delete this card?')) return;

        // Find the card to get its filename
        const cardToDelete = this.savedCards.find(card => String(card.id) === String(cardId));
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
            
            // Clear import tracking to ensure fresh import detection
            if (window.clearImportTracking) {
                window.clearImportTracking();
            }
            
            this.loadSavedCards(); // Refresh the list
        } catch (error) {
            console.error('Error deleting card:', error);
            showToast(error.message, 'danger');
        }
    }

    async handleCardAction(cardId, action) {
        console.log(`[handleCardAction] Called with cardId: ${cardId}, action: ${action}`);
        
        // Convert all IDs to strings and remove any decimal points and following digits
        const sanitizeId = (id) => String(id).split('.')[0].replace(/\D/g, '');
        const targetId = sanitizeId(cardId);
        
        // Try to find the card by comparing sanitized IDs
        let card = this.savedCards.find(card => {
            const currentId = sanitizeId(card.id);
            console.log(`[handleCardAction] Comparing ${currentId} with ${targetId}`);
            return currentId === targetId;
        });
        
        if (!card) {
            console.error(`[handleCardAction] Card not found: ${cardId}`);
            console.log(`[handleCardAction] Available card IDs:`, this.savedCards.map(c => c.id));
            showToast(`Card with ID ${cardId} not found. The card may have been deleted or not saved properly.`, 'warning');
            return;
        }
        
        if (action === 'edit') {
            await this.handleEditClick(card.id); // Use the found card's ID
        } else if (action === 'duplicate') {
            await this.duplicateCard(card);
        }
    }
    
    async duplicateCard(originalCard) {
        console.log('[duplicateCard] Duplicating card:', originalCard);
        // Deep copy the entire card and configuration
        const duplicatedCard = deepCopy(originalCard);
        duplicatedCard.id = Date.now().toString(); // Generate unique ID as string
        duplicatedCard.title = originalCard.title ? `${originalCard.title} (Copy)` : 'Copy';
        duplicatedCard.filename = null; // Clear filename so it gets a new one when saved
        duplicatedCard.webdavPath = null; // Clear WebDAV path
        duplicatedCard.uploadStatus = 'awaiting-upload'; // Reset upload status
        // Deep copy and rename variants
        if (duplicatedCard.configuration && Array.isArray(duplicatedCard.configuration.variants)) {
            duplicatedCard.configuration.variants = duplicatedCard.configuration.variants.map(variant => {
                if (typeof variant === 'string') {
                    return `${variant} (Copy)`;
                } else if (variant && typeof variant === 'object') {
                    return {
                        ...variant,
                        name: (variant.name ? `${variant.name} (Copy)` : 'Variant (Copy)')
                    };
                }
                return variant;
            });
        }
        // Switch to the correct card type if needed
        const typeMap = {
            'option': 'product-options',
            'spec': 'specification-table'
        };
        const desiredType = typeMap[duplicatedCard.cardType] || duplicatedCard.cardType || duplicatedCard.type;
        if (desiredType && this.selectedCardType !== desiredType) {
            this.selectCardType(desiredType);
        }
        // Populate the form with the duplicated card data (but don't set edit mode)
        this.editingCardId = null; // Clear edit mode for new card
        this.editingCardFilename = null;
        await this.populateForm(duplicatedCard);
        this.updateCancelBtnState();
        // Clear the URL parameter to prevent re-duplication on refresh
        const url = new URL(window.location);
        url.searchParams.delete('duplicate');
        window.history.replaceState({}, '', url);
        showToast('Card duplicated successfully! You can now modify and save the copy.', 'success');
    }
    
    async handleEditClick(cardId) {
        // If we're already editing a card, save it first if there are unsaved changes
        if (this.editingCardId && this.hasUnsavedChanges) {
            console.log('[handleEditClick] Already editing card with unsaved changes, saving first...');
            
            // Create a temporary form submission to save the current card
            const form = document.getElementById('cardForm');
            const formData = new FormData(form);
            const cardData = this.getFormData();
            
            // Auto-assign position for card types that need it
            const positionRequiredTypes = ['feature', 'product-options', 'cargo-options', 'weather-protection'];
            if (positionRequiredTypes.includes(this.selectedCardType) && !cardData.position) {
                const nextPos = this.getNextAvailablePosition(cardData.cardType || this.selectedCardType, cardData.sku);
                if (nextPos) {
                    cardData.position = nextPos;
                }
            }
            
            // For save-before-switch, we'll be more lenient with validation
            // Only validate the most critical fields to prevent completely invalid cards
            const selectedVariants = Array.from(document.querySelectorAll('input[name="variant"]:checked')).map(el => el.value);
            if (selectedVariants.length === 0) {
                showToast('Please select at least one variant before switching cards.', 'warning');
                return;
            }
            
            // Basic validation - only check if we have the minimum required data
            if (this.selectedCardType === 'feature') {
                if (!cardData.title.trim()) {
                    showToast('Title is required for feature cards.', 'warning');
                    return;
                }
            } else if (this.selectedCardType === 'product-options' || this.selectedCardType === 'cargo-options' || this.selectedCardType === 'weather-protection') {
                if (!cardData.title.trim()) {
                    showToast('Title is required for this card type.', 'warning');
                    return;
                }
            } else if (this.selectedCardType === 'specification-table') {
                if (!cardData.htmlContent || !cardData.htmlContent.trim()) {
                    showToast('HTML content is required for specification table cards.', 'warning');
                    return;
                }
            }
            
            // Preserve original card metadata for editing
            if (this.editingCardId && this.editingCardFilename) {
                const originalCard = this.savedCards.find(card => String(card.id) === String(this.editingCardId));
                if (originalCard) {
                    cardData.importedFromHypa = originalCard.importedFromHypa || false;
                    cardData.hypaUpdated = originalCard.hypaUpdated || false;
                    cardData.originalHypaData = originalCard.originalHypaData || {};
                    cardData.validationInfo = originalCard.validationInfo || { hasWarnings: false, warnings: [] };
                    cardData.webdavPath = originalCard.webdavPath || '';
                    cardData.uploadDate = originalCard.uploadDate || '';
                    cardData.uploadMetadata = originalCard.uploadMetadata || {};
                    cardData.savedAt = originalCard.savedAt || new Date().toISOString();
                    
                    if (this.selectedCardType === 'specification-table') {
                        const newContent = document.getElementById('description').value;
                        cardData.htmlContent = newContent;
                        cardData.description = newContent;
                        cardData.content = undefined;
                    } else {
                        if (originalCard.content && !cardData.content) {
                            cardData.content = originalCard.content;
                        }
                        if (originalCard.htmlContent && !cardData.htmlContent) {
                            cardData.htmlContent = originalCard.htmlContent;
                        }
                    }
                    
                    cardData.id = String(this.editingCardId).replace(/\D/g, '') || Date.now().toString();
                    cardData.filename = this.editingCardFilename;
                    cardData.originalFilename = this.editingCardFilename;
                    cardData.lastModified = new Date().toISOString();
                    
                    if (cardData.importedFromHypa) {
                        cardData.hypaUpdated = true;
                        if (cardData.validationInfo) {
                            cardData.validationInfo.hasWarnings = false;
                            cardData.validationInfo.warnings = [];
                        }
                    }
                }
            }
            
            formData.append('cardData', JSON.stringify(cardData));
            
            try {
                console.log('[handleEditClick] Saving current card before switching...');
                const response = await fetch('/api/save-card', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                
                if (result.success) {
                    console.log('[handleEditClick] Current card saved successfully, now switching to new card');
                    showToast('Current card saved. Now switching to edit the selected card.', 'success');
                    
                    // Reload cards from server to get the latest data
                    console.log('[handleEditClick] Reloading cards from server...');
                    await this.loadSavedCards();
                    console.log('[handleEditClick] Cards reloaded, total cards:', this.savedCards.length);
                    
                    // Clear edit state after successful save
                    this.editingCardId = null;
                    this.editingCardFilename = null;
                    this.hasUnsavedChanges = false;
                    this.clearOriginalFormData(); // Clear original form data for change tracking
                    this.updateCancelBtnState();
                    
                    // Continue with editing the new card
                } else {
                    throw new Error(result.error || 'Failed to save current card.');
                }
            } catch (error) {
                console.error('[handleEditClick] Error saving current card:', error);
                showToast('Failed to save current card. Please save manually before switching.', 'danger');
                return;
            }
        } else if (this.hasUnsavedChanges) {
            // Not editing but have unsaved changes (creating new card)
            const confirmed = confirm('You have unsaved changes. Do you want to discard them and edit the selected card?');
            if (!confirmed) {
                console.log('[handleEditClick] User cancelled due to unsaved changes');
                return;
            }
            // User confirmed, clear unsaved changes
            console.log('[handleEditClick] User confirmed, clearing unsaved changes');
            this.hasUnsavedChanges = false;
            this.clearOriginalFormData(); // Clear original form data for change tracking
        }
        
        // Use the same sanitization function as handleCardAction
        const sanitizeId = (id) => String(id).split('.')[0].replace(/\D/g, '');
        const targetId = sanitizeId(cardId);
        
        console.log(`[handleEditClick] Starting edit for cardId: ${cardId}, sanitized: ${targetId}`);
        console.log(`[handleEditClick] Total saved cards: ${this.savedCards.length}`);
        
        // First, try to find the card without filtering to see if it exists
        let cardToEdit = this.savedCards.find(card => {
            const currentId = sanitizeId(card.id);
            const exactMatch = String(card.id) === String(cardId);
            const sanitizedMatch = currentId === targetId;
            console.log(`[handleEditClick] Comparing ${currentId} with ${targetId} (exact: ${exactMatch}, sanitized: ${sanitizedMatch})`);
            return exactMatch || sanitizedMatch;
        });
        
        if (!cardToEdit) {
            console.log(`[handleEditClick] Card not found in savedCards. Available cards:`, this.savedCards.map(c => ({ id: c.id, sanitizedId: sanitizeId(c.id), title: c.title, cardType: c.cardType || c.type })));
            showToast('Could not find card data to edit.', 'warning');
            return;
        }
        
        console.log(`[handleEditClick] Found card to edit:`, cardToEdit);
        
        // Set the correct card type first so the card will be visible in the filtered list
        const cardType = cardToEdit.cardType || cardToEdit.type;
        const typeMap = {
            'option': 'product-options',
            'cargo': 'cargo-options',
            'spec': 'specification-table'
        };
        const desiredType = typeMap[cardType] || cardType;
        
        if (desiredType && this.selectedCardType !== desiredType) {
            console.log(`[handleEditClick] Switching card type from ${this.selectedCardType} to ${desiredType} to make card visible`);
            this.selectCardType(desiredType);
        }
        
        // Now try to find the card again after setting the correct card type
        console.log(`[handleEditClick] Looking for card with targetId: ${targetId} after setting card type`);
        console.log(`[handleEditClick] Current selected card type: ${this.selectedCardType}`);
        console.log(`[handleEditClick] Filter by details: ${this.filterByDetails}`);
        
        if (cardToEdit) {
            console.log('[handleEditClick] Card found, adjusting form selections to match card configuration...');
            
            // Temporarily adjust form selections to match the card being edited
            // This ensures the card will be visible in the filtered list
            if (cardToEdit.configuration) {
                const config = cardToEdit.configuration;
                
                // Set brand, model, generation to match the card
                if (config.brand && document.getElementById('brand').value !== config.brand) {
                    console.log('[handleEditClick] Setting brand to:', config.brand);
                    document.getElementById('brand').value = config.brand;
                    this.populateModelSelect(config.brand);
                }
                
                if (config.model && document.getElementById('model').value !== config.model) {
                    console.log('[handleEditClick] Setting model to:', config.model);
                    document.getElementById('model').value = config.model;
                    this.populateGenerationSelect(config.model);
                }
                
                if (config.generation && document.getElementById('generation').value !== config.generation) {
                    console.log('[handleEditClick] Setting generation to:', config.generation);
                    document.getElementById('generation').value = config.generation;
                    this.populateVariantCheckboxes();
                }
                
                // Set variants to match the card
                if (config.variants && Array.isArray(config.variants)) {
                    console.log('[handleEditClick] Setting variants to:', config.variants);
                    // Clear all variant checkboxes first
                    document.querySelectorAll('input[name="variant"]').forEach(cb => cb.checked = false);
                    
                    // Check the variants that match the card
                    config.variants.forEach(variant => {
                        const variantSku = typeof variant === 'string' ? variant : variant.sku;
                        if (variantSku) {
                            const checkbox = document.querySelector(`input[name="variant"][value="${variantSku}"]`);
                            if (checkbox) {
                                checkbox.checked = true;
                            }
                        }
                    });
                }
            }
            

            
            // Re-render the saved cards list to show the card with updated filters
            this.renderSavedCards();
            
            this.editingCardId = cardToEdit.id; // Set edit mode
            this.editingCardFilename = cardToEdit.filename; // Ensure filename is set
            console.log('[handleEditClick] editingCardId:', this.editingCardId, 'editingCardFilename:', this.editingCardFilename);
            console.log('[handleEditClick] Card found and edit mode set, populating form...');
            await this.populateForm(cardToEdit);
            this.updateCancelBtnState();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast('Editing card. Make your changes and click "Save Card".', 'info');
        } else {
            showToast('Could not find card data to edit.', 'warning');
        }
    }

    // Determine the next free position (1-12) for a given cardType & SKU
    getNextAvailablePosition(cardType, sku) {
        const used = new Set();
        this.savedCards.forEach(card => {
            const type = card.cardType || card.type;
            if (type === cardType && (card.sku === sku || !sku)) {
                if (card.position) {
                    used.add(Number(card.position));
                }
            }
        });
        for (let i = 1; i <= 12; i++) {
            if (!used.has(i)) return i;
        }
        // All positions taken
        console.warn('[getNextAvailablePosition] No free slot for', cardType, sku);
        return null;
    }

    clearFilter() {
        // Clear form selections to show all cards
        document.getElementById('brand').value = '';
        document.getElementById('model').value = '';
        document.getElementById('generation').value = '';
        
        // Clear variant checkboxes
        document.querySelectorAll('input[name="variant"]').forEach(chk => chk.checked = false);
        
        // Clear localStorage selections
        localStorage.removeItem('cardCreatorBrand');
        localStorage.removeItem('cardCreatorModel');
        localStorage.removeItem('cardCreatorGeneration');
        localStorage.removeItem('cardCreatorVariants');
        
        // Reset card type to default
        this.selectCardType('feature');
        
        // Re-render the saved cards list
        this.renderSavedCards();
        
        // Update preview
        this.updatePreview();
        
        showToast('Filter cleared. Showing all cards.', 'info');
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
        cleanupLastUnsavedImage(); // Clean up unsaved image on cancel
        console.log('[cancelEditMode] called. Before clear: editingCardId:', this.editingCardId, 'pendingCardType:', this.pendingCardType);
        this.editingCardId = null;
        this.editingCardFilename = null;
        this.updateCancelBtnState();
        this.justCancelledEdit = true;
        // --- Remember Brand, Model, Generation, and selected Variants ---
        const brand = document.getElementById('brand').value;
        const model = document.getElementById('model').value;
        const generation = document.getElementById('generation').value;
        const checkedVariants = Array.from(document.querySelectorAll('input[name="variant"]:checked')).map(cb => cb.value);
        // Reset the form
        const form = document.getElementById('cardForm');
        if (form) form.reset();
        // Restore remembered fields
        document.getElementById('brand').value = brand;
        this.populateModelSelect(brand);
        document.getElementById('model').value = model;
        this.populateGenerationSelect(model);
        document.getElementById('generation').value = generation;
        this.populateVariantCheckboxes();
        // Restore checked variants
        document.querySelectorAll('input[name="variant"]').forEach(cb => {
            cb.checked = checkedVariants.includes(cb.value);
        });
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
        // Clear change tracking
        this.clearOriginalFormData();
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
    
    // Update the status indicator
    updateStatusIndicator() {
        const statusElement = document.getElementById('cardStatus');
        const quickSaveBtn = document.getElementById('quickSaveBtn');
        
        if (!statusElement) return;
        
        let statusHtml = '';
        
        if (this.editingCardId) {
            // Editing an existing card
            if (this.hasUnsavedChanges) {
                statusHtml = '<span class="badge bg-warning"><i class="fas fa-exclamation-triangle me-1"></i>Changes Unsaved</span>';
                if (quickSaveBtn) {
                    quickSaveBtn.disabled = false;
                    quickSaveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes';
                }
            } else {
                statusHtml = '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Changes Saved</span>';
                if (quickSaveBtn) {
                    quickSaveBtn.disabled = true;
                    quickSaveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Saved';
                }
            }
        } else {
            // Creating a new card
            if (this.hasUnsavedChanges) {
                statusHtml = '<span class="badge bg-warning"><i class="fas fa-exclamation-triangle me-1"></i>Changes Unsaved</span>';
                if (quickSaveBtn) {
                    quickSaveBtn.disabled = false;
                    quickSaveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Card';
                }
            } else {
                statusHtml = '<span class="badge bg-secondary"><i class="fas fa-circle me-1"></i>No Changes</span>';
                if (quickSaveBtn) {
                    quickSaveBtn.disabled = true;
                    quickSaveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save';
                }
            }
        }
        
        statusElement.innerHTML = statusHtml;
    }
    
    // Check if form data has changed
    checkForChanges() {
        // If we're not editing a card, don't track changes
        if (!this.editingCardId) {
            this.hasUnsavedChanges = false;
            this.updateStatusIndicator();
            return;
        }
        
        if (!this.originalFormData) {
            console.log('[checkForChanges] No original form data, setting hasUnsavedChanges to false');
            this.hasUnsavedChanges = false;
            this.updateStatusIndicator();
            return;
        }
        
        const currentData = this.getFormData();
        const hasChanges = JSON.stringify(currentData) !== JSON.stringify(this.originalFormData);
        
        if (hasChanges !== this.hasUnsavedChanges) {
            console.log('[checkForChanges] Change detected:', hasChanges, 'previous state:', this.hasUnsavedChanges);
            this.hasUnsavedChanges = hasChanges;
            this.updateStatusIndicator();
        }
    }
    
    // Store original form data for comparison
    storeOriginalFormData() {
        console.log('[storeOriginalFormData] Storing original form data');
        this.originalFormData = this.getFormData();
        this.hasUnsavedChanges = false;
        this.updateStatusIndicator();
        console.log('[storeOriginalFormData] Original data stored, hasUnsavedChanges set to false');
    }
    
    // Clear original form data
    clearOriginalFormData() {
        console.log('[clearOriginalFormData] Clearing original form data');
        this.originalFormData = null;
        this.hasUnsavedChanges = false;
        this.updateStatusIndicator();
        console.log('[clearOriginalFormData] Original data cleared, hasUnsavedChanges set to false');
    }

    // Add this method for card type label mapping
    getCardTypeLabel(type) {
        const map = {
            'feature': 'Feature Card',
            'product-options': 'Product Options',
            'option': 'Product Options',
            'specification-table': 'Specification Table',
            'spec': 'Specification Table',
            'weather-protection': 'Weather Protection',
            'cargo-options': 'Cargo Options'
        };
        return map[type] || type || 'Unknown';
    }

    // Get all available variants for a given brand/model/generation combination
    getAllAvailableVariants(brand, model, generation) {
        if (!brand || !model || !generation) return [];
        

        
        // Find the configuration that matches the current selections
        const config = this.configurations.find(config => 
            config.brand === brand && 
            config.model === model && 
            config.generation === generation
        );
        

        
        if (!config || !config.variants) return [];
        
        // Extract SKUs from variants
        const variants = config.variants.map(variant => {
            if (typeof variant === 'string') {
                return variant;
            } else if (typeof variant === 'object' && variant.sku) {
                return variant.sku;
            }
            return null;
        }).filter(sku => sku !== null);
        

        return variants;
    }
}

// Initialize the card creator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.cardCreator = new CardCreator();
});