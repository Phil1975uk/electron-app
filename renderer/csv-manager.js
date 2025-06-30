// Smart CSV Manager with Auto-Mapping
class SmartCSVManager {
    constructor() {
        this.csvData = null;
        this.mappings = {};
        this.savedMappings = this.loadSavedMappings();
        this.filteredCount = 0;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File input handling
        const fileInput = document.getElementById('csvFileInput');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        const uploadSection = document.getElementById('uploadSection');
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('border-primary');
        });
        uploadSection.addEventListener('dragleave', () => {
            uploadSection.classList.remove('border-primary');
        });
        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('border-primary');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFile(files[0]);
            }
        });

        // Action buttons
        document.getElementById('importBtn').addEventListener('click', () => this.importConfigurations());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('newImportBtn').addEventListener('click', () => this.reset());
        
        // Filter toggle button
        document.getElementById('toggleFilter')?.addEventListener('click', () => {
            const checkbox = document.getElementById('filterFeatures');
            const button = document.getElementById('toggleFilter');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                button.innerHTML = checkbox.checked ? 
                    '<i class="fas fa-eye me-1"></i>Show All Rows' : 
                    '<i class="fas fa-filter me-1"></i>Apply Filter';
                
                // Re-process the file with new filter setting
                if (this.csvData) {
                    this.processFileWithFilter();
                }
            }
        });

        // Export functionality
        this.initializeExportEventListeners();
    }

    initializeExportEventListeners() {
        // Export step navigation
        document.getElementById('previewExportBtn')?.addEventListener('click', () => this.showExportPreview());
        document.getElementById('backToStep1Btn')?.addEventListener('click', () => this.backToExportStep1());
        document.getElementById('exportCsvBtn')?.addEventListener('click', () => this.exportCsv());
        document.getElementById('downloadCsvBtn')?.addEventListener('click', () => this.downloadCsvFile());
        document.getElementById('newExportBtn')?.addEventListener('click', () => this.resetExport());

        // Export selection changes
        document.getElementById('exportModel')?.addEventListener('change', () => this.onExportModelChange());
        document.getElementById('exportGeneration')?.addEventListener('change', () => this.onExportGenerationChange());

        // Load export data when export tab is shown
        document.getElementById('export-tab')?.addEventListener('shown.bs.tab', () => this.loadExportData());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
        try {
            this.showProgress('Reading CSV file...');
            
            const text = await this.readFileAsText(file);
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            
            if (result.errors.length > 0) {
                throw new Error(`CSV parsing errors: ${result.errors.map(e => e.message).join(', ')}`);
            }

            // Store original data and apply filtering
            this.originalData = result.data;
            this.processFileWithFilter();
            
        } catch (error) {
            this.showError(`Error processing file: ${error.message}`);
        }
    }

    processFileWithFilter() {
        if (!this.originalData) return;

        // Debug: Log first few rows to see structure
        console.log('First 3 CSV rows:', this.originalData.slice(0, 3));
        console.log('CSV column names:', Object.keys(this.originalData[0] || {}));
        
        // Check if filtering is enabled
        const filterEnabled = document.getElementById('filterFeatures')?.checked !== false;
        
        if (filterEnabled) {
            // Filter out columns that start with "features."
            const allColumns = Object.keys(this.originalData[0] || {});
            const featuresColumns = allColumns.filter(col => 
                col && typeof col === 'string' && 
                col.toLowerCase().startsWith('features.')
            );
            
            console.log(`Found ${featuresColumns.length} columns starting with "features.":`, featuresColumns);
            
            // Create new data without features columns
            this.csvData = this.originalData.map(row => {
                const newRow = {};
                Object.keys(row).forEach(key => {
                    if (!key.toLowerCase().startsWith('features.')) {
                        newRow[key] = row[key];
                    }
                });
                return newRow;
            });
            
            this.filteredCount = featuresColumns.length;
            console.log(`Filtered out ${this.filteredCount} columns starting with "features."`);
        } else {
            // No filtering - use all data
            this.csvData = this.originalData;
            this.filteredCount = 0;
        }
        
        console.log(`CSV after filtering: ${this.csvData.length} rows, ${Object.keys(this.csvData[0] || {}).length} columns`);
        
        this.autoMapColumns();
        this.showMappingPreview();
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    autoMapColumns() {
        if (!this.csvData || this.csvData.length === 0) return;

        const headers = Object.keys(this.csvData[0]);
        const mappings = {};

        // Smart mapping patterns
        const mappingPatterns = {
            brand: ['brand', 'manufacturer', 'make', 'company', 'vendor'],
            model: ['model', 'product', 'name', 'title', 'product_name'],
            generation: ['generation', 'version', 'series', 'year', 'model_year'],
            variants: ['variants', 'variant', 'options', 'sku', 'product_sku', 'product_id'],
            sku: ['sku', 'product_sku', 'product_id', 'item_number', 'part_number']
        };

        // Try to find exact matches first
        headers.forEach(header => {
            const lowerHeader = header.toLowerCase().trim();
            
            for (const [field, patterns] of Object.entries(mappingPatterns)) {
                if (patterns.some(pattern => lowerHeader.includes(pattern))) {
                    mappings[field] = header;
                    break;
                }
            }
        });

        // If we have saved mappings, try to use them
        if (this.savedMappings && Object.keys(this.savedMappings).length > 0) {
            headers.forEach(header => {
                if (this.savedMappings[header]) {
                    mappings[this.savedMappings[header]] = header;
                }
            });
        }

        // Smart variant detection - look for columns that might contain variant data
        if (!mappings.variants) {
            const variantCandidates = headers.filter(h => 
                h.toLowerCase().includes('variant') || 
                h.toLowerCase().includes('option') ||
                h.toLowerCase().includes('type') ||
                h.toLowerCase().includes('style')
            );
            if (variantCandidates.length > 0) {
                mappings.variants = variantCandidates[0];
            }
        }

        this.mappings = mappings;
    }

    showMappingPreview() {
        const previewSection = document.getElementById('mappingPreview');
        const uploadSection = document.getElementById('uploadSection');
        
        uploadSection.classList.add('d-none');
        previewSection.classList.remove('d-none');

        // Add filtering info to the alert
        const alert = previewSection.querySelector('.alert');
        if (alert) {
            const originalCount = this.originalData.length;
            const filteredCount = this.filteredCount;
            if (filteredCount > 0) {
                alert.innerHTML = `
                    <h6><i class="fas fa-brain me-2"></i>Smart Mapping Detected</h6>
                    <p class="mb-0">Our system automatically mapped your CSV columns. Review and adjust if needed:</p>
                    <small class="text-muted mt-2 d-block">
                        <i class="fas fa-filter me-1"></i>Filtered out ${filteredCount} columns starting with "features." (${originalCount} total columns)
                    </small>
                `;
            } else {
                alert.innerHTML = `
                    <h6><i class="fas fa-brain me-2"></i>Smart Mapping Detected</h6>
                    <p class="mb-0">Our system automatically mapped your CSV columns. Review and adjust if needed:</p>
                `;
            }
        }

        this.displayColumnMappings();
        this.displayImportPreview();
    }

    displayColumnMappings() {
        const headers = Object.keys(this.csvData[0]);
        const csvColumnsList = document.getElementById('csvColumnsList');
        const mappingList = document.getElementById('mappingList');

        if (!csvColumnsList || !mappingList) {
            console.error('Required DOM elements not found');
            return;
        }

        csvColumnsList.innerHTML = '';
        mappingList.innerHTML = '';

        headers.forEach(header => {
            // CSV column
            const csvItem = document.createElement('div');
            csvItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            csvItem.innerHTML = `
                <span><i class="fas fa-columns me-2"></i>${header}</span>
                <small class="text-muted">${this.getColumnSample(header)}</small>
            `;
            csvColumnsList.appendChild(csvItem);

            // Mapping
            const mappingItem = document.createElement('div');
            mappingItem.className = 'list-group-item';
            
            const mappedField = this.getMappedField(header);
            if (mappedField) {
                mappingItem.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-success">${mappedField}</span>
                        <button class="btn btn-sm btn-outline-secondary map-btn" data-header="${header}">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                `;
            } else {
                mappingItem.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-muted">Not mapped</span>
                        <button class="btn btn-sm btn-outline-primary map-btn" data-header="${header}">
                            <i class="fas fa-plus"></i> Map
                        </button>
                    </div>
                `;
            }
            
            // Add event listener to the button
            const mapBtn = mappingItem.querySelector('.map-btn');
            if (mapBtn) {
                mapBtn.addEventListener('click', () => {
                    this.changeMapping(header);
                });
            }
            
            mappingList.appendChild(mappingItem);
        });
    }

    getColumnSample(header) {
        const sample = this.csvData.slice(0, 3).map(row => row[header]).filter(val => val).join(', ');
        return sample.length > 30 ? sample.substring(0, 30) + '...' : sample;
    }

    getMappedField(header) {
        for (const [field, mappedHeader] of Object.entries(this.mappings)) {
            if (mappedHeader === header) {
                return field;
            }
        }
        return null;
    }

    changeMapping(header) {
        const fieldOptions = ['brand', 'model', 'generation', 'variants', 'sku'];
        const currentMapping = this.getMappedField(header);
        
        const options = fieldOptions.map(field => 
            `<option value="${field}" ${currentMapping === field ? 'selected' : ''}>${field}</option>`
        ).join('');

        const select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.innerHTML = `
            <option value="">Not mapped</option>
            ${options}
        `;

        select.addEventListener('change', (e) => {
            const newField = e.target.value;
            if (newField) {
                this.mappings[newField] = header;
            } else {
                // Remove mapping
                for (const [field, mappedHeader] of Object.entries(this.mappings)) {
                    if (mappedHeader === header) {
                        delete this.mappings[field];
                        break;
                    }
                }
            }
            this.displayColumnMappings();
            this.displayImportPreview();
        });

        // Replace the button with the select
        const mappingItem = select.closest('.list-group-item');
        if (mappingItem) {
            mappingItem.innerHTML = '';
            mappingItem.appendChild(select);
        }
    }

    displayImportPreview() {
        const previewHeader = document.getElementById('previewHeader');
        const previewBody = document.getElementById('previewBody');
        const previewCount = document.getElementById('previewCount');

        // Show mapped columns in preview
        const mappedColumns = Object.values(this.mappings).filter(Boolean);
        previewCount.textContent = this.csvData.length;

        // Header
        previewHeader.innerHTML = mappedColumns.map(col => 
            `<th>${col}</th>`
        ).join('');

        // Body (first 5 rows)
        previewBody.innerHTML = this.csvData.slice(0, 5).map(row => 
            `<tr>${mappedColumns.map(col => 
                `<td>${row[col] || ''}</td>`
            ).join('')}</tr>`
        ).join('');
    }

    async importConfigurations() {
        try {
            this.showImportProgress();
            
            const configurations = [];
            const totalRows = this.csvData.length;
            
            for (let i = 0; i < totalRows; i++) {
                const row = this.csvData[i];
                const config = this.createConfigurationFromRow(row);
                
                if (config) {
                    configurations.push(config);
                }
                
                // Update progress
                const progress = ((i + 1) / totalRows) * 100;
                this.updateProgress(progress, `Processing row ${i + 1} of ${totalRows}`);
            }

            // Save configurations
            await this.saveConfigurations(configurations);
            
            // Save mappings for future use
            this.saveMappings();
            
            this.showImportResults(configurations.length, totalRows);
            
        } catch (error) {
            this.showError(`Import failed: ${error.message}`);
        }
    }

    createConfigurationFromRow(row) {
        const brand = row[this.mappings.brand] || '';
        const model = row[this.mappings.model] || '';
        const generation = row[this.mappings.generation] || '';
        const variantsData = row[this.mappings.variants] || '';
        const sku = row[this.mappings.sku] || '';

        if (!brand || !model) {
            return null; // Skip rows without essential data
        }

        // Parse variants
        let variants = [];
        if (variantsData) {
            if (variantsData.includes(',')) {
                // Comma-separated variants
                variants = variantsData.split(',').map(v => v.trim()).filter(v => v);
            } else if (variantsData.includes(';')) {
                // Semicolon-separated variants
                variants = variantsData.split(';').map(v => v.trim()).filter(v => v);
            } else {
                // Single variant
                variants = [variantsData];
            }
        }

        // Create variant objects
        const variantObjects = variants.map((variant, index) => ({
            name: variant,
            sku: sku || `${brand}_${model}_${index + 1}`
        }));

        return {
            brand: brand.trim(),
            model: model.trim(),
            generation: generation.trim(),
            variants: variantObjects,
            id: Date.now() + Math.random()
        };
    }

    async saveConfigurations(newConfigurations) {
        try {
            // Load existing configurations
            const response = await fetch('/api/configurations');
            const existingData = await response.json();
            const existingConfigurations = Array.isArray(existingData) ? existingData : (existingData.configurations || []);

            // Merge with new configurations
            const allConfigurations = [...existingConfigurations, ...newConfigurations];

            // Save back to server
            const saveResponse = await fetch('/api/configurations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(allConfigurations)
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save configurations');
            }

        } catch (error) {
            console.error('Error saving configurations:', error);
            throw error;
        }
    }

    saveMappings() {
        const mappingsToSave = {};
        for (const [field, header] of Object.entries(this.mappings)) {
            mappingsToSave[header] = field;
        }
        
        localStorage.setItem('csvMappings', JSON.stringify(mappingsToSave));
    }

    loadSavedMappings() {
        try {
            const saved = localStorage.getItem('csvMappings');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Error loading saved mappings:', error);
            return {};
        }
    }

    showProgress(message) {
        document.getElementById('progressText').textContent = message;
    }

    showImportProgress() {
        document.getElementById('mappingPreview').classList.add('d-none');
        document.getElementById('importProgress').classList.remove('d-none');
    }

    updateProgress(percentage, message) {
        document.getElementById('progressBar').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = message;
    }

    showImportResults(imported, total) {
        document.getElementById('importProgress').classList.add('d-none');
        document.getElementById('importResults').classList.remove('d-none');
        
        document.getElementById('resultsSummary').innerHTML = `
            <p><strong>${imported}</strong> configurations imported successfully from <strong>${total}</strong> CSV rows.</p>
            <p class="mb-0">Your configurations are now available on the home page.</p>
        `;
    }

    showError(message) {
        // Create a temporary error alert
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show';
        alert.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.querySelector('.card-body').insertBefore(alert, document.querySelector('.card-body').firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    reset() {
        // Reset file input
        document.getElementById('csvFileInput').value = '';
        
        // Reset UI
        document.getElementById('uploadSection').classList.remove('d-none');
        document.getElementById('mappingPreview').classList.add('d-none');
        document.getElementById('importProgress').classList.add('d-none');
        document.getElementById('importResults').classList.add('d-none');
        
        // Reset data
        this.csvData = null;
        this.originalData = null;
        this.mappings = {};
        this.filteredCount = 0;
    }

    // Export functionality
    async loadExportData() {
        try {
            // Load configurations
            const configResponse = await fetch('/api/configurations');
            const configData = await configResponse.json();
            this.configurations = Array.isArray(configData) ? configData : (configData.configurations || []);

            // Load cards
            const cardsResponse = await fetch('/api/load-cards');
            const cardsData = await cardsResponse.json();
            this.cards = Array.isArray(cardsData) ? cardsData : [];

            this.populateExportDropdowns();
        } catch (error) {
            console.error('Error loading export data:', error);
            this.showError('Failed to load export data');
        }
    }

    populateExportDropdowns() {
        // Populate models dropdown
        const modelSelect = document.getElementById('exportModel');
        if (!modelSelect) return;

        const models = [...new Set(this.configurations.map(config => `${config.brand} - ${config.model}`))];
        modelSelect.innerHTML = '<option value="">Select a model...</option>' + 
            models.map(model => `<option value="${model}">${model}</option>`).join('');
    }

    onExportModelChange() {
        const modelSelect = document.getElementById('exportModel');
        const generationSelect = document.getElementById('exportGeneration');
        const variantsDiv = document.getElementById('exportVariants');

        if (!modelSelect || !generationSelect || !variantsDiv) return;

        const selectedModel = modelSelect.value;
        if (!selectedModel) {
            generationSelect.innerHTML = '<option value="">Select a model first</option>';
            variantsDiv.innerHTML = '<div class="text-muted">Select a generation first</div>';
            return;
        }

        // Get generations for selected model
        const [brand, model] = selectedModel.split(' - ');
        const modelConfigs = this.configurations.filter(config => 
            config.brand === brand && config.model === model
        );

        const generations = [...new Set(modelConfigs.map(config => config.generation))];
        generationSelect.innerHTML = '<option value="">Select a generation...</option>' + 
            generations.map(gen => `<option value="${gen}">${gen}</option>`).join('');

        variantsDiv.innerHTML = '<div class="text-muted">Select a generation first</div>';
    }

    onExportGenerationChange() {
        const modelSelect = document.getElementById('exportModel');
        const generationSelect = document.getElementById('exportGeneration');
        const variantsDiv = document.getElementById('exportVariants');

        if (!modelSelect || !generationSelect || !variantsDiv) return;

        const selectedModel = modelSelect.value;
        const selectedGeneration = generationSelect.value;

        if (!selectedModel || !selectedGeneration) {
            variantsDiv.innerHTML = '<div class="text-muted">Select a generation first</div>';
            return;
        }

        // Get variants for selected model and generation
        const [brand, model] = selectedModel.split(' - ');
        const config = this.configurations.find(c => 
            c.brand === brand && c.model === model && c.generation === selectedGeneration
        );

        if (!config || !config.variants) {
            variantsDiv.innerHTML = '<div class="text-muted">No variants found</div>';
            return;
        }

        const variantNames = config.variants.map(v => typeof v === 'string' ? v : v.name);
        variantsDiv.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="exportAllVariants" checked>
                <label class="form-check-label" for="exportAllVariants">
                    <strong>All Variants (${variantNames.length})</strong>
                </label>
            </div>
            <hr class="my-2">
            ${variantNames.map((variant, index) => `
                <div class="form-check">
                    <input class="form-check-input export-variant-checkbox" type="checkbox" 
                           id="exportVariant${index}" value="${variant}" checked>
                    <label class="form-check-label" for="exportVariant${index}">${variant}</label>
                </div>
            `).join('')}
        `;

        // Handle "All Variants" checkbox
        const allVariantsCheckbox = document.getElementById('exportAllVariants');
        const variantCheckboxes = document.querySelectorAll('.export-variant-checkbox');
        
        allVariantsCheckbox?.addEventListener('change', (e) => {
            variantCheckboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
        });

        variantCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const allChecked = Array.from(variantCheckboxes).every(c => c.checked);
                if (allVariantsCheckbox) {
                    allVariantsCheckbox.checked = allChecked;
                }
            });
        });
    }

    showExportPreview() {
        const selectedModel = document.getElementById('exportModel')?.value;
        const selectedGeneration = document.getElementById('exportGeneration')?.value;
        
        if (!selectedModel || !selectedGeneration) {
            this.showError('Please select a model and generation');
            return;
        }

        // Get selected variants
        const allVariantsCheckbox = document.getElementById('exportAllVariants');
        const variantCheckboxes = document.querySelectorAll('.export-variant-checkbox:checked');
        const selectedVariants = allVariantsCheckbox?.checked ? 
            Array.from(document.querySelectorAll('.export-variant-checkbox')).map(cb => cb.value) :
            Array.from(variantCheckboxes).map(cb => cb.value);

        if (selectedVariants.length === 0) {
            this.showError('Please select at least one variant');
            return;
        }

        // Get selected card types
        const cardTypeCheckboxes = document.querySelectorAll('#exportCardTypes input[type="checkbox"]:checked');
        const selectedCardTypes = Array.from(cardTypeCheckboxes).map(cb => cb.value);

        if (selectedCardTypes.length === 0) {
            this.showError('Please select at least one card type');
            return;
        }

        // Filter cards based on selection
        const [brand, model] = selectedModel.split(' - ');
        const filteredCards = this.cards.filter(card => {
            const config = card.configuration;
            return config.brand === brand && 
                   config.model === model && 
                   config.generation === selectedGeneration &&
                   selectedVariants.some(variant => config.variants.includes(variant)) &&
                   selectedCardTypes.includes(card.cardType);
        });

        // Show preview
        this.displayExportPreview(filteredCards, selectedModel, selectedGeneration, selectedVariants, selectedCardTypes);
        
        // Store export data
        this.exportData = {
            cards: filteredCards,
            model: selectedModel,
            generation: selectedGeneration,
            variants: selectedVariants,
            cardTypes: selectedCardTypes
        };

        // Show step 2
        document.getElementById('exportStep1').classList.add('d-none');
        document.getElementById('exportStep2').classList.remove('d-none');
    }

    displayExportPreview(cards, model, generation, variants, cardTypes) {
        const summaryDiv = document.getElementById('exportSummary');
        const headerRow = document.getElementById('exportPreviewHeader');
        const bodyRows = document.getElementById('exportPreviewBody');

        if (!summaryDiv || !headerRow || !bodyRows) return;

        // Summary
        summaryDiv.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Model:</strong> ${model}</p>
                    <p><strong>Generation:</strong> ${generation}</p>
                    <p><strong>Variants:</strong> ${variants.join(', ')}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Card Types:</strong> ${cardTypes.join(', ')}</p>
                    <p><strong>Total Cards:</strong> ${cards.length}</p>
                    <p><strong>CSV Rows:</strong> ${cards.length}</p>
                </div>
            </div>
        `;

        // Preview table
        if (cards.length > 0) {
            const sampleCard = cards[0];
            const headers = ['sku', 'brand', 'model', 'generation', 'variant'];
            
            // Add card-specific columns
            cardTypes.forEach(cardType => {
                if (cardType === 'feature') {
                    headers.push('features.feature_1_title', 'features.feature_1_subtitle', 'features.feature_1_description', 'features.feature_1_image');
                }
                // Add other card types as needed
            });

            headerRow.innerHTML = headers.map(h => `<th>${h}</th>`).join('');

            // Show first 3 cards as preview
            bodyRows.innerHTML = cards.slice(0, 3).map(card => {
                const row = [];
                row.push(card.configuration?.variants?.[0]?.sku || '');
                row.push(card.configuration?.brand || '');
                row.push(card.configuration?.model || '');
                row.push(card.configuration?.generation || '');
                row.push(card.configuration?.variants?.[0]?.name || card.configuration?.variants?.[0] || '');
                
                // Add card-specific data
                cardTypes.forEach(cardType => {
                    if (cardType === 'feature') {
                        row.push(card.title || '');
                        row.push(card.subtitle || '');
                        row.push(card.description || '');
                        row.push(card.imageUrl || '');
                    }
                });

                return `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
            }).join('');
        } else {
            headerRow.innerHTML = '<th>No cards found</th>';
            bodyRows.innerHTML = '<tr><td>No cards match your selection criteria</td></tr>';
        }
    }

    backToExportStep1() {
        document.getElementById('exportStep2').classList.add('d-none');
        document.getElementById('exportStep1').classList.remove('d-none');
    }

    async exportCsv() {
        if (!this.exportData) {
            this.showError('No export data available');
            return;
        }

        try {
            this.showExportProgress();
            
            const csvData = this.generateCsvData();
            this.exportedCsvData = csvData;
            
            this.showExportResults();
            
        } catch (error) {
            this.showError(`Export failed: ${error.message}`);
        }
    }

    generateCsvData() {
        const { cards, cardTypes } = this.exportData;
        
        // Define CSV headers based on card types - SKU first for Hypa Metafields
        const headers = ['sku', 'brand', 'model', 'generation', 'variant'];
        
        cardTypes.forEach(cardType => {
            if (cardType === 'feature') {
                headers.push('features.feature_1_title', 'features.feature_1_subtitle', 'features.feature_1_description', 'features.feature_1_image');
            }
            // Add other card types as needed
        });

        // Generate CSV rows
        const rows = cards.map(card => {
            const row = {};
            
            // Basic data - SKU first for Hypa Metafields
            row.sku = card.configuration?.variants?.[0]?.sku || '';
            row.brand = card.configuration?.brand || '';
            row.model = card.configuration?.model || '';
            row.generation = card.configuration?.generation || '';
            row.variant = card.configuration?.variants?.[0]?.name || card.configuration?.variants?.[0] || '';
            
            // Card-specific data
            cardTypes.forEach(cardType => {
                if (cardType === 'feature') {
                    row['features.feature_1_title'] = card.title || '';
                    row['features.feature_1_subtitle'] = card.subtitle || '';
                    row['features.feature_1_description'] = card.description || '';
                    row['features.feature_1_image'] = card.imageUrl || '';
                }
            });

            return row;
        });

        return { headers, rows };
    }

    downloadCsvFile() {
        if (!this.exportedCsvData) {
            this.showError('No CSV data to download');
            return;
        }

        const { headers, rows } = this.exportedCsvData;
        
        // Convert to CSV format
        const csvContent = [
            headers.join(','),
            ...rows.map(row => headers.map(header => {
                const value = row[header] || '';
                // Escape commas and quotes
                return `"${value.toString().replace(/"/g, '""')}"`;
            }).join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hypa-metafields-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    showExportProgress() {
        document.getElementById('exportStep2').classList.add('d-none');
        document.getElementById('exportProgress').classList.remove('d-none');
    }

    showExportResults() {
        document.getElementById('exportProgress').classList.add('d-none');
        document.getElementById('exportResults').classList.remove('d-none');
        
        const { cards } = this.exportData;
        document.getElementById('exportResultsSummary').innerHTML = `
            <p><strong>${cards.length}</strong> cards exported successfully.</p>
            <p class="mb-0">Your CSV file is ready for download and import into Hypa Metafields.</p>
        `;
    }

    resetExport() {
        // Reset export UI
        document.getElementById('exportStep1').classList.remove('d-none');
        document.getElementById('exportStep2').classList.add('d-none');
        document.getElementById('exportProgress').classList.add('d-none');
        document.getElementById('exportResults').classList.add('d-none');
        
        // Reset selections
        document.getElementById('exportModel').value = '';
        document.getElementById('exportGeneration').value = '';
        document.getElementById('exportVariants').innerHTML = '<div class="text-muted">Select a generation first</div>';
        
        // Reset data
        this.exportData = null;
        this.exportedCsvData = null;
    }
}

// Initialize the CSV Manager
const csvManager = new SmartCSVManager(); 