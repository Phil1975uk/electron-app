/**
 * Card Manager Application
 * 
 * This script manages the card manager page, including:
 * - Loading and displaying all cards
 * - Filtering cards by type, brand, model, generation, and variants
 * - Card statistics and management
 */

// Cache for image URL validation results
const imageValidationCache = new Map();

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

// Utility function to check if an image URL exists
async function validateImageUrl(imageUrl) {
    if (!imageUrl || imageUrl.trim() === '') {
        return false;
    }
    
    // Check cache first
    if (imageValidationCache.has(imageUrl)) {
        return imageValidationCache.get(imageUrl);
    }
    
    try {
        const response = await fetch(imageUrl, { 
            method: 'HEAD',
            mode: 'no-cors' // This allows checking cross-origin images
        });
        const result = true; // If we get here, the image likely exists
        imageValidationCache.set(imageUrl, result);
        return result;
    } catch (error) {
        // For cross-origin images, we can't use HEAD requests, so we'll try a different approach
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const result = true;
                imageValidationCache.set(imageUrl, result);
                resolve(result);
            };
            img.onerror = () => {
                const result = false;
                imageValidationCache.set(imageUrl, result);
                resolve(result);
            };
            // Add a timeout to prevent hanging
            setTimeout(() => {
                const result = false;
                imageValidationCache.set(imageUrl, result);
                resolve(result);
            }, 5000);
            img.src = imageUrl;
        });
    }
}

// Helper to get the public WebDAV URL from the internal webdavPath
function getPublicWebDavUrl(webdavPath) {
    if (!webdavPath) return '';
    let path = webdavPath.replace(/^\/dav/, '/product_images');
    // Remove any accidental double /product_images/
    path = path.replace(/\/product_images\/product_images\//, '/product_images/');
    // Remove any duplicate slashes (except after https:)
    path = path.replace(/([^:])\/+/, '$1/');
    return 'https://store-c8jhcan2jv.mybigcommerce.com' + path;
}

// Helper to check if an image exists using a hidden <img> (CORS-safe)
function checkImageExists(url, callback) {
    const img = new window.Image();
    img.onload = () => callback(true);
    img.onerror = () => callback(false);
    img.src = url + '?cb=' + Date.now(); // cache-busting query param
}

// Utility to get correct image src for cards
function getImageSrc(url, card = null) {
    if (!url) return '';
    
    // If card has been uploaded to WebDAV, use the WebDAV URL
    if (card && card.webdavPath) {
        return getPublicWebDavUrl(card.webdavPath);
    }
    
    // Remove 'renderer/' prefix if present
    if (url.startsWith('renderer/')) url = url.replace(/^renderer\//, '').replace(/^renderer\//, '');
    if (url.startsWith('cards/images/')) return '/' + url.replace(/^\//, '');
    if (url.startsWith('data:')) return url;
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

class CardManager {
    constructor() {
        this.allCards = [];
        this.filteredCards = [];
        this.configurations = [];
        this.filters = {
            cardType: '',
            uploadStatus: '',
            hypaImport: '',
            brand: '',
            model: '',
            generation: '',
            variants: '',
            selectedVariants: [],
            sku: ''
        };
        this.undoState = null;
        this.isUiEnabled = false; // New flag to track if we're in a UI context
    }

    async init() {
        console.log('Card Manager initializing...');
        
        try {
            await this.loadConfigurations();
        } catch (error) {
            console.warn('Configurations failed to load, continuing without them:', error);
        }
        
        try {
            await this.loadCards();
        } catch (error) {
            console.error('Failed to load cards:', error);
            // Show error in the cards list area
            const cardsList = document.getElementById('cardsList');
            if (cardsList) {
                cardsList.innerHTML = `
                    <div class="alert alert-danger">
                        <h5><i class="fas fa-exclamation-triangle me-2"></i>Failed to Load Cards</h5>
                        <p>Error: ${error.message}</p>
                        <button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
                    </div>
                `;
            }
            return;
        }

        // Check if we're in a UI context by looking for key elements
        this.isUiEnabled = !!document.getElementById('filterCardType');
        
        if (this.isUiEnabled) {
            console.log('Setting up event listeners...');
            this.setupEventListeners();
            
            console.log('Populating filter options...');
            this.populateFilterOptions();
            
            console.log('Updating stats...');
            this.updateStats();
            
            console.log('Rendering cards...');
            this.renderCards();
            
            this.setupUndoButtonListener();
        }
        
        console.log('Card Manager initialization complete!');
    }

    async loadConfigurations() {
        try {
            console.log('Loading configurations...');
            const response = await fetch('/api/configurations');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this.configurations = Array.isArray(data) ? data : (data.configurations || []);
            console.log('Configurations loaded:', this.configurations.length);
            if (window.debugLogEnabled && window.electronAPI && window.electronAPI.logDebugInfo) {
                window.electronAPI.logDebugInfo({
                    message: 'CardManager: Configurations fetch success',
                    data: { count: this.configurations.length },
                    timestamp: new Date().toISOString(),
                    page: 'card-manager'
                });
            }
        } catch (error) {
            console.error('Error loading configurations:', error);
            showToast('Failed to load bike configurations.', 'danger');
            if (window.debugLogEnabled && window.electronAPI && window.electronAPI.logDebugInfo) {
                window.electronAPI.logDebugInfo({
                    message: 'CardManager: Error loading configurations',
                    data: { error: error.message, stack: error.stack },
                    timestamp: new Date().toISOString(),
                    page: 'card-manager'
                });
            }
            throw error; // Re-throw to be caught by init()
        }
    }

    async loadCards() {
        try {
            console.log('Loading cards...');
            // Always fetch from server, never use localStorage
            const response = await fetch('/api/load-cards');
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response error:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            
            let cardsData = await response.json();
            console.log('Loaded cards from server:', cardsData);
            console.log('Cards data type:', typeof cardsData);
            console.log('Cards data length:', cardsData ? cardsData.length : 'null/undefined');
            
            // Ensure it's an array
            if (!Array.isArray(cardsData)) {
                console.warn('Cards data is not an array, converting to empty array');
                cardsData = [];
            }
            
            // Sanitize legacy IDs that may contain non-digit characters (e.g. dots)
            this.allCards = cardsData.map(card => {
                if (card && card.id != null) {
                    const cleanId = String(card.id).replace(/\D/g, '');
                    if (cleanId !== String(card.id) && cleanId !== '') {
                        card.id = cleanId;
                    }
                }
                return card;
            });
            this.filteredCards = [...this.allCards];
            this.populateVariantFilter();
            console.log('Cards loaded successfully:', this.allCards.length);
            if (window.debugLogEnabled && window.electronAPI && window.electronAPI.logDebugInfo) {
                window.electronAPI.logDebugInfo({
                    message: 'CardManager: Cards loaded successfully',
                    data: { count: this.allCards.length },
                    timestamp: new Date().toISOString(),
                    page: 'card-manager'
                });
            }
        } catch (error) {
            console.error('Error loading cards:', error);
            showToast('Failed to load cards. Please refresh the page.', 'danger');
            if (window.debugLogEnabled && window.electronAPI && window.electronAPI.logDebugInfo) {
                window.electronAPI.logDebugInfo({
                    message: 'CardManager: Error loading cards',
                    data: { error: error.message, stack: error.stack },
                    timestamp: new Date().toISOString(),
                    page: 'card-manager'
                });
            }
            throw error; // Re-throw to be caught by init()
        }
    }

    setupEventListeners() {
        if (!this.isUiEnabled) return;
        
        // Card Type filter
        const filterCardType = document.getElementById('filterCardType');
        if (filterCardType) {
            filterCardType.addEventListener('change', (e) => {
                this.filters.cardType = e.target.value;
                this.applyFilters();
            });
        }
        
        // Upload Status filter
        const filterUploadStatus = document.getElementById('filterUploadStatus');
        if (filterUploadStatus) {
            filterUploadStatus.addEventListener('change', (e) => {
                this.filters.uploadStatus = e.target.value;
                this.applyFilters();
            });
        }
        
        // Hypa Import filter
        document.getElementById('filterHypaImport').addEventListener('change', (e) => {
            this.filters.hypaImport = e.target.value;
            this.applyFilters();
        });
        // Brand filter
        document.getElementById('filterBrand').addEventListener('change', (e) => {
            this.filters.brand = e.target.value;
            this.populateModelFilter();
            this.populateGenerationFilter();
            this.populateVariantFilter();
            // Auto-select generation if only one is available
            const generationSelect = document.getElementById('filterGeneration');
            if (generationSelect.options.length === 2) {
                generationSelect.selectedIndex = 1;
                this.filters.generation = generationSelect.options[1].value;
                this.populateVariantFilter();
            }
            this.applyFilters();
        });
        // Model filter
        document.getElementById('filterModel').addEventListener('change', (e) => {
            this.filters.model = e.target.value;
            this.populateGenerationFilter();
            this.populateVariantFilter();
            // Auto-select generation if only one is available
            const generationSelect = document.getElementById('filterGeneration');
            if (generationSelect.options.length === 2) {
                generationSelect.selectedIndex = 1;
                this.filters.generation = generationSelect.options[1].value;
                this.populateVariantFilter();
            }
            this.applyFilters();
        });
        // Generation filter
        document.getElementById('filterGeneration').addEventListener('change', (e) => {
            this.filters.generation = e.target.value;
            this.populateVariantFilter();
            this.applyFilters();
        });
        // Variants filter (dropdown)
        document.getElementById('filterVariants').addEventListener('change', (e) => {
            this.filters.variants = e.target.value;
            this.toggleVariantCheckboxes();
            this.applyFilters();
        });
        // SKU filter
        document.getElementById('filterSku').addEventListener('input', (e) => {
            this.filters.sku = e.target.value;
            this.applyFilters();
        });
        // Clear filters button
        document.getElementById('clearFilters').addEventListener('click', () => this.clearAllFilters());
        // Refresh cards button
        document.getElementById('refreshCardsBtn').addEventListener('click', () => this.refreshCards());
        // Action buttons
        document.getElementById('resetImageStatusBtn').addEventListener('click', () => this.resetImageStatus());
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('clearDataModal'));
            modal.show();
        });
        document.getElementById('clearCacheBtn').addEventListener('click', () => this.clearImageCache());
        document.getElementById('uploadImagesBtn').addEventListener('click', () => this.uploadFilteredImages());
        // Clear data modal buttons
        document.getElementById('deleteAllCardsBtn').addEventListener('click', () => this.deleteAllCards());
        document.getElementById('deleteAllDataBtn').addEventListener('click', () => this.deleteAllData());
        // Variant checkbox event listeners
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.name === 'variantFilter') {
                this.updateSelectedVariants();
                this.applyFilters();
            }
        });
    }

    populateFilterOptions() {
        this.populateBrandFilter();
        this.populateModelFilter();
        this.populateGenerationFilter();
        // Don't populate variant filter initially - it will be populated when generation is selected
    }

    populateBrandFilter() {
        const brandSelect = document.getElementById('filterBrand');
        brandSelect.innerHTML = '<option value="">All Brands</option>';
        
        const brands = [...new Set(this.allCards.map(card => card.configuration?.brand).filter(Boolean))];
        brands.forEach(brand => {
            const option = new Option(brand, brand);
            brandSelect.add(option);
        });
    }

    populateModelFilter() {
        const modelSelect = document.getElementById('filterModel');
        modelSelect.innerHTML = '<option value="">All Models</option>';
        
        if (!this.filters.brand) return;
        
        const models = [...new Set(
            this.allCards
                .filter(card => card.configuration?.brand === this.filters.brand)
                .map(card => card.configuration?.model)
                .filter(Boolean)
        )];
        
        models.forEach(model => {
            const option = new Option(model, model);
            modelSelect.add(option);
        });
    }

    populateGenerationFilter() {
        const generationSelect = document.getElementById('filterGeneration');
        generationSelect.innerHTML = '<option value="">All Generations</option>';
        
        if (!this.filters.brand || !this.filters.model) return;
        
        const generations = [...new Set(
            this.allCards
                .filter(card => 
                    card.configuration?.brand === this.filters.brand && 
                    card.configuration?.model === this.filters.model
                )
                .map(card => card.configuration?.generation)
                .filter(Boolean)
        )];
        
        generations.forEach(generation => {
            const option = new Option(generation, generation);
            generationSelect.add(option);
        });
    }

    populateVariantFilter() {
        if (!this.isUiEnabled) return;
        
        const variantSelect = document.getElementById('filterVariants');
        if (!variantSelect) return;
        
        variantSelect.innerHTML = '<option value="">All Variants</option><option value="specific">Specific Variants</option>';
        
        // Only populate checkboxes if we have all required filters
        if (!this.filters.brand || !this.filters.model || !this.filters.generation) {
            const variantCheckboxes = document.getElementById('variantCheckboxes');
            if (variantCheckboxes) {
                variantCheckboxes.innerHTML = '';
                variantCheckboxes.style.display = 'none';
            }
            return;
        }
        
        // Get all variants from cards that match the selected brand, model, and generation
        const matchingCards = this.allCards.filter(card => 
            card.configuration?.brand === this.filters.brand && 
            card.configuration?.model === this.filters.model && 
            card.configuration?.generation === this.filters.generation
        );
        
        console.log('Matching cards for variant filter:', matchingCards);
        
        // Extract all unique variants from these cards
        const allVariants = new Set();
        matchingCards.forEach(card => {
            if (card.configuration?.variants) {
                card.configuration.variants.forEach(variant => {
                    if (typeof variant === 'string') {
                        // Old format: string
                        allVariants.add(variant);
                    } else if (typeof variant === 'object' && variant.name) {
                        // New format: object with name and sku
                        allVariants.add(variant.name);
                    } else {
                        // Fallback for any other format
                        allVariants.add(String(variant));
                    }
                });
            }
        });
        
        console.log('Found variants:', Array.from(allVariants));
        
        // Populate variant checkboxes if there are variants
        if (allVariants.size > 0) {
            this.populateVariantCheckboxes(Array.from(allVariants).sort());
        } else {
            document.getElementById('variantCheckboxes').innerHTML = '<small class="text-muted">No variants found for this configuration.</small>';
            document.getElementById('variantCheckboxes').style.display = 'none';
        }
    }

    populateVariantCheckboxes(variants) {
        if (!this.isUiEnabled) return;
        
        const container = document.getElementById('variantCheckboxes');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (variants.length === 0) {
            container.innerHTML = '<small class="text-muted">No variants available.</small>';
            return;
        }
        
        variants.forEach(variant => {
            const variantId = variant.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
            container.innerHTML += `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" value="${variant}" id="variant-${variantId}">
                    <label class="form-check-label" for="variant-${variantId}">${variant}</label>
                </div>
            `;
        });
        
        console.log('Variant checkboxes HTML:', container.innerHTML);
    }

    toggleVariantCheckboxes() {
        if (!this.isUiEnabled) return;
        
        const container = document.getElementById('variantCheckboxes');
        if (!container) return;
        
        const shouldShow = this.filters.variants === 'specific';
        container.style.display = shouldShow ? 'block' : 'none';
    }

    updateSelectedVariants() {
        if (!this.isUiEnabled) return;
        
        const checkboxes = document.querySelectorAll('#variantCheckboxes input[type="checkbox"]:checked');
        if (!checkboxes) return;
        
        this.filters.selectedVariants = Array.from(checkboxes).map(cb => cb.value);
    }

    applyFilters() {
        // Strict card type mapping: only allow known, valid card types
        // If you add a new card type, update this mapping!
        const cardTypeMap = {
            'feature': ['feature'],
            'product-options': ['product-options'],
            'option': ['option'],
            'specification-table': ['specification-table'],
            'spec': ['spec'],
            'weather-protection': ['weather-protection'],
            'weather': ['weather'],
            'cargo-options': ['cargo-options'],
            'cargo': ['cargo']
        };
        const selectedType = this.filters.cardType;
        const validTypes = cardTypeMap[selectedType] || [selectedType];

        this.filteredCards = this.allCards.filter(card => {
            const cardType = card.cardType || card.type;
            const config = card.configuration || {};
            const variantSkus = config.variantSkus || {};
            
            // Card type filter
            if (selectedType && !validTypes.includes(cardType)) {
                return false;
            }
            
            // Upload status filter
            if (this.filters.uploadStatus) {
                const isUploaded = card.webdavPath && card.uploadDate;
                if (this.filters.uploadStatus === 'uploaded' && !isUploaded) return false;
                if (this.filters.uploadStatus === 'awaiting' && isUploaded) return false;
            }
            
            // Hypa import filter
            if (this.filters.hypaImport) {
                const isImportedFromHypa = card.importedFromHypa === true;
                const isRecentlyUpdated = card.hypaUpdated === true;
                
                if (this.filters.hypaImport === 'imported' && !isImportedFromHypa) return false;
                if (this.filters.hypaImport === 'local' && isImportedFromHypa) return false;
                if (this.filters.hypaImport === 'updated' && !isRecentlyUpdated) return false;
            }
            
            // Brand filter
            if (this.filters.brand && config.brand !== this.filters.brand) {
                return false;
            }
            
            // Model filter
            if (this.filters.model && config.model !== this.filters.model) {
                return false;
            }
            
            // Generation filter
            if (this.filters.generation && config.generation !== this.filters.generation) {
                return false;
            }
            
            // Variant filter
            if (this.filters.variants === 'specific' && this.filters.selectedVariants.length > 0) {
                const cardVariants = config.variants || [];
                const hasMatchingVariant = this.filters.selectedVariants.some(selectedVariant => {
                    return cardVariants.some(cardVariant => {
                        if (typeof cardVariant === 'string') {
                            // Old format: string
                            return cardVariant === selectedVariant;
                        } else if (typeof cardVariant === 'object' && cardVariant.name) {
                            // New format: object with name and sku
                            return cardVariant.name === selectedVariant;
                        } else {
                            // Fallback for any other format
                            return String(cardVariant) === selectedVariant;
                        }
                    });
                });
                if (!hasMatchingVariant) return false;
            }
            
            // SKU filter
            if (this.filters.sku) {
                const skuValues = Object.values(variantSkus);
                const hasMatchingSku = skuValues.some(sku => 
                    sku.toLowerCase().includes(this.filters.sku.toLowerCase())
                );
                if (!hasMatchingSku) return false;
            }
            
            return true;
        });
        this.updateStats();
        this.renderCards();
    }

    clearAllFilters() {
        this.filters = {
            cardType: '',
            uploadStatus: '',
            hypaImport: '',
            brand: '',
            model: '',
            generation: '',
            variants: '',
            selectedVariants: [],
            sku: ''
        };
        
        // Reset form elements
        document.getElementById('filterCardType').value = '';
        document.getElementById('filterUploadStatus').value = '';
        document.getElementById('filterHypaImport').value = '';
        document.getElementById('filterBrand').value = '';
        document.getElementById('filterModel').value = '';
        document.getElementById('filterGeneration').value = '';
        document.getElementById('filterVariants').value = '';
        document.getElementById('filterSku').value = '';
        document.getElementById('variantCheckboxes').style.display = 'none';
        document.getElementById('variantCheckboxes').innerHTML = '';
        this.populateVariantFilter();
        // Reset filtered cards
        this.filteredCards = [...this.allCards];
        this.updateStats();
        this.renderCards();
    }

    updateStats() {
        if (!this.isUiEnabled) return;
        
        const statsElement = document.getElementById('cardStats');
        if (!statsElement) return;
        
        const totalCards = this.allCards.length;
        const filteredCards = this.filteredCards.length;
        
        // Calculate upload statistics
        const uploadedImages = this.allCards.filter(card => 
            card.imageUrl && card.webdavPath && card.uploadDate
        ).length;
        const awaitingUpload = this.allCards.filter(card => 
            card.imageUrl && (!card.webdavPath || !card.uploadDate)
        ).length;
        
        // Calculate Hypa import statistics
        const hypaImportedCards = this.allCards.filter(card => 
            card.importedFromHypa === true
        ).length;
        const recentlyUpdatedCards = this.allCards.filter(card => 
            card.hypaUpdated === true
        ).length;
        
        // Update the DOM elements
        statsElement.innerHTML = `
            <strong>Total Cards:</strong> ${totalCards}<br>
            <strong>Filtered Cards:</strong> ${filteredCards}<br>
            <strong>Uploaded Images:</strong> ${uploadedImages}<br>
            <strong>Awaiting Upload:</strong> ${awaitingUpload}<br>
            <strong>Hypa Imported Cards:</strong> ${hypaImportedCards}<br>
            <strong>Recently Updated Cards:</strong> ${recentlyUpdatedCards}
        `;
    }

    renderCards() {
        if (!this.isUiEnabled) return;
        
        const container = document.getElementById('cardsList');
        if (!container) {
            console.error('Cards container not found! Looking for element with id="cardsList"');
            return;
        }
        
        if (this.filteredCards.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h4 class="text-muted">No cards found</h4>
                    <p class="text-muted">Try adjusting your filters or create a new card.</p>
                    <button class="btn btn-primary" onclick="window.location.href='card-creator.html'">
                        <i class="fas fa-plus me-2"></i>Create New Card
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.filteredCards.map(card => this.renderCardItem(card)).join('');
    }

    renderCardItem(card) {
        const config = card.configuration || {};
        const variants = config.variants || [];
        const variantSkus = config.variantSkus || {};
        
        // Create variant tags with SKU information
        const variantTags = variants.map(variant => {
            let variantName, sku;
            
            if (typeof variant === 'string') {
                // Old format: string
                variantName = variant;
                sku = variantSkus[variant] || '';
            } else if (typeof variant === 'object' && variant.name) {
                // New format: object with name and sku
                variantName = variant.name;
                sku = variant.sku || '';
            } else {
                // Fallback for any other format
                variantName = String(variant);
                sku = '';
            }
            
            if (sku) {
                return `<span class="variant-tag" title="SKU: ${sku}">${variantName} <small class="text-muted">(${sku})</small></span>`;
            } else {
                return `<span class="variant-tag">${variantName}</span>`;
            }
        }).join('');
        
        const cardTypeColors = {
            'feature': 'primary',
            'product-options': 'success',
            'option': 'success',
            'specification-table': 'info',
            'spec': 'info',
            'weather-protection': 'warning',
            'weather': 'warning',
            'cargo-options': 'secondary',
            'cargo': 'secondary'
        };
        
        // Handle both cardType and type for backward compatibility
        const cardType = card.cardType || card.type || 'unknown';
        const typeColor = cardTypeColors[cardType] || 'secondary';
        
        // Unified display names for card types
        const typeDisplayNames = {
            'feature': 'Feature Card',
            'product-options': 'Product Options',
            'option': 'Product Options',
            'specification-table': 'Specification Table',
            'spec': 'Specification Table',
            'weather-protection': 'Weather Protection',
            'weather': 'Weather Protection',
            'cargo-options': 'Cargo Options',
            'cargo': 'Cargo Options'
        };
        const typeLabel = typeDisplayNames[cardType] || cardType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        // Check upload status
        const isUploaded = card.webdavPath && card.uploadDate;
        let uploadStatus = isUploaded ? 'Uploaded' : 'Not Uploaded';
        let statusColor = isUploaded ? 'success' : 'warning';
        let statusIcon = isUploaded ? 'fa-check-circle' : 'fa-clock';
        let statusId = `upload-status-${card.id}`;

        // WebDAV existence check (async, UI only, CORS-safe)
        if (card.webdavPath) {
            const publicUrl = getPublicWebDavUrl(card.webdavPath);
            setTimeout(() => {
                const badge = document.getElementById(statusId);
                if (badge) {
                    badge.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Checking...';
                    badge.className = 'badge bg-secondary';
                }
                checkImageExists(publicUrl, exists => {
                    if (badge) {
                        if (exists) {
                            badge.innerHTML = '<i class="fas fa-check-circle me-1"></i>Uploaded';
                            badge.className = 'badge bg-success';
                        } else {
                            badge.innerHTML = '<i class="fas fa-clock me-1"></i>Not Uploaded';
                            badge.className = 'badge bg-warning';
                        }
                    }
                });
            }, 0);
        }

        // Use getImageSrc function to handle local and external images properly
        const imageSrc = getImageSrc(card.imageUrl, card);
        
        // Build media preview section (image or mini spec table)
        let mediaPreviewHtml;
        if (cardType === 'spec' || cardType === 'specification-table') {
            // Extract raw HTML content
            const rawContent = (card.htmlContent || card.content || card.description || '').trim();
            // Try to capture the first complete <table> and then the first row only for brevity
            let tableMatch = rawContent.match(/<table[\s\S]*?<\/table>/i);
            let tablePreview = '';
            if (tableMatch) {
                // Extract the first row for compactness
                const firstRowMatch = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/i);
                if (firstRowMatch) {
                    tablePreview = `<table class="table table-sm mb-0">${firstRowMatch[0]}</table>`;
                }
            }
            if (!tablePreview) {
                // Fallback: use plain-text snippet if no proper table found
                const textSnippet = rawContent.replace(/<[^>]+>/g, '').substring(0, 80);
                tablePreview = `<div>${textSnippet}${rawContent.length > 80 ? '…' : ''}</div>`;
            }
            mediaPreviewHtml = `<div class="spec-preview card-preview d-flex align-items-center justify-content-center" style="width:100%; height:120px; overflow:hidden; background:#ffffff; border:1px solid #dee2e6; padding:4px; font-size:10px; line-height:1.2;">${tablePreview}</div>`;
        } else {
            mediaPreviewHtml = `<img src="${imageSrc}" alt="${card.title}" class="card-preview" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhmOWZhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; this.onerror=null;">`;
        }
        
        // Check upload status and create upload button
        let uploadButtonHtml = '';
        if (isUploaded) {
            uploadButtonHtml = `
                <button class="btn btn-outline-primary btn-sm" onclick="cardManager.handleUploadClick('${card.id}', true)">
                    <i class="fas fa-sync-alt me-1"></i>Update Image
                </button>
            `;
        } else {
            uploadButtonHtml = `
                <button class="btn btn-outline-warning btn-sm" onclick="cardManager.handleUploadClick('${card.id}', false)">
                    <i class="fas fa-upload me-1"></i>Upload Image
                </button>
            `;
        }
        
        // After the upload status and before the action buttons, show metadata if present
        let metadataHtml = '';
        if (card.uploadMetadata && Object.keys(card.uploadMetadata).length > 0) {
            metadataHtml = `<div class="mb-2"><small class="text-info">Metadata: <ul style='margin-bottom:0;'>${Object.entries(card.uploadMetadata).map(([k,v]) => `<li><b>${k}</b>: ${v}</li>`).join('')}</ul></small></div>`;
        }
        
        // Create SKU display section for new format variants
        let skuDisplayHtml = '';
        if (variants.length > 0 && typeof variants[0] === 'object' && variants[0].sku) {
            const skuEntries = variants
                .filter(v => typeof v === 'object' && v.name && v.sku)
                .map(v => `<span class="badge bg-info me-1">${v.name}: ${v.sku}</span>`);
            
            if (skuEntries.length > 0) {
                skuDisplayHtml = `
                    <div class="mb-2">
                        <small class="text-info">
                            <i class="fas fa-barcode me-1"></i><strong>SKUs:</strong>
                            ${skuEntries.join('')}
                        </small>
                    </div>
                `;
            }
        } else if (Object.keys(variantSkus).length > 0) {
            // Old format SKU display
            skuDisplayHtml = `
                <div class="mb-2">
                    <small class="text-info">
                        <i class="fas fa-barcode me-1"></i><strong>SKUs:</strong>
                        ${Object.entries(variantSkus).map(([variant, sku]) => 
                            `<span class="badge bg-info me-1">${variant}: ${sku}</span>`
                        ).join('')}
                    </small>
                </div>
            `;
        }
        
        let displayTitle = card.title || '';
        if (card.cardType === 'spec' || card.cardType === 'specification-table') {
            // Try to extract the h2 title from the HTML content
            const contentToCheck = card.content || card.htmlContent || card.description || '';
            if (contentToCheck) {
                const h2Match = contentToCheck.match(/<h2[^>]*>([^<]+)<\/h2>/);
                if (h2Match && h2Match[1]) {
                    displayTitle = h2Match[1].trim();
                }
            }
            if (!displayTitle) {
                displayTitle = card.title || `Specifications for ${card.sku}`;
            }
        }
        
        return `
            <div class="card-item">
                <div class="row">
                    <div class="col-md-2">
                        <div class="position-relative">
                            ${mediaPreviewHtml}
                            <div class="position-absolute top-0 start-0 m-1">
                                <span class="badge bg-${statusColor}" id="${statusId}">
                                    <i class="fas ${statusIcon} me-1"></i>${uploadStatus}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-7" style="max-height: 300px; overflow: hidden;">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="mb-1">${displayTitle}</h5>
                            <div class="d-flex gap-1">
                                <span class="badge bg-${typeColor} card-type-badge">${typeLabel}</span>
                                ${card.importedFromHypa ? '<span class="badge bg-info"><i class="fas fa-download me-1"></i>Hypa Import</span>' : ''}
                                ${card.hypaUpdated ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Updated</span>' : ''}
                            </div>
                        </div>
                        ${cardType === 'option' && card.price ? `<p class="text-success mb-2"><strong>${card.price}</strong></p>` : ''}
                        ${cardType !== 'option' && cardType !== 'spec' && cardType !== 'specification-table' && card.subtitle ? `<p class="text-muted mb-2">${card.subtitle}</p>` : ''}
                        ${(cardType === 'spec' || cardType === 'specification-table') ? 
                            `<p class="mb-2"><small class="text-muted">HTML Content: ${(card.htmlContent || card.description || '').substring(0, 100)}${(card.htmlContent || card.description || '').length > 100 ? '...' : ''}</small></p>` : 
                            card.description ? `<p class="mb-2">${card.description.substring(0, 150)}${card.description.length > 150 ? '...' : ''}</p>` : ''
                        }
                        <div class="mb-2">
                            <small class="text-muted">
                                <strong>${config.brand || 'Unknown'}</strong> 
                                ${config.model ? `• ${config.model}` : ''} 
                                ${config.generation ? `• ${config.generation}` : ''}
                            </small>
                        </div>
                        ${variantTags ? `<div class="mb-2">${variantTags}</div>` : ''}
                        ${skuDisplayHtml}
                        
                        <!-- Hypa Import Information - Compact -->
                        ${card.importedFromHypa ? `
                            <div class="mb-1">
                                <small class="text-info">
                                    <i class="fas fa-download me-1"></i>Hypa Import
                                    ${card.originalHypaData ? ` • ID: ${card.originalHypaData.productId}` : ''}
                                    ${card.validationInfo && card.validationInfo.hasWarnings ? ` • ${card.validationInfo.warnings.length} warnings` : ''}
                                    ${card.lastModified ? ` • ${new Date(card.lastModified).toLocaleDateString()}` : ''}
                                </small>
                            </div>
                        ` : ''}
                        
                        ${isUploaded ? `
                            <div class="mb-2">
                                <small class="text-success">
                                    <i class="fas fa-link me-1"></i>WebDAV: ${card.webdavPath}
                                </small>
                            </div>
                            <div class="mb-2">
                                <small class="text-muted">
                                    <i class="fas fa-calendar me-1"></i>Uploaded: ${new Date(card.uploadDate).toLocaleString()}
                                </small>
                            </div>
                        ` : ''}
                        ${metadataHtml}
                    </div>
                    <div class="col-md-3">
                        <div class="d-flex flex-wrap gap-2">
                            <button class="btn btn-outline-primary btn-sm" onclick="cardManager.editCard('${card.id}')">
                                <i class="fas fa-edit me-1"></i>Edit
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="cardManager.deleteCard('${card.id}')">
                                <i class="fas fa-trash me-1"></i>Delete
                            </button>
                            <button class="btn btn-outline-info btn-sm" onclick="cardManager.duplicateCard('${card.id}')">
                                <i class="fas fa-copy me-1"></i>Duplicate
                            </button>
                            ${uploadButtonHtml}
                            <button class="btn btn-outline-success btn-sm" onclick="cardManager.copyCardHtml('${card.id}')" ${!isUploaded ? 'disabled' : ''}>
                                <i class="fas fa-code me-1"></i>Copy HTML
                            </button>
                        </div>
                        <div class="mt-2">
                            <small class="text-muted">
                                Created: ${card.savedAt ? new Date(card.savedAt).toLocaleDateString() : (card.lastModified ? new Date(card.lastModified).toLocaleDateString() : 'Unknown')}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    editCard(cardId) {
        // Navigate to card creator with the card data
        window.location.href = `card-creator.html?edit=${cardId}`;
    }

    async deleteCard(cardId) {
        if (!confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
            return;
        }
        
        // Debug log for ID comparison
        console.log('deleteCard called with cardId:', cardId, 'type:', typeof cardId);
        console.log('All card IDs:', this.allCards.map(card => card.id + ' (type: ' + typeof card.id + ')'));

        // Find the card to delete (compare as strings for robustness)
        const cardToDelete = this.allCards.find(card => String(card.id) === String(cardId));
        if (!cardToDelete) {
            showToast('Could not find card to delete.', 'danger');
            return;
        }
        // Get the filename property (required for backend deletion)
        const filename = cardToDelete.filename;
        if (!filename) {
            showToast('Card file name missing. Cannot delete.', 'danger');
            return;
        }

        try {
            // Call backend API to delete the file
            const response = await fetch(`/api/delete-card/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                const errorMsg = data.error || 'Failed to delete card file.';
                showToast(errorMsg, 'danger');
                return;
            }

            // Store the deleted card for undo
            this.undoState = { ...cardToDelete };
            if (this.undoTimeout) clearTimeout(this.undoTimeout);
            this.showPersistentUndoButton();
            // Remove from local array
            this.allCards = this.allCards.filter(card => String(card.id) !== String(cardId));
            this.filteredCards = this.filteredCards.filter(card => String(card.id) !== String(cardId));

            // Clear import tracking to ensure fresh import detection
            if (window.clearImportTracking) {
                window.clearImportTracking();
            }
            
            // Reload the card list from the server to ensure UI is in sync
            await this.loadCards();
            this.applyFilters();
            this.updateStats();
            this.renderCards();
        } catch (error) {
            console.error('Error deleting card:', error);
            showToast('Failed to delete card', 'danger');
        }
    }

    showPersistentUndoButton() {
        if (!this.isUiEnabled) return;
        
        const undoBtn = document.getElementById('undoDeleteBtn');
        if (!undoBtn) return;
        
        undoBtn.style.display = 'block';
    }

    hidePersistentUndoButton() {
        if (!this.isUiEnabled) return;
        
        const undoBtn = document.getElementById('undoDeleteBtn');
        if (!undoBtn) return;
        
        undoBtn.style.display = 'none';
    }

    async undoDelete() {
        if (!this.undoState) return;
        try {
            // Restore the card by POSTing to the backend
            const response = await fetch('/api/restore-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.undoState)
            });
            if (!response.ok) {
                showToast('Failed to restore card.', 'danger');
                return;
            }
            showToast('Card restored!', 'success');
            this.undoState = null;
            this.hidePersistentUndoButton();
            await this.loadCards();
            this.applyFilters();
            this.updateStats();
            this.renderCards();
        } catch (error) {
            showToast('Failed to restore card: ' + error.message, 'danger');
        }
    }

    // Call this after any card-changing action except delete
    clearUndoState() {
        this.undoState = null;
        this.hidePersistentUndoButton();
    }

    // In init or after DOMContentLoaded
    setupUndoButtonListener() {
        if (!this.isUiEnabled) return;
        
        const undoBtn = document.getElementById('undoDeleteBtn');
        if (!undoBtn) return;
        
        undoBtn.addEventListener('click', () => this.undoDelete());
    }

    duplicateCard(cardId) {
        // Navigate to card creator with the card data for duplication
        window.location.href = `card-creator.html?duplicate=${cardId}`;
    }

    async copyCardHtml(cardId) {
        const card = this.allCards.find(c => String(c.id) === String(cardId));
        if (!card) {
            showToast('Card not found', 'danger');
            return;
        }

        if (!card.webdavPath) {
            showToast('Card must be uploaded to WebDAV before copying HTML', 'warning');
            return;
        }

        // Generate the HTML code with the WebDAV image URL
        const htmlCode = await this.generateCardHtml(card);
        
        // Always show the modal with the HTML code
            this.showHtmlModal(htmlCode);
    }

    async generateCardHtml(card) {
        if (!card) return '';
        
        let imageUrl = '';
        if (card.imageUrl) {
            imageUrl = card.imageUrl;
        } else if (card.webdavPath) {
            imageUrl = getPublicWebDavUrl(card.webdavPath);
        }

        switch (card.cardType || card.type) {
            case 'feature':
                return this.generateFeatureCardHtml(card, imageUrl);
            case 'product-options':
                return this.generateProductOptionsCardHtml(card, imageUrl);
            case 'specification-table':
            case 'spec':
                return this.generateSpecificationTableCardHtml(card);
            case 'weather-protection':
            case 'weather':
                return this.generateWeatherProtectionCardHtml(card, imageUrl);
            case 'cargo-options':
            case 'cargo':
                return this.generateCargoOptionsCardHtml(card, imageUrl);
            default:
                console.warn('Unknown card type:', card.cardType || card.type);
                return '';
        }
    }

    generateFeatureCardHtml(card, imageUrl) {
        const title = card.title || '';
        const subtitle = card.subtitle || '';
        const description = card.description || card.content || '';
        
        return `<!-- Product feature card container -->
<div style="display: flex; align-items: center; gap: 20px; max-width: 1200px; margin: 10px auto 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; flex-wrap: wrap;">
<!-- Text content -->
<div style="flex: 1; min-width: 300px;">
<h2>${title}</h2>
<h3>${subtitle}</h3>
<p>${description}</p>
</div>
<!-- Image -->
<div style="flex: 0 0 auto; max-width: 400px; min-width: 250px;">
</div>
<div class="se-component se-image-container __se__float-"><figure style="width: 400px;">
<img src="${imageUrl}" alt="${title}" style="max-width: 100%; height: auto; display: block; border-radius: 5px; width: 400px;" data-proportion="true" width="400" height="auto" data-size="400px,auto" data-align="" data-index="2" data-file-name="${imageUrl.split('/').pop()}" data-file-size="0" origin-size="1600,1067" data-origin="400px,auto">
</figure>
</div>
<div style="flex: 0 0 auto; max-width: 400px; min-width: 250px;">
</div>
</div>`;
    }

    generateProductOptionsCardHtml(card, imageUrl) {
        const title = card.title || '';
        const price = card.price || '';
        const description = card.description || '';
        const filename = imageUrl ? imageUrl.split('/').pop().split('?')[0] : ''; // Get filename from URL

        // If no valid image URL, generate HTML without image section
        if (!imageUrl || imageUrl.trim() === '') {
            return `<!-- Example of another card -->
<div class="swiper-slide">
<div class="card">
<div class="card-info">
<div class="card-title">${title}</div>

<div class="card-description">${description}</div>

<div class="card-price">${price}</div>
<button class="more-info-btn">More Information</button></div>
</div>
</div>`;
        }

        return `<!-- Example of another card -->
<div class="swiper-slide">
<div class="se-component se-image-container __se__float- __se__float-none">
    <figure>
      <img src="${imageUrl}" alt="${title}" data-proportion="true" data-align="none" data-file-name="${filename}" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto" data-index="0">
    </figure>
</div>

<div class="card">
<div class="card-info">
<div class="card-title">${title}</div>

<div class="card-description">${description}</div>

<div class="card-price">${price}</div>
<button class="more-info-btn">More Information</button></div>
</div>
</div>`;
    }

    generateSpecificationTableCardHtml(card) {
        // For specification table cards, return the HTML content exactly as pasted
        const htmlContent = card.htmlContent || card.description || '';
        
        if (!htmlContent.trim()) {
            return '<!-- No HTML content provided for specification table -->';
        }
        
        // Return the HTML content exactly as provided, no modifications
        return htmlContent;
    }

    generateWeatherProtectionCardHtml(card, imageUrl) {
        const title = card.title || '';
        const price = card.price || '';
        const description = card.description || '';
        const filename = imageUrl ? imageUrl.split('/').pop().split('?')[0] : ''; // Get filename from URL
        
        // If no valid image URL, generate HTML without image section
        if (!imageUrl || imageUrl.trim() === '') {
            return `<!-- Product feature card container -->
<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>${title}</h2>

<h3>${price}</h3>

<p>${description}</p>
    </div>
</div>`;
        }
        
        return `<!-- Product feature card container -->
<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>${title}</h2>

<h3>${price}</h3>

<p>${description}</p>
    </div>

<!-- Image -->
<div class="se-component se-image-container __se__float- __se__float-none">
    <figure>
      <img src="${imageUrl}" alt="${title}" data-proportion="true" data-align="none" data-index="0" data-file-name="${filename}" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto">
    </figure>
</div>
</div>`;
    }

    generateCargoOptionsCardHtml(card, imageUrl) {
        const title = card.title || '';
        const price = card.price || '';
        const description = card.description || '';
        const filename = imageUrl ? imageUrl.split('/').pop().split('?')[0] : ''; // Get filename from URL
        
        // If no valid image URL, generate HTML without image section
        if (!imageUrl || imageUrl.trim() === '') {
            return `<!-- Product feature card container -->
<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>${title}</h2>

<h3>${price}</h3>

<p>${description}</p>
    </div>
</div>`;
        }
        
        return `<!-- Product feature card container -->
<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>${title}</h2>

<h3>${price}</h3>

<p>${description}</p>
    </div>

<!-- Image -->
<div class="se-component se-image-container __se__float- __se__float-none">
    <figure>
      <img src="${imageUrl}" alt="${title}" data-proportion="true" data-align="none" data-index="0" data-file-name="${filename}" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto">
    </figure>
</div>
</div>`;
    }

    showHtmlModal(htmlCode) {
        if (!this.isUiEnabled) return;
        
        const modal = document.getElementById('htmlModal');
        const codeContainer = document.getElementById('htmlCodeContainer');
        if (!modal || !codeContainer) return;
        
        codeContainer.textContent = htmlCode;
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }

    updateUploadStatus(message, type = 'info') {
        if (!this.isUiEnabled) return;
        
        const statusElement = document.getElementById('uploadStatus');
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = `alert alert-${type}`;
        statusElement.style.display = 'block';
    }

    hideUploadStatus() {
        if (!this.isUiEnabled) return;
        
        const statusElement = document.getElementById('uploadStatus');
        if (!statusElement) return;
        
        statusElement.style.display = 'none';
    }

    async handleUploadClick(cardId, isUpdate) {
        if (isUpdate) {
            if (!confirm('Are you sure you want to re-upload and overwrite the existing image?')) {
                return;
            }
        }

        const card = this.allCards.find(c => String(c.id) === String(cardId));
        if (!card) {
            showToast('Card not found for upload.', 'danger');
            return;
        }

        if (!card.imageUrl) {
            showToast('This card has no image URL to upload.', 'warning');
            return;
        }

        this.startUpload([card]);
    }

    uploadFilteredImages() {
        const cardsToUpload = this.filteredCards.filter(card => 
            card.imageUrl && (!card.webdavPath || !card.uploadDate)
        );
        
        if (cardsToUpload.length === 0) {
            showToast('No images to upload. All filtered cards are already uploaded or have no images.', 'info');
            return;
        }
        
        if (!confirm(`Upload ${cardsToUpload.length} images to WebDAV? This will create the folder structure and upload all images.`)) {
            return;
        }
        
        this.startUpload(cardsToUpload);
    }

    async startUpload(cardsToUpload) {
        showCancelButton(); // Show cancel button at start
        const progressDiv = document.getElementById('uploadProgress');
        const statusDiv = document.getElementById('uploadStatus');
        const progressBar = document.querySelector('#uploadProgress .progress');
        const progressBarInner = document.querySelector('#uploadProgress .progress-bar');
        
        progressDiv.style.display = 'block';
        progressBar.style.display = 'block';
        progressDiv.className = 'alert alert-info';
        
        let successCount = 0;
        let errorCount = 0;
        let uploadResults = [];
        
        for (let i = 0; i < cardsToUpload.length; i++) {
            // Cancel logic: abort if user requested cancel
            if (window.cancelOperation) {
                showToast('Upload cancelled by user.', 'warning');
                break;
            }
            const card = cardsToUpload[i];
            const progress = ((i + 1) / cardsToUpload.length) * 100;
            
            statusDiv.innerHTML = `
                <strong>Uploading ${i + 1} of ${cardsToUpload.length}: ${card.title}</strong>
                <br><small>Processing image and adding metadata...</small>
            `;
            progressBarInner.style.width = `${progress}%`;
            progressBarInner.textContent = `${Math.round(progress)}%`;
            
            try {
                const uploadResult = await this.uploadSingleImage(card);
                // Store metadata in card for UI display
                if (uploadResult && uploadResult.metadata) {
                    card.uploadMetadata = uploadResult.metadata;
                    uploadResults.push({ card, metadata: uploadResult.metadata, success: true });
                } else {
                    card.uploadMetadata = null;
                    uploadResults.push({ card, metadata: null, success: true });
                }
                successCount++;
                showToast(`Uploaded: ${card.title}`, 'success');
                
                // Show metadata fields in status bar if present
                if (card.uploadMetadata) {
                    const metadataText = Object.entries(card.uploadMetadata)
                        .map(([k,v]) => `<b>${k}</b>: ${v}`)
                        .join(', ');
                    statusDiv.innerHTML = `
                        <strong>✅ Uploaded ${i + 1} of ${cardsToUpload.length}: ${card.title}</strong>
                        <br><small class="text-success">Metadata: ${metadataText}</small>
                    `;
                } else {
                    statusDiv.innerHTML = `
                        <strong>✅ Uploaded ${i + 1} of ${cardsToUpload.length}: ${card.title}</strong>
                        <br><small class="text-muted">No metadata added</small>
                    `;
                }
            } catch (error) {
                errorCount++;
                card.uploadMetadata = null;
                uploadResults.push({ card, metadata: null, success: false, error: error.message });
                console.error(`Failed to upload ${card.title}:`, error);
                showToast(`Failed to upload: ${card.title}`, 'danger');
                
                statusDiv.innerHTML = `
                    <strong>❌ Failed ${i + 1} of ${cardsToUpload.length}: ${card.title}</strong>
                    <br><small class="text-danger">Error: ${error.message}</small>
                `;
            }
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Final status with detailed results
        let finalMessage = `<strong>Upload complete! ${successCount} successful, ${errorCount} failed.</strong>`;
        
        console.log('Upload results:', uploadResults);
        
        if (successCount > 0) {
            finalMessage += '<br><br><strong>Successfully uploaded:</strong><ul>';
            uploadResults.filter(r => r.success).forEach(result => {
                console.log('Processing successful result:', result);
                
                // Get bike details from configuration
                const config = result.card.configuration || {};
                const model = config.model || 'Unknown Model';
                const generation = config.generation || '';
                const variants = Array.isArray(config.variants) ? config.variants.join(', ') : (config.variants || '');
                
                finalMessage += `<li><strong>${model} ${generation}</strong> (${variants}) - Model: ${model}, Generation: ${generation}, Variants: ${variants}</li>`;
            });
            finalMessage += '</ul>';
        }
        
        if (errorCount > 0) {
            finalMessage += '<br><br><strong>Failed uploads:</strong><ul>';
            uploadResults.filter(r => !r.success).forEach(result => {
                finalMessage += `<li><strong>${result.card.title || 'Unknown'}</strong> - ${result.error}</li>`;
            });
            finalMessage += '</ul>';
        }
        
        // Update status bar
        this.updateUploadStatus(finalMessage, 'success');
        
        // Refresh the UI to show updated upload status
        this.renderCards();
        
        // Hide status after 10 seconds
        setTimeout(() => {
            this.hideUploadStatus();
        }, 10000);
        hideCancelButton(); // Always hide cancel button at end
    }

    async uploadSingleImage(card) {
        const filename = this.generateFilename(card);
        const webdavPath = this.generateWebdavPath(card);
        
        const response = await fetch('/api/bulk-upload-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cardId: card.id,
                imageUrl: card.imageUrl,
                filename: filename,
                webdavPath: webdavPath,
                // Send full card data for metadata writing
                configuration: card.configuration,
                cardType: card.cardType || card.type,
                dimensions: card.dimensions,
                title: card.title
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        
        const result = await response.json();
        
        // Update card with upload status
        if (result.success) {
            card.webdavPath = result.webdavPath;
            card.uploadDate = new Date().toISOString();
            card.uploadMetadata = result.metadata;
            
            // Save the updated card data
            await this.saveCardData(card);
        }
        
        return result;
    }

    async saveCardData(card) {
        try {
            // Find the stored copy of this card and update it
            const cardFile = this.allCards.find(c => String(c.id) === String(card.id));
            if (cardFile) {
                Object.assign(cardFile, card);
                
                // Save the updated cards array
                const response = await fetch('/api/save-cards', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ cards: this.allCards })
                });
                
                if (!response.ok) {
                    console.warn('Failed to save updated card data');
                }
            }
        } catch (error) {
            console.error('Error saving card data:', error);
        }
    }

    generateFilename(card) {
        const config = card.configuration || {};
        const model = config.model || 'unknown';
        const generation = config.generation || 'unknown';
        const cardType = card.cardType || card.type || 'unknown';
        
        // Map card types to their correct names for filenames (same as WebDAV mapping)
        let filenameCardType = cardType;
        switch (cardType) {
            case 'option':
                filenameCardType = 'product-options';
                break;
            case 'weather':
                filenameCardType = 'weather-protection';
                break;
            case 'cargo':
                filenameCardType = 'cargo-options';
                break;
            case 'feature':
            case 'product-options':
            case 'weather-protection':
            case 'cargo-options':
                // These are already correct
                break;
            default:
                // For unknown types, use as-is
                break;
        }
        
        // Convert title to filename-friendly format
        const titleSlug = card.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .trim();
        
        // Get file extension from image URL
        const urlParts = card.imageUrl.split('.');
        const extension = urlParts[urlParts.length - 1].split('?')[0]; // Remove query parameters
        
        return `${model}_${generation}_${filenameCardType}_${titleSlug}.${extension}`;
    }

    generateWebdavPath(card) {
        const config = card.configuration || {};
        const brand = config.brand || 'unknown';
        const model = config.model || 'unknown';
        const generation = config.generation || 'unknown';
        const cardType = card.cardType || card.type || 'unknown';
        
        // Map card types to their correct WebDAV folder names
        let webdavCardType = cardType;
        switch (cardType) {
            case 'option':
                webdavCardType = 'product-options';
                break;
            case 'weather':
                webdavCardType = 'weather-protection';
                break;
            case 'cargo':
                webdavCardType = 'cargo-options';
                break;
            case 'feature':
            case 'product-options':
            case 'weather-protection':
            case 'cargo-options':
                // These are already correct
                break;
            default:
                // For unknown types, use as-is
                break;
        }
        
        // Ensure proper UTF-8 encoding for special characters
        const encodedBrand = encodeURIComponent(brand);
        const encodedModel = encodeURIComponent(model);
        const encodedGeneration = encodeURIComponent(generation);
        const encodedCardType = encodeURIComponent(webdavCardType);
        
        return `/dav/product_images/product_modules/${encodedBrand}/${encodedModel}/${encodedGeneration}/${encodedCardType}/`;
    }

    async resetImageStatus() {
        if (confirm('Are you sure you want to reset the image upload status for all cards? This will mark all cards as "awaiting upload" so you can test the image upload process again.')) {
            try {
                // Reset image status for all cards
                this.allCards.forEach(card => {
                    // Clear only the upload-related properties that determine upload status
                    // Keep imageUrl so the image still displays
                    delete card.webdavPath;
                    delete card.uploadDate;
                    delete card.uploadMetadata;
                    
                    // Clear any other upload-related properties
                    delete card.imageUploaded;
                    delete card.imageUploadDate;
                    delete card.imageUploadStatus;
                    delete card.imageStatus;
                });
                
                // Save the updated cards to both localStorage and server
                await this.saveAllCards();
                
                // Also save to server via API
                try {
                    const response = await fetch('/api/save-cards', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ cards: this.allCards })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server save failed: ${response.status}`);
                    }
                    
                    console.log('Cards saved to server successfully');
                } catch (serverError) {
                    console.warn('Failed to save to server, but localStorage saved:', serverError);
                    showToast('Warning: Changes saved locally but failed to save to server. Changes may not persist on reload.', 'warning');
                }
                
                // Update the display
                this.updateStats();
                this.renderCards();
                
                showToast('Image status reset successfully! All cards are now marked as "awaiting upload".', 'success');
                
                console.log('Image status reset for', this.allCards.length, 'cards');
                
            } catch (error) {
                console.error('Error resetting image status:', error);
                showToast('Error resetting image status: ' + error.message, 'danger');
            }
        }
    }

    async saveAllCards() {
        try {
            // Save all cards to server only - no localStorage
            const response = await fetch('/api/save-all-cards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cards: this.allCards })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                console.log('All cards saved to server successfully');
                showToast('All cards saved successfully!', 'success');
            } else {
                throw new Error(result.error || 'Failed to save cards');
            }
        } catch (error) {
            console.error('Error saving cards:', error);
            showToast('Error saving cards: ' + error.message, 'danger');
            throw error;
        }
    }

    async deleteAllCards() {
        try {
            // Clear server files only - no localStorage
            const response = await fetch('/api/delete-all-cards', { method: 'DELETE' });
            if (response.ok) {
                // Clear import tracking to ensure fresh import detection
                if (window.clearImportTracking) {
                    window.clearImportTracking();
                }
                
                // Clear local arrays
                this.allCards = [];
                this.filteredCards = [];
                
                showToast('All cards deleted successfully', 'success');
                this.updateStats();
                this.renderCards();
            } else {
                showToast('Failed to delete all cards from server.', 'danger');
            }
        } catch (error) {
            console.error('Error deleting all cards:', error);
            showToast('Error deleting all cards: ' + error.message, 'danger');
        }
    }

    async deleteAllData() {
        try {
            const response = await fetch('/api/delete-all-data', { method: 'DELETE' });
            if (response.ok) {
                // Clear import tracking to ensure fresh import detection
                if (window.clearImportTracking) {
                    window.clearImportTracking();
                }
                
                showToast('All data deleted. App will reload...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast('Failed to delete all data.', 'danger');
            }
        } catch (error) {
            showToast('Error deleting all data: ' + error.message, 'danger');
        }
    }

    async clearImageCache() {
        try {
            // Clear the image validation cache
            imageValidationCache.clear();
            
            if (window.electronAPI && window.electronAPI.clearCache) {
                const result = await window.electronAPI.clearCache();
                if (result.success) {
                    showToast('Cache cleared successfully! Refreshing page...', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    showToast('Failed to clear cache: ' + (result.error || 'Unknown error'), 'danger');
                }
            } else {
                showToast('Image validation cache cleared! Refreshing page...', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            showToast('Error clearing cache: ' + error.message, 'danger');
        }
    }

    async refreshCards() {
        try {
            console.log('Refreshing cards from server...');
            
            // Load cards from server only
            const response = await fetch('/api/load-cards');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const serverCards = await response.json();
            console.log('Cards from server:', serverCards.length);
            
            // Update the cards array and UI
            this.allCards = serverCards;
            this.filteredCards = [...this.allCards];
            
            // Update UI
            this.updateStats();
            this.renderCards();
            
            console.log('Cards refreshed successfully. Total cards:', serverCards.length);
            showToast(`Cards refreshed successfully. Total: ${serverCards.length}`, 'success');
        } catch (error) {
            console.error('Error refreshing cards:', error);
            showToast('Error refreshing cards: ' + error.message, 'error');
        }
    }
}

// Initialize the card manager when the page loads
let cardManager;
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing CardManager...');
    cardManager = new CardManager();
    try {
        await cardManager.init();
        console.log('CardManager initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize CardManager:', error);
        showToast('Failed to initialize Card Manager. Please refresh the page.', 'danger');
    }
}); 

// Cancel Operation logic
const cancelBtn = document.getElementById('cancelOperationBtn');
window.cancelOperation = false;
if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        window.cancelOperation = true;
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling...';
    });
}

// Call these when upload/import starts and ends:
function showCancelButton() {
    if (cancelBtn) {
        cancelBtn.style.display = '';
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Cancel Current Operation';
    }
    window.cancelOperation = false;
}
function hideCancelButton() {
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Cancel Current Operation';
    }
    window.cancelOperation = false;
}

// Example: In your bulk upload/import function, call showCancelButton() at the start and hideCancelButton() at the end.
// In your upload loop, check window.cancelOperation and abort if true.
// Example:
// for (let i = 0; i < items.length; i++) {
//     if (window.cancelOperation) {
//         // Clean up, show message, break/return
//         break;
//     }
//     // ... upload logic ...
// }
// hideCancelButton();

// Make CardManager available globally
window.CardManager = CardManager;