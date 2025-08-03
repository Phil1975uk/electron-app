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
        console.log('Initializing Import Analysis...');
        
        // Add global function for clearing caches
        window.clearAllCaches = async function() {
            try {
                console.log('Clearing all caches...');
                localStorage.clear();
                sessionStorage.clear();
                await fetch('/api/clear-import-cache', { method: 'POST' });
                await loadData();
                showAnalysisToast('All caches cleared and data reloaded from project files', 'success');
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
        console.log('loadData() called - starting to load data from project files only...');
        console.log('Clearing localStorage cache to ensure fresh data...');
        localStorage.removeItem('cards');
        localStorage.removeItem('configurations');
        localStorage.removeItem('hypaCsvCache');

        try {
            // Load configurations
            const configResponse = await fetch('/api/configurations');
            if (configResponse.ok) {
                configurations = await configResponse.json();
                console.log('Loaded configurations from server:', configurations.length);
            }

            // Load cards
            const cardsResponse = await fetch('/api/load-cards');
            if (cardsResponse.ok) {
                cards = await cardsResponse.json();
                console.log('Loaded cards from server:', cards.length);
                // Make cards available globally
                window.cards = cards;
            }

            // Load hypa CSV cache
            const hypaResponse = await fetch('/api/hypa-csv-cache');
            if (hypaResponse.ok) {
                const hypaData = await hypaResponse.json();
                originalHypaCsvData = hypaData.data || [];
                originalHypaCsvHeaders = hypaData.headers || [];
                console.log('Loaded hypa CSV cache from server');
            }

            // Clear import cache
            try {
                await fetch('/api/clear-import-cache', { method: 'POST' });
                console.log('Cleared import cache via API');
            } catch (error) {
                console.log('Could not clear import cache via API');
            }

            performAnalysis();
            console.log('Data loaded completely from project files - no cache dependencies');
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
        // Basic statistics update
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
        
        // Group cards by SKU, including variants
        const groupedBySku = {};
        
        cards.forEach(card => {
            // Add the primary SKU
            const primarySku = card.sku || 'unknown';
            if (!groupedBySku[primarySku]) {
                groupedBySku[primarySku] = [];
            }
            groupedBySku[primarySku].push(card);
            
            // Add all variant SKUs from the configuration
            if (card.configuration && card.configuration.variants) {
                card.configuration.variants.forEach(variant => {
                    const variantSku = variant.sku;
                    if (variantSku && variantSku !== primarySku) {
                        if (!groupedBySku[variantSku]) {
                            groupedBySku[variantSku] = [];
                        }
                        // Create a copy of the card for this variant
                        const variantCard = {
                            ...card,
                            sku: variantSku,
                            title: card.title,
                            description: card.description,
                            imageUrl: card.imageUrl,
                            price: card.price,
                            cardType: card.cardType,
                            position: card.position
                        };
                        groupedBySku[variantSku].push(variantCard);
                    }
                });
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
        
        return `
            <div class="card mb-3 sku-card" data-sku="${item.sku}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-box me-2"></i>${item.sku}
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

    // Debug function to check if everything is loaded
    window.debugExportSystem = function() {
        console.log('🔍 Debugging export system...');
        console.log('Cards loaded:', cards ? cards.length : 'none');
        console.log('Export button exists:', document.getElementById('exportHypaBtn') ? 'yes' : 'no');
        console.log('Modal exists:', document.getElementById('exportHypaModal') ? 'yes' : 'no');
        console.log('Container exists:', document.getElementById('productCardsContainer') ? 'yes' : 'no');
        
        if (cards && cards.length > 0) {
            console.log('Sample card:', cards[0]);
            console.log('Card SKUs:', [...new Set(cards.map(c => c.sku))].slice(0, 5));
        }
    };

    // Missing functions that the HTML references
    window.toggleSelectAll = function() {
        console.log('🧪 Toggle select all clicked');
        
        // Get ALL cards (not just visible ones)
        const allCards = document.querySelectorAll('.sku-card');
        const checkboxes = Array.from(allCards).map(card => card.querySelector('.sku-checkbox')).filter(cb => cb);
        const allChecked = checkboxes.every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        
        console.log(`✅ ${allChecked ? 'Unselected' : 'Selected'} all ${checkboxes.length} cards (all cards, not just visible)`);
        
        // Update summary after selection change
        updateExportSummary();
    };

    window.selectFilteredResults = function() {
        console.log('🧪 Select filtered results clicked');
        
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
                    console.log(`✅ Selected visible card: ${card.getAttribute('data-sku')}`);
                }
            }
            // Note: We don't uncheck hidden cards - they keep their selection state
        });
        
        console.log(`✅ Selected ${selectedCount} visible cards (out of ${totalVisible} visible, ${skuCards.length} total)`);
        
        // Update summary after selection change
        updateExportSummary();
    };

    window.clearSearchBox = function() {
        console.log('🧪 Clear search clicked');
        const searchBox = document.getElementById('productSearchFilter');
        if (searchBox) {
            searchBox.value = '';
            console.log('✅ Search box cleared');
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
            console.log('✅ Search box listener added');
        }
        
        if (filterSelect) {
            filterSelect.addEventListener('change', function() {
                filterCards();
            });
            console.log('✅ Filter select listener added');
        }
    }

    function filterCards() {
        const searchTerm = document.getElementById('productSearchFilter')?.value.toLowerCase() || '';
        const filterValue = document.getElementById('showFilter')?.value || 'all';
        
        console.log(`🔍 Filtering cards - Search: "${searchTerm}", Filter: "${filterValue}"`);
        
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
            alert('No cards selected for export. Please select at least one SKU.');
            return;
        }
        
        // Generate CSV
        const csvContent = await generateHypaCsv(selectedCards);
        
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
        
        console.log('✅ Export completed successfully');
        alert(`Successfully exported ${selectedCards.length} SKUs to CSV file.`);
    }

    async function generateHypaCsv(selectedCards) {
        console.log('📊 Generating Hypa CSV format...');
        
        // Load HTML templates
        const templates = await loadHtmlTemplates();
        
        // CSV header
        const headers = ['id,name,key,description,namespace,permission_set,value,status,error,mode'];
        
        const csvRows = [headers[0]];
        
        // Load the reference CSV to get the correct IDs
        const referenceCsv = await loadReferenceCsv();
        const validSkus = getValidSkus(referenceCsv);
        
        // Filter to only include cards that exist in the reference CSV
        const validSelectedCards = selectedCards.filter(skuData => {
            const hasValidSku = validSkus.includes(skuData.sku);
            if (!hasValidSku) {
                console.log(`⚠️ Skipping ${skuData.sku} - not found in reference CSV`);
            }
            return hasValidSku;
        });
        
        console.log(`📊 Exporting ${validSelectedCards.length} valid SKUs out of ${selectedCards.length} selected`);
        
        validSelectedCards.forEach(skuData => {
            console.log(`🔍 Processing SKU: ${skuData.sku} with ${skuData.cards.length} cards`);
            skuData.cards.forEach(card => {
                console.log(`🔍 Card data:`, card);
                const metafieldKey = `${card.cardType}-${card.position || 1}-card`;
                const namespace = 'shared';
                const permissionSet = 'write_and_sf_access';
                
                // Generate proper HTML using template
                const value = generateCardHtml(card, templates);
                console.log(`🔍 Card HTML content length: ${value.length}`);
                const status = 'completed';
                const error = '';
                const mode = 'create_update';
                
                // Find the correct ID from reference CSV based on SKU and key
                const correctId = findCorrectId(referenceCsv, skuData.sku, metafieldKey);
                
                // Skip this card if no matching ID found
                if (correctId === null) {
                    console.log(`⚠️ Skipping card ${card.title} for ${skuData.sku}:${metafieldKey} - no matching entry in reference CSV`);
                    return; // Skip this card
                }
                
                const csvRow = [
                    correctId,
                    skuData.sku,
                    metafieldKey,
                    '', // description
                    namespace,
                    permissionSet,
                    `"${value.replace(/"/g, '""')}"`, // Escape quotes in HTML
                    status,
                    error,
                    mode
                ].join(',');
                
                csvRows.push(csvRow);
            });
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
            const response = await fetch('/reference-templates/2025-08-01-19-30-42-product-8363.csv');
            if (response.ok) {
                const csvText = await response.text();
                return parseCsvToRows(csvText);
            } else {
                console.warn('⚠️ Could not load reference CSV');
                return [];
            }
        } catch (error) {
            console.error('❌ Error loading reference CSV:', error);
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

    function findCorrectId(referenceCsv, sku, key) {
        // Look for exact match first
        const exactMatch = referenceCsv.find(row => 
            row.name === sku && row.key === key
        );
        
        if (exactMatch) {
            return exactMatch.id;
        }
        
        // If no exact match, find any row with same SKU and similar key
        const skuMatch = referenceCsv.find(row => 
            row.name === sku && row.key.includes(key.split('-')[0]) // Match card type
        );
        
        if (skuMatch) {
            return skuMatch.id;
        }
        
        // No match found - this SKU/key combination doesn't exist in reference
        console.warn(`⚠️ No matching ID found for ${sku}:${key} - skipping this card`);
        return null; // Return null to indicate this should be skipped
    }

    function getValidSkus(referenceCsv) {
        // Extract unique SKUs from reference CSV
        const validSkus = [...new Set(referenceCsv.map(row => row.name))];
        console.log('📋 Valid SKUs from reference CSV:', validSkus);
        return validSkus;
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
}); 