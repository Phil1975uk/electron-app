// Wait for both DOM and XLSX library to be loaded
window.addEventListener('load', () => {
    // DOM Elements
    let bikeConfigForm;
    let configTableBody;
    let exportBtn;
    let editModal;
    let saveEditBtn;
    let brandSelect;
    let customBrandInput;
    let customBrand;

    // Load saved configurations from file instead of localStorage
    let configurations = [];
    
    // Filter state
    let filteredConfigurations = [];
    let currentFilters = {
        brand: '',
        model: '',
        generation: '',
        search: ''
    };

    // Selection state
    let selectedConfigurations = new Set();

    // File-based storage functions
    async function loadConfigurationsFromFile() {
        try {
            const response = await fetch('/api/configurations');
            if (response.ok) {
                const data = await response.json();
                // Handle nested structure: { configurations: [...] }
                const configs = Array.isArray(data) ? data : (data.configurations || []);
                console.log(`Loaded ${configs.length} configurations from file`);
                return configs;
            } else {
                console.log('No configurations file found, starting with empty array');
                return [];
            }
        } catch (error) {
            console.error('Error loading configurations from file:', error);
            return [];
        }
    }

    async function saveConfigurationsToFile() {
        try {
            const response = await fetch('/api/configurations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(configurations)
            });
            
            if (response.ok) {
                console.log(`Saved ${configurations.length} configurations to file`);
            } else {
                console.error('Failed to save configurations to file');
            }
        } catch (error) {
            console.error('Error saving configurations to file:', error);
        }
    }

    // Initialize DOM elements
    async function initializeElements() {
        bikeConfigForm = document.getElementById('bikeConfigForm');
        configTableBody = document.getElementById('configTableBody');
        exportBtn = document.getElementById('exportBtn');
        const exportSelectedBtn = document.getElementById('exportSelectedBtn');
        saveEditBtn = document.getElementById('saveEditBtn');
        brandSelect = document.getElementById('brand');
        customBrandInput = document.getElementById('customBrandInput');
        customBrand = document.getElementById('customBrand');
        
        // Filter elements
        const filterBrand = document.getElementById('filterBrand');
        const filterModel = document.getElementById('filterModel');
        const filterGeneration = document.getElementById('filterGeneration');
        const searchInput = document.getElementById('searchInput');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        
        // Initialize modal
        const editModalElement = document.getElementById('editModal');
        if (editModalElement) {
            editModal = new bootstrap.Modal(editModalElement);
        }

        // Enable all form inputs
        const allInputs = document.querySelectorAll('#bikeConfigForm input, #bikeConfigForm select, #bikeConfigForm textarea');
        allInputs.forEach((input) => {
            // Force enable all inputs
            input.removeAttribute('disabled');
            input.removeAttribute('readonly');
            input.style.pointerEvents = 'auto';
            input.style.opacity = '1';
            input.style.background = '#fff';
        });

        // Add event listeners
        if (bikeConfigForm) {
            bikeConfigForm.addEventListener('submit', handleFormSubmit);
        }
        if (exportBtn) {
            exportBtn.addEventListener('click', exportToExcel);
        }
        if (exportSelectedBtn) {
            exportSelectedBtn.addEventListener('click', exportSelectedToExcel);
        }
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', deleteSelectedConfigurations);
        }
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', handleEditSave);
        }
        if (brandSelect) {
            brandSelect.addEventListener('change', handleBrandChange);
        }
        
        // Filter event listeners
        if (filterBrand) {
            filterBrand.addEventListener('change', handleFilterChange);
        }
        if (filterModel) {
            filterModel.addEventListener('change', handleFilterChange);
        }
        if (filterGeneration) {
            filterGeneration.addEventListener('change', handleFilterChange);
        }
        if (searchInput) {
            searchInput.addEventListener('input', handleFilterChange);
        }
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearAllFilters);
        }
        
        // Add variant management listeners
        const addVariantBtn = document.getElementById('addVariantBtn');
        const addEditVariantBtn = document.getElementById('addEditVariantBtn');
        
        if (addVariantBtn) {
            addVariantBtn.addEventListener('click', addVariant);
        }
        if (addEditVariantBtn) {
            addEditVariantBtn.addEventListener('click', addEditVariant);
        }
        
        // Initialize variant containers
        initializeVariantContainers();
        
        // Load configurations from server first, then render
        await loadConfigurationsFromServer();
        filteredConfigurations = [...configurations];
        renderTable();
        updateBrandSelect();
        updateFilterOptions();
        // updateExcelFile(); // Removed automatic Excel generation on page load
        

    }
    
    // Variant management functions
    function initializeVariantContainers() {
        const variantsContainer = document.getElementById('variantsContainer');
        const editVariantsContainer = document.getElementById('editVariantsContainer');
        
        if (variantsContainer) {
            variantsContainer.addEventListener('click', handleVariantContainerClick);
        }
        if (editVariantsContainer) {
            editVariantsContainer.addEventListener('click', handleEditVariantContainerClick);
        }
    }
    
    function addVariant() {
        const container = document.getElementById('variantsContainer');
        const variantDiv = document.createElement('div');
        variantDiv.className = 'variant-group mb-3';
        variantDiv.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <label class="form-label">Variant Name</label>
                    <input type="text" class="form-control variant-input" placeholder="Enter variant name" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">SKU</label>
                    <input type="text" class="form-control variant-sku-input" placeholder="Enter unique SKU" required>
                </div>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm remove-variant mt-2" style="display: none;">
                <i class="fas fa-times me-1"></i>Remove Variant
            </button>
        `;
        container.appendChild(variantDiv);
        updateVariantRemoveButtons();
    }
    
    function addEditVariant() {
        const container = document.getElementById('editVariantsContainer');
        const variantDiv = document.createElement('div');
        variantDiv.className = 'variant-group mb-3';
        variantDiv.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <label class="form-label">Variant Name</label>
                    <input type="text" class="form-control edit-variant-input" placeholder="Enter variant name" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">SKU</label>
                    <input type="text" class="form-control edit-variant-sku-input" placeholder="Enter unique SKU" required>
                </div>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm remove-edit-variant mt-2" style="display: none;">
                <i class="fas fa-times me-1"></i>Remove Variant
            </button>
        `;
        container.appendChild(variantDiv);
        updateEditVariantRemoveButtons();
    }
    
    function handleVariantContainerClick(e) {
        if (e.target.classList.contains('remove-variant')) {
            e.target.closest('.variant-group').remove();
            updateVariantRemoveButtons();
        }
    }
    
    function handleEditVariantContainerClick(e) {
        if (e.target.classList.contains('remove-edit-variant')) {
            e.target.closest('.variant-group').remove();
            updateEditVariantRemoveButtons();
        }
    }
    
    function updateVariantRemoveButtons() {
        const variantInputs = document.querySelectorAll('.variant-input');
        const removeButtons = document.querySelectorAll('.remove-variant');
        
        removeButtons.forEach((button, index) => {
            button.style.display = variantInputs.length > 1 ? 'block' : 'none';
        });
    }
    
    function updateEditVariantRemoveButtons() {
        const variantInputs = document.querySelectorAll('.edit-variant-input');
        const removeButtons = document.querySelectorAll('.remove-edit-variant');
        
        removeButtons.forEach((button, index) => {
            button.style.display = variantInputs.length > 1 ? 'block' : 'none';
        });
    }
    
    function getVariants() {
        const variantGroups = document.querySelectorAll('#variantsContainer .variant-group');
        const variants = [];
        
        variantGroups.forEach(group => {
            const variantInput = group.querySelector('.variant-input');
            const skuInput = group.querySelector('.variant-sku-input');
            
            if (variantInput && skuInput) {
                const variantName = variantInput.value.trim();
                const sku = skuInput.value.trim();
                
                if (variantName && sku) {
                    variants.push({
                        name: variantName,
                        sku: sku
                    });
                }
            }
        });
        
        return variants;
    }
    
    function getEditVariants() {
        const variantGroups = document.querySelectorAll('#editVariantsContainer .variant-group');
        const variants = [];
        
        console.log('Found variant groups:', variantGroups.length);
        
        variantGroups.forEach((group, index) => {
            const variantInput = group.querySelector('.edit-variant-input');
            const skuInput = group.querySelector('.edit-variant-sku-input');
            
            console.log(`Variant group ${index}:`, { variantInput, skuInput });
            
            if (variantInput && skuInput) {
                const variantName = variantInput.value.trim();
                const sku = skuInput.value.trim();
                
                console.log(`Variant ${index} values:`, { variantName, sku });
                
                if (variantName && sku) {
                    variants.push({
                        name: variantName,
                        sku: sku
                    });
                }
            }
        });
        
        console.log('Final variants array:', variants);
        return variants;
    }
    
    function setEditVariants(variants) {
        const container = document.getElementById('editVariantsContainer');
        console.log('setEditVariants called with:', variants);
        
        container.innerHTML = '';
        
        if (variants && variants.length > 0) {
            variants.forEach((variant, index) => {
                const variantDiv = document.createElement('div');
                variantDiv.className = 'variant-group mb-3';
                
                // Handle both old format (string) and new format (object)
                const variantName = typeof variant === 'string' ? variant : variant.name || '';
                const variantSku = typeof variant === 'string' ? '' : variant.sku || '';
                
                console.log(`Processing variant ${index}:`, { variant, variantName, variantSku });
                
                variantDiv.innerHTML = `
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label">Variant Name</label>
                            <input type="text" class="form-control edit-variant-input" value="${variantName}" placeholder="Enter variant name" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">SKU</label>
                            <input type="text" class="form-control edit-variant-sku-input" value="${variantSku}" placeholder="Enter unique SKU" required>
                        </div>
                    </div>
                    <button type="button" class="btn btn-outline-danger btn-sm remove-edit-variant mt-2" style="display: none;">
                        <i class="fas fa-times me-1"></i>Remove Variant
                    </button>
                `;
                container.appendChild(variantDiv);
            });
        } else {
            console.log('No variants found, adding empty variant group');
            // Add one empty variant group
            const variantDiv = document.createElement('div');
            variantDiv.className = 'variant-group mb-3';
            variantDiv.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label">Variant Name</label>
                        <input type="text" class="form-control edit-variant-input" placeholder="Enter variant name" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">SKU</label>
                        <input type="text" class="form-control edit-variant-sku-input" placeholder="Enter unique SKU" required>
                    </div>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm remove-edit-variant mt-2" style="display: none;">
                    <i class="fas fa-times me-1"></i>Remove Variant
                </button>
            `;
            container.appendChild(variantDiv);
        }
        updateEditVariantRemoveButtons();
    }

    // Functions
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const brand = brandSelect.value === 'custom' ? customBrand.value : brandSelect.value;
        const model = document.getElementById('model').value;
        const generation = document.getElementById('generation').value;
        const variants = getVariants();

        if (!brand || !model || !generation || variants.length === 0) {
            alert('Please fill in all fields and add at least one variant');
            return;
        }

        // Check for duplicate SKUs across all configurations
        const allSkus = [];
        configurations.forEach(config => {
            if (config.variants && Array.isArray(config.variants)) {
                config.variants.forEach(variant => {
                    if (variant.sku) {
                        allSkus.push({ sku: variant.sku, config: config });
                    }
                });
            }
        });
        
        // Check for duplicates within the current variants being added
        const currentSkus = variants.map(v => v.sku).filter(sku => sku);
        const duplicateCurrentSkus = currentSkus.filter((sku, index) => currentSkus.indexOf(sku) !== index);
        
        if (duplicateCurrentSkus.length > 0) {
            alert(`⚠️ DUPLICATE SKUs IN CURRENT CONFIGURATION!\n\n` +
                  `The following SKUs are duplicated within this configuration:\n` +
                  `${[...new Set(duplicateCurrentSkus)].join(', ')}\n\n` +
                  `Each SKU must be unique within a single configuration.`);
            return;
        }
        
        // Check for duplicates with existing configurations
        const duplicateWithExisting = [];
        currentSkus.forEach(sku => {
            const existingConfigs = allSkus.filter(item => item.sku === sku);
            if (existingConfigs.length > 0) {
                duplicateWithExisting.push({ sku, configs: existingConfigs });
            }
        });
        
        if (duplicateWithExisting.length > 0) {
            let warningMessage = `⚠️ DUPLICATE SKUs DETECTED!\n\n`;
            warningMessage += `The following SKUs are already used in other configurations:\n\n`;
            
            duplicateWithExisting.forEach(duplicate => {
                warningMessage += `SKU: "${duplicate.sku}" is used in:\n`;
                duplicate.configs.forEach(config => {
                    warningMessage += `• ${config.config.brand} - ${config.config.model} - ${config.config.generation}\n`;
                });
                warningMessage += `\n`;
            });
            
            warningMessage += `This will cause issues with Hypa Metafields uploads.\n`;
            warningMessage += `Each SKU must be unique across all products.\n\n`;
            warningMessage += `Continue anyway?`;
            
            const continueAnyway = confirm(warningMessage);
            if (!continueAnyway) {
                return;
            }
        }

        const newConfig = {
            id: Date.now(),
            brand,
            model,
            generation,
            variants
        };

        configurations.push(newConfig);
        saveConfigurations();
        updateFilterOptions();
        applyFilters();
        bikeConfigForm.reset();
        resetVariantContainer();
    }

    function handleBrandChange(e) {
        if (e.target.value === 'custom') {
            customBrandInput.style.display = 'block';
            customBrand.required = true;
        } else {
            customBrandInput.style.display = 'none';
            customBrand.required = false;
        }
    }

    function handleEditSave() {
        const id = document.getElementById('editId').value;
        const brand = document.getElementById('editBrand').value;
        const model = document.getElementById('editModel').value;
        const generation = document.getElementById('editGeneration').value;
        const variants = getEditVariants();



        if (!brand || !model || !generation || variants.length === 0) {
            alert('Please fill in all fields and add at least one variant');
            return;
        }
        
        // Check for duplicate SKUs across all configurations (excluding current config)
        const allSkus = [];
        configurations.forEach((config) => {
            if (config.id.toString() !== id.toString()) { // Exclude current config being edited
                if (config.variants && Array.isArray(config.variants)) {
                    config.variants.forEach(variant => {
                        if (variant.sku) {
                            allSkus.push({ sku: variant.sku, config: config });
                        }
                    });
                }
            }
        });
        
        // Check for duplicates within the current variants being edited
        const currentSkus = variants.map(v => v.sku).filter(sku => sku);
        const duplicateCurrentSkus = currentSkus.filter((sku, index) => currentSkus.indexOf(sku) !== index);
        
        if (duplicateCurrentSkus.length > 0) {
            alert(`⚠️ DUPLICATE SKUs IN CURRENT CONFIGURATION!\n\n` +
                  `The following SKUs are duplicated within this configuration:\n` +
                  `${[...new Set(duplicateCurrentSkus)].join(', ')}\n\n` +
                  `Each SKU must be unique within a single configuration.`);
            return;
        }
        
        // Check for duplicates with existing configurations
        const duplicateWithExisting = [];
        currentSkus.forEach(sku => {
            const existingConfigs = allSkus.filter(item => item.sku === sku);
            if (existingConfigs.length > 0) {
                duplicateWithExisting.push({ sku, configs: existingConfigs });
            }
        });
        
        if (duplicateWithExisting.length > 0) {
            let warningMessage = `⚠️ DUPLICATE SKUs DETECTED!\n\n`;
            warningMessage += `The following SKUs are already used in other configurations:\n\n`;
            
            duplicateWithExisting.forEach(duplicate => {
                warningMessage += `SKU: "${duplicate.sku}" is used in:\n`;
                duplicate.configs.forEach(config => {
                    warningMessage += `• ${config.config.brand} - ${config.config.model} - ${config.config.generation}\n`;
                });
                warningMessage += `\n`;
            });
            
            warningMessage += `This will cause issues with Hypa Metafields uploads.\n`;
            warningMessage += `Each SKU must be unique across all products.\n\n`;
            warningMessage += `Continue anyway?`;
            
            const continueAnyway = confirm(warningMessage);
            if (!continueAnyway) {
                return;
            }
        }
        
        // Find config by stringified ID for robustness
        let index = configurations.findIndex(config => config.id.toString() === id.toString());

        if (index !== -1) {
            configurations[index] = {
                ...configurations[index],
                brand,
                model,
                generation,
                variants
            };
            saveConfigurations();
            updateFilterOptions();
            applyFilters();
            editModal.hide();
        } else {
            console.error('Configuration not found with id:', id);
            alert('Error: Configuration not found. No changes were saved.');
        }
    }

    function editConfiguration(id) {
        const config = configurations.find(config => config.id === id);
        if (config) {
            document.getElementById('editId').value = config.id;
            document.getElementById('editBrand').value = config.brand;
            document.getElementById('editModel').value = config.model;
            document.getElementById('editGeneration').value = config.generation;
            setEditVariants(config.variants || []);
            
            // Show the modal first
            editModal.show();
            
            // Enable inputs once after modal is shown
            setTimeout(() => {
                forceEnableModalInputs();
            }, 100);
        }
    }
    
    function forceEnableModalInputs() {
        const modal = document.getElementById('editModal');
        if (!modal) return;
        

        
        // Force modal to front
        modal.style.zIndex = '9999';
        modal.style.position = 'relative';
        
        // Force backdrop to proper z-index
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach((backdrop, index) => {
            if (index > 0) { // Keep only the first backdrop
                backdrop.remove();
            } else {
                backdrop.style.zIndex = '9998';
            }
        });
        
        const inputs = modal.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            // Remove any disabled/readonly attributes
            input.removeAttribute('disabled');
            input.removeAttribute('readonly');
            
            // Ensure proper styling
            input.style.pointerEvents = 'auto';
            input.style.opacity = '1';
            input.style.background = '#fff';
            input.style.color = '#000';
            input.style.position = 'relative';
            input.style.zIndex = '10000';
            input.style.cursor = 'text';
            
            // Remove any event listeners that might be blocking
            input.onclick = null;
            input.onfocus = null;
            input.oninput = null;
            

        });
        
        // Remove any potential blocking elements (second check)
        const extraBackdrops = document.querySelectorAll('.modal-backdrop');
        extraBackdrops.forEach((backdrop, index) => {
            if (index > 0) { // Keep only the first backdrop
                backdrop.remove();
            }
        });
        

    }

    // Utility: Robust deep copy (uses structuredClone if available, else JSON fallback)
    function deepCopy(obj) {
        if (typeof structuredClone === 'function') {
            return structuredClone(obj);
        } else {
            return JSON.parse(JSON.stringify(obj));
        }
    }

    function duplicateConfiguration(id) {
        const config = configurations.find(config => config.id === id);
        if (config) {
            // Check for potential SKU conflicts if variants are copied
            const hasVariants = config.variants && config.variants.length > 0;
            let shouldCopyVariants = false;
            
            if (hasVariants) {
                // Check if any SKUs from this config already exist in other configs
                const existingSkus = [];
                configurations.forEach(existingConfig => {
                    if (existingConfig.id !== config.id && existingConfig.variants) {
                        existingConfig.variants.forEach(variant => {
                            if (variant.sku) {
                                existingSkus.push(variant.sku);
                            }
                        });
                    }
                });
                
                const conflictingSkus = config.variants
                    .filter(variant => variant.sku && existingSkus.includes(variant.sku))
                    .map(variant => variant.sku);
                
                if (conflictingSkus.length > 0) {
                    const result = confirm(
                        `⚠️ SKU CONFLICTS DETECTED!\n\n` +
                        `The following SKUs from this configuration already exist in other configurations:\n` +
                        `${conflictingSkus.join(', ')}\n\n` +
                        `Duplicating will create another configuration with the same brand/model/generation but NO variants to prevent SKU conflicts.\n\n` +
                        `You will need to add unique variants with unique SKUs manually.\n\n` +
                        `Continue with duplication?`
                    );
                    if (!result) return;
                    shouldCopyVariants = false;
                } else {
                    const result = confirm(
                        `Duplicate configuration: ${config.brand} - ${config.model} - ${config.generation}\n\n` +
                        `This will create another configuration with the same brand/model/generation.\n\n` +
                        `Would you like to copy the variants as well? (Only if SKUs are unique)\n\n` +
                        `Click OK to copy variants, Cancel to create without variants.`
                    );
                    shouldCopyVariants = result;
                }
            }
            
            // Deep copy the configuration
            const newConfig = deepCopy(config);
            newConfig.id = Date.now();
            
            if (!shouldCopyVariants) {
                newConfig.variants = []; // Clear variants - user must add unique ones
            }
            
            configurations.push(newConfig);
            saveConfigurations();
            updateFilterOptions();
            applyFilters();
            
            // Show appropriate message
            setTimeout(() => {
                if (shouldCopyVariants) {
                    alert(
                        `Configuration duplicated successfully!\n\n` +
                        `✅ Variants were copied because all SKUs are unique.\n\n` +
                        `You can now edit this configuration to modify variants if needed.`
                    );
                } else {
                    alert(
                        `Configuration duplicated successfully!\n\n` +
                        `⚠️ IMPORTANT: Variants were NOT copied to prevent SKU conflicts.\n\n` +
                        `You must now add unique variants with unique SKUs for this configuration.\n\n` +
                        `Remember: Each SKU must be unique across all products for Hypa Metafields to work correctly.`
                    );
                }
            }, 100);
            
            editConfiguration(newConfig.id);
        }
    }

    function renderTable() {
        if (!configTableBody) return;
        
        configTableBody.innerHTML = '';
        
        // Sort filteredConfigurations alphabetically by brand, then model, then generation
        const sortedConfigs = [...filteredConfigurations].sort((a, b) => {
            const brandCmp = a.brand.localeCompare(b.brand);
            if (brandCmp !== 0) return brandCmp;
            const modelCmp = a.model.localeCompare(b.model);
            if (modelCmp !== 0) return modelCmp;
            return a.generation.localeCompare(b.generation);
        });
        
        sortedConfigs.forEach((config, index) => {
            const row = document.createElement('tr');
            const isSelected = selectedConfigurations.has(config.id);
            
            // Create variants display
            const variantsHtml = config.variants ? config.variants.map(variant => 
                `<span class="badge bg-primary variant-badge">${variant.name}</span>`
            ).join('') : '';
            
            // Create SKUs display
            const skusHtml = config.variants ? config.variants.map(variant => 
                `<span class="badge bg-secondary variant-badge">${variant.sku}</span>`
            ).join('') : '';
            
            row.innerHTML = `
                <td>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="selectConfig${config.id}" 
                               ${isSelected ? 'checked' : ''} onchange="toggleConfigurationSelection(${config.id})">
                    </div>
                </td>
                    <td>${config.brand}</td>
                    <td>${config.model}</td>
                    <td>${config.generation}</td>
                <td>${variantsHtml}</td>
                <td class="action-buttons">
                    <button class="btn btn-outline-primary btn-sm" onclick="editConfiguration(${config.id})" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                    <button class="btn btn-outline-success btn-sm" onclick="duplicateConfiguration(${config.id})" title="Duplicate">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteConfiguration(${config.id})" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                    </td>
            `;
            
            configTableBody.appendChild(row);
        });
        
        updateResultsCount();
        updateExportSelectedButton();
    }

    function updateBrandSelect() {
        if (!brandSelect) return;
        
        const customBrands = [...new Set(configurations.map(config => config.brand))];
        const defaultBrands = ['Riese & Müller', 'GoCycle', 'VanMoof'];
        const allBrands = [...new Set([...defaultBrands, ...customBrands])].sort((a, b) => a.localeCompare(b));
        
        brandSelect.innerHTML = `
            <option value="">Select Brand</option>
            ${allBrands.map(brand => `<option value="${brand}">${brand}</option>`).join('')}
            <option value="custom">Add Custom Brand...</option>
        `;
    }

    function updateFilterOptions() {
        const filterBrand = document.getElementById('filterBrand');
        const filterModel = document.getElementById('filterModel');
        const filterGeneration = document.getElementById('filterGeneration');
        
        if (filterBrand) {
            const brands = [...new Set(configurations.map(config => config.brand))].sort((a, b) => a.localeCompare(b));
            filterBrand.innerHTML = '<option value="">All Brands</option>' + 
                brands.map(brand => `<option value="${brand}">${brand}</option>`).join('');
        }
        
        if (filterModel) {
            const models = [...new Set(configurations.map(config => config.model))].sort((a, b) => a.localeCompare(b));
            filterModel.innerHTML = '<option value="">All Models</option>' + 
                models.map(model => `<option value="${model}">${model}</option>`).join('');
        }
        
        if (filterGeneration) {
            const generations = [...new Set(configurations.map(config => config.generation))].sort((a, b) => a.localeCompare(b));
            filterGeneration.innerHTML = '<option value="">All Generations</option>' + 
                generations.map(gen => `<option value="${gen}">${gen}</option>`).join('');
        }
    }
    
    function handleFilterChange() {
        const filterBrand = document.getElementById('filterBrand');
        const filterModel = document.getElementById('filterModel');
        const filterGeneration = document.getElementById('filterGeneration');
        const searchInput = document.getElementById('searchInput');
        
        currentFilters = {
            brand: filterBrand ? filterBrand.value : '',
            model: filterModel ? filterModel.value : '',
            generation: filterGeneration ? filterGeneration.value : '',
            search: searchInput ? searchInput.value.toLowerCase() : ''
        };
        
        applyFilters();
    }
    
    function applyFilters() {
        filteredConfigurations = configurations.filter(config => {
            const matchesBrand = !currentFilters.brand || config.brand === currentFilters.brand;
            const matchesModel = !currentFilters.model || config.model === currentFilters.model;
            const matchesGeneration = !currentFilters.generation || config.generation === currentFilters.generation;
            
            const searchTerm = currentFilters.search.toLowerCase();
            const matchesSearch = !searchTerm || 
                config.brand.toLowerCase().includes(searchTerm) ||
                config.model.toLowerCase().includes(searchTerm) ||
                config.generation.toLowerCase().includes(searchTerm) ||
                (config.variants && config.variants.some(v => 
                    v.name.toLowerCase().includes(searchTerm) || 
                    v.sku.toLowerCase().includes(searchTerm)
                ));
            
            return matchesBrand && matchesModel && matchesGeneration && matchesSearch;
        });
        
        // Clear selections when filters change
        selectedConfigurations.clear();
        
        renderTable();
        updateFilterOptions();
    }
    
    function clearAllFilters() {
        currentFilters = {
            brand: '',
            model: '',
            generation: '',
            search: ''
        };
        
        // Reset filter dropdowns
        const filterBrand = document.getElementById('filterBrand');
        const filterModel = document.getElementById('filterModel');
        const filterGeneration = document.getElementById('filterGeneration');
        const searchInput = document.getElementById('searchInput');
        
        if (filterBrand) filterBrand.value = '';
        if (filterModel) filterModel.value = '';
        if (filterGeneration) filterGeneration.value = '';
        if (searchInput) searchInput.value = '';
        
        // Clear selections when filters change
        selectedConfigurations.clear();
        
        filteredConfigurations = [...configurations];
        renderTable();
        updateFilterOptions();
    }
    
    function updateResultsCount() {
        const count = filteredConfigurations.length;
        const totalCount = configurations.length;
        const resultsCountElement = document.getElementById('resultsCount');
            
        if (count === totalCount) {
            resultsCountElement.textContent = `Showing all ${count} configurations`;
            } else {
            resultsCountElement.textContent = `Showing ${count} of ${totalCount} configurations`;
        }
    }

    function updateExportSelectedButton() {
        const exportSelectedBtn = document.getElementById('exportSelectedBtn');
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        if (exportSelectedBtn) {
            exportSelectedBtn.disabled = selectedConfigurations.size === 0;
        }
        if (deleteSelectedBtn) {
            deleteSelectedBtn.disabled = selectedConfigurations.size === 0;
        }
    }

    function saveConfigurations() {
        // Save to file instead of localStorage
        saveConfigurationsToFile();
        // Also save to server
        saveConfigurationsToServer();
        updateBrandSelect();
        // updateExcelFile(); // Removed automatic Excel generation on page load
    }
    
    async function saveConfigurationsToServer() {
        try {
            const response = await fetch('/api/configurations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configurations: configurations })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Configurations saved to server:', result.message);
            return result.message;
        } catch (error) {
            console.error('Error saving configurations to server:', error);
            // Don't show error to user, just log it
        }
    }
    
    async function loadConfigurationsFromServer() {
        try {
            const response = await fetch('/api/configurations');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const serverData = await response.json();
            // Handle both formats: direct array or { configurations: [...] }
            const serverConfigs = Array.isArray(serverData) ? serverData : (serverData.configurations || []);
            
            if (serverConfigs.length > 0) {
                configurations = serverConfigs;
                // Save to file instead of localStorage
                await saveConfigurationsToFile();
                console.log('Loaded configurations from server:', configurations.length);
            }
        } catch (error) {
            console.error('Error loading configurations from server:', error);
            // Fall back to file storage
        }
    }

    function updateExcelFile() {
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not available');
            return;
        }

        try {
            // Create worksheet from configurations
            const ws = XLSX.utils.json_to_sheet(configurations.map(({ id, ...rest }) => rest));
            
            // Create workbook and append worksheet
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Bike Configurations");
            
            // Write to file
            XLSX.writeFile(wb, "bike_configurations.xlsx");
            console.log('Excel file updated successfully');
        } catch (error) {
            console.error('Error updating Excel file:', error);
        }
    }

    function exportToExcel() {
        if (typeof XLSX === 'undefined') {
            alert('Excel export functionality is not available. Please check if the XLSX library is loaded.');
            return;
        }
        try {
            // Flatten configs so each variant is a row
            const exportRows = configurations.flatMap(config =>
                (config.variants && config.variants.length > 0 ? config.variants : [{ name: '', sku: '' }]).map(variant => ({
                    Brand: config.brand,
                    Model: config.model,
                    Generation: config.generation,
                    'Variant Name': variant.name,
                    SKU: variant.sku,
                    'Full Name': `${config.brand} ${config.model} ${config.generation} ${variant.name}`.trim()
                }))
            );
            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Bike Configurations");
            XLSX.writeFile(wb, "bike_configurations.xlsx");
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Error exporting to Excel. Please try again.');
        }
    }

    function exportSelectedToExcel() {
        if (typeof XLSX === 'undefined') {
            alert('Excel export functionality is not available. Please check if the XLSX library is loaded.');
            return;
        }
        if (selectedConfigurations.size === 0) {
            alert('Please select at least one configuration to export.');
            return;
        }
        try {
            const selectedConfigs = configurations.filter(config => selectedConfigurations.has(config.id));
            // Flatten selected configs so each variant is a row
            const exportRows = selectedConfigs.flatMap(config =>
                (config.variants && config.variants.length > 0 ? config.variants : [{ name: '', sku: '' }]).map(variant => ({
                    Brand: config.brand,
                    Model: config.model,
                    Generation: config.generation,
                    'Variant Name': variant.name,
                    SKU: variant.sku,
                    'Full Name': `${config.brand} ${config.model} ${config.generation} ${variant.name}`.trim()
                }))
            );
            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Selected Configurations");
            XLSX.writeFile(wb, "selected_bike_configurations.xlsx");
        } catch (error) {
            console.error('Error exporting selected items to Excel:', error);
            alert('Error exporting to Excel. Please try again.');
        }
    }

    function resetVariantContainer() {
        customBrandInput.style.display = 'none';
        
        // Reset variants container
        const variantsContainer = document.getElementById('variantsContainer');
        variantsContainer.innerHTML = `
            <div class="variant-group mb-3">
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label">Variant Name</label>
                        <input type="text" class="form-control variant-input" placeholder="Enter variant name" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">SKU</label>
                        <input type="text" class="form-control variant-sku-input" placeholder="Enter unique SKU" required>
                    </div>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm remove-variant mt-2" style="display: none;">
                    <i class="fas fa-times me-1"></i>Remove Variant
                </button>
            </div>
        `;
    }

    // Global functions for selection management
    window.toggleConfigurationSelection = function(configId) {
        if (selectedConfigurations.has(configId)) {
            selectedConfigurations.delete(configId);
        } else {
            selectedConfigurations.add(configId);
        }
        updateExportSelectedButton();
        updateSelectAllCheckbox();
    };

    window.toggleSelectAll = function() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (!selectAllCheckbox) return;

        if (selectAllCheckbox.checked) {
            // Select all visible configurations
            filteredConfigurations.forEach(config => {
                selectedConfigurations.add(config.id);
            });
        } else {
            // Deselect all
            selectedConfigurations.clear();
        }
        
        // Update checkboxes in table
        filteredConfigurations.forEach(config => {
            const checkbox = document.getElementById(`selectConfig${config.id}`);
            if (checkbox) {
                checkbox.checked = selectAllCheckbox.checked;
            }
        });
        
        updateExportSelectedButton();
    };

    function updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (!selectAllCheckbox) return;

        const visibleConfigs = filteredConfigurations.length;
        const selectedCount = selectedConfigurations.size;
        
        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === visibleConfigs) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    // Global delete functions
    window.deleteConfiguration = function(id) {
        if (confirm('Are you sure you want to delete this configuration?')) {
            configurations = configurations.filter(config => config.id !== id);
            saveConfigurations();
            updateFilterOptions();
            applyFilters();
        }
    };

    window.deleteSelectedConfigurations = function() {
        if (selectedConfigurations.size === 0) {
            alert('No configurations selected for deletion.');
            return;
        }

        const count = selectedConfigurations.size;
        const confirmMessage = `Are you sure you want to delete ${count} configuration${count > 1 ? 's' : ''}? This action cannot be undone.`;
        
        if (confirm(confirmMessage)) {
            // Remove selected configurations
            configurations = configurations.filter(config => !selectedConfigurations.has(config.id));
            
            // Clear selections
            selectedConfigurations.clear();
            
            // Save and refresh
            saveConfigurations();
            updateFilterOptions();
            applyFilters();
            
            // Show success message
            alert(`Successfully deleted ${count} configuration${count > 1 ? 's' : ''}.`);
        }
    };

    // Global functions for table actions
    window.editConfiguration = editConfiguration;
    window.duplicateConfiguration = duplicateConfiguration;
    window.deleteConfiguration = deleteConfiguration;
    
    // DEBUG: Global test function
    window.testFormInputs = function() {
        console.log('DEBUG: Testing form inputs...');
        
        const inputs = document.querySelectorAll('#bikeConfigForm input, #bikeConfigForm select, #bikeConfigForm textarea');
        inputs.forEach((input, index) => {
            console.log(`Input ${index}:`, {
                id: input.id,
                type: input.type,
                disabled: input.disabled,
                readonly: input.readOnly,
                value: input.value,
                style: {
                    pointerEvents: input.style.pointerEvents,
                    opacity: input.style.opacity,
                    background: input.style.background
                }
            });
            
            // Try to focus each input
            try {
                input.focus();
                console.log(`Successfully focused input ${input.id}`);
            } catch (error) {
                console.error(`Failed to focus input ${input.id}:`, error);
            }
        });
        
        // Test clicking on inputs
        inputs.forEach((input, index) => {
            try {
                input.click();
                console.log(`Successfully clicked input ${input.id}`);
            } catch (error) {
                console.error(`Failed to click input ${input.id}:`, error);
            }
        });
        
        alert('Check console for form input test results');
    };
    
    // Global function to force enable modal inputs (for debug buttons)
    window.forceModalFocus = function() {
        console.log('Force modal focus called...');
        
        // Force window to front
        if (window.electronAPI && window.electronAPI.focusWindow) {
            window.electronAPI.focusWindow();
        }
        window.focus();
        
        // Force enable all modal inputs
        forceEnableModalInputs();
        
        console.log('Force modal focus completed');
    };
    
    // Global function to test modal inputs
    window.testEditModalInputs = function() {
        console.log('Testing edit modal inputs...');
        
        const modal = document.getElementById('editModal');
        if (!modal) {
            console.log('Modal not found');
            return;
        }
        
        const inputs = modal.querySelectorAll('input, select, textarea');
        console.log('Found inputs:', inputs.length);
        
        inputs.forEach((input, index) => {
            console.log(`Input ${index + 1}:`, {
                id: input.id,
                type: input.type,
                disabled: input.disabled,
                readonly: input.readOnly,
                value: input.value,
                style: {
                    pointerEvents: input.style.pointerEvents,
                    opacity: input.style.opacity,
                    background: input.style.background,
                    color: input.style.color,
                    cursor: input.style.cursor,
                    zIndex: input.style.zIndex
                }
            });
            
            // Try to focus each input
            try {
                input.focus();
                console.log(`Successfully focused: ${input.id}`);
            } catch (error) {
                console.log(`Failed to focus: ${input.id}`, error);
            }
        });
        
        // Force enable inputs
        forceEnableModalInputs();
        
        console.log('Edit modal input test completed');
    };
    
    // DEBUG: Check for hidden modals or overlays
    function checkForBlockingElements() {
        console.log('DEBUG: Checking for blocking elements...');
        
        // Check for modal backdrops
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach((backdrop, index) => {
            console.log(`DEBUG: Found modal backdrop ${index}:`, backdrop);
            if (backdrop.style.display !== 'none') {
                console.log('DEBUG: Removing modal backdrop');
                backdrop.remove();
            }
        });
        
        // Check for any elements with high z-index that might be blocking
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            const zIndex = window.getComputedStyle(element).zIndex;
            if (zIndex && parseInt(zIndex) > 1000) {
                console.log('DEBUG: High z-index element:', element, 'z-index:', zIndex);
            }
        });
        
        // Check for any hidden modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach((modal, index) => {
            console.log(`DEBUG: Modal ${index}:`, modal.id, 'display:', window.getComputedStyle(modal).display);
        });
    }
    
    // Run the check after a short delay
    setTimeout(checkForBlockingElements, 1000);
    
    // Initialize the application
    initializeElements();
}); 
