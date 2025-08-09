// Import Analysis Dashboard
window.addEventListener('load', () => {
    // Data storage
    let configurations = [];
    let cards = [];
    let analysisData = [];
    let originalHypaCsvData = null;
    let originalHypaCsvHeaders = null;
    let hasSavedImportState = false;
    
    // DOM Elements
    let refreshAnalysisBtn;
    let startImportBtn;
    let exportAnalysisBtn;
    let filterStatusBtn;
    let analysisTableBody;
    let csvFileInput;
    let analyzeCsvBtn;

    // Initialize the application
    async function initializeElements() {
        // Add global function for clearing caches (preserves imported Hypa CSV data)
        window.clearAllCaches = async function() {
            try {
                localStorage.clear();
                sessionStorage.clear();
                // Note: Not clearing import cache to preserve imported Hypa CSV data
                await loadData();
                showAnalysisToast('Caches cleared and data reloaded (imported Hypa CSV preserved)', 'success');
            } catch (error) {
                console.error('Error clearing caches:', error);
                showAnalysisToast('Error clearing caches: ' + error.message, 'error');
            }
        };
        
        // Load data
        await loadData();
        
        // Set up export button
        setupExportButton();
    }

    async function loadData() {
        localStorage.removeItem('cards');
        localStorage.removeItem('configurations');
        localStorage.removeItem('hypaCsvCache');

        try {
            // Load configurations
            const configResponse = await fetch('/api/configurations');
            if (configResponse.ok) {
                configurations = await configResponse.json();
            }

            // Load cards
            const cardsResponse = await fetch('/api/load-cards');
            if (cardsResponse.ok) {
                cards = await cardsResponse.json();
                // Make cards available globally
                window.cards = cards;
            }

            // Load hypa CSV cache
            const hypaResponse = await fetch('/api/hypa-csv-cache');
            if (hypaResponse.ok) {
                const hypaData = await hypaResponse.json();
                originalHypaCsvData = hypaData.data || [];
                originalHypaCsvHeaders = hypaData.headers || [];
            }

            // Note: Cache clearing removed to preserve imported Hypa CSV data

            performAnalysis();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    function performAnalysis() {
        console.log('Performing analysis...');
        // Basic analysis - just update statistics
        updateStatistics();
    }

    function updateStatistics() {
        console.log('Updating statistics...');
        
        // Update BigCommerce Variants count (unique SKUs)
        const totalConfigsElement = document.getElementById('totalConfigs');
        if (totalConfigsElement && cards) {
            // Count unique SKUs from cards
            const uniqueSkus = new Set();
            cards.forEach(card => {
                if (card.sku) {
                    uniqueSkus.add(card.sku);
                }
                // Also add variant SKUs from configurations
                if (card.configuration && card.configuration.variants) {
                    card.configuration.variants.forEach(variant => {
                        if (variant.sku) {
                            uniqueSkus.add(variant.sku);
                        }
                    });
                }
            });
            totalConfigsElement.textContent = uniqueSkus.size || 0;
        }
        
        // Update Cards Created count
        const totalCardsElement = document.getElementById('totalCards');
        if (totalCardsElement && cards) {
            totalCardsElement.textContent = cards.length || 0;
        }
        
        // Update Images count (unique image URLs)
        const totalImagesElement = document.getElementById('totalImages');
        if (totalImagesElement && cards) {
            const uniqueImages = new Set();
            cards.forEach(card => {
                if (card.imageUrl) {
                    uniqueImages.add(card.imageUrl);
                }
            });
            totalImagesElement.textContent = uniqueImages.size || 0;
        }
        
        // Update Hypa Metafields statistics
        const totalHypaImportedElement = document.getElementById('totalHypaImported');
        const totalHypaExportedElement = document.getElementById('totalHypaExported');
        
        if (totalHypaImportedElement) {
            // Count imported Hypa data
            if (originalHypaCsvData && originalHypaCsvData.length > 0) {
                totalHypaImportedElement.textContent = originalHypaCsvData.length;
            } else {
                totalHypaImportedElement.textContent = '0';
            }
        }
        
        if (totalHypaExportedElement) {
            // This would be updated when export is completed
            totalHypaExportedElement.textContent = '0';
        }
        
        console.log('✅ Statistics updated');
    }

    function showAnalysisToast(message, type = 'info') {
        // Toast notification function
        console.log(`Toast: ${message} (${type})`);
    }

    // ===== SIMPLE EXPORT SYSTEM =====
    
    function setupExportButton() {
        const exportBtn = document.getElementById('exportHypaBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', handleExportClick);
            console.log('✅ Export button setup complete');
        }
    }

    function handleExportClick() {
        console.log('🚀 Export button clicked - starting simple export...');
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('exportHypaModal'));
        modal.show();
        
        // After modal opens, run the export and show selection step immediately
        setTimeout(() => {
            runSimpleExport();
            // Force show selection step
            showSelectionStep();
        }, 300);
    }

    function runSimpleExport() {
        console.log('🔍 Running simple export...');
        
        // Step 1: Prepare export data
        const exportData = prepareExportData();
        console.log(`📊 Prepared ${exportData.length} items for export`);
        
        // Step 2: Show cards in modal
        displayExportCards(exportData);
        
        // Step 3: Update modal to show selection step
        showSelectionStep();
    }

    function prepareExportData() {
        if (!cards || cards.length === 0) {
            console.log('❌ No cards available for export');
            return [];
        }

        console.log(`📋 Preparing ${cards.length} cards for export...`);
        
        // Get all unique SKUs from the cards
        const allSkus = [];
        console.log(`🔍 Analyzing ${cards.length} cards for SKUs...`);
        
        cards.forEach((card, index) => {
            console.log(`📋 Card ${index + 1}:`, {
                sku: card.sku,
                cardType: card.cardType,
                hasConfig: !!card.configuration,
                hasVariants: !!(card.configuration && card.configuration.variants),
                variantCount: card.configuration?.variants?.length || 0
            });
            
            // Each card has its own SKU - add it to the list
            if (card.sku && !allSkus.includes(card.sku)) {
                allSkus.push(card.sku);
                console.log(`  ✅ Added SKU: ${card.sku}`);
            }
        });
        
        console.log(`📋 Found ${allSkus.length} unique SKUs from cards:`, allSkus);
        
        // Initialize groups for each SKU
        const groupedBySku = {};
        allSkus.forEach(sku => {
            groupedBySku[sku] = [];
        });
        
        // Group cards by configuration (brand/model/generation) to identify shared cards
        const cardsByConfig = {};
        cards.forEach(card => {
            if (card.configuration) {
                const configKey = `${card.configuration.brand}-${card.configuration.model}-${card.configuration.generation}`;
                if (!cardsByConfig[configKey]) {
                    cardsByConfig[configKey] = [];
                }
                cardsByConfig[configKey].push(card);
            }
        });
        
        console.log('🔍 Cards grouped by configuration:', Object.keys(cardsByConfig));
        
        // Add cards to SKU groups
        cards.forEach(card => {
            const cardSku = card.sku;
            if (cardSku && groupedBySku[cardSku]) {
                // Add this card to its own SKU group
                groupedBySku[cardSku].push(card);
                
                                // For shared cards (features, options, cargo), also add to other SKUs in same configuration
                // Note: spec tables should remain individual per SKU, not shared
                if (card.cardType === 'feature' || card.cardType === 'product-options' || card.cardType === 'cargo-options') {
                    if (card.configuration) {
                        const configKey = `${card.configuration.brand}-${card.configuration.model}-${card.configuration.generation}`;
                        const configCards = cardsByConfig[configKey] || [];
                        
                        // Add this shared card to all SKUs in the same configuration
                        configCards.forEach(configCard => {
                            const configSku = configCard.sku;
                            if (configSku && configSku !== cardSku && groupedBySku[configSku]) {
                                // Create a copy of the card for this SKU
                                const cardCopy = {
                                    ...card,
                                    sku: configSku,
                                    // Keep original SKU for reference
                                    originalSku: card.sku
                                };
                                groupedBySku[configSku].push(cardCopy);
                            }
                        });
                    }
                }
                
                // Debug: Log spec table assignments
                if (card.cardType === 'specification-table') {
                    console.log(`🔍 Spec table for ${cardSku}: "${card.title}" - NOT duplicated`);
                }
            }
        });

        // Convert to export format
        const exportItems = Object.keys(groupedBySku).map(sku => ({
            sku: sku,
            cards: groupedBySku[sku],
            cardCount: groupedBySku[sku].length,
            model: groupedBySku[sku][0]?.configuration?.model || 'Unknown',
            brand: groupedBySku[sku][0]?.configuration?.brand || 'Unknown',
            generation: groupedBySku[sku][0]?.configuration?.generation || 'Unknown'
        }));

        // Debug: Log card counts for each SKU
        console.log('📊 Card counts by SKU:');
        exportItems.forEach(item => {
            console.log(`  ${item.sku}: ${item.cardCount} cards`);
            if (item.generation === 'Packster2') {
                console.log(`    Brand: ${item.brand}, Model: ${item.model}, Generation: ${item.generation}`);
                console.log(`    Card types: ${item.cards.map(c => c.cardType).join(', ')}`);
            }
        });

        console.log(`✅ Created ${exportItems.length} SKU groups for export`);
        
        // Debug: Show some sample data
        if (exportItems.length > 0) {
            console.log('🔍 Sample export item:', exportItems[0]);
            console.log('🔍 Sample card configuration:', exportItems[0].cards[0]?.configuration);
            console.log('🔍 Sample card data:', exportItems[0].cards[0]);
        }
        
        return exportItems;
    }

    function generateVariantSpecContent(originalCard, variant) {
        // Get the original spec table content
        const originalContent = originalCard.content || originalCard.description || '';
        
        // Extract the variant name and SKU
        const variantName = variant.name || variant.sku || 'Unknown Variant';
        const variantSku = variant.sku || 'Unknown SKU';
        
        // Create variant-specific title
        const variantTitle = `The ${originalCard.configuration?.model || 'Model'} ${variantName} in detail`;
        
        // Replace the title in the spec table content
        let variantContent = originalContent;
        
        // Replace the main title (h2) with variant-specific title
        variantContent = variantContent.replace(
            /<h2[^>]*>([^<]+)<\/h2>/,
            `<h2 class="s-12 m-12 l-12">${variantTitle}</h2>`
        );
        
        // Add variant information to the spec table if it doesn't exist
        if (!variantContent.includes('Variant') && !variantContent.includes('SKU')) {
            // Find the specs table and add variant info at the beginning
            const specsTableMatch = variantContent.match(/(<div class="specs__table">)/);
            if (specsTableMatch) {
                const variantInfo = `
          <div class="specs__item">
            <div class="specs__item-inner">
              <span class="specs__name">Variant</span>
              <span class="specs__value">${variantName}</span>
            </div>
          </div>
          <div class="specs__item">
            <div class="specs__item-inner">
              <span class="specs__name">SKU</span>
              <span class="specs__value">${variantSku}</span>
            </div>
          </div>`;
                
                variantContent = variantContent.replace(
                    /(<div class="specs__table">)/,
                    `$1${variantInfo}`
                );
            }
        }
        
        return variantContent;
    }

    function displayExportCards(exportData) {
        console.log('🎨 Displaying export cards...');
        
        const container = document.getElementById('productCardsContainer');
        if (!container) {
            console.error('❌ productCardsContainer not found');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Create cards for each SKU
        exportData.forEach((item, index) => {
            const cardHtml = createSkuCard(item, index);
            container.innerHTML += cardHtml;
        });

        console.log(`✅ Displayed ${exportData.length} SKU cards`);
        
        // Store export data globally for export function
        window.currentExportData = exportData;
        
        // Add event listeners to checkboxes for summary updates
        setTimeout(() => {
            const checkboxes = container.querySelectorAll('.sku-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', updateExportSummary);
            });
            console.log(`✅ Added change listeners to ${checkboxes.length} checkboxes`);
            
            // Initial summary update
            updateExportSummary();
        }, 100);
        
        // Debug: Check if cards are actually visible
        setTimeout(() => {
            const skuCards = container.querySelectorAll('.sku-card');
            console.log(`🔍 Found ${skuCards.length} SKU cards in DOM`);
            if (skuCards.length === 0) {
                console.error('❌ No cards found in container!');
            } else {
                console.log('✅ Cards are visible in the interface');
            }
        }, 500);
    }

    function createSkuCard(item, index) {
        const cardTypes = item.cards.map(card => card.cardType).join(', ');
        const hasImages = item.cards.some(card => card.imageUrl);
        
        // Get variant information from the first card's configuration
        const firstCard = item.cards[0];
        const config = firstCard?.configuration || {};
        const variants = config.variants || [];
        
        // Find the specific variant for this SKU
        const variantInfo = variants.find(v => v.sku === item.sku);
        const variantName = variantInfo ? variantInfo.name : 'Unknown Variant';
        
        // Create a descriptive title
        const descriptiveTitle = `${item.brand} ${item.model} ${item.generation} - ${variantName}`;
        
        return `
            <div class="card mb-3 sku-card" data-sku="${item.sku}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-box me-2"></i>
                        <strong>${descriptiveTitle}</strong>
                        <br><small class="text-muted">SKU: ${item.sku}</small>
                    </h6>
                    <div class="form-check">
                        <input class="form-check-input sku-checkbox" type="checkbox" 
                               id="sku_${index}" data-sku="${item.sku}" checked>
                        <label class="form-check-label" for="sku_${index}">
                            Export
                        </label>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Brand:</strong> ${item.brand}</p>
                            <p><strong>Model:</strong> ${item.model}</p>
                            <p><strong>Generation:</strong> ${item.generation}</p>
                            <p><strong>Variant:</strong> ${variantName}</p>
                            <p><strong>Cards:</strong> ${item.cardCount}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Types:</strong> ${cardTypes}</p>
                            <p><strong>Images:</strong> ${hasImages ? '✅ Yes' : '❌ No'}</p>
                            <p><strong>Status:</strong> <span class="badge bg-success">Ready</span></p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function showSelectionStep() {
        console.log('📋 Showing selection step...');
        
        // Hide other steps
        const analysisStep = document.getElementById('exportAnalysisStep');
        const comparisonStep = document.getElementById('exportComparisonStep');
        const selectionStep = document.getElementById('exportSelectionStep');
        const finalStep = document.getElementById('exportFinalStep');
        
        if (analysisStep) {
            analysisStep.style.display = 'none';
            console.log('✅ Hidden analysis step');
        }
        if (comparisonStep) {
            comparisonStep.style.display = 'none';
            console.log('✅ Hidden comparison step');
        }
        if (finalStep) {
            finalStep.style.display = 'none';
            console.log('✅ Hidden final step');
        }
        if (selectionStep) {
            selectionStep.style.display = 'block';
            console.log('✅ Showed selection step');
        }
        
        // Update progress
        const progressBar = document.getElementById('exportProgress');
        if (progressBar) progressBar.style.width = '75%';
        
        // Force the container to be visible
        const container = document.getElementById('productCardsContainer');
        if (container) {
            container.style.display = 'block';
            container.style.visibility = 'visible';
            console.log('✅ Forced container visibility');
        }
        
        console.log('✅ Selection step displayed');
        
        // Hide the "Continue to Selection" button since we're already in selection
        const continueBtn = document.getElementById('continueToSelectionBtn');
        if (continueBtn) {
            continueBtn.style.display = 'none';
            console.log('✅ Hidden "Continue to Selection" button');
        }
        
        // Setup search and filter functionality
        setTimeout(() => {
            setupSearchAndFilter();
        }, 100);
        
        // Add a "Continue to Export" button to replace the hidden one
        const modalFooter = document.querySelector('#exportHypaModal .modal-footer .d-flex.gap-2');
        if (modalFooter && !document.getElementById('continueToExportBtn')) {
            const exportBtn = document.createElement('button');
            exportBtn.type = 'button';
            exportBtn.className = 'btn btn-sm btn-success';
            exportBtn.id = 'continueToExportBtn';
            exportBtn.innerHTML = '<i class="fas fa-download me-1"></i>Continue to Export';
            exportBtn.onclick = function() {
                console.log('🧪 Continue to Export clicked');
                exportSelectedCards();
            };
            modalFooter.appendChild(exportBtn);
            console.log('✅ Added "Continue to Export" button');
        }
    }

    // Global test function
    window.testSimpleExport = function() {
        console.log('🧪 Testing simple export...');
        runSimpleExport();
    };

    // Fix modal backdrop issue
    function setupModalCloseHandlers() {
        const exportModal = document.getElementById('exportHypaModal');
        if (exportModal) {
            // Handle modal close events
            exportModal.addEventListener('hidden.bs.modal', function () {
                console.log('Export modal hidden - cleaning up backdrop...');
                // Remove any lingering backdrops
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => {
                    backdrop.remove();
                });
                // Remove modal-open class from body
                document.body.classList.remove('modal-open');
                // Remove any inline styles that might be blocking
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            });

            // Handle close button clicks
            const closeButtons = exportModal.querySelectorAll('[data-bs-dismiss="modal"]');
            closeButtons.forEach(button => {
                button.addEventListener('click', function() {
                    console.log('Close button clicked - ensuring proper cleanup...');
                    // Force backdrop removal after a short delay
                    setTimeout(() => {
                        const backdrops = document.querySelectorAll('.modal-backdrop');
                        backdrops.forEach(backdrop => {
                            backdrop.remove();
                        });
                        document.body.classList.remove('modal-open');
                        document.body.style.overflow = '';
                        document.body.style.paddingRight = '';
                    }, 100);
                });
            });
        }
    }

    // Initialize modal close handlers when the page loads
    setupModalCloseHandlers();
    
    // Set up Hypa import functionality
    setupHypaImport();
    
    // Set up BigCommerce import functionality
    setupBigCommerceImport();
    
    // Initialize import history table
    updateImportHistoryTable();
    
    function setupHypaImport() {
        const hypaCsvFileInput = document.getElementById('hypaCsvFile');
        const confirmHypaImportBtn = document.getElementById('confirmHypaImportBtn');
        
        if (hypaCsvFileInput && confirmHypaImportBtn) {
            // Handle file selection
            hypaCsvFileInput.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (file) {
                    console.log('📁 Hypa CSV file selected:', file.name);
                    confirmHypaImportBtn.disabled = false;
                    confirmHypaImportBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Import Hypa CSV';
                    confirmHypaImportBtn.onclick = () => importHypaCsv(file);
                } else {
                    confirmHypaImportBtn.disabled = true;
                    confirmHypaImportBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Select File First';
                }
            });
            
            // Handle import button click
            confirmHypaImportBtn.addEventListener('click', function() {
                const file = hypaCsvFileInput.files[0];
                if (file) {
                    importHypaCsv(file);
                }
            });
        }
    }
    
    async function importHypaCsv(file) {
        console.log('🚀 Starting Hypa CSV import...');
        
        // Show progress indicator
        const importBtn = document.getElementById('confirmHypaImportBtn');
        const originalText = importBtn.innerHTML;
        importBtn.disabled = true;
        importBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Importing...';
        
        try {
            const formData = new FormData();
            formData.append('hypaCsvFile', file);
            
            // Update progress
            importBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading file...';
            
            const response = await fetch('/api/import-hypa-csv', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Hypa CSV import successful:', result);
                
                // Update progress
                importBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing data...';
                
                // Reload data to include the imported Hypa CSV
                await loadData();
                
                // Update statistics to reflect the imported data
                updateStatistics();
                
                // Update progress to success
                importBtn.innerHTML = '<i class="fas fa-check me-2"></i>Import Complete!';
                importBtn.classList.remove('btn-primary');
                importBtn.classList.add('btn-success');
                
                showAnalysisToast('Hypa CSV imported successfully!', 'success');
                
                // Calculate unique SKUs from the imported data
                const uniqueSkus = new Set();
                if (result.data && Array.isArray(result.data)) {
                    result.data.forEach(row => {
                        if (row.sku) {
                            uniqueSkus.add(row.sku);
                        }
                    });
                }
                
                // Add to import history
                addImportHistoryEntry({
                    type: 'Hypa CSV',
                    fileName: file.name,
                    items: uniqueSkus.size,
                    success: uniqueSkus.size,
                    errors: 0,
                    status: 'success',
                    details: `Imported ${uniqueSkus.size} products/variants (SKUs) from ${result.rows} rows`
                });
                
                // Auto-close modal after 2 seconds
                setTimeout(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('importHypaModal'));
                    if (modal) {
                        modal.hide();
                    }
                    
                    // Reset button after modal closes
                    setTimeout(() => {
                        importBtn.disabled = false;
                        importBtn.innerHTML = originalText;
                        importBtn.classList.remove('btn-success');
                        importBtn.classList.add('btn-primary');
                    }, 500);
                }, 2000);
                
            } else {
                const error = await response.json();
                console.error('❌ Hypa CSV import failed:', error);
                showAnalysisToast('Import failed: ' + (error.message || 'Unknown error'), 'error');
                
                // Add to import history as error
                addImportHistoryEntry({
                    type: 'Hypa CSV',
                    fileName: file.name,
                    items: 0,
                    success: 0,
                    errors: 1,
                    status: 'error',
                    details: `Import failed: ${error.message || 'Unknown error'}`
                });
                
                // Reset button on error
                importBtn.disabled = false;
                importBtn.innerHTML = originalText;
            }
        } catch (error) {
            console.error('❌ Error importing Hypa CSV:', error);
            showAnalysisToast('Import failed: ' + error.message, 'error');
            
            // Reset button on error
            importBtn.disabled = false;
            importBtn.innerHTML = originalText;
        }
    }
    
    function setupBigCommerceImport() {
        const bigcommerceCsvFileInput = document.getElementById('bigcommerceCsvFile');
        const uploadAndValidateBigCommerceBtn = document.getElementById('uploadAndValidateBigCommerceBtn');
        
        if (bigcommerceCsvFileInput && uploadAndValidateBigCommerceBtn) {
            // Handle file selection
            bigcommerceCsvFileInput.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (file) {
                    console.log('📁 BigCommerce CSV file selected:', file.name);
                    uploadAndValidateBigCommerceBtn.disabled = false;
                    uploadAndValidateBigCommerceBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload & Validate';
                } else {
                    uploadAndValidateBigCommerceBtn.disabled = true;
                    uploadAndValidateBigCommerceBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Select File First';
                }
            });
            
            // Handle upload button click
            uploadAndValidateBigCommerceBtn.addEventListener('click', function() {
                uploadAndValidateBigCommerce();
            });
        }
    }

    // Test function that shows cards directly on the page (bypasses modal)
    window.testDirectCards = function() {
        console.log('🧪 Testing direct card display...');
        
        const exportData = prepareExportData();
        console.log(`📊 Prepared ${exportData.length} items for display`);
        
        // Create a simple container on the page
        let testContainer = document.getElementById('testCardsContainer');
        if (!testContainer) {
            testContainer = document.createElement('div');
            testContainer.id = 'testCardsContainer';
            testContainer.style.cssText = 'position: fixed; top: 50px; left: 50px; width: 80%; height: 80%; background: white; border: 2px solid red; z-index: 9999; overflow-y: auto; padding: 20px;';
            testContainer.innerHTML = '<h3>Test Cards Display</h3><button onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px;">Close</button>';
            document.body.appendChild(testContainer);
        }
        
        // Display cards in the test container
        exportData.forEach((item, index) => {
            const cardHtml = createSkuCard(item, index);
            testContainer.innerHTML += cardHtml;
        });
        
        console.log(`✅ Displayed ${exportData.length} cards in test container`);
    };



    // Missing functions that the HTML references
    window.toggleSelectAll = function() {
        // Get ALL cards (not just visible ones)
        const allCards = document.querySelectorAll('.sku-card');
        const checkboxes = Array.from(allCards).map(card => card.querySelector('.sku-checkbox')).filter(cb => cb);
        const allChecked = checkboxes.every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        
        // Update summary after selection change
        updateExportSummary();
    };

    window.selectFilteredResults = function() {
        // Select only currently visible cards (but keep existing selections)
        const skuCards = document.querySelectorAll('.sku-card');
        let selectedCount = 0;
        let totalVisible = 0;
        
        skuCards.forEach(card => {
            // Check if card is currently visible
            const isVisible = card.style.display !== 'none' && card.style.visibility !== 'hidden';
            
            if (isVisible) {
                totalVisible++;
                const checkbox = card.querySelector('.sku-checkbox');
                if (checkbox) {
                    checkbox.checked = true;
                    selectedCount++;
                }
            }
            // Note: We don't uncheck hidden cards - they keep their selection state
        });
        
        // Update summary after selection change
        updateExportSummary();
    };

    window.clearSearchBox = function() {
        const searchBox = document.getElementById('productSearchFilter');
        if (searchBox) {
            searchBox.value = '';
            // Show all cards when search is cleared
            showAllCards();
        }
    };

    // Search and filter functionality
    function setupSearchAndFilter() {
        const searchBox = document.getElementById('productSearchFilter');
        const filterSelect = document.getElementById('showFilter');
        
        if (searchBox) {
            searchBox.addEventListener('input', function() {
                filterCards();
            });
        }
        
        if (filterSelect) {
            filterSelect.addEventListener('change', function() {
                filterCards();
            });
        }
    }

    function filterCards() {
        const searchTerm = document.getElementById('productSearchFilter')?.value.toLowerCase() || '';
        const filterValue = document.getElementById('showFilter')?.value || 'all';
        
        const skuCards = document.querySelectorAll('.sku-card');
        let visibleCount = 0;
        
        console.log(`🔍 Processing ${skuCards.length} cards for search: "${searchTerm}"`);
        
        skuCards.forEach(card => {
            const sku = card.getAttribute('data-sku') || '';
            const cardText = card.textContent.toLowerCase();
            
            // Enhanced search - look for SKU, brand, model, generation
            const brandMatch = cardText.match(/brand:\s*([^\n]+)/i);
            const modelMatch = cardText.match(/model:\s*([^\n]+)/i);
            const generationMatch = cardText.match(/generation:\s*([^\n]+)/i);
            const brand = brandMatch ? brandMatch[1].toLowerCase() : '';
            const model = modelMatch ? modelMatch[1].toLowerCase() : '';
            const generation = generationMatch ? generationMatch[1].toLowerCase() : '';
            
            // Debug: Log what we're searching in
            if (searchTerm === 'packster2') {
                console.log(`🔍 Debug for Packster2 - SKU: ${sku}, Brand: ${brand}, Model: ${model}, Generation: ${generation}`);
                console.log(`🔍 Full card text: ${cardText}`);
            }
            
            // Check if search term matches any part
            const matchesSearch = searchTerm === '' || 
                cardText.includes(searchTerm) || 
                sku.toLowerCase().includes(searchTerm) ||
                brand.includes(searchTerm) ||
                model.includes(searchTerm) ||
                generation.includes(searchTerm);
            
            // Debug for packster2 search
            if (searchTerm === 'packster2') {
                console.log(`🔍 Card ${sku}: cardText.includes="${cardText.includes(searchTerm)}", sku.includes="${sku.toLowerCase().includes(searchTerm)}", brand.includes="${brand.includes(searchTerm)}", model.includes="${model.includes(searchTerm)}", generation.includes="${generation.includes(searchTerm)}"`);
            }
            
            // Apply filter logic
            let matchesFilter = true;
            if (filterValue === 'exportable') {
                // For now, all cards are exportable
                matchesFilter = true;
            } else if (filterValue === 'new') {
                // For now, all cards are new
                matchesFilter = true;
            } else if (filterValue === 'updated') {
                // For now, no cards are updated
                matchesFilter = false;
            } else if (filterValue === 'remove') {
                // For now, no cards are for removal
                matchesFilter = false;
            }
            
            if (matchesSearch && matchesFilter) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        console.log(`✅ Filtered to ${visibleCount} visible cards`);
    }

    function showAllCards() {
        const skuCards = document.querySelectorAll('.sku-card');
        skuCards.forEach(card => {
            card.style.display = 'block';
        });
        console.log(`✅ Showed all ${skuCards.length} cards`);
    }

    async function exportSelectedCards() {
        console.log('🚀 Starting export of selected cards...');
        
        // Show progress indicator
        const exportBtn = document.getElementById('confirmExportBtn');
        if (!exportBtn) {
            console.error('❌ Export button not found');
            showAnalysisToast('Export button not found. Please refresh the page.', 'error');
            return;
        }
        
        const originalText = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exporting...';
        
        try {
        const selectedCards = [];
        const skuCards = document.querySelectorAll('.sku-card');
        
        skuCards.forEach(card => {
            const checkbox = card.querySelector('.sku-checkbox');
            if (checkbox && checkbox.checked) {
                const sku = card.getAttribute('data-sku');
                // Find the corresponding export data for this SKU
                const exportData = window.currentExportData?.find(item => item.sku === sku);
                if (exportData) {
                    selectedCards.push(exportData);
                }
            }
        });
        
        console.log(`📋 Found ${selectedCards.length} selected SKUs for export`);
        
        if (selectedCards.length === 0) {
                showAnalysisToast('No cards selected for export. Please select at least one SKU.', 'error');
            return;
        }
            
            // Update progress
            if (exportBtn) {
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating CSV...';
            }
        
        // Generate CSV
        const csvContent = await generateHypaCsv(selectedCards);
            
            // Update progress
            if (exportBtn) {
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating file...';
            }
        
        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `hypa-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
            
            // Update progress to success
            if (exportBtn) {
                exportBtn.innerHTML = '<i class="fas fa-check me-2"></i>Export Complete!';
                exportBtn.classList.remove('btn-primary');
                exportBtn.classList.add('btn-success');
            }
        
        console.log('✅ Export completed successfully');
            showAnalysisToast(`Successfully exported ${selectedCards.length} SKUs to CSV file!`, 'success');
            
            // Auto-close modal after 2 seconds
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('exportHypaModal'));
                if (modal) {
                    modal.hide();
                }
                
                // Reset button after modal closes
                setTimeout(() => {
                    if (exportBtn) {
                        exportBtn.disabled = false;
                        exportBtn.innerHTML = originalText;
                        exportBtn.classList.remove('btn-success');
                        exportBtn.classList.add('btn-primary');
                    }
                }, 500);
            }, 2000);
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            showAnalysisToast('Export failed: ' + error.message, 'error');
            
            // Reset button on error
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalText;
            }
        }
    }

    async function generateHypaCsv(selectedCards) {
        console.log('📊 Generating Hypa CSV format...');
        
        // Load HTML templates
        const templates = await loadHtmlTemplates();
        
        // CSV header - Hypa format with shared namespace keys
        const headers = [
            'id',
            'sku',
            'shared.feature-1-card',
            'shared.feature-2-card',
            'shared.feature-3-card',
            'shared.feature-4-card',
            'shared.feature-5-card',
            'shared.feature-6-card',
            'shared.feature-7-card',
            'shared.feature-8-card',
            'shared.feature-9-card',
            'shared.feature-10-card',
            'shared.option-1-card',
            'shared.option-2-card',
            'shared.option-3-card',
            'shared.option-4-card',
            'shared.option-5-card',
            'shared.option-6-card',
            'shared.option-7-card',
            'shared.option-8-card',
            'shared.option-9-card',
            'shared.option-10-card',
            'shared.option-11-card',
            'shared.option-12-card',
            'shared.spec-table',
            'shared.cargo-option-1-card',
            'shared.cargo-option-2-card',
            'shared.cargo-option-3-card',
            'shared.cargo-option-4-card',
            'shared.cargo-option-5-card',
            'shared.cargo-option-6-card',
            'shared.cargo-option-7-card',
            'shared.cargo-option-8-card',
            'shared.cargo-option-9-card',
            'shared.cargo-option-10-card',
            'shared.cargo-option-11-card',
            'shared.cargo-option-12-card',
            'shared.weather-option-1-card',
            'shared.weather-option-2-card',
            'shared.weather-option-3-card',
            'shared.weather-option-4-card',
            'shared.weather-option-5-card',
            'shared.weather-option-6-card',
            'shared.weather-option-7-card',
            'shared.weather-option-8-card',
            'shared.weather-option-9-card',
            'shared.weather-option-10-card',
            'shared.weather-option-11-card',
            'shared.weather-option-12-card'
        ];
        
        const csvRows = [headers.join(',')];
        
        // Load the reference CSV to get the correct IDs
        const referenceCsv = await loadReferenceCsv();
        const validSkus = getValidSkus(referenceCsv);
        
        // Debug: Log what SKUs are being selected vs what's in the reference CSV
        console.log('🔍 Selected SKUs:', selectedCards.map(s => s.sku));
        console.log('🔍 Valid SKUs from reference CSV:', validSkus);
        
        // Use all selected cards - generate new IDs for those not in reference CSV
        const validSelectedCards = selectedCards;
        console.log(`📊 Exporting ${validSelectedCards.length} SKUs (including new ones)`);
        
        validSelectedCards.forEach(skuData => {
            console.log(`🔍 Processing SKU: ${skuData.sku} with ${skuData.cards.length} cards`);
            
            // Find the correct numeric ID from imported Hypa CSV for this SKU
            const referenceRow = referenceCsv.find(row => row.sku === skuData.sku);
            let numericId;
            
            if (referenceRow) {
                // Use existing ID from reference CSV
                numericId = referenceRow.id;
                console.log(`🔍 Using existing numeric ID ${numericId} for SKU ${skuData.sku}`);
            } else {
                // Generate new ID for new SKU
                const maxId = Math.max(...referenceCsv.map(row => parseInt(row.id) || 0), 0);
                numericId = maxId + 1;
                console.log(`🔍 Generated new numeric ID ${numericId} for new SKU ${skuData.sku} (not found in cache)`);
            }
            
            // Create a row with all columns initialized to empty
            const row = new Array(headers.length).fill('');
            row[0] = numericId; // id column - use numeric ID from imported data
            row[1] = skuData.sku; // sku column
            
            // Organize cards by type and position
            const cardsByType = {
                'feature': [],
                'product-options': [],
                'cargo-options': [],
                'weather-protection': [],
                'specification-table': []
            };
            
            // Sort cards into their types
            skuData.cards.forEach(card => {
                const cardType = card.cardType || 'unknown';
                if (cardsByType[cardType]) {
                    cardsByType[cardType].push(card);
                }
            });
            
            // Sort each type by position
            Object.keys(cardsByType).forEach(cardType => {
                cardsByType[cardType].sort((a, b) => {
                    const posA = a.position || 0;
                    const posB = b.position || 0;
                    return posA - posB;
                });
            });
            
            // Map cards to the correct columns
            cardsByType['feature'].forEach((card, index) => {
                if (index < 10) { // feature-1 to feature-10
                    const columnIndex = 2 + index; // 2 is the first feature column
                const value = generateCardHtml(card, templates);
                    row[columnIndex] = `"${value.replace(/"/g, '""')}"`; // Escape quotes in HTML
                }
            });
            
            cardsByType['product-options'].forEach((card, index) => {
                if (index < 12) { // option-1 to option-12
                    const columnIndex = 12 + index; // 12 is the first option column
                    const value = generateCardHtml(card, templates);
                    row[columnIndex] = `"${value.replace(/"/g, '""')}"`; // Escape quotes in HTML
                }
            });
            
            cardsByType['specification-table'].forEach((card, index) => {
                if (index < 1) { // Only one spec-table column
                    const columnIndex = 24; // spec-table column
                    const value = generateCardHtml(card, templates);
                    row[columnIndex] = `"${value.replace(/"/g, '""')}"`; // Escape quotes in HTML
                }
            });
            
            cardsByType['cargo-options'].forEach((card, index) => {
                if (index < 12) { // cargo-option-1 to cargo-option-12
                    const columnIndex = 25 + index; // 25 is the first cargo-option column
                    const value = generateCardHtml(card, templates);
                    row[columnIndex] = `"${value.replace(/"/g, '""')}"`; // Escape quotes in HTML
                }
            });
            
            cardsByType['weather-protection'].forEach((card, index) => {
                if (index < 12) { // weather-option-1 to weather-option-12
                    const columnIndex = 37 + index; // 37 is the first weather-option column
                    const value = generateCardHtml(card, templates);
                    row[columnIndex] = `"${value.replace(/"/g, '""')}"`; // Escape quotes in HTML
                }
            });
            
            csvRows.push(row.join(','));
        });
        
        console.log(`✅ Generated CSV with ${csvRows.length - 1} rows`);
        return csvRows.join('\n');
    }

    async function loadHtmlTemplates() {
        console.log('📋 Loading HTML templates...');
        
        const templates = {};
        const templateFiles = {
            'feature': 'feature-card-template.html',
            'product-options': 'product-options-card-template.html',
            'cargo-options': 'cargo-options-card-template.html',
            'specification-table': 'specification-table-template.html'
        };
        
        for (const [cardType, filename] of Object.entries(templateFiles)) {
            try {
                const response = await fetch(`/reference-templates/${filename}`);
                if (response.ok) {
                    templates[cardType] = await response.text();
                    console.log(`✅ Loaded template for ${cardType}`);
                } else {
                    console.warn(`⚠️ Could not load template for ${cardType}`);
                }
            } catch (error) {
                console.error(`❌ Error loading template for ${cardType}:`, error);
            }
        }
        
        return templates;
    }

    async function loadReferenceCsv() {
        try {
            // Load the imported Hypa CSV data from cache
            const response = await fetch('/api/hypa-csv-cache');
            if (response.ok) {
                const cacheData = await response.json();
                if (cacheData.data && cacheData.data.length > 0) {
                    console.log(`📋 Loaded ${cacheData.data.length} rows from imported Hypa CSV cache`);
                    return cacheData.data;
            } else {
                    console.warn('⚠️ No imported Hypa CSV data found in cache');
                    return [];
                }
            } else {
                console.warn('⚠️ Could not load Hypa CSV cache');
                return [];
            }
        } catch (error) {
            console.error('❌ Error loading Hypa CSV cache:', error);
            return [];
        }
    }

    function parseCsvToRows(csvText) {
        const lines = csvText.split('\n');
        const rows = [];
        
        for (let i = 1; i < lines.length; i++) { // Skip header
            const line = lines[i].trim();
            if (line) {
                const columns = line.split(',');
                if (columns.length >= 3) {
                    rows.push({
                        id: columns[0],
                        name: columns[1],
                        key: columns[2]
                    });
                }
            }
        }
        
        return rows;
    }

    function getValidSkus(referenceCsv) {
        // Extract unique SKUs from reference CSV
        const validSkus = [...new Set(referenceCsv.map(row => row.sku))];
        console.log('📋 Valid SKUs from imported Hypa CSV:', validSkus);
        return validSkus;
    }

    function findCorrectId(referenceCsv, sku, key) {
        // Look for exact match first
        const exactMatch = referenceCsv.find(row => 
            row.sku === sku && row.key === key
        );
        
        if (exactMatch) {
            return exactMatch.id;
        }
        
        // If no exact match, find any row with same SKU and similar key
        const skuMatch = referenceCsv.find(row => 
            row.sku === sku && row.key.includes(key.split('-')[0]) // Match card type
        );
        
        if (skuMatch) {
            return skuMatch.id;
        }
        
        // No match found - this SKU/key combination doesn't exist in reference
        console.warn(`⚠️ No matching ID found for ${sku}:${key} - skipping this card`);
        return null; // Return null to indicate this should be skipped
    }

    function generateCardHtml(card, templates) {
        const cardType = card.cardType;
        const template = templates[cardType];
        
        console.log(`🔍 Processing card type: ${cardType}`);
        console.log(`🔍 Template available: ${!!template}`);
        
        if (!template) {
            console.warn(`⚠️ No template found for card type: ${cardType}`);
            return card.description || '';
        }
        
        // Extract data from card
        const cardData = {
            title: card.title || '',
            subtitle: card.subtitle || '',
            content: card.description || '',
            imageUrl: card.imageUrl || '',
            price: card.price || ''
        };
        
        console.log(`🔍 Card data:`, cardData);
        
        // Replace placeholders in template
        let html = template;
        Object.entries(cardData).forEach(([key, value]) => {
            const placeholder = `{${key}}`;
            html = html.replace(new RegExp(placeholder, 'g'), value);
        });
        
        console.log(`✅ Generated HTML for ${cardType} card: ${card.title}`);
        return html;
    }

    function updateExportSummary() {
        const skuCards = document.querySelectorAll('.sku-card');
        let selectedSkuCount = 0;
        let totalSkuCount = skuCards.length;
        let selectedCardCount = 0;
        let totalCardCount = 0;
        
        skuCards.forEach(card => {
            const checkbox = card.querySelector('.sku-checkbox');
            // Extract card count from the card's data attribute or text content
            const cardText = card.textContent;
            const cardCountMatch = cardText.match(/Cards:\s*(\d+)/);
            const cardCount = cardCountMatch ? parseInt(cardCountMatch[1]) : 0;
            
            if (checkbox && checkbox.checked) {
                selectedSkuCount++;
                selectedCardCount += cardCount;
            }
            totalCardCount += cardCount;
        });
        
        // Update summary elements
        const summaryTotal = document.getElementById('summaryTotal');
        const summaryNew = document.getElementById('summaryNew');
        const summaryUpdated = document.getElementById('summaryUpdated');
        const summaryRemove = document.getElementById('summaryRemove');
        
        if (summaryTotal) summaryTotal.textContent = `${selectedSkuCount} SKUs (${selectedCardCount} cards)`;
        if (summaryNew) summaryNew.textContent = `${selectedSkuCount} SKUs (${selectedCardCount} cards)`;
        if (summaryUpdated) summaryUpdated.textContent = '0 SKUs (0 cards)';
        if (summaryRemove) summaryRemove.textContent = '0 SKUs (0 cards)';
        
        console.log(`📊 Updated summary: ${selectedSkuCount} SKUs selected (${selectedCardCount} total cards) out of ${totalSkuCount} SKUs (${totalCardCount} total cards)`);
    }

    // Other missing functions (stubs for now)
    window.generateDeleteCsv = function() {
        console.log('🧪 Generate delete CSV clicked');
        alert('Delete CSV generation not implemented yet');
    };

    window.generateReplaceCsv = function() {
        console.log('🧪 Generate replace CSV clicked');
        alert('Replace CSV generation not implemented yet');
    };

    window.exportToHypaFormat = function() {
        console.log('🧪 Export to Hypa format clicked');
        alert('Export to Hypa format not implemented yet');
    };

    window.exportCardsToSimpleCsv = function() {
        console.log('🧪 Export cards to simple CSV clicked');
        alert('Export to simple CSV not implemented yet');
    };

    window.showPlaceholderCardSummary = function() {
        console.log('🧪 Show placeholder card summary clicked');
        alert('Placeholder card summary not implemented yet');
    };

    // Additional missing functions
    window.exportCardsToFile = function() {
        console.log('🧪 Export cards to file clicked');
        alert('Export cards to file not implemented yet');
    };

    window.migrateAndUpdateCards = function() {
        console.log('🧪 Migrate and update cards clicked');
        alert('Migrate and update cards not implemented yet');
    };

    window.cleanupBadCards = function() {
        console.log('🧪 Cleanup bad cards clicked');
        alert('Cleanup bad cards not implemented yet');
    };

    window.restoreImportState = function() {
        console.log('🧪 Restore import state clicked');
        alert('Restore import state not implemented yet');
    };

    window.testHypaFlow = function() {
        console.log('🧪 Test Hypa flow clicked');
        alert('Test Hypa flow not implemented yet');
    };

    // Function to check if all required functions are available
    window.checkAllFunctions = function() {
        console.log('🔍 Checking all required functions...');
        
        const requiredFunctions = [
            'clearAllCaches',
            'testSimpleExport', 
            'testDirectCards',
            'debugExportSystem',
            'toggleSelectAll',
            'selectFilteredResults',
            'clearSearchBox',
            'generateDeleteCsv',
            'generateReplaceCsv',
            'exportToHypaFormat',
            'exportCardsToSimpleCsv',
            'showPlaceholderCardSummary',
            'exportCardsToFile',
            'migrateAndUpdateCards',
            'cleanupBadCards',
            'restoreImportState',
            'testHypaFlow'
        ];
        
        const missingFunctions = [];
        
        requiredFunctions.forEach(funcName => {
            if (typeof window[funcName] !== 'function') {
                missingFunctions.push(funcName);
            }
        });
        
        if (missingFunctions.length === 0) {
            console.log('✅ All required functions are available!');
        } else {
            console.log('❌ Missing functions:', missingFunctions);
        }
        
        return missingFunctions.length === 0;
    };

    // Debug function to check card visibility
    window.debugCardVisibility = function() {
        console.log('🔍 Debugging card visibility...');
        
        const skuCards = document.querySelectorAll('.sku-card');
        console.log(`Total cards found: ${skuCards.length}`);
        
        skuCards.forEach((card, index) => {
            const sku = card.getAttribute('data-sku');
            const display = card.style.display;
            const visibility = card.style.visibility;
            const checkbox = card.querySelector('.sku-checkbox');
            const isChecked = checkbox ? checkbox.checked : 'no checkbox';
            
            console.log(`Card ${index + 1}: SKU=${sku}, display=${display}, visibility=${visibility}, checked=${isChecked}`);
        });
    };

    // Function to manually refresh the summary
    window.refreshSummary = function() {
        console.log('🔄 Manually refreshing summary...');
        updateExportSummary();
    };

    // Debug function to show card content
    window.debugCardContent = function() {
        console.log('🔍 Debugging card content...');
        
        const skuCards = document.querySelectorAll('.sku-card');
        console.log(`Found ${skuCards.length} cards`);
        
        skuCards.forEach((card, index) => {
            const sku = card.getAttribute('data-sku');
            const cardText = card.textContent;
            console.log(`Card ${index + 1} (${sku}):`);
            console.log(`  Text: ${cardText.substring(0, 300)}...`);
        });
    };

    // Initialize
    initializeElements();
    
    // ===== IMPORT HISTORY FUNCTIONS =====
    
    // Load import history from localStorage
    function loadImportHistory() {
        try {
            const history = localStorage.getItem('importHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error loading import history:', error);
            return [];
        }
    }
    
    // Save import history to localStorage
    function saveImportHistory(history) {
        try {
            localStorage.setItem('importHistory', JSON.stringify(history));
        } catch (error) {
            console.error('Error saving import history:', error);
        }
    }
    
    // Add entry to import history
    function addImportHistoryEntry(entry) {
        const history = loadImportHistory();
        
        // Add timestamp if not provided
        if (!entry.timestamp) {
            entry.timestamp = new Date().toISOString();
        }
        
        // Add to beginning of array (most recent first)
        history.unshift(entry);
        
        // Keep only last 20 entries
        if (history.length > 20) {
            history.splice(20);
        }
        
        saveImportHistory(history);
        updateImportHistoryTable();
    }
    
    // Update the import history table
    function updateImportHistoryTable() {
        const history = loadImportHistory();
        const tableBody = document.getElementById('importHistoryTable');
        
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        history.forEach((entry, index) => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(entry.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            // Get status class
            const statusClass = entry.status === 'success' ? 'text-success' : 
                              entry.status === 'error' ? 'text-danger' : 'text-warning';
            
            // Get status icon
            const statusIcon = entry.status === 'success' ? 'fa-check-circle' : 
                             entry.status === 'error' ? 'fa-times-circle' : 'fa-exclamation-circle';
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${entry.fileName || 'N/A'}</td>
                <td><span class="badge bg-primary">${entry.items || 0}</span></td>
                <td><span class="badge bg-success">${entry.success || 0}</span></td>
                <td><span class="badge bg-danger">${entry.errors || 0}</span></td>
                <td><i class="fas ${statusIcon} ${statusClass}"></i> ${entry.status || 'unknown'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="viewImportDetails(${index})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // View import details (placeholder function) - make it global
    window.viewImportDetails = function(index) {
        const history = loadImportHistory();
        const entry = history[index];
        
        if (entry) {
            alert(`Import Details:\nFile: ${entry.fileName}\nItems: ${entry.items}\nSuccess: ${entry.success}\nErrors: ${entry.errors}\nType: ${entry.type}\nDetails: ${entry.details || 'N/A'}`);
        }
    };
    
    // ===== BIGCOMMERCE UPLOAD FUNCTIONS =====
    
    function handleBigcommerceCsvFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            console.log('BigCommerce CSV file selected:', file.name);
        }
    }

    function uploadAndValidateBigCommerce() {
        const fileInput = document.getElementById('bigcommerceCsvFile');
        const file = fileInput.files[0];
        
        if (!file) {
            showAnalysisToast('Please select a CSV file first.', 'error');
            return;
        }

        // Show progress indicator
        const uploadBtn = document.getElementById('uploadAndValidateBigCommerceBtn');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // Update progress
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Parsing CSV...';
                
                const csvText = e.target.result;
                const results = Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    transform: function(value) {
                        return value.trim();
                    }
                });

                if (results.errors && results.errors.length > 0) {
                    console.warn('CSV parsing warnings:', results.errors);
                }

                const data = results.data;
                console.log('Parsed CSV data:', data);
                
                // Debug: Show the first few rows and their structure
                if (data.length > 0) {
                    console.log('First row structure:', Object.keys(data[0]));
                    console.log('Sample rows:', data.slice(0, 3));
                }

                if (data.length === 0) {
                    showAnalysisToast('No data found in CSV file.', 'error');
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = originalText;
                    return;
                }

                // Update progress
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Validating...';

                // Store the data globally
                window.bigcommerceCsvData = data;
                
                // Update progress to success
                uploadBtn.innerHTML = '<i class="fas fa-check me-2"></i>Complete!';
                uploadBtn.classList.remove('btn-primary');
                uploadBtn.classList.add('btn-success');
                
                // Show validation results
                showBigcommerceValidationResults(data);
                
                // Calculate drivetrain variants from BigCommerce data
                const allVariants = [];
                const uniqueModels = new Set();
                const drivetrainVariants = new Set();
                
                data.forEach(row => {
                    // Check multiple possible SKU fields for variants
                    const sku = row.Code || row.SKU || row['Product Code'] || row['Product Code/SKU'] || row.sku;
                    const model = row.Name || row['Product Name'] || row.Model || row['Product Type'];
                    const drivetrain = row['Drivetrain'] || row['Drive Train'] || row['Drive'] || row['Gear System'] || row['Transmission'];
                    
                    if (sku) {
                        allVariants.push(sku);
                        if (model) {
                            uniqueModels.add(model);
                        }
                        if (drivetrain) {
                            drivetrainVariants.add(drivetrain);
                        }
                    }
                });
                
                console.log('BigCommerce import analysis:', {
                    totalRows: data.length,
                    totalVariants: allVariants.length,
                    uniqueModels: uniqueModels.size,
                    drivetrainVariants: Array.from(drivetrainVariants),
                    sampleVariants: allVariants.slice(0, 5),
                    sampleModels: Array.from(uniqueModels).slice(0, 3)
                });
                
                // Add to import history
                addImportHistoryEntry({
                    type: 'BigCommerce CSV',
                    fileName: file.name,
                    items: allVariants.length,
                    success: allVariants.length,
                    errors: 0,
                    status: 'success',
                    details: `Validated ${allVariants.length} drivetrain variants (${Array.from(drivetrainVariants).join(', ')}) from ${uniqueModels.size} models`
                });
                
                // Reset button after a delay
                setTimeout(() => {
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = originalText;
                    uploadBtn.classList.remove('btn-success');
                    uploadBtn.classList.add('btn-primary');
                }, 2000);
                
            } catch (error) {
                console.error('Error parsing CSV:', error);
                showAnalysisToast('Error parsing CSV file: ' + error.message, 'error');
                
                // Add to import history as error
                addImportHistoryEntry({
                    type: 'BigCommerce CSV',
                    fileName: file.name,
                    items: 0,
                    success: 0,
                    errors: 1,
                    status: 'error',
                    details: `Parse error: ${error.message}`
                });
                
                // Reset button on error
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = originalText;
            }
        };
        
        reader.readAsText(file);
    }

    function showBigcommerceValidationResults(data) {
        console.log('showBigcommerceValidationResults called with data:', data);
        const validationResultsDiv = document.getElementById('validationResultsBigCommerce');
        console.log('validationResultsDiv:', validationResultsDiv);
        
        // Simple validation - check for required fields
        const requiredFields = ['Name', 'Code', 'Product Type']; // Updated to match actual CSV headers
        const validRows = data.filter(row => {
            return requiredFields.every(field => row[field] && row[field].trim() !== '');
        });
        
        const invalidRows = data.filter(row => {
            return !requiredFields.every(field => row[field] && row[field].trim() !== '');
        });
        
        // Count drivetrain variants (each row is a variant)
        const totalVariants = data.length;
        const uniqueModels = new Set();
        const drivetrainVariants = new Set();
        
        data.forEach(row => {
            const model = row.Name || row['Product Name'] || row.Model || row['Product Type'];
            const drivetrain = row['Drivetrain'] || row['Drive Train'] || row['Drive'] || row['Gear System'] || row['Transmission'];
            
            if (model) {
                uniqueModels.add(model);
            }
            if (drivetrain) {
                drivetrainVariants.add(drivetrain);
            }
        });

        console.log('Validation results:', { validRows: validRows.length, invalidRows: invalidRows.length, total: data.length });

        validationResultsDiv.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center">
                            <h4>${validRows.length}</h4>
                            <small>Valid Variants</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-warning text-dark">
                        <div class="card-body text-center">
                            <h4>${invalidRows.length}</h4>
                            <small>Invalid Variants</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-info text-white">
                        <div class="card-body text-center">
                            <h4>${uniqueModels.size}</h4>
                            <small>Unique Models</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center">
                            <h4>${drivetrainVariants.size}</h4>
                            <small>Drivetrain Types</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Validation Complete:</strong> Found ${validRows.length} valid drivetrain variants from ${uniqueModels.size} models. Drivetrain types: ${Array.from(drivetrainVariants).join(', ')}.
            </div>
            
            <div class="d-flex justify-content-between">
                <button class="btn btn-secondary" onclick="showBigcommerceStep(1)">
                    <i class="fas fa-arrow-left me-2"></i>Back to Upload
                </button>
                <button class="btn btn-primary" onclick="showBigcommerceFieldMapping()">
                    Continue to Field Mapping<i class="fas fa-arrow-right ms-2"></i>
                </button>
            </div>
        `;
        
        // Show step 2
        showBigcommerceStep(2);
    }
    
    function showBigcommerceStep(step) {
        // Hide all steps
        const steps = document.querySelectorAll('.bigcommerce-step');
        steps.forEach(s => s.style.display = 'none');
        
        // Show the requested step
        const stepElement = document.getElementById(`bigcommerceStep${step}`);
        if (stepElement) {
            stepElement.style.display = 'block';
        }
    }
    
    function showBigcommerceFieldMapping() {
        // This would show field mapping interface
        console.log('Showing BigCommerce field mapping...');
        showBigcommerceStep(3);
    }
}); 