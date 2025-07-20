// Import Analysis Dashboard
window.addEventListener('load', async () => {
    // Initialize card manager for HTML generation
    if (!window.cardManager) {
        window.cardManager = new CardManager();
        await window.cardManager.init();
        console.log('Card manager initialized successfully');
    }
    // Always fetch the cached Hypa CSV from the backend on page load
    await loadHypaCsvCacheFromServer();
    
    // Data storage
    let configurations = [];
    let cards = [];
    let analysisData = [];
    let originalHypaCsvData = null; // Store original Hypa CSV for perfect round-trip
    let originalHypaCsvHeaders = null; // Store original column headers
    let hasSavedImportState = false; // Track if import state has been saved
    
    // Load Hypa CSV cache from server
    async function loadHypaCsvCacheFromServer() {
        try {
            const response = await fetch('/api/hypa-csv-cache');
            if (response.ok) {
                const cacheData = await response.json();
                if (cacheData && cacheData.data) {
                    originalHypaCsvData = cacheData.data;
                    originalHypaCsvHeaders = cacheData.headers || [];
                    console.log('Loaded Hypa CSV cache from server:', cacheData.data?.length || 0, 'rows');
                }
            }
        } catch (error) {
            console.log('No Hypa CSV cache found on server or error loading:', error.message);
        }
    }
    
    // DOM Elements
    let refreshAnalysisBtn;
    let startImportBtn;
    let exportAnalysisBtn;
    let filterStatusBtn;
    let analysisTableBody;
    let csvFileInput;
    let analyzeCsvBtn;

    // Enhanced CSV Import Functions - 4-Step Workflow
    let csvData = null;
    let validationResults = null;
    let fieldMappings = null;
    let configMatchingResults = null;
    let currentImportStep = 1;
    let importHistory = [];

    // Add lightweight UI delay constant and helper
    const UI_DELAY_MS = 200;                       // Short, user-visible pause used by progress UI
    const delay = (ms = UI_DELAY_MS) => new Promise(r => setTimeout(r, ms));

    // Simple non-cryptographic hash for duplicate keys (djb2)
    function simpleHash(str = '') {
        let h = 5381;
        for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
        return (h >>> 0).toString(36); // base-36 for brevity
    }

    // Initialize the application
    async function initializeElements() {
        refreshAnalysisBtn = document.getElementById('refreshAnalysisBtn');
        startImportBtn = document.getElementById('startImportBtn');
        exportAnalysisBtn = document.getElementById('exportAnalysisBtn');
        filterStatusBtn = document.getElementById('filterStatusBtn');
        analysisTableBody = document.getElementById('analysisTableBody');
        csvFileInput = document.getElementById('csvFileInput');
        const uploadAndValidateBtn = document.getElementById('uploadAndValidateBtn');

        // BigCommerce Import Modal Elements
        const bigcommerceCsvFile = document.getElementById('bigcommerceCsvFile');
        const uploadAndValidateBigCommerceBtn = document.getElementById('uploadAndValidateBigCommerceBtn');
        const backToUploadBigCommerceBtn = document.getElementById('backToUploadBigCommerceBtn');
        const continueToMappingBigCommerceBtn = document.getElementById('continueToMappingBigCommerceBtn');
        const backToValidationBigCommerceBtn = document.getElementById('backToValidationBigCommerceBtn');
        const continueToConfigMatchBigCommerceBtn = document.getElementById('continueToConfigMatchBigCommerceBtn');
        const backToMappingBigCommerceBtn2 = document.getElementById('backToMappingBigCommerceBtn');
        const continueToReviewBigCommerceBtn = document.getElementById('continueToReviewBigCommerceBtn');
        const backToConfigMatchBigCommerceBtn2 = document.getElementById('backToConfigMatchBigCommerceBtn');
        const confirmImportBigCommerceBtn = document.getElementById('confirmImportBigCommerceBtn');

        // Hypa Import Modal Elements
        const hypaCsvFile = document.getElementById('hypaCsvFile');
        console.log('Hypa CSV file element found:', hypaCsvFile);

        // Add event listeners
        if (refreshAnalysisBtn) {
            refreshAnalysisBtn.addEventListener('click', refreshAnalysis);
        }
        if (exportAnalysisBtn) {
            exportAnalysisBtn.addEventListener('click', exportAnalysis);
        }
        if (filterStatusBtn) {
            filterStatusBtn.addEventListener('click', showFilterModal);
        }
        if (csvFileInput) {
            csvFileInput.addEventListener('change', handleCsvFileSelect);
        }
        if (uploadAndValidateBtn) {
            uploadAndValidateBtn.addEventListener('click', uploadAndValidate);
        }

        // BigCommerce Import Modal Event Listeners
        if (bigcommerceCsvFile) {
            bigcommerceCsvFile.addEventListener('change', handleBigcommerceCsvFileSelect);
        }
        if (uploadAndValidateBigCommerceBtn) {
            console.log('BigCommerce upload button found, adding event listener');
            uploadAndValidateBigCommerceBtn.addEventListener('click', uploadAndValidateBigCommerce);
        } else {
            console.error('BigCommerce upload button not found');
        }
        if (backToUploadBigCommerceBtn) {
            backToUploadBigCommerceBtn.addEventListener('click', () => showBigcommerceStep(1));
        }
        if (continueToMappingBigCommerceBtn) {
            continueToMappingBigCommerceBtn.addEventListener('click', showBigcommerceFieldMapping);
        }
        if (backToValidationBigCommerceBtn) {
            backToValidationBigCommerceBtn.addEventListener('click', () => showBigcommerceStep(2));
        }
        if (continueToConfigMatchBigCommerceBtn) {
            continueToConfigMatchBigCommerceBtn.addEventListener('click', showBigcommerceConfigurationMatching);
        }
        if (backToMappingBigCommerceBtn2) {
            backToMappingBigCommerceBtn2.addEventListener('click', () => showBigcommerceStep(3));
        }
        if (continueToReviewBigCommerceBtn) {
            continueToReviewBigCommerceBtn.addEventListener('click', showBigcommerceFinalReview);
        }
        if (backToConfigMatchBigCommerceBtn2) {
            backToConfigMatchBigCommerceBtn2.addEventListener('click', () => showBigcommerceStep(4));
        }
        if (confirmImportBigCommerceBtn) {
            confirmImportBigCommerceBtn.addEventListener('click', confirmBigcommerceImport);
        }

        // Hypa Import Modal Event Listeners
        if (hypaCsvFile) {
            console.log('Adding change event listener to hypaCsvFile');
            hypaCsvFile.addEventListener('change', handleHypaCsvFileSelect);
            console.log('Event listener added successfully');
        } else {
            console.error('hypaCsvFile element not found!');
        }
        
        // Add event listener for the import button
        const importHypaBtn = document.getElementById('importHypaBtn');
        if (importHypaBtn) {
            importHypaBtn.addEventListener('click', function() {
                // Show progress immediately when button is clicked
                showHypaImportProgress();
            });
        }

        // Enhanced import workflow buttons
        const continueToMappingBtn = document.getElementById('continueToMappingBtn');
        const continueToConfigMatchBtn = document.getElementById('continueToConfigMatchBtn');
        const continueToReviewBtn = document.getElementById('continueToReviewBtn');
        const confirmImportBtn = document.getElementById('confirmImportBtn');
        const backToUploadBtn = document.getElementById('backToUploadBtn');
        const backToValidationBtn = document.getElementById('backToValidationBtn');
        const backToMappingBtn = document.getElementById('backToMappingBtn');
        const backToConfigMatchBtn = document.getElementById('backToConfigMatchBtn');

        if (continueToMappingBtn) {
            continueToMappingBtn.addEventListener('click', showFieldMapping);
        }
        if (continueToConfigMatchBtn) {
            continueToConfigMatchBtn.addEventListener('click', showConfigurationMatching);
        }
        if (continueToReviewBtn) {
            continueToReviewBtn.addEventListener('click', showFinalReview);
        }
        if (confirmImportBtn) {
            confirmImportBtn.addEventListener('click', confirmImport);
        }
        if (backToUploadBtn) {
            backToUploadBtn.addEventListener('click', () => showStep(1));
        }
        if (backToValidationBtn) {
            backToValidationBtn.addEventListener('click', () => showStep(2));
        }
        if (backToMappingBtn) {
            backToMappingBtn.addEventListener('click', () => showStep(3));
        }
        if (backToConfigMatchBtn) {
            backToConfigMatchBtn.addEventListener('click', () => showStep(4));
        }

        // Load data and perform initial analysis
        await loadData();
        performAnalysis();
        renderAnalysisTable();
        loadImportHistory();
        
        // Debug: Check if BigCommerce button exists
        setTimeout(() => {
            const testButton = document.getElementById('uploadAndValidateBigCommerceBtn');
            console.log('BigCommerce button test:', testButton);
            if (testButton) {
                console.log('Button found, adding test click listener');
                testButton.addEventListener('click', () => {
                    console.log('Button clicked!');
                    uploadAndValidateBigCommerce();
                });
            } else {
                console.log('Button not found in DOM');
            }
            
            // Test Hypa functionality
            const hypaTestButton = document.getElementById('confirmHypaImportBtn');
            console.log('Hypa test button:', hypaTestButton);
            if (hypaTestButton) {
                console.log('Hypa button found, testing click...');
                // Add a test click to see if it works
                hypaTestButton.addEventListener('click', () => {
                    console.log('Hypa button clicked!');
                    showAnalysisToast('Hypa button clicked!', 'info');
                });
            }
            
            // Test file input
            const hypaFileInput = document.getElementById('hypaCsvFile');
            console.log('Hypa file input test:', hypaFileInput);
            if (hypaFileInput) {
                console.log('Hypa file input found, testing change event...');
                // Simulate a file selection to test the flow
                console.log('File input ready for testing');
            } else {
                console.error('Hypa file input not found!');
            }
            
            // Import cards file input
            const importCardsFileInput = document.getElementById('importCardsFile');
            if (importCardsFileInput) {
                importCardsFileInput.addEventListener('change', function(event) {
                    const file = event.target.files[0];
                    if (file) {
                        console.log('Import cards file selected:', file.name);
                        importCardsFromFile(file).then(() => {
                            // Refresh the analysis after import
                            performAnalysis();
                            renderAnalysisTable();
                        }).catch(error => {
                            console.error('Error importing cards:', error);
                            showAnalysisToast('Error importing cards: ' + error.message, 'error');
                        });
                    }
                });
            }
        }, 1000);

        // Hypa Import Modal Event Listeners
        function attachHypaCsvFileListener() {
            const hypaCsvFile = document.getElementById('hypaCsvFile');
            if (hypaCsvFile) {
                if (!hypaCsvFile._listenerAttached) {
                    hypaCsvFile.addEventListener('change', handleHypaCsvFileSelect);
                    hypaCsvFile._listenerAttached = true;
                    console.log('Hypa CSV file event listener attached');
                }
            } else {
                console.error('hypaCsvFile element not found!');
            }
        }

        // Attach event listener when the Hypa import modal is shown
        const importHypaModal = document.getElementById('importHypaModal');
        if (importHypaModal) {
            importHypaModal.addEventListener('shown.bs.modal', function () {
                console.log('Hypa import modal shown, attaching event listener');
                // Use setTimeout to ensure the modal is fully rendered
                setTimeout(() => {
                    attachHypaCsvFileListener();
                }, 100);
            });
        }

        // Also try to attach immediately if the element exists
        setTimeout(() => {
            attachHypaCsvFileListener();
        }, 500);

        // Watch for dynamic replacement of the file input (fallback)
        const observer = new MutationObserver(() => {
            attachHypaCsvFileListener();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // File-based storage functions for configurations
    async function loadConfigurationsFromFile() {
        try {
            // Try to load from server endpoint first
            const response = await fetch('/api/configurations');
            if (response.ok) {
                const data = await response.json();
                const configs = Array.isArray(data) ? data : (data.configurations || []);
                console.log(`Loaded ${configs.length} configurations from server`);
                return configs;
            } else {
                console.log('No configurations found on server, trying localStorage...');
                
                // Fallback to localStorage
                const localStorageConfigs = localStorage.getItem('configurations');
                if (localStorageConfigs) {
                    try {
                        const configs = JSON.parse(localStorageConfigs);
                        console.log(`Loaded ${configs.length} configurations from localStorage`);
                        return configs;
                    } catch (error) {
                        console.error('Error parsing localStorage configurations:', error);
                    }
                }
                
                // Final fallback to direct file path
                try {
                    const fileResponse = await fetch('renderer/data/configurations.json');
                    if (fileResponse.ok) {
                        const configFile = await fileResponse.json();
                        const configs = configFile.configurations || [];
                        console.log(`Loaded ${configs.length} configurations from file`);
                        return configs;
                    }
                } catch (fileError) {
                    console.log('No configurations file found');
                }
                
                console.log('No configurations found, starting with empty array');
                return [];
            }
        } catch (error) {
            console.error('Error loading configurations:', error);
            
            // Fallback to localStorage
            try {
                const localStorageConfigs = localStorage.getItem('configurations');
                if (localStorageConfigs) {
                    const configs = JSON.parse(localStorageConfigs);
                    console.log(`Loaded ${configs.length} configurations from localStorage fallback`);
                    return configs;
                }
            } catch (localStorageError) {
                console.error('Error loading configurations from localStorage:', localStorageError);
            }
            
            // Final fallback to direct file path
            try {
                const fileResponse = await fetch('renderer/data/configurations.json');
                if (fileResponse.ok) {
                    const configFile = await fileResponse.json();
                    const configs = configFile.configurations || [];
                    console.log(`Loaded ${configs.length} configurations from file fallback`);
                    return configs;
                }
            } catch (fileError) {
                console.log('No configurations file found in fallback');
            }
            
            return [];
        }
    }

    async function loadData() {
        try {
            // Load configurations from file instead of localStorage
            configurations = await loadConfigurationsFromFile();

            // Load cards data from server only
            let cardsData = null;
            
            // Load from server only (no localStorage)
            const cardsResponse = await fetch('/api/cards');
            if (cardsResponse.ok) {
                cardsData = await cardsResponse.json();
                console.log('Loaded cards from server:', cardsData.length);
            } else {
                console.log('No cards found on server, starting with empty array');
                cardsData = [];
            }

            // Ensure both are arrays
            if (!Array.isArray(configurations)) {
                configurations = [];
            }
            if (!Array.isArray(cardsData)) {
                cardsData = [];
            }
            
            cards = cardsData;
            // Make cards globally accessible for export functions
            window.cards = cards;

            console.log('Loaded data:', { configurations: configurations.length, cards: cards.length });
        } catch (error) {
            console.error('Error loading data:', error);
            // Fallback to empty arrays
            configurations = [];
            cards = [];
        }
    }

    function performAnalysis() {
        analysisData = [];
        
        // Ensure configurations is an array
        if (!Array.isArray(configurations)) {
            configurations = [];
        }
        
        configurations.forEach(config => {
            const configSkus = config.variants ? config.variants.map(v => v.sku) : [];
            const analysis = {
                config: config,
                skus: configSkus,
                hasConfig: true,
                hasCards: false,
                hasImages: false,
                hasHypa: false,
                cardCount: 0,
                imageCount: 0,
                hypaCount: 0,
                overallStatus: 'config-only'
            };

            // Check for cards
            configSkus.forEach(sku => {
                const skuCards = cards.filter(card => card.sku === sku);
                if (skuCards.length > 0) {
                    analysis.hasCards = true;
                    analysis.cardCount += skuCards.length;
                    
                    // Check for images in cards
                    skuCards.forEach(card => {
                        if (card.imageUrl && card.imageUrl !== '') {
                            analysis.hasImages = true;
                            analysis.imageCount++;
                        }
                        if (card.exportedToHypa) {
                            analysis.hasHypa = true;
                            analysis.hypaCount++;
                        }
                    });
                }
            });

            // Determine overall status
            if (analysis.hasConfig && analysis.hasCards && analysis.hasImages && analysis.hasHypa) {
                analysis.overallStatus = 'complete';
            } else if (analysis.hasConfig && analysis.hasCards && analysis.hasImages) {
                analysis.overallStatus = 'images-uploaded';
            } else if (analysis.hasConfig && analysis.hasCards) {
                analysis.overallStatus = 'cards-created';
            } else if (analysis.hasConfig) {
                analysis.overallStatus = 'config-only';
            }

            analysisData.push(analysis);
        });

        updateStatistics();
    }

    function updateStatistics() {
        const totalConfigs = analysisData.length;
        const totalCards = analysisData.filter(item => item.hasCards).length;
        const totalImages = analysisData.filter(item => item.hasImages).length;
        const totalHypa = analysisData.filter(item => item.hasHypa).length;

        // Update overview cards - check if elements exist first
        const totalConfigsEl = document.getElementById('totalConfigs');
        const totalCardsEl = document.getElementById('totalCards');
        const totalImagesEl = document.getElementById('totalImages');
        const totalHypaImportedEl = document.getElementById('totalHypaImported');
        const totalHypaExportedEl = document.getElementById('totalHypaExported');

        if (totalConfigsEl) totalConfigsEl.textContent = totalConfigs;
        if (totalCardsEl) totalCardsEl.textContent = totalCards;
        if (totalImagesEl) totalImagesEl.textContent = totalImages;
        if (totalHypaImportedEl) totalHypaImportedEl.textContent = totalHypa;
        if (totalHypaExportedEl) totalHypaExportedEl.textContent = totalHypa;

        // Update progress bars - check if elements exist first
        const cardsProgress = totalConfigs > 0 ? (totalCards / totalConfigs) * 100 : 0;
        const imagesProgress = totalConfigs > 0 ? (totalImages / totalConfigs) * 100 : 0;
        const hypaProgress = totalConfigs > 0 ? (totalHypa / totalConfigs) * 100 : 0;
        const completeProgress = totalConfigs > 0 ? (analysisData.filter(item => item.overallStatus === 'complete').length / totalConfigs) * 100 : 0;

        const cardsProgressEl = document.getElementById('cardsProgress');
        const imagesProgressEl = document.getElementById('imagesProgress');
        const hypaProgressEl = document.getElementById('hypaProgress');
        const completeProgressEl = document.getElementById('completeProgress');

        if (cardsProgressEl) cardsProgressEl.style.width = cardsProgress + '%';
        if (imagesProgressEl) imagesProgressEl.style.width = imagesProgress + '%';
        if (hypaProgressEl) hypaProgressEl.style.width = hypaProgress + '%';
        if (completeProgressEl) completeProgressEl.style.width = completeProgress + '%';

        const cardsProgressTextEl = document.getElementById('cardsProgressText');
        const imagesProgressTextEl = document.getElementById('imagesProgressText');
        const hypaProgressTextEl = document.getElementById('hypaProgressText');
        const completeProgressTextEl = document.getElementById('completeProgressText');

        if (cardsProgressTextEl) cardsProgressTextEl.textContent = `${totalCards} of ${totalConfigs} configurations have cards`;
        if (imagesProgressTextEl) imagesProgressTextEl.textContent = `${totalImages} of ${totalConfigs} configurations have images`;
        if (hypaProgressTextEl) hypaProgressTextEl.textContent = `${totalHypa} of ${totalConfigs} configurations have Hypa metafields`;
        if (completeProgressTextEl) completeProgressTextEl.textContent = `${analysisData.filter(item => item.overallStatus === 'complete').length} of ${totalConfigs} configurations are complete`;
    }

    function renderAnalysisTable() {
        if (!analysisTableBody) return;

        analysisTableBody.innerHTML = '';

        analysisData.forEach(item => {
            const row = document.createElement('tr');
            const statusClass = getStatusClass(item.overallStatus);
            
            row.innerHTML = `
                <td><strong>${item.skus.join(', ')}</strong></td>
                <td>${item.config.brand}</td>
                <td>${item.config.model}</td>
                <td>${item.config.generation}</td>
                <td>
                    <span class="badge bg-primary status-badge">
                        <i class="fas fa-check me-1"></i>Configured
                    </span>
                </td>
                <td>
                    ${item.hasCards ? 
                        `<span class="badge bg-warning status-badge">
                            <i class="fas fa-file-alt me-1"></i>${item.cardCount} Cards
                        </span>` : 
                        `<span class="badge bg-secondary status-badge">
                            <i class="fas fa-times me-1"></i>No Cards
                        </span>`
                    }
                </td>
                <td>
                    ${item.hasImages ? 
                        `<span class="badge bg-info status-badge">
                            <i class="fas fa-image me-1"></i>${item.imageCount} Images
                        </span>` : 
                        `<span class="badge bg-secondary status-badge">
                            <i class="fas fa-times me-1"></i>No Images
                        </span>`
                    }
                </td>
                <td>
                    ${item.hasHypa ? 
                        `<span class="badge bg-success status-badge">
                            <i class="fas fa-sync me-1"></i>${item.hypaCount} Updated
                        </span>` : 
                        `<span class="badge bg-secondary status-badge">
                            <i class="fas fa-times me-1"></i>Not Updated
                        </span>`
                    }
                </td>
                <td>
                    <span class="badge ${statusClass} status-badge">
                        ${getStatusText(item.overallStatus)}
                    </span>
                </td>
                <td class="action-buttons">
                    <button class="btn btn-outline-primary btn-sm" onclick="viewDetails('${item.config.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-success btn-sm" onclick="createCards('${item.config.id}')" title="Create Cards" ${item.hasCards ? 'disabled' : ''}>
                        <i class="fas fa-file-alt"></i>
                    </button>
                    <button class="btn btn-outline-info btn-sm" onclick="uploadImages('${item.config.id}')" title="Upload Images" ${!item.hasCards ? 'disabled' : ''}>
                        <i class="fas fa-image"></i>
                    </button>
                    <button class="btn btn-outline-warning btn-sm" onclick="updateHypa('${item.config.id}')" title="Update Hypa" ${!item.hasImages ? 'disabled' : ''}>
                        <i class="fas fa-sync"></i>
                    </button>
                </td>
            `;
            
            row.className = statusClass;
            analysisTableBody.appendChild(row);
        });
    }

    function getStatusClass(status) {
        switch (status) {
            case 'complete': return 'table-success';
            case 'images-uploaded': return 'table-info';
            case 'cards-created': return 'table-warning';
            case 'config-only': return 'table-secondary';
            default: return 'table-secondary';
        }
    }

    function getStatusText(status) {
        switch (status) {
            case 'complete': return 'Complete';
            case 'images-uploaded': return 'Images Uploaded';
            case 'cards-created': return 'Cards Created';
            case 'config-only': return 'Config Only';
            default: return 'Unknown';
        }
    }

    async function refreshAnalysis() {
        refreshAnalysisBtn.disabled = true;
        refreshAnalysisBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Refreshing...';
        
        try {
            await loadData();
            performAnalysis();
            renderAnalysisTable();
            showAnalysisToast('Analysis refreshed successfully!', 'success');
        } catch (error) {
            console.error('Error refreshing analysis:', error);
            showAnalysisToast('Error refreshing analysis. Please try again.', 'error');
        } finally {
            refreshAnalysisBtn.disabled = false;
            refreshAnalysisBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Refresh Analysis';
        }
    }

    function exportAnalysis() {
        if (typeof XLSX === 'undefined') {
            alert('Excel export functionality is not available.');
            return;
        }

        try {
            const exportData = analysisData.map(item => ({
                'SKU': item.skus.join(', '),
                'Brand': item.config.brand,
                'Model': item.config.model,
                'Generation': item.config.generation,
                'Has Configuration': item.hasConfig ? 'Yes' : 'No',
                'Has Cards': item.hasCards ? 'Yes' : 'No',
                'Card Count': item.cardCount,
                'Has Images': item.hasImages ? 'Yes' : 'No',
                'Image Count': item.imageCount,
                'Has Hypa Metafields': item.hasHypa ? 'Yes' : 'No',
                'Hypa Count': item.hypaCount,
                'Overall Status': getStatusText(item.overallStatus)
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Import Analysis");
            XLSX.writeFile(wb, "import_analysis.xlsx");
            
            showAnalysisToast('Analysis exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting analysis:', error);
            showAnalysisToast('Error exporting analysis. Please try again.', 'error');
        }
    }

    function showFilterModal() {
        // TODO: Implement filter modal for status filtering
        alert('Filter functionality coming soon!');
    }

    function handleCsvFileSelect(event) {
        const file = event.target.files[0];
        const uploadAndValidateBtn = document.getElementById('uploadAndValidateBtn');
        
        if (file) {
            uploadAndValidateBtn.disabled = false;
        } else {
            uploadAndValidateBtn.disabled = true;
        }
    }

    function uploadAndValidate() {
        const file = csvFileInput.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.error('CSV parsing errors:', results.errors);
                    alert('Error parsing CSV file. Please check the file format.');
                    return;
                }

                csvData = results.data;
                validationResults = validateCsvData(csvData);
                showValidationResults();
            },
            error: function(error) {
                console.error('CSV parsing error:', error);
                alert('Error reading CSV file. Please try again.');
            }
        });
    }

    function validateCsvData(data) {
        const results = {
            valid: [],
            warnings: [],
            errors: [],
            total: data.length
        };

        data.forEach((row, index) => {
            const issues = [];
            let status = 'valid';

            // Check for required fields
            if (!row.Code || row.Code.trim() === '') {
                issues.push('Missing SKU code');
                status = 'error';
            }
            if (!row.Name || row.Name.trim() === '') {
                issues.push('Missing product name');
                status = 'error';
            }
            if (!row.Brand || row.Brand.trim() === '') {
                issues.push('Missing brand');
                status = 'error';
            }

            // Check for warnings
            if (row.Code && row.Code.length < 3) {
                issues.push('SKU code seems too short');
                if (status === 'valid') status = 'warning';
            }
            if (row.Name && row.Name.length > 100) {
                issues.push('Product name is very long');
                if (status === 'valid') status = 'warning';
            }

            const result = {
                row: index + 1,
                sku: row.Code || 'N/A',
                name: row.Name || 'N/A',
                brand: row.Brand || 'N/A',
                issues: issues,
                status: status,
                data: row
            };

            if (status === 'valid') {
                results.valid.push(result);
            } else if (status === 'warning') {
                results.warnings.push(result);
            } else {
                results.errors.push(result);
            }
        });

        return results;
    }

    function showValidationResults() {
        showStep(2);
        
        // Update statistics
        document.getElementById('validRows').textContent = validationResults.valid.length;
        document.getElementById('warningRows').textContent = validationResults.warnings.length;
        document.getElementById('errorRows').textContent = validationResults.errors.length;
        document.getElementById('totalRows').textContent = validationResults.total;

        // Populate validation table
        const validationTableBody = document.getElementById('validationTableBody');
        validationTableBody.innerHTML = '';

        const allResults = [...validationResults.errors, ...validationResults.warnings, ...validationResults.valid];
        allResults.forEach(result => {
            const row = document.createElement('tr');
            const statusClass = result.status === 'valid' ? 'table-success' : 
                              result.status === 'warning' ? 'table-warning' : 'table-danger';
            const statusText = result.status === 'valid' ? 'Valid' : 
                             result.status === 'warning' ? 'Warning' : 'Error';
            
            row.innerHTML = `
                <td>${result.row}</td>
                <td>${result.sku}</td>
                <td>${result.name}</td>
                <td>${result.issues.join(', ')}</td>
                <td><span class="badge ${statusClass === 'table-success' ? 'bg-success' : 
                                       statusClass === 'table-warning' ? 'bg-warning' : 'bg-danger'}">${statusText}</span></td>
            `;
            row.className = statusClass;
            validationTableBody.appendChild(row);
        });

        // Enable continue button if there are valid items
        const continueBtn = document.getElementById('continueToMappingBtn');
        continueBtn.disabled = validationResults.valid.length === 0;
    }

    function showFieldMapping() {
        if (!validationResults || !validationResults.validData) {
            showAnalysisToast('No valid data to map fields for', 'error');
            return;
        }

        // Detect field mappings
        fieldMappings = detectFieldMappings(validationResults.validData);
        
        // Populate CSV fields
        const csvFieldsList = document.getElementById('csvFieldsList');
        const targetFieldsList = document.getElementById('targetFieldsList');
        
        if (csvFieldsList && targetFieldsList) {
            csvFieldsList.innerHTML = '';
            targetFieldsList.innerHTML = '';
            
            Object.keys(fieldMappings).forEach(csvField => {
                const mapping = fieldMappings[csvField];
                
                // CSV field item
                const csvItem = document.createElement('div');
                csvItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                csvItem.innerHTML = `
                    <span>${csvField}</span>
                    <i class="fas fa-arrow-right text-muted"></i>
                `;
                csvFieldsList.appendChild(csvItem);
                
                // Target field item
                const targetItem = document.createElement('div');
                targetItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                targetItem.innerHTML = `
                    <span>${mapping.target}</span>
                    <span class="badge bg-success">${mapping.confidence}%</span>
                `;
                targetFieldsList.appendChild(targetItem);
            });
        }
        
        showStep(3);
    }

    function showConfigurationMatching() {
        console.log('showBigcommerceConfigurationMatching called');
        const configMatchingDiv = document.getElementById('configMatchingBigCommerce');
        console.log('configMatchingDiv:', configMatchingDiv);
        
        // Initialize selection state at the very beginning
        if (!window.selectedConfigGroups) window.selectedConfigGroups = new Set();
        if (!window.selectedConfigVariants) window.selectedConfigVariants = new Set();
        
        const data = window.bigcommerceCsvData;
        console.log('bigcommerceCsvData:', data);
        
        if (!data || data.length === 0) {
            console.error('No data available for configuration matching');
            showAnalysisToast('No data available for configuration matching.', 'error');
            return;
        }

        // Get field mappings
        let fieldMappings = window.bigcommerceFieldMappings;
        if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
            console.log('No field mappings found, using defaults');
            fieldMappings = {
                SKU: 'Code',
                Brand: 'Brand',
                Model: 'Name',
                'Product URL': 'Product URL'
            };
        }
        console.log('Field mappings being used:', fieldMappings);
        console.log('Sample CSV row:', data[0]);

        // Check if we already have processed data with split groups
        let processedData = window.bigcommerceProcessedData;
        console.log('Existing processed data:', processedData);
        
        if (!processedData) {
            console.log('Processing data for the first time');
            // First time - process the data to extract the 5 essential fields
            processedData = data.map(row => {
                // Use mapped fields
                const sku = row[fieldMappings['SKU'] || 'Code'] || '';
                const brand = row[fieldMappings['Brand'] || 'Brand'] || '';
                const productUrl = row[fieldMappings['Product URL'] || 'Product URL'] || '';
                
                // Extract generation, variant, and model from Product URL
                const parsed = parseGenerationAndVariantFromUrl(productUrl);
                
                return {
                    ...row,
                    sku,
                    brand,
                    model: parsed.model, // Use extracted model instead of CSV Name field
                    generation: parsed.generation,
                    variant: parsed.variant,
                    // Create a group key for grouping variants
                    groupKey: `${brand}-${parsed.generation}`.toLowerCase().replace(/\s+/g, '-'),
                    excluded: false, // Track if variant is excluded from group
                    subGroup: null, // Track sub-group assignment
                    decision: 'create' // Default decision
                };
            });
            
            // Store processed data globally
            window.bigcommerceProcessedData = processedData;
            console.log('Processed data created and stored:', processedData.length, 'items');
        } else {
            // Preserve existing split groups and excluded status
            console.log('Preserving existing processed data with split groups');
        }

        // Group variants by Brand + Generation, respecting split groups
        const groupedData = {};
        processedData.forEach(item => {
            if (item.excluded) return; // Skip excluded variants
            
            // Use subGroup if it exists, otherwise use original groupKey
            const key = item.subGroup || item.groupKey;
            
            if (!groupedData[key]) {
                groupedData[key] = {
                    brand: item.brand,
                    generation: item.generation,
                    variants: [],
                    totalVariants: 0,
                    groupKey: key,
                    isSubGroup: !!item.subGroup,
                    originalGroupKey: item.groupKey,
                    decision: 'create' // Default decision
                };
            }
            groupedData[key].variants.push(item);
            groupedData[key].totalVariants++;
        });

        // Store grouped data globally
        window.bigcommerceGroupedData = groupedData;
        console.log('Grouped data created:', Object.keys(groupedData).length, 'groups');
        console.log('Sample group:', Object.values(groupedData)[0]);

        // Convert grouped data to array for display
        const groupedArray = Object.values(groupedData);
        console.log('Grouped array for display:', groupedArray.length, 'groups');

        // --- Begin scroll position preservation ---
        const tableContainer = configMatchingDiv.querySelector('.table-responsive');
        let scrollTop = 0;
        if (tableContainer) scrollTop = tableContainer.scrollTop;
        // --- End scroll position preservation ---

        // Build a map of groupKey to group for sorting split groups together
        const groupMap = {};
        Object.values(groupedData).forEach(group => {
            groupMap[group.groupKey] = group;
        });
        // Sort groupedArray so sub-groups appear after their parent group
        const sortedGroupedArray = [];
        groupedArray.forEach(group => {
            if (!group.isSubGroup) {
                sortedGroupedArray.push(group);
                // Add sub-groups immediately after
                Object.values(groupedData).forEach(subGroup => {
                    if (subGroup.isSubGroup && subGroup.originalGroupKey === group.groupKey) {
                        sortedGroupedArray.push(subGroup);
                    }
                });
            }
        });
        // Add any sub-groups that don't have a parent (just in case)
        groupedArray.forEach(group => {
            if (group.isSubGroup && !sortedGroupedArray.includes(group)) {
                sortedGroupedArray.push(group);
            }
        });

        // Multi-select state for variants
        // if (!window.selectedConfigVariants) window.selectedConfigVariants = new Set();
        
        // Initialize group selection state
        // if (!window.selectedConfigGroups) window.selectedConfigGroups = new Set();

        const htmlContent = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Configuration Grouping:</strong> Variants have been grouped by Brand + Generation. You can remove individual variants, split groups into sub-groups, or create separate configurations.
            </div>
            <div class="mb-3">
                <label class="form-label">Grouping Strategy:</label>
                <select class="form-select" id="groupingStrategy" onchange="updateGroupingStrategy()">
                    <option value="grouped">Create one configuration per group (recommended)</option>
                    <option value="separate">Create separate configuration for each variant</option>
                </select>
            </div>
            <div class="mb-2 d-flex align-items-center gap-2">
                <button type="button" class="btn btn-danger btn-sm" id="removeSelectedGroupsBtn"><i class="fas fa-trash me-1"></i>Remove Selected Groups</button>
                <button type="button" class="btn btn-danger btn-sm" id="removeSelectedVariantsBtn"><i class="fas fa-trash me-1"></i>Remove Selected Variants</button>
                <span class="text-muted small">(Skip = will not be imported)</span>
            </div>
            <div class="table-responsive" style="max-height: 400px;">
                <table class="table table-sm table-striped">
                    <thead class="table-dark">
                        <tr>
                            <th><input type="checkbox" id="selectAllGroups"></th>
                            <th>Group</th>
                            <th>Brand</th>
                            <th>Generation</th>
                            <th>Variants</th>
                            <th>Variant Details</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedGroupedArray.map((group, index) => `
                            <tr class="${group.isSubGroup ? 'table-warning' : ''}">
                                <td><input type="checkbox" class="groupCheckbox" data-groupkey="${group.groupKey}" ${group.decision === 'skip' ? '' : (window.selectedConfigGroups.has(group.groupKey) ? 'checked' : '')}></td>
                                <td>
                                    <strong>${group.isSubGroup ? 'Sub-Group' : 'Group'} ${index + 1}</strong>
                                    ${group.isSubGroup ? `<br><small class="text-muted">Split from: ${group.originalGroupKey}</small>` : ''}
                                </td>
                                <td>${group.brand || ''}</td>
                                <td>${group.generation || ''}</td>
                                <td><span class="badge bg-primary">${group.totalVariants}</span></td>
                                <td class="text-nowrap" style="width: 200px;">
                                    <div class="small">
                                        <div class="fw-bold text-primary">${group.brand} ${group.generation}</div>
                                        <div class="text-muted">${group.variants.length} variant${group.variants.length !== 1 ? 's' : ''}</div>
                                        <div class="mt-2">
                                            ${group.variants.map(v => `
                                                <div class="d-flex justify-content-between align-items-center mb-1 p-1 border rounded bg-light">
                                                    <input type="checkbox" class="variantCheckbox me-2" data-variantsku="${v.sku}" ${v.decision === 'skip' ? '' : (window.selectedConfigVariants.has(v.sku) ? 'checked' : '')}>
                                                    <div class="flex-grow-1">
                                                        <div class="fw-bold small">${v.variant || 'Default'}</div>
                                                        <div class="text-muted" style="font-size: 0.75rem;">SKU: ${v.sku}</div>
                                                    </div>
                                                    <div class="btn-group btn-group-sm ms-1">
                                                        <button class="btn btn-outline-warning btn-sm" onclick="splitVariantFromGroup('${v.sku}')" title="Split this variant into separate group">
                                                            <i class="fas fa-cut"></i>
                                                        </button>
                                                        <button class="btn btn-outline-danger btn-sm" onclick="removeVariantFromGroup('${v.sku}')" title="Remove from group">
                                                            <i class="fas fa-times"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="btn-group-vertical btn-group-sm">
                                        <button class="btn btn-outline-info btn-sm" onclick="splitGroupByCriteria('${group.groupKey}')" title="Split group by criteria (e.g., HS vs non-HS)">
                                            <i class="fas fa-split me-1"></i>Split Group
                                        </button>
                                        <select class="form-select form-select-sm groupDecisionSelect" data-groupkey="${group.groupKey}">
                                            <option value="create" ${group.decision === 'create' ? 'selected' : ''}>Create Configuration</option>
                                            <option value="skip" ${group.decision === 'skip' ? 'selected' : ''}>Skip</option>
                                        </select>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <button type="button" class="btn btn-secondary" onclick="showVariantDetails()">
                    <i class="fas fa-list me-2"></i>View All Variants
                </button>
                <button type="button" class="btn btn-warning" onclick="showExcludedVariants()">
                    <i class="fas fa-ban me-2"></i>View Excluded Variants
                </button>
                <button type="button" class="btn btn-info" onclick="showSplitGroups()">
                    <i class="fas fa-split me-2"></i>View Split Groups
                </button>
            </div>
        `;
        configMatchingDiv.innerHTML = htmlContent;

        // Checkbox logic for groups
        const selectAllGroups = document.getElementById('selectAllGroups');
        const groupCheckboxes = Array.from(document.querySelectorAll('.groupCheckbox'));
        const removeSelectedBtn = document.getElementById('removeSelectedGroupsBtn');
        groupCheckboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                const groupKey = this.getAttribute('data-groupkey');
                if (this.checked) {
                    window.selectedConfigGroups.add(groupKey);
                } else {
                    window.selectedConfigGroups.delete(groupKey);
                }
            });
        });
        if (selectAllGroups) {
            selectAllGroups.addEventListener('change', function() {
                groupCheckboxes.forEach(cb => {
                    cb.checked = this.checked;
                    const groupKey = cb.getAttribute('data-groupkey');
                    if (this.checked) {
                        window.selectedConfigGroups.add(groupKey);
                    } else {
                        window.selectedConfigGroups.delete(groupKey);
                    }
                });
            });
        }
        if (removeSelectedBtn) {
            removeSelectedBtn.addEventListener('click', function() {
                // Set decision to skip for all selected groups
                const processedData = window.bigcommerceProcessedData;
                if (!processedData) return;
                window.selectedConfigGroups.forEach(groupKey => {
                    processedData.forEach(item => {
                        if ((item.subGroup || item.groupKey) === groupKey) {
                            item.decision = 'skip';
                        }
                    });
                });
                // Clear selection
                window.selectedConfigGroups.clear();
                
                // Auto-save the import state
                autoSaveImportState();
                
                // Refresh
                showBigcommerceConfigurationMatching();
            });
        }
        // Variant-level checkbox logic
        const variantCheckboxes = Array.from(document.querySelectorAll('.variantCheckbox'));
        const removeSelectedVariantsBtn = document.getElementById('removeSelectedVariantsBtn');
        variantCheckboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                const sku = this.getAttribute('data-variantsku');
                if (this.checked) {
                    window.selectedConfigVariants.add(sku);
                } else {
                    window.selectedConfigVariants.delete(sku);
                }
            });
        });
        if (removeSelectedVariantsBtn) {
            removeSelectedVariantsBtn.addEventListener('click', function() {
                // Set decision to skip for all selected variants
                const processedData = window.bigcommerceProcessedData;
                if (!processedData) return;
                window.selectedConfigVariants.forEach(sku => {
                    processedData.forEach(item => {
                        if (item.sku === sku) {
                            item.decision = 'skip';
                        }
                    });
                });
                // Clear selection
                window.selectedConfigVariants.clear();
                
                // Auto-save the import state
                autoSaveImportState();
                
                // Refresh
                showBigcommerceConfigurationMatching();
            });
        }
        // Persist skip state in select
        const groupDecisionSelects = Array.from(document.querySelectorAll('.groupDecisionSelect'));
        groupDecisionSelects.forEach(sel => {
            sel.addEventListener('change', function() {
                const groupKey = this.getAttribute('data-groupkey');
                const value = this.value;
                const processedData = window.bigcommerceProcessedData;
                if (!processedData) return;
                processedData.forEach(item => {
                    if ((item.subGroup || item.groupKey) === groupKey) {
                        item.decision = value;
                    }
                });
                showBigcommerceConfigurationMatching();
            });
        });
        // --- Restore scroll position ---
        setTimeout(() => {
            const tableContainer = configMatchingDiv.querySelector('.table-responsive');
            if (tableContainer) tableContainer.scrollTop = scrollTop;
        }, 0);
        
        // Auto-save the import state
        autoSaveImportState();
        
        showBigcommerceStep(4);
    }

    function analyzeConfigurationMatches(processedData) {
        const results = {
            newConfigs: [],
            addToExisting: [],
            manualReview: [],
            total: processedData.length
        };

        processedData.forEach(item => {
            // Try to find existing configuration with same brand and model
            const existingConfig = configurations.find(config => 
                config.brand === item.brand && 
                config.model === item.model
            );

            if (!existingConfig) {
                // No existing config found - create new
                results.newConfigs.push({
                    ...item,
                    suggestedAction: 'new',
                    existingConfig: null,
                    decision: 'new'
                });
            } else {
                // Check if this variant already exists
                const existingVariant = existingConfig.variants?.find(v => v.sku === item.sku);
                
                if (existingVariant) {
                    // Variant already exists - skip or update
                    results.manualReview.push({
                        ...item,
                        suggestedAction: 'skip',
                        existingConfig: existingConfig,
                        decision: 'skip'
                    });
                } else {
                    // Add to existing config
                    results.addToExisting.push({
                        ...item,
                        suggestedAction: 'add',
                        existingConfig: existingConfig,
                        decision: 'add'
                    });
                }
            }
        });

        return results;
    }

    function displayConfigurationMatching(results) {
        // Update statistics
        document.getElementById('matchNewCount').textContent = results.newConfigs.length;
        document.getElementById('matchExistingCount').textContent = results.addToExisting.length;
        document.getElementById('matchManualCount').textContent = results.manualReview.length;
        document.getElementById('matchTotalCount').textContent = results.total;

        // Populate table
        const tableBody = document.getElementById('configMatchTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
            
            // Combine all items
            const allItems = [
                ...results.newConfigs,
                ...results.addToExisting,
                ...results.manualReview
            ];

            allItems.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.sku}</td>
                    <td>${item.brand}</td>
                    <td>${item.model}</td>
                    <td>${item.variant || item.name || 'N/A'}</td>
                    <td>
                        <span class="badge ${getMatchActionClass(item.suggestedAction)}">
                            ${getMatchActionText(item.suggestedAction)}
                        </span>
                    </td>
                    <td>${item.existingConfig ? `${item.existingConfig.brand} ${item.existingConfig.model}` : 'N/A'}</td>
                    <td>
                        <select class="form-select form-select-sm" onchange="updateConfigDecision('${item.sku}', this.value)">
                            <option value="new" ${item.decision === 'new' ? 'selected' : ''}>New Config</option>
                            <option value="add" ${item.decision === 'add' ? 'selected' : ''}>Add to Existing</option>
                            <option value="skip" ${item.decision === 'skip' ? 'selected' : ''}>Skip</option>
                        </select>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    function getMatchActionClass(action) {
        switch (action) {
            case 'new': return 'bg-success';
            case 'add': return 'bg-warning';
            case 'skip': return 'bg-secondary';
            default: return 'bg-info';
        }
    }

    function getMatchActionText(action) {
        switch (action) {
            case 'new': return 'New Config';
            case 'add': return 'Add to Existing';
            case 'skip': return 'Skip';
            default: return 'Unknown';
        }
    }

    function detectFieldMappings(data) {
        if (!data || data.length === 0) return {};
        
        const firstRow = data[0];
        // Set default mappings
        const mappings = {
            SKU: 'Code',
            Brand: 'Brand',
            Model: 'Name',
            'Product URL': 'Product URL'
        };
        // If the CSV has these columns, keep them, otherwise try to auto-detect
        Object.keys(mappings).forEach(key => {
            if (!(mappings[key] in firstRow)) {
                // Try to find a matching column
                const found = Object.keys(firstRow).find(col => col.toLowerCase().replace(/[_\s]/g, '') === key.toLowerCase().replace(/[_\s]/g, ''));
                if (found) mappings[key] = found;
            }
        });
        return mappings;
    }

    function processCsvDataWithMappings(data, mappings) {
        return data.map(row => {
            const processed = {};
            
            // First, map the basic fields
            Object.keys(mappings).forEach(csvField => {
                const mapping = mappings[csvField];
                processed[mapping.target] = row[csvField];
            });
            
            // Now intelligently parse the product name to extract brand, model, generation, and variant
            if (processed.name && !processed.brand && !processed.model) {
                const parsed = parseProductName(processed.name);
                processed.brand = processed.brand || parsed.brand;
                processed.model = processed.model || parsed.model;
                processed.generation = processed.generation || parsed.generation;
                processed.variant = processed.variant || parsed.variant;
            }
            
            // If we have a brand but no model, try to extract from name
            if (processed.brand && !processed.model && processed.name) {
                const parsed = parseProductName(processed.name);
                processed.model = parsed.model;
                processed.generation = processed.generation || parsed.generation;
                processed.variant = processed.variant || parsed.variant;
            }
            
            // If we have a name but no variant, try to extract it
            if (processed.name && !processed.variant) {
                const parsed = parseProductName(processed.name);
                processed.variant = parsed.variant;
            }
            
            return processed;
        });
    }

    function parseProductName(productName) {
        if (!productName) return { brand: '', model: '', generation: '', variant: '' };
        
        const name = productName.trim();
        let brand = '';
        let model = '';
        let generation = '';
        let variant = '';
        
        // Common bike brand patterns
        const brandPatterns = [
            { pattern: /^Riese\s*&\s*Muller/i, brand: 'Riese & Muller' },
            { pattern: /^Riese\s*&\s*Müller/i, brand: 'Riese & Muller' },
            { pattern: /^R\s*&\s*M/i, brand: 'Riese & Muller' },
            { pattern: /^Trek/i, brand: 'Trek' },
            { pattern: /^Specialized/i, brand: 'Specialized' },
            { pattern: /^Giant/i, brand: 'Giant' },
            { pattern: /^Cannondale/i, brand: 'Cannondale' },
            { pattern: /^Cube/i, brand: 'Cube' },
            { pattern: /^Haibike/i, brand: 'Haibike' },
            { pattern: /^Gazelle/i, brand: 'Gazelle' },
            { pattern: /^Kalkhoff/i, brand: 'Kalkhoff' },
            { pattern: /^Bulls/i, brand: 'Bulls' },
            { pattern: /^Scott/i, brand: 'Scott' },
            { pattern: /^Merida/i, brand: 'Merida' },
            { pattern: /^Focus/i, brand: 'Focus' }
        ];
        
        // Find brand
        for (const brandPattern of brandPatterns) {
            if (brandPattern.pattern.test(name)) {
                brand = brandPattern.brand;
                break;
            }
        }
        
        // Extract model and generation from the name
        let remainingName = name;
        if (brand) {
            // Remove brand from the beginning
            remainingName = name.replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '').trim();
        }
        
        // Common model patterns for Riese & Muller
        if (brand === 'Riese & Muller') {
            const rnModelPatterns = [
                { pattern: /Superdelite(\d+)/i, model: 'Superdelite', generation: 'Superdelite$1' },
                { pattern: /Delite(\d+)/i, model: 'Delite', generation: 'Delite$1' },
                { pattern: /Charger(\d+)/i, model: 'Charger', generation: 'Charger$1' },
                { pattern: /Load(\d+)/i, model: 'Load', generation: 'Load$1' },
                { pattern: /Packster(\d+)/i, model: 'Packster', generation: 'Packster$1' },
                { pattern: /Multicharger(\d+)/i, model: 'Multicharger', generation: 'Multicharger$1' },
                { pattern: /Neo(\d+)/i, model: 'Neo', generation: 'Neo$1' },
                { pattern: /Culture(\d+)/i, model: 'Culture', generation: 'Culture$1' },
                { pattern: /Roadster(\d+)/i, model: 'Roadster', generation: 'Roadster$1' },
                { pattern: /Tinker(\d+)/i, model: 'Tinker', generation: 'Tinker$1' },
                { pattern: /Homage(\d+)/i, model: 'Homage', generation: 'Homage$1' },
                { pattern: /Variation(\d+)/i, model: 'Variation', generation: 'Variation$1' },
                { pattern: /Kiez(\d+)/i, model: 'Kiez', generation: 'Kiez$1' },
                { pattern: /Birdy(\d+)/i, model: 'Birdy', generation: 'Birdy$1' },
                { pattern: /Flying(\d+)/i, model: 'Flying', generation: 'Flying$1' },
                { pattern: /Swing(\d+)/i, model: 'Swing', generation: 'Swing$1' }
            ];
            
            for (const modelPattern of rnModelPatterns) {
                const match = remainingName.match(modelPattern.pattern);
                if (match) {
                    model = modelPattern.model;
                    generation = match[0]; // Use the full match as generation
                    
                    // Remove the model/generation from remaining name to get variant
                    remainingName = remainingName.replace(modelPattern.pattern, '').trim();
                    break;
                }
            }
        }
        
        // If no specific model found, try to extract common patterns
        if (!model) {
            // Look for common model patterns
            const commonModelPatterns = [
                /(\w+)(\d+)/i, // Word followed by number (e.g., "Superdelite5")
                /(\w+)\s+(\d+)/i, // Word space number (e.g., "Superdelite 5")
                /(\w+)-(\d+)/i, // Word dash number (e.g., "Superdelite-5")
            ];
            
            for (const pattern of commonModelPatterns) {
                const match = remainingName.match(pattern);
                if (match) {
                    model = match[1];
                    generation = match[0];
                    
                    // Remove the model/generation from remaining name to get variant
                    remainingName = remainingName.replace(pattern, '').trim();
                    break;
                }
            }
        }
        
        // Clean up the results
        if (model) {
            model = model.charAt(0).toUpperCase() + model.slice(1).toLowerCase();
        }
        
        // The remaining name is the variant
        variant = remainingName.trim();
        
        return { brand, model, generation, variant };
    }

    function showFinalReview() {
        if (!configMatchingResults) {
            showAnalysisToast('No configuration matching results available', 'error');
            return;
        }

        // Process the configuration matching decisions
        const allItems = [
            ...configMatchingResults.newConfigs,
            ...configMatchingResults.addToExisting,
            ...configMatchingResults.manualReview
        ];

        const finalData = allItems.map(item => {
            return {
                sku: item.sku,
                brand: item.brand,
                model: item.model,
                generation: item.generation,
                variant: item.variant,
                name: item.name,
                decision: item.decision,
                existingConfig: item.existingConfig
            };
        });

        // Count by decision type
        const newCount = finalData.filter(item => item.decision === 'new').length;
        const addCount = finalData.filter(item => item.decision === 'add').length;
        const skipCount = finalData.filter(item => item.decision === 'skip').length;
        const totalCount = finalData.length;

        // Update final review statistics
        document.getElementById('finalNewCount').textContent = newCount;
        document.getElementById('finalUpdateCount').textContent = addCount;
        document.getElementById('finalSkipCount').textContent = skipCount;
        document.getElementById('finalTotalCount').textContent = totalCount;

        // Populate final review table
        const tableBody = document.getElementById('finalReviewTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
            
            finalData.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.sku}</td>
                    <td>${item.brand}</td>
                    <td>${item.model}</td>
                    <td>${item.generation}</td>
                    <td>${item.variant}</td>
                    <td>${item.name}</td>
                    <td>
                        <span class="badge ${getFinalActionClass(item.decision)}">
                            ${getFinalActionText(item.decision)}
                        </span>
                    </td>
                    <td>
                        <span class="badge bg-success">Ready</span>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }

        showStep(5);
    }

    function getFinalActionClass(decision) {
        switch (decision) {
            case 'new': return 'bg-success';
            case 'add': return 'bg-warning';
            case 'skip': return 'bg-secondary';
            default: return 'bg-info';
        }
    }

    function getFinalActionText(decision) {
        switch (decision) {
            case 'new': return 'New Config';
            case 'add': return 'Add to Existing';
            case 'skip': return 'Skip';
            default: return 'Unknown';
        }
    }

    function showStep(step) {
        currentImportStep = step;
        
        // Hide all steps
        document.getElementById('uploadStep').style.display = 'none';
        document.getElementById('validationStep').style.display = 'none';
        document.getElementById('mappingStep').style.display = 'none';
        document.getElementById('configMatchStep').style.display = 'none';
        document.getElementById('reviewStep').style.display = 'none';
        
        // Reset all badges
        document.getElementById('step1Badge').className = 'badge bg-secondary';
        document.getElementById('step2Badge').className = 'badge bg-secondary';
        document.getElementById('step3Badge').className = 'badge bg-secondary';
        document.getElementById('step4Badge').className = 'badge bg-secondary';
        document.getElementById('step5Badge').className = 'badge bg-secondary';
        
        // Show current step and update progress
        let progressWidth = 20;
        let activeStep = 1;
        
        switch (step) {
            case 1:
                document.getElementById('uploadStep').style.display = 'block';
                document.getElementById('step1Badge').className = 'badge bg-info';
                progressWidth = 20;
                activeStep = 1;
                break;
            case 2:
                document.getElementById('validationStep').style.display = 'block';
                document.getElementById('step2Badge').className = 'badge bg-info';
                progressWidth = 40;
                activeStep = 2;
                break;
            case 3:
                document.getElementById('mappingStep').style.display = 'block';
                document.getElementById('step3Badge').className = 'badge bg-info';
                progressWidth = 60;
                activeStep = 3;
                break;
            case 4:
                document.getElementById('configMatchStep').style.display = 'block';
                document.getElementById('step4Badge').className = 'badge bg-info';
                progressWidth = 80;
                activeStep = 4;
                break;
            case 5:
                document.getElementById('reviewStep').style.display = 'block';
                document.getElementById('step5Badge').className = 'badge bg-info';
                progressWidth = 100;
                activeStep = 5;
                break;
        }
        
        // Update progress bar
        document.getElementById('importProgress').style.width = progressWidth + '%';
        
        // Update previous step badges
        for (let i = 1; i < activeStep; i++) {
            document.getElementById(`step${i}Badge`).className = 'badge bg-success';
        }
    }

    function confirmImport() {
        if (!configMatchingResults) {
            showAnalysisToast('No configuration matching results available', 'error');
            return;
        }

        // Get all items with their decisions
        const allItems = [
            ...configMatchingResults.newConfigs,
            ...configMatchingResults.addToExisting,
            ...configMatchingResults.manualReview
        ];

        let newCount = 0;
        let updateCount = 0;
        let skipCount = 0;
        
        allItems.forEach(item => {
            if (item.decision === 'new') {
                // Create new configuration
                const timestamp = Date.now();
                const randomPart = Math.floor(Math.random() * 1000);
                const newId = timestamp + randomPart;
                
                const newConfig = {
                    id: newId,
                    brand: item.brand,
                    model: item.model,
                    generation: item.generation,
                    variants: [{
                        name: item.name,
                        sku: item.sku
                    }]
                };
                configurations.push(newConfig);
                newCount++;
            } else if (item.decision === 'add') {
                // Add variant to existing configuration
                if (item.existingConfig) {
                    const existingIndex = configurations.findIndex(config => config.id === item.existingConfig.id);
                    if (existingIndex !== -1) {
                        // Check if variant already exists
                        const existingVariant = configurations[existingIndex].variants?.find(v => v.sku === item.sku);
                        if (!existingVariant) {
                            if (!configurations[existingIndex].variants) {
                                configurations[existingIndex].variants = [];
                            }
                            configurations[existingIndex].variants.push({
                                name: item.name,
                                sku: item.sku
                            });
                            updateCount++;
                        } else {
                            skipCount++;
                        }
                    }
                }
            } else if (item.decision === 'skip') {
                skipCount++;
            }
        });
        
        // Save configurations to file instead of localStorage
        saveConfigurationsToFile();
        
        // Add to import history
        addToImportHistory({
            date: new Date().toISOString(),
            file: csvFileInput.files[0].name,
            total: allItems.length,
            success: newCount + updateCount,
            errors: skipCount,
            status: 'completed'
        });
        
        // Show success message
        showAnalysisToast(`Import completed! ${newCount} new configurations created, ${updateCount} variants added to existing configs, ${skipCount} skipped.`, 'success');
        
        // Close modal and refresh
        const modal = bootstrap.Modal.getInstance(document.getElementById('importCsvModal'));
        modal.hide();
        
        // Refresh analysis
        performAnalysis();
        renderAnalysisTable();
        loadImportHistory();
    }

    function loadImportHistory() {
        // Load from localStorage or use sample data
        const history = JSON.parse(localStorage.getItem('importHistory')) || [];
        importHistory = history;
        
        // Update history table if it exists
        const historyTable = document.getElementById('importHistoryTable');
        if (historyTable) {
            historyTable.innerHTML = '';
            
            history.slice(0, 5).forEach(importItem => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(importItem.date).toLocaleDateString()}</td>
                    <td>${importItem.file}</td>
                    <td>${importItem.total}</td>
                    <td>${importItem.success}</td>
                    <td>${importItem.errors}</td>
                    <td><span class="badge bg-success">${importItem.status}</span></td>
                    <td>
                        <button class="btn btn-outline-secondary btn-sm" onclick="viewImportDetails('${importItem.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="rollbackImport('${importItem.id}')">
                            <i class="fas fa-undo"></i>
                        </button>
                    </td>
                `;
                historyTable.appendChild(row);
            });
        }
    }

    function addToImportHistory(importData) {
        importData.id = Date.now().toString();
        importHistory.unshift(importData);
        
        // Keep only last 50 imports
        if (importHistory.length > 50) {
            importHistory = importHistory.slice(0, 50);
        }
        
        localStorage.setItem('importHistory', JSON.stringify(importHistory));
    }

    function showAnalysisToast(message, type = 'info') {
        const toast = document.getElementById('analysisToast');
        const toastBody = document.getElementById('analysisToastBody');
        
        if (toast && toastBody) {
            toastBody.textContent = message;
            
            // Update toast styling based on type
            const toastHeader = toast.querySelector('.toast-header');
            const icon = toastHeader.querySelector('i');
            
            // Remove existing type classes
            icon.className = 'fas me-2';
            
            // Add type-specific styling
            switch (type) {
                case 'success':
                    icon.classList.add('text-success');
                    break;
                case 'error':
                    icon.classList.add('text-danger');
                    break;
                case 'warning':
                    icon.classList.add('text-warning');
                    break;
                default:
                    icon.classList.add('text-info');
            }
            
            // Show the toast
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        } else {
            console.log(`Toast (${type}): ${message}`);
        }
    }

    // Global functions for action buttons
    window.viewDetails = function(configId) {
        // Open card creator with pre-filled configuration
        const config = configurations.find(c => c.id == configId);
        if (config) {
            // Store the configuration data for the card creator
            localStorage.setItem('selectedConfigForCard', JSON.stringify(config));
            // Navigate to card creator
            window.location.href = 'card-creator.html?config=' + configId;
        }
    };

    window.createCards = function(configId) {
        // Open card creator with pre-filled configuration
        const config = configurations.find(c => c.id == configId);
        if (config) {
            // Store the configuration data for the card creator
            localStorage.setItem('selectedConfigForCard', JSON.stringify(config));
            // Navigate to card creator
            window.location.href = 'card-creator.html?config=' + configId;
        }
    };

    window.uploadImages = function(configId) {
        // Open WebDAV explorer for image upload
        const config = configurations.find(c => c.id == configId);
        if (config) {
            // Store the configuration data for the WebDAV explorer
            localStorage.setItem('selectedConfigForImages', JSON.stringify(config));
            // Navigate to WebDAV explorer
            window.location.href = 'webdav-explorer.html?config=' + configId;
        }
    };

    window.updateHypa = function(configId) {
        // Open card manager to update Hypa metafields
        const config = configurations.find(c => c.id == configId);
        if (config) {
            // Store the configuration data for the card manager
            localStorage.setItem('selectedConfigForHypa', JSON.stringify(config));
            // Navigate to card manager
            window.location.href = 'card-manager.html?config=' + configId;
        }
    };

    window.viewImportDetails = function(importId) {
        // Show import details in a modal
        const importData = importHistory.find(imp => imp.id === importId);
        if (importData) {
            const details = `
Import Details:
- Date: ${new Date(importData.date).toLocaleString()}
- File: ${importData.file}
- Total Items: ${importData.total}
- Successful: ${importData.success}
- Errors: ${importData.errors}
- Status: ${importData.status}
            `;
            alert(details);
        }
    };

    window.rollbackImport = function(importId) {
        if (confirm('Are you sure you want to rollback this import? This action cannot be undone.')) {
            // TODO: Implement actual rollback logic
            // For now, just show a message
            showAnalysisToast('Rollback functionality coming soon!', 'info');
        }
    };

    window.updateConfigDecision = function(sku, decision) {
        if (!configMatchingResults) return;
        
        // Find the item and update its decision
        const allItems = [
            ...configMatchingResults.newConfigs,
            ...configMatchingResults.addToExisting,
            ...configMatchingResults.manualReview
        ];
        
        const item = allItems.find(item => item.sku === sku);
        if (item) {
            item.decision = decision;
            
            // Update statistics
            const newCount = allItems.filter(item => item.decision === 'new').length;
            const addCount = allItems.filter(item => item.decision === 'add').length;
            const skipCount = allItems.filter(item => item.decision === 'skip').length;
            
            document.getElementById('matchNewCount').textContent = newCount;
            document.getElementById('matchExistingCount').textContent = addCount;
            document.getElementById('matchManualCount').textContent = skipCount;
        }
    };

    // BigCommerce Import Functions
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

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
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

                if (data.length === 0) {
                    showAnalysisToast('No data found in CSV file.', 'error');
                    return;
                }

                // Store the data globally
                window.bigcommerceCsvData = data;
                
                // Auto-save the import state
                autoSaveImportState();

                // Show validation results
                showBigcommerceValidationResults(data);
                
            } catch (error) {
                console.error('Error parsing CSV:', error);
                showAnalysisToast('Error parsing CSV file: ' + error.message, 'error');
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

        console.log('Validation results:', { validRows: validRows.length, invalidRows: invalidRows.length, total: data.length });

        validationResultsDiv.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center">
                            <h4>${validRows.length}</h4>
                            <small>Valid Products</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-warning text-dark">
                        <div class="card-body text-center">
                            <h4>${invalidRows.length}</h4>
                            <small>Invalid Products</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-info text-white">
                        <div class="card-body text-center">
                            <h4>${data.length}</h4>
                            <small>Total Products</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center">
                            <h4>${validRows.length > 0 ? Math.round((validRows.length / data.length) * 100) : 0}%</h4>
                            <small>Success Rate</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Validation Complete:</strong> ${validRows.length} products are ready for import.
            </div>
        `;
        
        console.log('About to call showBigcommerceStep(2)');
        showBigcommerceStep(2);
    }

    function showBigcommerceFieldMapping() {
        console.log('showBigcommerceFieldMapping called');
        const fieldMappingDiv = document.getElementById('fieldMappingBigCommerce');
        console.log('fieldMappingDiv:', fieldMappingDiv);
        
        const data = window.bigcommerceCsvData;
        console.log('bigcommerceCsvData:', data);
        
        if (!data || data.length === 0) {
            console.error('No data available for field mapping');
            showAnalysisToast('No data available for field mapping.', 'error');
            return;
        }

        // Auto-detect field mappings
        const detectedMappings = detectFieldMappings(data);
        console.log('Detected mappings:', detectedMappings);
        
        // Store mappings globally
        window.bigcommerceFieldMappings = detectedMappings;
        
        // Auto-save the import state
        autoSaveImportState();

        const htmlContent = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Field Mapping:</strong> Map CSV columns to bike configuration fields. The system will try to auto-detect mappings.
            </div>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead class="table-dark">
                        <tr>
                            <th>Required Field</th>
                            <th>Mapped CSV Column</th>
                            <th>Sample Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>SKU</strong></td>
                            <td>
                                <select class="form-select form-select-sm" id="skuMapping" onchange="updateFieldMapping('SKU', this.value)">
                                    <option value="">Select column...</option>
                                    ${Object.keys(data[0] || {}).map(col => 
                                        `<option value="${col}" ${detectedMappings.SKU === col ? 'selected' : ''}>${col}</option>`
                                    ).join('')}
                                </select>
                            </td>
                            <td><small class="text-muted">${detectedMappings.SKU ? data[0][detectedMappings.SKU] : 'N/A'}</small></td>
                        </tr>
                        <tr>
                            <td><strong>Brand</strong></td>
                            <td>
                                <select class="form-select form-select-sm" id="brandMapping" onchange="updateFieldMapping('Brand', this.value)">
                                    <option value="">Select column...</option>
                                    ${Object.keys(data[0] || {}).map(col => 
                                        `<option value="${col}" ${detectedMappings.Brand === col ? 'selected' : ''}>${col}</option>`
                                    ).join('')}
                                </select>
                            </td>
                            <td><small class="text-muted">${detectedMappings.Brand ? data[0][detectedMappings.Brand] : 'N/A'}</small></td>
                        </tr>
                        <tr>
                            <td><strong>Model</strong></td>
                            <td>
                                <select class="form-select form-select-sm" id="modelMapping" onchange="updateFieldMapping('Model', this.value)">
                                    <option value="">Select column...</option>
                                    ${Object.keys(data[0] || {}).map(col => 
                                        `<option value="${col}" ${detectedMappings.Model === col ? 'selected' : ''}>${col}</option>`
                                    ).join('')}
                                </select>
                            </td>
                            <td><small class="text-muted">${detectedMappings.Model ? data[0][detectedMappings.Model] : 'N/A'}</small></td>
                        </tr>
                        <tr>
                            <td><strong>Product URL</strong></td>
                            <td>
                                <select class="form-select form-select-sm" id="urlMapping" onchange="updateFieldMapping('Product URL', this.value)">
                                    <option value="">Select column...</option>
                                    ${Object.keys(data[0] || {}).map(col => 
                                        `<option value="${col}" ${detectedMappings['Product URL'] === col ? 'selected' : ''}>${col}</option>`
                                    ).join('')}
                                </select>
                            </td>
                            <td><small class="text-muted">${detectedMappings['Product URL'] ? data[0][detectedMappings['Product URL']] : 'N/A'}</small></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        fieldMappingDiv.innerHTML = htmlContent;
        showBigcommerceStep(3);
    }

    // Global function to update field mappings
    window.updateFieldMapping = function(field, value) {
        if (!window.bigcommerceFieldMappings) {
            window.bigcommerceFieldMappings = {};
        }
        window.bigcommerceFieldMappings[field] = value;
        
        // Auto-save the import state
        autoSaveImportState();
        
        // Update the sample value display
        const data = window.bigcommerceCsvData;
        if (data && data.length > 0) {
            const sampleValue = data[0][value] || 'N/A';
            const row = document.querySelector(`#${field.toLowerCase().replace(/\s+/g, '')}Mapping`).closest('tr');
            const sampleCell = row.querySelector('td:last-child small');
            if (sampleCell) {
                sampleCell.textContent = sampleValue;
            }
        }
    };

    // Helper: Parse generation and variant from Product URL
    function parseGenerationAndVariantFromUrl(productUrl) {
        if (!productUrl) return { generation: '', variant: '', model: '' };
        let clean = productUrl.replace(/^\//, '').replace(/\/$/, '').replace(/^riese-muller-/, '');
        let parts = clean.split('-');
        // Known base models (without generation numbers)
        const baseModels = ['superdelite', 'delite', 'charger', 'multicharger', 'nevo', 'homage', 'load', 'packster', 'roadster'];
        let generation = '';
        let variant = '';
        let model = '';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            // Check if this part starts with a known base model
            const matchedBaseModel = baseModels.find(baseModel => part.startsWith(baseModel));
            
            if (matchedBaseModel) {
                model = matchedBaseModel; // Use the base model name
                generation = part; // Keep the full part as generation (e.g., "superdelite5")
                variant = parts.slice(i + 1).join(' ');
                break;
            }
        }
        
        if (!generation && parts.length > 0) {
            generation = parts[0];
            model = parts[0]; // Fallback to first part
            variant = parts.slice(1).join(' ');
        }
        
        return {
            generation: generation.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            variant: variant.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            model: model.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        };
    }

    function showBigcommerceConfigurationMatching() {
        console.log('showBigcommerceConfigurationMatching called');
        const configMatchingDiv = document.getElementById('configMatchingBigCommerce');
        console.log('configMatchingDiv:', configMatchingDiv);
        
        // Initialize selection state at the very beginning
        if (!window.selectedConfigGroups) window.selectedConfigGroups = new Set();
        if (!window.selectedConfigVariants) window.selectedConfigVariants = new Set();
        
        const data = window.bigcommerceCsvData;
        console.log('bigcommerceCsvData:', data);
        
        if (!data || data.length === 0) {
            console.error('No data available for configuration matching');
            showAnalysisToast('No data available for configuration matching.', 'error');
            return;
        }

        // Get field mappings
        let fieldMappings = window.bigcommerceFieldMappings;
        if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
            console.log('No field mappings found, using defaults');
            fieldMappings = {
                SKU: 'Code',
                Brand: 'Brand',
                Model: 'Name',
                'Product URL': 'Product URL'
            };
        }
        console.log('Field mappings being used:', fieldMappings);
        console.log('Sample CSV row:', data[0]);

        // Check if we already have processed data with split groups
        let processedData = window.bigcommerceProcessedData;
        console.log('Existing processed data:', processedData);
        
        if (!processedData) {
            console.log('Processing data for the first time');
            // First time - process the data to extract the 5 essential fields
            processedData = data.map(row => {
                // Use mapped fields
                const sku = row[fieldMappings['SKU'] || 'Code'] || '';
                const brand = row[fieldMappings['Brand'] || 'Brand'] || '';
                const productUrl = row[fieldMappings['Product URL'] || 'Product URL'] || '';
                
                console.log('Processing row:', { sku, brand, productUrl, originalBrand: row[fieldMappings['Brand'] || 'Brand'] });
                
                // Extract generation, variant, and model from Product URL
                const parsed = parseGenerationAndVariantFromUrl(productUrl);
                
                return {
                    ...row,
                    sku,
                    brand,
                    model: parsed.model, // Use extracted model instead of CSV Name field
                    generation: parsed.generation,
                    variant: parsed.variant,
                    // Create a group key for grouping variants
                    groupKey: `${brand}-${parsed.generation}`.toLowerCase().replace(/\s+/g, '-'),
                    excluded: false, // Track if variant is excluded from group
                    subGroup: null, // Track sub-group assignment
                    decision: 'create' // Default decision
                };
            });
            
            // Store processed data globally
            window.bigcommerceProcessedData = processedData;
            console.log('Processed data created and stored:', processedData.length, 'items');
        } else {
            // Preserve existing split groups and excluded status
            console.log('Preserving existing processed data with split groups');
        }

        // Group variants by Brand + Generation, respecting split groups
        const groupedData = {};
        processedData.forEach(item => {
            if (item.excluded) return; // Skip excluded variants
            
            // Use subGroup if it exists, otherwise use original groupKey
            const key = item.subGroup || item.groupKey;
            
            if (!groupedData[key]) {
                groupedData[key] = {
                    brand: item.brand,
                    generation: item.generation,
                    variants: [],
                    totalVariants: 0,
                    groupKey: key,
                    isSubGroup: !!item.subGroup,
                    originalGroupKey: item.groupKey,
                    decision: 'create' // Default decision
                };
            }
            groupedData[key].variants.push(item);
            groupedData[key].totalVariants++;
        });

        // Store grouped data globally
        window.bigcommerceGroupedData = groupedData;
        console.log('Grouped data created:', Object.keys(groupedData).length, 'groups');
        console.log('Sample group:', Object.values(groupedData)[0]);

        // Convert grouped data to array for display
        const groupedArray = Object.values(groupedData);
        console.log('Grouped array for display:', groupedArray.length, 'groups');

        // --- Begin scroll position preservation ---
        const tableContainer = configMatchingDiv.querySelector('.table-responsive');
        let scrollTop = 0;
        if (tableContainer) scrollTop = tableContainer.scrollTop;
        // --- End scroll position preservation ---

        // Build a map of groupKey to group for sorting split groups together
        const groupMap = {};
        Object.values(groupedData).forEach(group => {
            groupMap[group.groupKey] = group;
        });
        // Sort groupedArray so sub-groups appear after their parent group
        const sortedGroupedArray = [];
        groupedArray.forEach(group => {
            if (!group.isSubGroup) {
                sortedGroupedArray.push(group);
                // Add sub-groups immediately after
                Object.values(groupedData).forEach(subGroup => {
                    if (subGroup.isSubGroup && subGroup.originalGroupKey === group.groupKey) {
                        sortedGroupedArray.push(subGroup);
                    }
                });
            }
        });
        // Add any sub-groups that don't have a parent (just in case)
        groupedArray.forEach(group => {
            if (group.isSubGroup && !sortedGroupedArray.includes(group)) {
                sortedGroupedArray.push(group);
            }
        });

        // Multi-select state for variants
        // if (!window.selectedConfigVariants) window.selectedConfigVariants = new Set();
        
        // Initialize group selection state
        // if (!window.selectedConfigGroups) window.selectedConfigGroups = new Set();

        const htmlContent = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Configuration Grouping:</strong> Variants have been grouped by Brand + Generation. You can remove individual variants, split groups into sub-groups, or create separate configurations.
            </div>
            <div class="mb-3">
                <label class="form-label">Grouping Strategy:</label>
                <select class="form-select" id="groupingStrategy" onchange="updateGroupingStrategy()">
                    <option value="grouped">Create one configuration per group (recommended)</option>
                    <option value="separate">Create separate configuration for each variant</option>
                </select>
            </div>
            <div class="mb-2 d-flex align-items-center gap-2">
                <button type="button" class="btn btn-danger btn-sm" id="removeSelectedGroupsBtn"><i class="fas fa-trash me-1"></i>Remove Selected Groups</button>
                <button type="button" class="btn btn-danger btn-sm" id="removeSelectedVariantsBtn"><i class="fas fa-trash me-1"></i>Remove Selected Variants</button>
                <span class="text-muted small">(Skip = will not be imported)</span>
            </div>
            <div class="table-responsive" style="max-height: 400px;">
                <table class="table table-sm table-striped">
                    <thead class="table-dark">
                        <tr>
                            <th><input type="checkbox" id="selectAllGroups"></th>
                            <th>Group</th>
                            <th>Brand</th>
                            <th>Generation</th>
                            <th>Variants</th>
                            <th>Variant Details</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedGroupedArray.map((group, index) => `
                            <tr class="${group.isSubGroup ? 'table-warning' : ''}">
                                <td><input type="checkbox" class="groupCheckbox" data-groupkey="${group.groupKey}" ${group.decision === 'skip' ? '' : (window.selectedConfigGroups.has(group.groupKey) ? 'checked' : '')}></td>
                                <td>
                                    <strong>${group.isSubGroup ? 'Sub-Group' : 'Group'} ${index + 1}</strong>
                                    ${group.isSubGroup ? `<br><small class="text-muted">Split from: ${group.originalGroupKey}</small>` : ''}
                                </td>
                                <td>${group.brand || ''}</td>
                                <td>${group.generation || ''}</td>
                                <td><span class="badge bg-primary">${group.totalVariants}</span></td>
                                <td class="text-nowrap" style="width: 200px;">
                                    <div class="small">
                                        <div class="fw-bold text-primary">${group.brand} ${group.generation}</div>
                                        <div class="text-muted">${group.variants.length} variant${group.variants.length !== 1 ? 's' : ''}</div>
                                        <div class="mt-2">
                                            ${group.variants.map(v => `
                                                <div class="d-flex justify-content-between align-items-center mb-1 p-1 border rounded bg-light">
                                                    <input type="checkbox" class="variantCheckbox me-2" data-variantsku="${v.sku}" ${v.decision === 'skip' ? '' : (window.selectedConfigVariants.has(v.sku) ? 'checked' : '')}>
                                                    <div class="flex-grow-1">
                                                        <div class="fw-bold small">${v.variant || 'Default'}</div>
                                                        <div class="text-muted" style="font-size: 0.75rem;">SKU: ${v.sku}</div>
                                                    </div>
                                                    <div class="btn-group btn-group-sm ms-1">
                                                        <button class="btn btn-outline-warning btn-sm" onclick="splitVariantFromGroup('${v.sku}')" title="Split this variant into separate group">
                                                            <i class="fas fa-cut"></i>
                                                        </button>
                                                        <button class="btn btn-outline-danger btn-sm" onclick="removeVariantFromGroup('${v.sku}')" title="Remove from group">
                                                            <i class="fas fa-times"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="btn-group-vertical btn-group-sm">
                                        <button class="btn btn-outline-info btn-sm" onclick="splitGroupByCriteria('${group.groupKey}')" title="Split group by criteria (e.g., HS vs non-HS)">
                                            <i class="fas fa-split me-1"></i>Split Group
                                        </button>
                                        <select class="form-select form-select-sm groupDecisionSelect" data-groupkey="${group.groupKey}">
                                            <option value="create" ${group.decision === 'create' ? 'selected' : ''}>Create Configuration</option>
                                            <option value="skip" ${group.decision === 'skip' ? 'selected' : ''}>Skip</option>
                                        </select>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <button type="button" class="btn btn-secondary" onclick="showVariantDetails()">
                    <i class="fas fa-list me-2"></i>View All Variants
                </button>
                <button type="button" class="btn btn-warning" onclick="showExcludedVariants()">
                    <i class="fas fa-ban me-2"></i>View Excluded Variants
                </button>
                <button type="button" class="btn btn-info" onclick="showSplitGroups()">
                    <i class="fas fa-split me-2"></i>View Split Groups
                </button>
            </div>
        `;
        configMatchingDiv.innerHTML = htmlContent;

        // Checkbox logic for groups
        const selectAllGroups = document.getElementById('selectAllGroups');
        const groupCheckboxes = Array.from(document.querySelectorAll('.groupCheckbox'));
        const removeSelectedBtn = document.getElementById('removeSelectedGroupsBtn');
        groupCheckboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                const groupKey = this.getAttribute('data-groupkey');
                if (this.checked) {
                    window.selectedConfigGroups.add(groupKey);
                } else {
                    window.selectedConfigGroups.delete(groupKey);
                }
            });
        });
        if (selectAllGroups) {
            selectAllGroups.addEventListener('change', function() {
                groupCheckboxes.forEach(cb => {
                    cb.checked = this.checked;
                    const groupKey = cb.getAttribute('data-groupkey');
                    if (this.checked) {
                        window.selectedConfigGroups.add(groupKey);
                    } else {
                        window.selectedConfigGroups.delete(groupKey);
                    }
                });
            });
        }
        if (removeSelectedBtn) {
            removeSelectedBtn.addEventListener('click', function() {
                // Set decision to skip for all selected groups
                const processedData = window.bigcommerceProcessedData;
                if (!processedData) return;
                window.selectedConfigGroups.forEach(groupKey => {
                    processedData.forEach(item => {
                        if ((item.subGroup || item.groupKey) === groupKey) {
                            item.decision = 'skip';
                        }
                    });
                });
                // Clear selection
                window.selectedConfigGroups.clear();
                
                // Auto-save the import state
                autoSaveImportState();
                
                // Refresh
                showBigcommerceConfigurationMatching();
            });
        }
        // Variant-level checkbox logic
        const variantCheckboxes = Array.from(document.querySelectorAll('.variantCheckbox'));
        const removeSelectedVariantsBtn = document.getElementById('removeSelectedVariantsBtn');
        variantCheckboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                const sku = this.getAttribute('data-variantsku');
                if (this.checked) {
                    window.selectedConfigVariants.add(sku);
                } else {
                    window.selectedConfigVariants.delete(sku);
                }
            });
        });
        if (removeSelectedVariantsBtn) {
            removeSelectedVariantsBtn.addEventListener('click', function() {
                // Set decision to skip for all selected variants
                const processedData = window.bigcommerceProcessedData;
                if (!processedData) return;
                window.selectedConfigVariants.forEach(sku => {
                    processedData.forEach(item => {
                        if (item.sku === sku) {
                            item.decision = 'skip';
                        }
                    });
                });
                // Clear selection
                window.selectedConfigVariants.clear();
                
                // Auto-save the import state
                autoSaveImportState();
                
                // Refresh
                showBigcommerceConfigurationMatching();
            });
        }
        // Persist skip state in select
        const groupDecisionSelects = Array.from(document.querySelectorAll('.groupDecisionSelect'));
        groupDecisionSelects.forEach(sel => {
            sel.addEventListener('change', function() {
                const groupKey = this.getAttribute('data-groupkey');
                const value = this.value;
                const processedData = window.bigcommerceProcessedData;
                if (!processedData) return;
                processedData.forEach(item => {
                    if ((item.subGroup || item.groupKey) === groupKey) {
                        item.decision = value;
                    }
                });
                showBigcommerceConfigurationMatching();
            });
        });
        // --- Restore scroll position ---
        setTimeout(() => {
            const tableContainer = configMatchingDiv.querySelector('.table-responsive');
            if (tableContainer) tableContainer.scrollTop = scrollTop;
        }, 0);
        
        // Auto-save the import state
        autoSaveImportState();
        
        showBigcommerceStep(4);
    }

    // Global function to split variant from group (creates separate group)
    window.splitVariantFromGroup = function(sku) {
        const processedData = window.bigcommerceProcessedData;
        if (!processedData) return;
        
        const variant = processedData.find(item => item.sku === sku);
        if (variant) {
            // Create a unique sub-group key for this variant
            variant.subGroup = `${variant.groupKey}-${variant.variant.toLowerCase().replace(/\s+/g, '-')}`;
            showAnalysisToast(`Variant ${variant.variant} (${sku}) split into separate group.`, 'info');
            
            // Auto-save the import state
            autoSaveImportState();
            
            // Refresh the configuration matching display
            showBigcommerceConfigurationMatching();
        }
    };

    // Global function to split group by criteria
    window.splitGroupByCriteria = function(groupKey) {
        const groupedData = window.bigcommerceGroupedData;
        if (!groupedData || !groupedData[groupKey]) return;
        
        const group = groupedData[groupKey];
        const variants = group.variants;
        
        // Create and show modal
        const modalHtml = `
            <div class="modal fade" id="splitGroupModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Split Group: ${group.brand} ${group.generation}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Split Criteria (e.g., "HS", "Mountain", "Rohloff"):</label>
                                <div class="input-group">
                                    <input type="text" class="form-control" id="splitCriteria" placeholder="Enter criteria to split by..." oninput="filterVariantsInModal()">
                                    <button class="btn btn-outline-secondary" type="button" onclick="filterVariantsInModal()">Test Filter</button>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Current Variants: <span id="variantCount" class="badge bg-secondary">${variants.length}</span></label>
                                <div class="border rounded p-3" id="variantsList" style="max-height: 300px; overflow-y: auto;">
                                    ${variants.map((variant, index) => `
                                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded variant-item" 
                                             data-variant="${variant.variant || 'Default'}" 
                                             data-sku="${variant.sku}"
                                             style="transition: all 0.3s ease; background-color: #f8f9fa;">
                                            <div class="flex-grow-1">
                                                <div class="fw-bold">${index + 1}. ${variant.variant || 'Default'}</div>
                                                <div class="text-muted small">SKU: ${variant.sku}</div>
                                                <div class="text-muted small">${variant.model}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="performSplitGroup('${groupKey}')">Split Group</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('splitGroupModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('splitGroupModal'));
        modal.show();
        
        // Add event listener after modal is shown
        setTimeout(() => {
            const criteriaInput = document.getElementById('splitCriteria');
            if (criteriaInput) {
                criteriaInput.addEventListener('input', filterVariantsInModal);
                criteriaInput.addEventListener('keyup', filterVariantsInModal);
                console.log('Event listeners added to splitCriteria input');
            }
            
            // Focus on input
            criteriaInput.focus();
            
            // Trigger initial filter to show all items
            filterVariantsInModal();
        }, 500);
    };

    // Global function to filter variants in modal
    window.filterVariantsInModal = function() {
        console.log('filterVariantsInModal called');
        
        const criteriaInput = document.getElementById('splitCriteria');
        const variantsList = document.getElementById('variantsList');
        const countBadge = document.getElementById('variantCount');
        
        if (!criteriaInput || !variantsList || !countBadge) {
            console.log('Required elements not found:', { criteriaInput, variantsList, countBadge });
            return;
        }
        
        const criteria = criteriaInput.value.toLowerCase();
        console.log('Filtering by criteria:', criteria);
        
        const variantItems = variantsList.querySelectorAll('.variant-item');
        console.log('Found variant items:', variantItems.length);
        
        let visibleCount = 0;
        
        variantItems.forEach((item, index) => {
            const variantName = item.getAttribute('data-variant') || '';
            const sku = item.getAttribute('data-sku') || '';
            
            console.log(`Variant ${index}:`, { variantName, sku });
            
            const matches = variantName.toLowerCase().includes(criteria) || sku.toLowerCase().includes(criteria);
            
            if (matches || !criteria) {
                item.style.display = 'flex';
                item.style.opacity = '1';
                item.classList.remove('d-none');
                visibleCount++;
                console.log(`Variant ${index} SHOWN`);
            } else {
                item.style.display = 'none';
                item.style.opacity = '0.3';
                item.classList.add('d-none');
                console.log(`Variant ${index} HIDDEN`);
            }
        });
        
        console.log('Visible count:', visibleCount);
        
        // Update count badge
        countBadge.textContent = visibleCount;
        countBadge.className = criteria ? 'badge bg-success' : 'badge bg-secondary';
        
        // Force a repaint
        variantsList.style.display = 'none';
        variantsList.offsetHeight; // Force reflow
        variantsList.style.display = 'block';
    };

    // Global function to perform the split
    window.performSplitGroup = function(groupKey) {
        console.log('performSplitGroup called with groupKey:', groupKey);
        
        const criteria = document.getElementById('splitCriteria').value.trim();
        console.log('Split criteria:', criteria);
        
        if (!criteria) {
            showAnalysisToast('Please enter split criteria.', 'warning');
            return;
        }
        
        const groupedData = window.bigcommerceGroupedData;
        const processedData = window.bigcommerceProcessedData;
        
        if (!groupedData || !groupedData[groupKey] || !processedData) {
            console.log('Data not available:', { groupedData: !!groupedData, groupKey, processedData: !!processedData });
            showAnalysisToast('Data not available for splitting.', 'error');
            return;
        }
        
        const group = groupedData[groupKey];
        const variants = group.variants;
        
        console.log('Group variants before split:', variants.length);
        
        let splitCount = 0;
        
        // Update both groupedData and processedData
        variants.forEach(variant => {
            if (variant.variant.toLowerCase().includes(criteria.toLowerCase())) {
                const subGroup = `${groupKey}-${criteria.toLowerCase()}`;
                variant.subGroup = subGroup;
                splitCount++;
                
                // Also update the corresponding item in processedData
                const processedItem = processedData.find(item => item.sku === variant.sku);
                if (processedItem) {
                    processedItem.subGroup = subGroup;
                    console.log(`Updated processedData item ${processedItem.sku} with subGroup: ${subGroup}`);
                }
            }
        });
        
        console.log('Split count:', splitCount);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('splitGroupModal'));
        if (modal) {
            modal.hide();
        }
        
        if (splitCount > 0) {
            showAnalysisToast(`Split ${splitCount} variants matching "${criteria}" into separate group.`, 'success');
            console.log('Refreshing configuration matching display...');
            showBigcommerceConfigurationMatching();
        } else {
            showAnalysisToast(`No variants found matching "${criteria}".`, 'warning');
        }
    };

    // Global function to show split groups
    window.showSplitGroups = function() {
        const processedData = window.bigcommerceProcessedData;
        if (!processedData) return;
        
        const splitVariants = processedData.filter(item => item.subGroup && !item.excluded);
        
        if (splitVariants.length === 0) {
            alert('No split groups found.');
            return;
        }
        
        // Group by subGroup
        const splitGroups = {};
        splitVariants.forEach(item => {
            if (!splitGroups[item.subGroup]) {
                splitGroups[item.subGroup] = [];
            }
            splitGroups[item.subGroup].push(item);
        });
        
        let details = 'Split Groups:\n\n';
        Object.entries(splitGroups).forEach(([subGroup, variants]) => {
            details += `Group: ${subGroup}\n`;
            variants.forEach(variant => {
                details += `  - ${variant.brand} ${variant.generation} ${variant.variant} (${variant.sku})\n`;
            });
            details += '\n';
        });
        
        alert(details);
    };

    // Global function to remove variant from group
    window.removeVariantFromGroup = function(sku) {
        const processedData = window.bigcommerceProcessedData;
        if (!processedData) return;
        
        const variant = processedData.find(item => item.sku === sku);
        if (variant) {
            variant.excluded = true;
            showAnalysisToast(`Variant ${variant.variant} (${sku}) removed from group.`, 'warning');
            
            // Refresh the configuration matching display
            showBigcommerceConfigurationMatching();
        }
    };

    // Global function to show excluded variants
    window.showExcludedVariants = function() {
        const processedData = window.bigcommerceProcessedData;
        if (!processedData) return;
        
        const excludedVariants = processedData.filter(item => item.excluded);
        
        if (excludedVariants.length === 0) {
            alert('No excluded variants.');
            return;
        }
        
        let details = 'Excluded Variants:\n\n';
        excludedVariants.forEach((item, index) => {
            details += `${index + 1}. ${item.brand} ${item.generation} ${item.variant}\n`;
            details += `   SKU: ${item.sku}\n\n`;
        });
        
        details += '\nThese variants will be skipped during import.';
        alert(details);
    };

    // Global function to update grouping strategy
    window.updateGroupingStrategy = function() {
        const strategy = document.getElementById('groupingStrategy').value;
        const groupedArray = window.bigcommerceGroupedData ? Object.values(window.bigcommerceGroupedData) : [];
        
        if (strategy === 'grouped') {
            document.getElementById('groupedConfigCount').textContent = groupedArray.length;
            document.getElementById('avgVariantsPerConfig').textContent = 
                groupedArray.length > 0 ? Math.round(window.bigcommerceProcessedData.length / groupedArray.length) : 0;
        } else {
            document.getElementById('groupedConfigCount').textContent = window.bigcommerceProcessedData.length;
            document.getElementById('avgVariantsPerConfig').textContent = '1';
        }
    };

    // Global function to update group decision
    window.updateGroupDecision = function(groupKey, decision) {
        if (!window.bigcommerceGroupedData) return;
        
        if (window.bigcommerceGroupedData[groupKey]) {
            window.bigcommerceGroupedData[groupKey].decision = decision;
            console.log(`Updated group ${groupKey} decision to: ${decision}`);
        }
    };

    // Global function to show variant details
    window.showVariantDetails = function() {
        const processedData = window.bigcommerceProcessedData;
        if (!processedData) return;
        
        let details = 'All Variants:\n\n';
        processedData.forEach((item, index) => {
            details += `${index + 1}. ${item.brand} ${item.generation} ${item.variant}\n`;
            details += `   SKU: ${item.sku}\n\n`;
        });
        
        alert(details);
    };

    function showBigcommerceFinalReview() {
        const finalReviewDiv = document.getElementById('finalReviewBigCommerce');
        const groupedData = window.bigcommerceGroupedData;
        const processedData = window.bigcommerceProcessedData;
        
        if (!groupedData || !processedData) {
            showAnalysisToast('No data available for final review.', 'error');
            return;
        }

        const groupedArray = Object.values(groupedData);
        const createCount = groupedArray.filter(group => group.decision !== 'skip').length;
        const skipCount = groupedArray.filter(group => group.decision === 'skip').length;
        const totalVariants = processedData.length;

        finalReviewDiv.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center">
                            <h4>${createCount}</h4>
                            <small>Configurations to Create</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-info text-white">
                        <div class="card-body text-center">
                            <h4>${totalVariants}</h4>
                            <small>Total Variants</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center">
                            <h4>${processedData.length}</h4>
                            <small>Total</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Ready to Import:</strong> Review the summary above. This will create new bike configurations from your BigCommerce products.
            </div>
        `;
        
        showBigcommerceStep(5);
    }

    function confirmBigcommerceImport() {
        const processedData = window.bigcommerceProcessedData;
        const groupedData = window.bigcommerceGroupedData;
        
        if (!processedData || processedData.length === 0) {
            showAnalysisToast('No data available for import.', 'error');
            return;
        }

        if (!groupedData) {
            showAnalysisToast('No grouped data available for import.', 'error');
            return;
        }

        let newCount = 0;
        let skipCount = 0;

        // Process each group based on its decision
        Object.values(groupedData).forEach(group => {
            if (group.decision === 'create') {
                // Create new configuration for this group
                const newConfig = {
                    id: Date.now().toString(),
                    brand: group.brand || 'Unknown',
                    model: group.variants[0]?.model || 'Unknown', // Use extracted model from first variant
                    generation: group.generation || '',
                    variants: group.variants.map(variant => ({
                        name: variant.variant || 'Default',
                        sku: variant.sku || ''
                    }))
                };
                configurations.push(newConfig);
                newCount++;
            } else {
                // Skip this group
                skipCount += group.variants.length;
            }
        });

        // Save configurations to file and server
        saveConfigurationsToFile();
        if (typeof saveConfigurationsToServer === 'function') {
            saveConfigurationsToServer();
        }
        
        // Show success message
        showAnalysisToast(`BigCommerce import completed! ${newCount} new configurations created, ${skipCount} variants skipped.`, 'success');
        
        // Close modal and refresh
        const modal = bootstrap.Modal.getInstance(document.getElementById('importBigCommerceModal'));
        modal.hide();
        
        // Refresh analysis
        performAnalysis();
        renderAnalysisTable();
    }

    // Add the saveConfigurationsToFile function
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

    // Add the saveCardsToFile function
    async function saveCardsToFile() {
        try {
            console.log('Saving cards to file, count:', cards.length);
            
            // First, save to localStorage for mobile compatibility
            localStorage.setItem('cards', JSON.stringify(cards));
            console.log('Cards saved to localStorage');
            
            // Then save to server for desktop persistence
            const response = await fetch('/api/save-cards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cards: cards })
            });
            
            if (response.ok) {
                console.log(`Saved ${cards.length} cards to server`);
            } else {
                console.error('Failed to save cards to server, but localStorage backup exists');
            }
        } catch (error) {
            console.error('Error saving cards to file:', error);
            console.log('Cards are still saved in localStorage as backup');
        }
    }

    function showBigcommerceStep(step) {
        console.log('showBigcommerceStep called with step:', step);
        
        // Hide all steps first
        const steps = ['importStep1', 'importStep2', 'importStep3', 'importStep4', 'importStep5'];
        steps.forEach(stepId => {
            const stepElement = document.getElementById(stepId);
            if (stepElement) {
                stepElement.style.display = 'none';
            }
        });
        
        // Show the requested step
        const targetStep = document.getElementById(`importStep${step}`);
        if (targetStep) {
            targetStep.style.display = 'block';
            console.log(`Step ${step} displayed`);
        } else {
            console.error(`Step ${step} element not found`);
        }
        
        // Store current step globally
        window.currentBigcommerceStep = step;
    }

    // Make showBigcommerceStep available globally
    window.showBigcommerceStep = showBigcommerceStep;

    // Hypa Import Functions
    function handleHypaCsvFileSelect(event) {
        // New file selected – reset any persisted variant actions
        localStorage.removeItem('hypaVariantActions');
        try {
            console.log('handleHypaCsvFileSelect fired', event);
        const file = event.target.files[0];
        console.log('Selected file:', file);
        if (file) {
            console.log('Hypa CSV file selected:', file.name);
            console.log('File size:', file.size);
            console.log('File type:', file.type);
            // Enable the import button
            const importBtn = document.getElementById('confirmHypaImportBtn');
            console.log('Original import button found:', importBtn);
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Analyze File';
                // Add event listener to the original button
                importBtn.onclick = function() {
                    console.log('Original button clicked - starting file analysis...');
                    showHypaFilePreview(file);
                };
                console.log('Button updated and event listener added');
            } else {
                console.error('Original import button not found!');
            }
        } else {
            console.log('No file selected');
            }
        } catch (err) {
            showAnalysisToast('Error processing Hypa CSV file: ' + err.message, 'danger');
            console.error('Error in handleHypaCsvFileSelect:', err);
        }
    }

    async function showHypaFilePreview(file) {
        console.log('showHypaFilePreview called with file:', file.name);
        
        // Show initial progress modal
        const modalBody = document.querySelector('#importHypaModal .modal-body');
        const modalFooter = document.querySelector('#importHypaModal .modal-footer');
        
        modalBody.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Hypa Import Workflow:</strong> Processing your file through the complete import pipeline.
            </div>
            
            <!-- Progress Steps -->
            <div class="mb-4">
                <div class="progress" style="height: 4px;">
                    <div class="progress-bar bg-info" id="workflowProgress" role="progressbar" style="width: 0%"></div>
                </div>
                <div class="d-flex justify-content-between mt-2">
                    <span class="badge bg-info" id="step1Badge">Step 1: File Upload</span>
                    <span class="badge bg-secondary" id="step2Badge">Step 2: Parse CSV</span>
                    <span class="badge bg-secondary" id="step3Badge">Step 3: Validate Data</span>
                    <span class="badge bg-secondary" id="step4Badge">Step 4: Match SKUs</span>
                    <span class="badge bg-secondary" id="step5Badge">Step 5: Check Duplicates</span>
                    <span class="badge bg-secondary" id="step6Badge">Step 6: Ready to Import</span>
                </div>
            </div>
            
            <!-- Current Step Info -->
            <div class="card border-info mb-3">
                <div class="card-header bg-info text-white">
                    <h6 class="mb-0"><i class="fas fa-cog fa-spin me-2"></i>Processing...</h6>
                </div>
                <div class="card-body">
                    <div id="currentStepInfo">
                        <p class="mb-2"><strong>Current Step:</strong> <span id="currentStepText">Uploading file...</span></p>
                        <p class="mb-2"><strong>File:</strong> <span id="currentFileName">${file.name}</span></p>
                        <p class="mb-0"><strong>Size:</strong> <span id="currentFileSize">${(file.size / 1024).toFixed(1)} KB</span></p>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-warning">
                <i class="fas fa-clock me-2"></i>
                <strong>Please wait...</strong> We're processing your file through our validation pipeline.
            </div>
        `;

        // Update modal footer
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" disabled>
                <i class="fas fa-times me-2"></i>Cancel
            </button>
            <button type="button" class="btn btn-primary" disabled>
                <i class="fas fa-spinner fa-spin me-2"></i>Processing...
            </button>
        `;

        // Update progress to step 1
        updateWorkflowProgress(1, 'File Upload', 'Reading file data...');
        
        // Add delay to make progress visible
        await delay();

        const reader = new FileReader();
        reader.onload = async function(e) {
            console.log('File read successfully, parsing CSV...');
            
            // Update progress to step 2
            updateWorkflowProgress(2, 'Parse CSV', 'Parsing CSV data with Papa Parse...');
            
            // Add delay to make progress visible
            await delay();
            
            try {
                console.log('Papa Parse available:', typeof Papa !== 'undefined');
                if (typeof Papa === 'undefined') {
                    console.error('Papa Parse is not loaded!');
                    showAnalysisToast('CSV parsing library not loaded. Please refresh the page.', 'error');
                    return;
                }
                
                const csvData = Papa.parse(e.target.result, { header: true });
                // Normalise common header names (e.g. "SKU" → "sku")
                csvData.data = csvData.data.map(r => {
                    if (r.SKU && !r.sku) { r.sku = r.SKU; delete r.SKU; }
                    return r;
                });
                console.log('CSV parsed successfully:', csvData);
                
                if (csvData.errors.length > 0) {
                    console.error('CSV parsing errors:', csvData.errors);
                    console.error('First error details:', csvData.errors[0]);
                    console.error('CSV content preview:', e.target.result.substring(0, 500));
                    
                    // Check if we have valid data despite errors
                    if (csvData.data && csvData.data.length > 0) {
                        console.log('CSV has valid data despite parsing errors, continuing...');
                        showAnalysisToast('CSV parsed with some errors, but continuing with valid data.', 'warning');
                    } else {
                        console.error('No valid data found in CSV');
                        showAnalysisToast('CSV parsing errors found. Please check your file format.', 'error');
                        return;
                    }
                }
                
                // Update progress to step 3
                updateWorkflowProgress(3, 'Validate Data', `Validating ${csvData.data.length} rows...`);
                
                // Add delay to make validation step visible
                await delay();
                
                // Store the original CSV data for perfect round-trip export
                originalHypaCsvData = csvData.data;
                originalHypaCsvHeaders = csvData.meta.fields;
                console.log('Original Hypa CSV data stored for round-trip export');
                console.log('Original headers:', originalHypaCsvHeaders);
                console.log('Original data rows:', originalHypaCsvData.length);
                
                // Save the Hypa CSV data to cache for export
                try {
                    const cacheResponse = await fetch('/api/hypa-csv-cache', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            data: csvData.data,
                            headers: csvData.meta.fields
                        })
                    });
                    
                    if (cacheResponse.ok) {
                        console.log('Hypa CSV cache saved successfully for export');
                    } else {
                        console.error('Failed to save Hypa CSV cache:', cacheResponse.status);
                    }
                } catch (error) {
                    console.error('Error saving Hypa CSV cache:', error);
                }
                
                // Save the Hypa CSV data to cache for export
                try {
                    const cacheResponse = await fetch('/api/hypa-csv-cache', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            data: csvData.data,
                            headers: csvData.meta.fields
                        })
                    });
                    
                    if (cacheResponse.ok) {
                        console.log('Hypa CSV cache saved successfully for export');
                    } else {
                        console.error('Failed to save Hypa CSV cache:', await cacheResponse.text());
                    }
                } catch (error) {
                    console.error('Error saving Hypa CSV cache:', error);
                }
                
                // Store the parsed data for later use
                window.hypaCsvData = csvData.data;
                console.log('CSV data stored in window.hypaCsvData');
                console.log('Data length:', csvData.data.length);
                console.log('First row sample:', csvData.data[0]);
                
                // Update progress to step 4
                updateWorkflowProgress(4, 'Match SKUs', 'Matching SKUs with local configurations...');
                
                // Add delay to make SKU matching step visible
                await delay();
                
                // Show validation results
                console.log('Calling showHypaValidationResults...');
                await showHypaValidationResults(csvData.data);
                
            } catch (error) {
                console.error('Error reading Hypa CSV file:', error);
                showAnalysisToast('Error reading Hypa CSV file: ' + error.message, 'error');
            }
        };
        reader.onerror = function(error) {
            console.error('FileReader error:', error);
            showAnalysisToast('Error reading file.', 'error');
        };
        console.log('Starting to read file...');
        reader.readAsText(file);
    }

    function showHypaImportProgress() {
        // Show progress immediately when import button is clicked
        const modalBody = document.querySelector('#importHypaModal .modal-body');
        const modalFooter = document.querySelector('#importHypaModal .modal-footer');
        
        modalBody.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Hypa Import Workflow:</strong> Ready to process your Hypa export file through the complete import pipeline.
            </div>
            
            <!-- Progress Steps -->
            <div class="mb-4">
                <div class="progress" style="height: 4px;">
                    <div class="progress-bar bg-info" id="workflowProgress" role="progressbar" style="width: 0%"></div>
                </div>
                <div class="d-flex justify-content-between mt-2">
                    <span class="badge bg-secondary" id="step1Badge">Step 1: File Upload</span>
                    <span class="badge bg-secondary" id="step2Badge">Step 2: Parse CSV</span>
                    <span class="badge bg-secondary" id="step3Badge">Step 3: Validate Data</span>
                    <span class="badge bg-secondary" id="step4Badge">Step 4: Match SKUs</span>
                    <span class="badge bg-secondary" id="step5Badge">Step 5: Check Duplicates</span>
                    <span class="badge bg-secondary" id="step6Badge">Step 6: Ready to Import</span>
                </div>
            </div>
            
            <!-- Current Step Info -->
            <div class="card border-info mb-3">
                <div class="card-header bg-info text-white">
                    <h6 class="mb-0"><i class="fas fa-upload me-2"></i>Ready to Start</h6>
                </div>
                <div class="card-body">
                    <div id="currentStepInfo">
                        <p class="mb-2"><strong>Current Step:</strong> <span id="currentStepText">Waiting for file selection...</span></p>
                        <p class="mb-2"><strong>File:</strong> <span id="currentFileName">No file selected</span></p>
                        <p class="mb-0"><strong>Size:</strong> <span id="currentFileSize">-</span></p>
                    </div>
                </div>
            </div>
            
            <div class="mb-3">
                <label for="hypaCsvFile" class="form-label">
                    <i class="fas fa-file-csv me-2"></i>Select Hypa Metafields CSV Export:
                </label>
                <input type="file" class="form-control" id="hypaCsvFile" accept=".csv" />
                <div class="form-text">
                    <i class="fas fa-lightbulb me-1"></i>
                    The file should contain columns like SKU, Title, Content, Card Type, etc.
                </div>
            </div>
            
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Note:</strong> This will import existing cards from Hypa. Cards with the same SKU will be skipped to avoid duplicates.
            </div>
            
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Important:</strong> Only cards for products that have been imported from BigCommerce will be created. 
                If you haven't imported a product from BigCommerce yet, its Hypa cards will be skipped.
            </div>
        `;

        // Update modal footer
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirmHypaImportBtn" disabled>
                <i class="fas fa-upload me-2"></i>Select File First
            </button>
        `;
        
        // Add event listener to the new file input
        setTimeout(() => {
            const newHypaCsvFile = document.getElementById('hypaCsvFile');
            if (newHypaCsvFile) {
                console.log('Adding event listener to new hypaCsvFile element');
                newHypaCsvFile.addEventListener('change', handleHypaCsvFileSelect);
            } else {
                console.error('New hypaCsvFile element not found after creation');
            }
        }, 100);
    }

    function updateWorkflowProgress(step, stepName, description) {
        const progressBar = document.getElementById('workflowProgress');
        const currentStepText = document.getElementById('currentStepText');
        const progress = (step / 6) * 100;
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        if (currentStepText) {
            currentStepText.textContent = description;
        }
        
        // Update step badges
        const stepNames = ['File Upload', 'Parse CSV', 'Validate Data', 'Match SKUs', 'Check Duplicates', 'Ready to Import'];
        for (let i = 1; i <= 6; i++) {
            const badge = document.getElementById(`step${i}Badge`);
            if (badge) {
                if (i < step) {
                    badge.className = 'badge bg-success';
                    badge.textContent = `Step ${i}: ${stepNames[i-1]} ✓`;
                } else if (i === step) {
                    badge.className = 'badge bg-info';
                    badge.textContent = `Step ${i}: ${stepName}`;
                } else {
                    badge.className = 'badge bg-secondary';
                    badge.textContent = `Step ${i}: ${stepNames[i-1]}`;
                }
            }
        }
    }

    async function showHypaValidationResults(data) {
        console.log('=== showHypaValidationResults START ===');
        // Load previously excluded SKUs from localStorage at the very top
        let excludedSkus = [];
        try {
            excludedSkus = JSON.parse(localStorage.getItem('hypaImportExcludedSkus') || '[]');
        } catch (e) { excludedSkus = []; }
        console.log('showHypaValidationResults called with data:', data);
        const modalBody = document.querySelector('#importHypaModal .modal-body');
        const modalFooter = document.querySelector('#importHypaModal .modal-footer');
        console.log('Modal body found:', modalBody);
        console.log('About to call validateHypaData...');
        const validation = validateHypaData(data);
        console.log('validateHypaData completed');
        
        // === NEW: Collect validation statistics ===
        const validationStats = {
            totalCards: 0,
            validCards: 0,
            invalidCards: 0,
            placeholderCards: 0,
            validationErrors: [],
            errorTypes: {}
        };
        console.log('Validation stats object created');
        
        // --- Build variant-level preview data with validation tracking ---
        const skuToVariantPreview = {};
        console.log('About to process ALL Hypa CSV rows, count:', data ? data.length : 'null');
        
        // Process ALL rows from the Hypa CSV data, not just those in local configurations
        console.log('Starting to process rows...');
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            if (rowIndex % 50 === 0) {
                console.log(`Processing row ${rowIndex}/${data.length}`);
            }
            const sku = row.sku && row.sku.trim();
            if (!sku) continue;
            
            // Check if this SKU exists in local configurations
            let localConfig = null;
            let localVariant = null;
            
            if (configurations && configurations.length > 0) {
                configurations.forEach(config => {
                    if (config.variants && Array.isArray(config.variants)) {
                        config.variants.forEach(variant => {
                            if (variant.sku && variant.sku.trim() === sku) {
                                localConfig = config;
                                localVariant = variant;
                            }
                        });
                    }
                });
            }
            
            // Create entry for this SKU (whether it exists locally or not)
            if (!skuToVariantPreview[sku]) {
                skuToVariantPreview[sku] = {
                    model: localConfig ? localConfig.model : 'Unknown',
                    generation: localConfig ? localConfig.generation : 'Unknown',
                    hasLocalConfig: !!localConfig,
                    variants: []
                };
            }
            
            // Extract and process cards for this SKU
            const extractedCards = extractCardsFromHypaRow(row);
            validationStats.totalCards += extractedCards.length;
            
            // Validate and filter cards to collect statistics
                                const { validCards, invalidCards, placeholderCards } = await validateAndFilterCards(extractedCards, row);
            
            validationStats.validCards += validCards.length;
            validationStats.invalidCards += invalidCards.length;
            validationStats.placeholderCards += placeholderCards.length;
            
            // Collect validation errors
            invalidCards.forEach(invalidCard => {
                const errors = invalidCard.validation.errors;
                validationStats.validationErrors.push({
                    sku: sku,
                    cardTitle: invalidCard.card.title || 'Unknown',
                    cardType: invalidCard.card.cardType || 'Unknown',
                    errors: errors,
                    rowId: invalidCard.rowId
                });
                
                // Count error types
                errors.forEach(error => {
                    validationStats.errorTypes[error] = (validationStats.errorTypes[error] || 0) + 1;
                });
            });
            
            // Use valid cards + placeholder cards for display
            const cards = [...validCards, ...placeholderCards];
            
            skuToVariantPreview[sku].variants.push({
                name: localVariant ? localVariant.name : 'Unknown Variant',
                id: localVariant ? localVariant.id : 'unknown',
                cards,
                importAction: localConfig ? 'import' : 'skip', // Skip if no local config
                hasLocalConfig: !!localConfig
            });
        }
        console.log('ALL Hypa CSV rows processed, skuToVariantPreview keys:', Object.keys(skuToVariantPreview));
        console.log('About to build preview HTML...');
        
        // === DUPLICATE CHECK (after skuToVariantPreview is built) ===
        updateWorkflowProgress(5, 'Check Duplicates', 'Checking for existing cards...');
        console.log('=== DUPLICATE CHECK START ===');
        console.log('Existing cards count:', window.cards ? window.cards.length : 'undefined');
        
        // Check for duplicates against existing cards
        const existingCardKeys = new Set((window.cards || []).map(c => `${c.sku}-${c.cardType}-${c.position||1}-${simpleHash((c.title||'')+(c.content||''))}`));
        console.log('Existing card keys count:', existingCardKeys.size);
        
        // Mark variants as having duplicates
        let totalVariantsChecked = 0;
        let totalCardsChecked = 0;
        let totalDuplicatesFound = 0;
        
        Object.entries(skuToVariantPreview).forEach(([sku, info]) => {
            console.log(`Checking SKU: ${sku} (${info.variants.length} variants)`);
            info.variants.forEach((variant, vIdx) => {
                variant.hasDuplicates = false;
                variant.duplicateCount = 0;
                totalVariantsChecked++;
                
                console.log(`  Variant ${vIdx}: ${variant.cards.length} cards`);
                variant.cards.forEach((card, cardIdx) => {
                    const cardKey = `${card.sku}-${card.cardType}-${card.position||1}-${simpleHash((card.title||'')+(card.content||''))}`;
                    totalCardsChecked++;
                    
                    const isDuplicate = existingCardKeys.has(cardKey);
                    const status = isDuplicate ? 'DUPLICATE' : 'NEW';
                    console.log(`    Card ${cardIdx}: ${status} - ${card.cardType} - "${card.title || 'No title'}"`);
                    
                    if (isDuplicate) {
                        variant.hasDuplicates = true;
                        variant.duplicateCount++;
                        totalDuplicatesFound++;
                    }
                });
                
                if (variant.hasDuplicates) {
                    console.log(`  Variant ${vIdx}: ${variant.duplicateCount} duplicates found`);
                }
            });
        });
        
        console.log('=== DUPLICATE CHECK SUMMARY ===');
        console.log(`Total variants checked: ${totalVariantsChecked}`);
        console.log(`Total cards checked: ${totalCardsChecked}`);
        console.log(`Total duplicates found: ${totalDuplicatesFound}`);
        console.log('=== DUPLICATE CHECK END ===');
        
        updateWorkflowProgress(6, 'Ready to Import', 'Duplicate check complete! Ready to import cards.');
        
        // --- Render variant-level preview table ---
        console.log('About to build preview HTML...');
        let previewHtml = `<div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
            <table class="table table-bordered table-striped">
                <thead class="table-light" style="position: sticky; top: 0; z-index: 1000; background-color: #f8f9fa;">
                    <tr>
                        <th>SKU</th>
                        <th>Model</th>
                        <th>Generation</th>
                        <th>Variant</th>
                        <th>Local Config</th>
                        <th>Cards to Import</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="variantPreviewTableBody">
        `;
        // Add this CSS inline for immediate effect, before the preview table is rendered:
        const gridStyle = `<style>
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.card-grid-item { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; align-items: flex-start; cursor: pointer; min-width: 0; transition: box-shadow 0.15s; }
.card-grid-item:hover, .card-grid-item:focus { box-shadow: 0 0 0 2px #0d6efd33; background: #e9ecef; }
.card-grid-badge { font-size: 0.8em; margin-bottom: 2px; }
.card-grid-title { font-weight: bold; font-size: 1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.card-grid-thumb { width: 40px; height: 28px; object-fit: cover; border-radius: 3px; margin-top: 2px; }
.card-grid-info { margin-left: auto; color: #0d6efd; font-size: 1.1em; cursor: pointer; }
@media (max-width: 600px) { .card-grid { grid-template-columns: 1fr; } }
</style>`;
            // Load any previously saved Import/Skip choices for this session
    const savedVariantActions = JSON.parse(localStorage.getItem('hypaVariantActions') || '{}');
   
    // Ensure global preview / invalid arrays start clean
    window.variantPreviewCards = {};   // reset state between imports
    window.invalidCardsForReview = [];
    
    // Clear import tracking when cards are deleted
    window.clearImportTracking = function() {
        console.log('[clearImportTracking] Clearing import tracking data...');
        
        // Clear hypaCsvCache.json if it exists
        fetch('/api/clear-import-cache', { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    console.log('[clearImportTracking] Import cache cleared successfully');
                } else {
                    console.warn('[clearImportTracking] Failed to clear import cache');
                }
            })
            .catch(error => {
                console.error('[clearImportTracking] Error clearing import cache:', error);
            });
        
        // Reload cards from server to ensure fresh data
        if (window.loadData) {
            window.loadData();
        }
    };
        
        // Use saved actions as starting point, but ensure defaults are set for existing cards
        const variantActions = { ...savedVariantActions };
        Object.entries(skuToVariantPreview).forEach(([sku, info]) => {
            info.variants.forEach((variant, vIdx) => {
                const localConfigStatus = variant.hasLocalConfig ? 
                    '<span class="badge bg-success">✓ Found</span>' : 
                    '<span class="badge bg-warning">⚠ Not Found</span>';
                
                previewHtml += `<tr class="${variant.hasLocalConfig ? '' : 'table-warning'}">
                    <td>${sku}</td>
                    <td>${info.model || ''}</td>
                    <td>${info.generation || ''}</td>
                    <td>${variant.name || ''}</td>
                    <td>
                    ${localConfigStatus}
                    ${variant.hasDuplicates ? `<br><span class="badge bg-info">${variant.duplicateCount} cards already imported</span>` : ''}
                </td>
                    <td>
                        ${variant.cards.length === 0 ? '<span class="text-muted">No cards</span>' :
                            `${gridStyle}<div class="card-grid">${variant.cards.map((card, idx) => {
                                const cardKey = `${sku}_${vIdx}_${idx}`;
                                window.variantPreviewCards[cardKey] = card;
                                
                                // Check if this card already exists in the app
                                const cardKeyForDuplicateCheck = `${card.sku}-${card.cardType}-${card.position||1}-${simpleHash((card.title||'')+(card.content||''))}`;
                                const existingCardKeys = new Set((window.cards || []).map(c => `${c.sku}-${c.cardType}-${c.position||1}-${simpleHash((c.title||'')+(c.content||''))}`));
                                const cardExists = existingCardKeys.has(cardKeyForDuplicateCheck);
                                
                                // Create the "Already Exists" indicator
                                const existsIndicator = cardExists ? 
                                    `<div class="position-absolute top-0 end-0 m-1">
                                        <span class="badge bg-warning" style="font-size: 0.7em;">
                                            <i class="fas fa-check me-1"></i>Exists
                                        </span>
                                    </div>` : '';
                                
                                // Create individual card action dropdown
                                const cardActionKey = `${sku}_${vIdx}_${idx}`;
                                const savedCardAction = savedVariantActions[cardActionKey] || (cardExists ? 'skip' : 'import');
                                
                                // Ensure the default action is stored in variantActions for the summary
                                if (!variantActions[cardActionKey]) {
                                    variantActions[cardActionKey] = cardExists ? 'skip' : 'import';
                                    console.log(`Setting default action for ${cardActionKey}: ${variantActions[cardActionKey]} (cardExists: ${cardExists})`);
                                }
                                
                                const cardActionDropdown = `
                                    <div class="position-absolute bottom-0 start-0 m-1" style="z-index: 10;" onclick="event.stopPropagation();">
                                        <select class="form-select form-select-sm card-import-action" data-card-key="${cardActionKey}" style="font-size: 0.7em; width: auto; min-width: 80px;" onclick="event.stopPropagation();">
                                            <option value="import" ${savedCardAction === 'import' ? 'selected' : ''}>Import</option>
                                            <option value="skip" ${savedCardAction === 'skip' ? 'selected' : ''}>Skip</option>
                                        </select>
                                    </div>
                                `;
                                
                                if (card.cardType === 'specification-table') {
                                    // Show the <h2> heading (title) fully and styled to match the spec card, but smaller
                                    return `<div class=\"card-grid-item position-relative\" tabindex=\"0\" aria-label=\"Spec card: ${card.title ? card.title.replace(/</g, '&lt;') : '(No Heading)'}\" data-card-key=\"${cardKey}\">
                                        ${existsIndicator}
                                        ${cardActionDropdown}
                                        <span class=\"badge bg-secondary card-grid-badge\">${getCardTypeDisplayName(card.cardType)}</span>
                                        <span class=\"card-grid-title\" style=\"font-size:1.1rem;font-weight:600;color:#2a2a2a;white-space:normal;word-break:break-word;\">${card.title ? card.title.replace(/</g, '&lt;') : '(No Heading)'}</span>
                                        <span class=\"card-grid-info\"><i class=\"fas fa-info-circle\"></i></span>
                                    </div>`;
                                } else {
                                    // Make all card titles match the spec card style, but smaller
                                    return `<div class=\"card-grid-item position-relative\" tabindex=\"0\" aria-label=\"${getCardTypeDisplayName(card.cardType)} card: ${card.title ? card.title.replace(/</g, '&lt;').slice(0, 32) : '(No Title)'}\" data-card-key=\"${cardKey}\">
                                        ${existsIndicator}
                                        ${cardActionDropdown}
                                        <span class=\"badge bg-secondary card-grid-badge\">${getCardTypeDisplayName(card.cardType)}</span>
                                        <span class=\"card-grid-title\" style=\"font-size:1.1rem;font-weight:600;color:#2a2a2a;white-space:normal;word-break:break-word;\">${card.title ? card.title.replace(/</g, '&lt;').slice(0, 32) + (card.title.length > 32 ? '…' : '') : '(No Title)'}</span>
                                        ${card.imageUrl ? `<img src=\"${card.imageUrl}\" class=\"card-grid-thumb\" alt=\"\">` : ''}
                                        <span class=\"card-grid-info\"><i class=\"fas fa-info-circle\"></i></span>
                                    </div>`;
                                }
                            }).join('')}</div>`}
                        </td>
                    <td>
                        <div class="text-center">
                            <small class="text-muted">Individual card controls above</small>
                        </div>
                    </td>
                </tr>`;
            });
        });
        console.log('Preview HTML building completed');
        previewHtml += '</tbody></table></div>';
        // Add card type summary
        const cardTypeCounts = { Feature: 0, Option: 0, Cargo: 0, Weather: 0, Spec: 0 };
        Object.values(skuToVariantPreview).forEach(info => {
            info.variants.forEach(variant => {
                variant.cards.forEach(card => {
                    switch (card.cardType) {
                        case 'feature': cardTypeCounts.Feature++; break;
                        case 'product-options': cardTypeCounts.Option++; break;
                        case 'cargo-options': cardTypeCounts.Cargo++; break;
                        case 'weather-protection': cardTypeCounts.Weather++; break;
                        case 'specification-table': cardTypeCounts.Spec++; break;
                    }
                });
            });
        });
        const totalCards = Object.values(cardTypeCounts).reduce((a, b) => a + b, 0);
        // After building previewHtml and before inserting summaryHtml
        // Count unique cards by type (using cardType + title + content as a unique key)
        const uniqueCardKeys = new Set();
        const uniqueCardTypeCounts = { Feature: 0, Option: 0, Cargo: 0, Weather: 0, Spec: 0 };
        Object.values(skuToVariantPreview).forEach(info => {
            info.variants.forEach(variant => {
                variant.cards.forEach(card => {
                    const key = `${card.cardType}|${card.title}|${card.content}`;
                    if (!uniqueCardKeys.has(key)) {
                        uniqueCardKeys.add(key);
                        switch (card.cardType) {
                            case 'feature': uniqueCardTypeCounts.Feature++; break;
                            case 'product-options': uniqueCardTypeCounts.Option++; break;
                            case 'cargo-options': uniqueCardTypeCounts.Cargo++; break;
                            case 'weather-protection': uniqueCardTypeCounts.Weather++; break;
                            case 'specification-table': uniqueCardTypeCounts.Spec++; break;
                        }
                    }
                });
            });
        });
        const totalUniqueCards = Object.values(uniqueCardTypeCounts).reduce((a, b) => a + b, 0);
        
        // Update summaryHtml to show both total and unique counts
        const summaryHtml = `
            <div class="alert alert-secondary mt-3 mb-0">
                <strong>Summary:</strong>
                <ul class="mb-0" style="display: flex; flex-wrap: wrap; gap: 2em; list-style: none; padding-left: 0;">
                    <li>Feature: <strong>${cardTypeCounts.Feature}</strong> (<span title='Unique'>${uniqueCardTypeCounts.Feature} unique</span>)</li>
                    <li>Option: <strong>${cardTypeCounts.Option}</strong> (<span title='Unique'>${uniqueCardTypeCounts.Option} unique</span>)</li>
                    <li>Cargo: <strong>${cardTypeCounts.Cargo}</strong> (<span title='Unique'>${uniqueCardTypeCounts.Cargo} unique</span>)</li>
                    <li>Weather: <strong>${cardTypeCounts.Weather}</strong> (<span title='Unique'>${uniqueCardTypeCounts.Weather} unique</span>)</li>
                    <li>Spec: <strong>${cardTypeCounts.Spec}</strong> (<span title='Unique'>${uniqueCardTypeCounts.Spec} unique</span>)</li>
                    <li>Total: <strong>${totalCards}</strong> (<span title='Unique'>${totalUniqueCards} unique</span>)</li>
                </ul>
            </div>
        `;
        // Insert summaryHtml after previewHtml and before the import button
        modalBody.innerHTML = `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                <strong>Workflow Complete!</strong> Your Hypa export file has been successfully processed and validated.
            </div>
            <div class="mb-4">
                <div class="progress" style="height: 4px;">
                    <div class="progress-bar bg-success" id="workflowProgress" role="progressbar" style="width: 100%"></div>
                </div>
                <div class="d-flex justify-content-between mt-2">
                    <span class="badge bg-success" id="step1Badge">Step 1: File Upload ✓</span>
                    <span class="badge bg-success" id="step2Badge">Step 2: Parse CSV ✓</span>
                    <span class="badge bg-success" id="step3Badge">Step 3: Validate Data ✓</span>
                    <span class="badge bg-success" id="step4Badge">Step 4: Match SKUs ✓</span>
                    <span class="badge bg-success" id="step5Badge">Step 5: Check Duplicates ✓</span>
                    <span class="badge bg-success" id="step6Badge">Step 6: Ready to Import ✓</span>
                </div>
            </div>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Review the cards to be imported for each variant below. Use the dropdown to skip or import for each variant.</strong>
            </div>
            ${previewHtml}
            ${summaryHtml}
            <div class="mt-4 text-center">
                <button type="button" class="btn btn-success btn-lg" id="importCardsBtn">
                    <i class="fas fa-download me-2"></i>Import Selected Cards
                </button>
                <p class="text-muted mt-2">
                    Only variants set to "Import & Overwrite" will be imported. Others will be skipped.
                </p>
            </div>
        `;
        
        // Store validation stats globally for the detail view
        window.hypaValidationStats = validationStats;
        
        // Update modal footer to ensure Cancel button works properly
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="fas fa-times me-2"></i>Cancel
            </button>
        `;
        
        // --- Listen for individual card action changes ---
        document.querySelectorAll('.card-import-action').forEach(sel => {
            sel.addEventListener('change', function() {
                const cardKey = this.getAttribute('data-card-key');
                variantActions[cardKey] = this.value;
                localStorage.setItem('hypaVariantActions', JSON.stringify(variantActions));
            });
        });
        // --- Update import button to show summary first ---
        document.getElementById('importCardsBtn').onclick = function() {
            showImportSummary(variantActions, skuToVariantPreview);
        };
        // After inserting previewHtml, add event listeners for card-grid-item:
        setTimeout(() => {
            document.querySelectorAll('.card-grid-item').forEach(el => {
                el.addEventListener('click', function(e) {
                    const cardKey = this.getAttribute('data-card-key');
                    if (window.variantPreviewCards && window.variantPreviewCards[cardKey]) {
                        showCardDetailsModal(window.variantPreviewCards[cardKey]);
                    }
                });
                el.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        const cardKey = this.getAttribute('data-card-key');
                        if (window.variantPreviewCards && window.variantPreviewCards[cardKey]) {
                            showCardDetailsModal(window.variantPreviewCards[cardKey]);
                        }
                    }
                });
            });
        }, 0);
        console.log('=== showHypaValidationResults END ===');
    }

    function showImportSummary(variantActions, skuToVariantPreview) {
        console.log('=== showImportSummary function called ===');
        console.log('skuToVariantPreview:', skuToVariantPreview);
        
        // Analyze the import actions
        const summary = {
            totalCards: 0,
            toImport: 0,
            toSkip: 0,
            byType: { Feature: 0, Option: 0, Cargo: 0, Weather: 0, Spec: 0 },
            byTypeImport: { Feature: 0, Option: 0, Cargo: 0, Weather: 0, Spec: 0 },
            byTypeSkip: { Feature: 0, Option: 0, Cargo: 0, Weather: 0, Spec: 0 },
            existingCards: 0,
            newCards: 0
        };
        
        // Count cards from the preview data
        console.log('variantActions received:', variantActions);
        console.log('variantActions keys:', Object.keys(variantActions));
        console.log('variantActions values:', Object.values(variantActions));
        
        // Count actions to verify
        const actionCounts = {};
        Object.values(variantActions).forEach(action => {
            actionCounts[action] = (actionCounts[action] || 0) + 1;
        });
        console.log('Action counts in variantActions:', actionCounts);
        
        let cardCount = 0;
        Object.entries(skuToVariantPreview).forEach(([sku, info]) => {
            info.variants.forEach((variant, vIdx) => {
                variant.cards.forEach((card, idx) => {
                    const cardKey = `${sku}_${vIdx}_${idx}`;
                    const action = variantActions[cardKey] || 'import';
                    cardCount++;
                    
                    console.log(`Card ${cardCount}: ${cardKey}: action = ${action}, title = "${card.title}", cardType = ${card.cardType}`);
                    
                    summary.totalCards++;
                    
                    // Count by action
                    if (action === 'import') {
                        summary.toImport++;
                        console.log(`  → Counted as IMPORT`);
                    } else if (action === 'skip') {
                        summary.toSkip++;
                        console.log(`  → Counted as SKIP`);
                    } else {
                        console.log(`  → WARNING: Unknown action "${action}"`);
                    }
                    
                    // Count by type
                    let typeKey = 'Feature';
                    switch (card.cardType) {
                        case 'feature': typeKey = 'Feature'; break;
                        case 'product-options': typeKey = 'Option'; break;
                        case 'cargo-options': typeKey = 'Cargo'; break;
                        case 'weather-protection': typeKey = 'Weather'; break;
                        case 'specification-table': typeKey = 'Spec'; break;
                    }
                    
                    summary.byType[typeKey]++;
                    if (action === 'import') {
                        summary.byTypeImport[typeKey]++;
                    } else {
                        summary.byTypeSkip[typeKey]++;
                    }
                    
                    // Check if card exists
                    const cardKeyForDuplicateCheck = `${card.sku}-${card.cardType}-${card.position||1}-${simpleHash((card.title||'')+(card.content||''))}`;
                    const existingCardKeys = new Set((window.cards || []).map(c => `${c.sku}-${c.cardType}-${c.position||1}-${simpleHash((c.title||'')+(c.content||''))}`));
                    const cardExists = existingCardKeys.has(cardKeyForDuplicateCheck);
                    
                    if (cardExists) {
                        summary.existingCards++;
                    } else {
                        summary.newCards++;
                    }
                });
            });
        });
        
        console.log('=== SUMMARY DEBUG ===');
        console.log('Total cards counted in summary:', summary.totalCards);
        console.log('To import:', summary.toImport);
        console.log('To skip:', summary.toSkip);
        console.log('By type:', summary.byType);
        console.log('By type import:', summary.byTypeImport);
        console.log('By type skip:', summary.byTypeSkip);
        
        // Verify the math
        console.log('=== MATH VERIFICATION ===');
        console.log('Total cards:', summary.totalCards);
        console.log('To import + To skip:', summary.toImport + summary.toSkip);
        console.log('Math check:', summary.totalCards === (summary.toImport + summary.toSkip) ? '✓ CORRECT' : '✗ WRONG');
        
        // Check if there's a mismatch with validation stats
        if (window.hypaValidationStats) {
            console.log('=== VALIDATION STATS COMPARISON ===');
            console.log('validationStats.totalCards:', window.hypaValidationStats.totalCards);
            console.log('validationStats.validCards:', window.hypaValidationStats.validCards);
            console.log('validationStats.invalidCards:', window.hypaValidationStats.invalidCards);
            console.log('validationStats.placeholderCards:', window.hypaValidationStats.placeholderCards);
            console.log('Expected total (valid + placeholder):', window.hypaValidationStats.validCards + window.hypaValidationStats.placeholderCards);
            

        }
        
        // Create summary modal
        const summaryHtml = `
            <div class="modal fade" id="importSummaryModal" tabindex="-1" aria-labelledby="importSummaryModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="importSummaryModalLabel">
                                <i class="fas fa-clipboard-list me-2"></i>Import Summary
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Review your import selections before proceeding.</strong>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 class="mb-0"><i class="fas fa-chart-pie me-2"></i>Overall Summary</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="d-flex justify-content-between mb-2">
                                                <span>Total Cards:</span>
                                                <strong>${summary.totalCards}</strong>
                                            </div>
                                            <div class="d-flex justify-content-between mb-2">
                                                <span>To Import:</span>
                                                <strong class="text-success">${summary.toImport}</strong>
                                            </div>
                                            <div class="d-flex justify-content-between mb-2">
                                                <span>To Skip:</span>
                                                <strong class="text-warning">${summary.toSkip}</strong>
                                            </div>
                                            <div class="d-flex justify-content-between mb-2">
                                                <span>New Cards:</span>
                                                <strong class="text-primary">${summary.newCards}</strong>
                                            </div>
                                            <div class="d-flex justify-content-between">
                                                <span>Existing Cards:</span>
                                                <strong class="text-secondary">${summary.existingCards}</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 class="mb-0"><i class="fas fa-list me-2"></i>By Card Type</h6>
                                        </div>
                                        <div class="card-body">
                                            ${Object.entries(summary.byType).map(([type, total]) => `
                                                <div class="mb-2">
                                                    <div class="d-flex justify-content-between">
                                                        <span>${type}:</span>
                                                        <span><strong>${total}</strong> total</span>
                                                    </div>
                                                    <div class="d-flex justify-content-between text-muted small">
                                                        <span>→ Import: <span class="text-success">${summary.byTypeImport[type]}</span></span>
                                                        <span>→ Skip: <span class="text-warning">${summary.byTypeSkip[type]}</span></span>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            ${summary.toImport === 0 ? `
                                <div class="alert alert-warning mt-3">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <strong>No cards selected for import!</strong> Please review your selections and choose at least one card to import.
                                </div>
                            ` : `
                                <div class="alert alert-success mt-3">
                                    <i class="fas fa-check-circle me-2"></i>
                                    <strong>Ready to import ${summary.toImport} cards!</strong> Click "Confirm Import" to proceed.
                                </div>
                            `}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-arrow-left me-2"></i>Back to Review
                            </button>
                            ${summary.toImport > 0 ? `
                                <button type="button" class="btn btn-success" id="confirmImportBtn">
                                    <i class="fas fa-download me-2"></i>Confirm Import (${summary.toImport} cards)
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', summaryHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('importSummaryModal'));
        modal.show();
        
        // Handle confirm button
        document.getElementById('confirmImportBtn')?.addEventListener('click', function() {
            modal.hide();
            // Remove modal from DOM
            document.getElementById('importSummaryModal').remove();
            // Proceed with import
            setTimeout(() => {
                confirmHypaImport(variantActions);
                // Clear saved choices after final import
                localStorage.removeItem('hypaVariantActions');
            }, 100);
        });
        
        // Clean up modal when hidden
        document.getElementById('importSummaryModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    async function confirmHypaImport(variantActions) {
        // Add a global cancel flag
        window.hypaImportCancelRequested = false;
        console.log('=== confirmHypaImport function called ===');
        console.log('variantActions:', variantActions);
        console.log('window.hypaCsvData:', window.hypaCsvData);
        const data = window.hypaCsvData;
        console.log('Hypa CSV data:', data);
        if (!data || data.length === 0) {
            console.error('No data available for import');
            showAnalysisToast('No data available for import.', 'error');
            return;
        }

        // Show progress modal
        const modalBody = document.querySelector('#importHypaModal .modal-body');
        const modalFooter = document.querySelector('#importHypaModal .modal-footer');
        
        modalBody.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Importing from Hypa:</strong> Processing your Hypa export file...
            </div>
            
            <div class="progress mb-3" style="height: 25px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     id="hypaImportProgress" 
                     role="progressbar" 
                     style="width: 0%" 
                     aria-valuenow="0" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                    0%
                </div>
            </div>
            
            <div class="row mb-3">
                <div class="col-md-6">
                    <div class="card border-primary">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="fas fa-tasks me-2"></i>Progress</h6>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between mb-2">
                                <span>Processed:</span>
                                <span id="processedCount">0</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Total:</span>
                                <span id="totalCount">${data.length}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Current SKU:</span>
                                <span id="currentSku">-</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card border-success">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0"><i class="fas fa-check-circle me-2"></i>Results</h6>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between mb-2">
                                <span>Cards Imported:</span>
                                <span id="importedCount">0</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Skipped:</span>
                                <span id="skippedCount">0</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Not Found:</span>
                                <span id="notFoundCount">0</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-warning">
                <i class="fas fa-clock me-2"></i>
                <strong>Processing...</strong> Please wait while we import your cards. This may take a few moments.
            </div>
        `;

        // Update modal footer to show cancel button (enabled)
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" id="cancelHypaImportBtn">
                <i class="fas fa-times me-2"></i>Cancel
            </button>
            <button type="button" class="btn btn-primary" disabled>
                <i class="fas fa-spinner fa-spin me-2"></i>Importing...
            </button>
        `;
        // Add cancel event listener
        document.getElementById('cancelHypaImportBtn').onclick = function() {
            window.hypaImportCancelRequested = true;
            const modal = bootstrap.Modal.getInstance(document.getElementById('importHypaModal'));
            if (modal) modal.hide();
        };

        console.log('Starting import process...');
        console.log('Data length:', data.length);
        console.log('First row sample:', data[0]);
        
        let importedCount = 0;
        let skippedCount = 0;
        let notFoundCount = 0;
        const importedCards = [];
        const missingSkus = [];

        // Get existing product SKUs from configurations
        const existingSkus = new Set();
        if (configurations && configurations.length > 0) {
            configurations.forEach(config => {
                if (config.variants && Array.isArray(config.variants)) {
                    config.variants.forEach(variant => {
                        if (variant.sku) {
                            existingSkus.add(variant.sku.trim());
                        }
                    });
                }
            });
        }
        console.log('Existing SKUs in configurations:', Array.from(existingSkus));

        // Store the original Hypa data for export
        if (!window.originalHypaData) {
            window.originalHypaData = JSON.parse(JSON.stringify(data)); // Deep copy
            console.log('Stored original Hypa data for export');
        }

        // Process rows with progress updates
        const shouldImportCard = (cardKey) => {
            if (!variantActions || Object.keys(variantActions).length === 0) return true;
            return variantActions[cardKey] !== 'skip';
        };
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            // Update progress
            const progress = ((i + 1) / data.length) * 100;
            const progressBar = document.getElementById('hypaImportProgress');
            const processedCountEl = document.getElementById('processedCount');
            const currentSkuEl = document.getElementById('currentSku');
            
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressBar) progressBar.textContent = Math.round(progress) + '%';
            if (processedCountEl) processedCountEl.textContent = i + 1;
            if (currentSkuEl) currentSkuEl.textContent = row.sku || 'Unknown';
            
            // Check for cancel
            if (window.hypaImportCancelRequested) {
                showAnalysisToast('Hypa import cancelled by user.', 'warning');
                break;
            }
            
            // Skip rows without SKU
            if (!row.sku || !row.sku.trim()) {
                console.log('Skipping row without SKU:', row);
                continue;
            }
            
            // Check if SKU exists in configurations
            if (!existingSkus.has(row.sku.trim())) {
                console.log(`SKU ${row.sku} not found in configurations, skipping`);
                missingSkus.push(row.sku);
                notFoundCount++;
                continue;
            }
            
            // Yield every 200 rows to keep UI responsive
            if (i % 200 === 0) await delay(0);
            
            // Extract cards from this row
            try {
                const extractedCards = extractCardsFromHypaRow(row);
                console.log(`Extracted ${extractedCards.length} cards from SKU ${row.sku}`);
                
                if (extractedCards.length > 0) {
                    // Validate and filter cards
                    const { validCards, invalidCards, placeholderCards } = await validateAndFilterCards(extractedCards, row);
                    
                    console.log(`Valid cards: ${validCards.length}, Invalid cards: ${invalidCards.length}, Placeholder cards: ${placeholderCards.length}`);
                    
                    // Filter cards based on individual card actions
                    const filteredValidCards = validCards.filter((card, idx) => {
                        const cardKey = `${row.sku}_0_${idx}`; // Assuming single variant for now
                        const shouldImport = shouldImportCard(cardKey);
                        if (!shouldImport) {
                            console.log(`Skipping card ${idx} for SKU ${row.sku} (user chose skip)`);
                            skippedCount++;
                        }
                        return shouldImport;
                    });
                    
                    const filteredPlaceholderCards = placeholderCards.filter((card, idx) => {
                        const cardKey = `${row.sku}_0_${validCards.length + idx}`; // Offset by valid cards count
                        const shouldImport = shouldImportCard(cardKey);
                        if (!shouldImport) {
                            console.log(`Skipping placeholder card ${idx} for SKU ${row.sku} (user chose skip)`);
                            skippedCount++;
                        }
                        return shouldImport;
                    });
                    
                    // Add filtered valid cards to import
                    if (filteredValidCards.length > 0) {
                        importedCards.push(...filteredValidCards);
                        importedCount += filteredValidCards.length;
                    }
                    
                    // Add filtered placeholder cards to import
                    if (filteredPlaceholderCards.length > 0) {
                        importedCards.push(...filteredPlaceholderCards);
                        importedCount += filteredPlaceholderCards.length;
                    }
                    
                    // Store invalid cards for review
                    if (invalidCards.length > 0) {
                        if (!window.invalidCardsForReview) {
                            window.invalidCardsForReview = [];
                        }
                        window.invalidCardsForReview.push(...invalidCards);
                    }
                    
                    // Count as skipped if no cards were imported
                    if (filteredValidCards.length === 0 && filteredPlaceholderCards.length === 0) {
                        skippedCount++;
                    }
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`Error extracting cards from SKU ${row.sku}:`, error);
                skippedCount++;
            }
            
            // Update imported count display
            const importedCountEl = document.getElementById('importedCount');
            const skippedCountEl = document.getElementById('skippedCount');
            const notFoundCountEl = document.getElementById('notFoundCount');
            
            if (importedCountEl) importedCountEl.textContent = importedCount;
            if (skippedCountEl) skippedCountEl.textContent = skippedCount;
            if (notFoundCountEl) notFoundCountEl.textContent = notFoundCount;
        }
        // Reset cancel flag
        window.hypaImportCancelRequested = false;

        // === NEW: Show cross-reference/enrichment progress ===
        let enrichedCount = 0;
        let notEnrichedCount = 0;
        importedCards.forEach(card => {
            if (card.enrichedFromConfig) enrichedCount++;
            else notEnrichedCount++;
        });
        // Add a commentary section to the modal
        const progressCommentary = document.createElement('div');
        progressCommentary.className = 'alert alert-info';
        progressCommentary.innerHTML = `
            <i class="fas fa-link me-2"></i>
            <strong>Cross-referencing with BigCommerce data:</strong><br>
            <span class="badge bg-success me-2">${enrichedCount} cards enriched with product details</span>
            <span class="badge bg-warning">${notEnrichedCount} cards missing configuration (imported with Hypa data only)</span>
            <br>
            <small>Cards are enriched with model, generation, variant, price, and images from your BigCommerce import if available.</small>
        `;
        // Insert commentary after the progress bar
        const modalBodyEl = document.querySelector('#importHypaModal .modal-body');
        if (modalBodyEl) {
            const progressBarEl = modalBodyEl.querySelector('.progress');
            if (progressBarEl && progressBarEl.parentNode) {
                progressBarEl.parentNode.insertBefore(progressCommentary, progressBarEl.nextSibling);
            } else {
                modalBodyEl.appendChild(progressCommentary);
            }
        }

        // Show warning if there are missing SKUs
        if (missingSkus.length > 0) {
            const uniqueMissingSkus = [...new Set(missingSkus)];
            const missingSkusList = uniqueMissingSkus.slice(0, 10).join(', ') + (uniqueMissingSkus.length > 10 ? ` and ${uniqueMissingSkus.length - 10} more...` : '');
            
            const warningMessage = `Found ${missingSkus.length} products in Hypa export that don't exist in your local configurations. 
            
Missing SKUs: ${missingSkusList}

To import cards for these products, you need to:
1. Import the products from BigCommerce first, OR
2. Create configurations for these SKUs manually

Only cards for existing products will be imported.`;
            
            if (!confirm(warningMessage + '\n\nDo you want to continue importing cards for existing products only?')) {
                return;
            }
        }

        // After all rows processed, importedCards contains all extracted cards

        // === ENHANCED LOGIC: Attach configuration and merge cards ===
        // 1. Attach configuration to each card by matching SKU
        importedCards.forEach(card => {
            const config = configurations.find(cfg =>
                cfg.variants && cfg.variants.some(v => v.sku === card.sku)
            );
            if (config) {
                const matchingVariants = config.variants.filter(v => v.sku === card.sku);
                card.configuration = {
                    brand: config.brand,
                    model: config.model,
                    generation: config.generation,
                    variants: matchingVariants
                };
            } else {
                card.configuration = null;
            }
        });

        // 2. Merge cards with identical content/cardType/model/generation, combining their variants
        const mergedCards = [];
        importedCards.forEach(card => {
            // For specification-table keep one per SKU+title to avoid cross-variant merges
            if (card.cardType === 'specification-table') {
                const exists = mergedCards.find(c => c.cardType === 'specification-table' && c.sku === card.sku && c.title === card.title);
                if (!exists) mergedCards.push(card);
                return;
            }
            // Other card types – merge on brand/model/generation/content as before
            if (!card.configuration) {
                mergedCards.push(card);
                return;
            }
            const existing = mergedCards.find(existingCard =>
                existingCard.cardType === card.cardType &&
                existingCard.content === card.content &&
                existingCard.configuration &&
                existingCard.configuration.brand === card.configuration.brand &&
                existingCard.configuration.model === card.configuration.model &&
                existingCard.configuration.generation === card.configuration.generation
            );
            if (existing) {
                // Merge variants (avoid duplicates)
                const existingSkus = new Set(existing.configuration.variants.map(v => v.sku));
                card.configuration.variants.forEach(variant => {
                    if (!existingSkus.has(variant.sku)) {
                        existing.configuration.variants.push(variant);
                    }
                });
            } else {
                mergedCards.push(card);
            }
        });

        // Add to existing cards (avoid duplicates by SKU + card type + position)
        const existingCardKeys = new Set(cards.map(c => `${c.sku}-${c.cardType}-${c.position||1}-${simpleHash((c.title||'')+(c.content||''))}`));
        const newCards = mergedCards.filter(card => {
            const cardKey = `${card.sku}-${card.cardType}-${card.position||1}-${simpleHash((card.title||'')+(card.content||''))}`;
            return !existingCardKeys.has(cardKey);
        });
        
        cards.push(...newCards);
        
        // Save to file-based storage
        saveCardsToFile();
        
        // Count placeholder cards
        const placeholderCount = newCards.filter(card => card.isPlaceholder).length;
        const validNewCards = newCards.filter(card => !card.isPlaceholder).length;
        
        let message = `Hypa import completed! ${validNewCards} valid cards imported, ${placeholderCount} placeholder cards created for invalid cards, ${importedCards.length - newCards.length} duplicates skipped.`;
        
        if (missingSkus.length > 0) {
            message += `\n\n${missingSkus.length} products skipped (not found in local configurations).`;
        }
        
        // Show validation results if there are invalid cards
        if (window.invalidCardsForReview && window.invalidCardsForReview.length > 0) {
            const invalidCount = window.invalidCardsForReview.length;
            message += `\n\n⚠️ ${invalidCount} cards had validation issues and were replaced with placeholders.`;
            
            // Show detailed validation modal
            showValidationResultsModal();
        }
        
        showAnalysisToast(message, 'success');
        
        // Close modal and refresh
        const modal = bootstrap.Modal.getInstance(document.getElementById('importHypaModal'));
        modal.hide();
        
        // Refresh analysis
        performAnalysis();
        renderAnalysisTable();
    }

    function extractCardsFromHypaRow(row) {
        console.log('=== extractCardsFromHypaRow called for SKU:', row.sku, '===');
        const cards = [];
        const columns = Object.keys(row);
        
        console.log('Available columns:', columns);
        
        // === COLUMN-DRIVEN CARD EXTRACTION ===
        // Process all columns and determine card type from column name
        console.log('--- Processing all card columns ---');
        
        // Define column patterns and their corresponding card types
        const columnPatterns = [
            { pattern: /^shared\.feature-\d+-card$/, cardType: 'feature' },
            { pattern: /^shared\.option-\d+-card$/, cardType: 'product-options' },
            { pattern: /^shared\.cargo-option-\d+-card$/, cardType: 'cargo-options' },
            { pattern: /^shared\.weather-option-\d+-card$/, cardType: 'weather-protection' },
            { pattern: /^shared\.spec-table$/, cardType: 'specification-table' }
        ];
        
        // Process each column that matches a card pattern
        columns.forEach(columnName => {
            const pattern = columnPatterns.find(p => p.pattern.test(columnName));
            if (pattern) {
                const cardType = pattern.cardType;
                console.log(`Processing ${columnName} as ${cardType} card`);
                
                const extractedCards = extractCardsFromColumn(row, columnName, cardType);
                console.log(`Found ${extractedCards.length} ${cardType} cards in ${columnName}`);
                cards.push(...extractedCards);
            }
        });
        
        // Deduplicate cards within this row based on content
        const deduplicatedCards = [];
        const seenCardKeys = new Set();
        
        cards.forEach(card => {
            // Create a unique key based on card type, title, and content
            const cardKey = `${card.cardType}|${card.title || ''}|${card.content || ''}`;
            
            if (!seenCardKeys.has(cardKey)) {
                seenCardKeys.add(cardKey);
                deduplicatedCards.push(card);
            } else {
                console.log(`Deduplicating duplicate card: ${card.cardType} - "${card.title}"`);
            }
        });
        
        console.log(`=== SUMMARY for SKU ${row.sku} ===`);
        console.log(`Total cards extracted: ${cards.length} -> ${deduplicatedCards.length} after deduplication`);
        console.log('Card types:', deduplicatedCards.map(c => c.cardType));
        console.log('Card titles:', deduplicatedCards.map(c => c.title));
        console.log('=== END extractCardsFromHypaRow ===');
        
        return deduplicatedCards;
    }

    // === UNIFIED COLUMN-DRIVEN CARD EXTRACTION ===
    function extractCardsFromColumn(row, columnName, cardType) {
        const cards = [];
        const htmlContent = row[columnName];
        
        console.log(`Extracting ${cardType} cards from ${columnName}: ${htmlContent ? 'Has content' : 'Empty'} (length: ${htmlContent ? htmlContent.length : 0})`);
        
        if (!htmlContent || !htmlContent.trim()) {
            console.log(`Skipping ${columnName} - no content`);
            return cards;
        }
        
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // Get the appropriate selectors based on card type
            const selectors = getCardTypeSelectors(cardType);
            
            // Find all cards in this cell - look for top-level card containers
            let cardContainers = [];
            
            // Different card types have different top-level container structures
            switch (cardType) {
                            case 'feature':
                // Feature cards: look for divs with class "product-feature-card" OR the correct flex layout format
                let featureContainers = Array.from(doc.querySelectorAll('div.product-feature-card'));
                
                // If no standard containers found, look for the correct flex layout format
                if (featureContainers.length === 0) {
                    featureContainers = Array.from(doc.querySelectorAll('div')).filter(div => {
                        const style = div.getAttribute('style') || '';
                        // Look for the correct feature card format: flex layout with border and padding
                        return style.includes('display: flex') && 
                               style.includes('align-items: center') && 
                               style.includes('border') && 
                               style.includes('padding') &&
                               style.includes('background: #f9f9f9');
                    });
                }
                
                cardContainers = featureContainers;
                break;
                case 'product-options':
                    // Option cards: look for divs with class "swiper-slide" containing cards
                    cardContainers = Array.from(doc.querySelectorAll('div.swiper-slide'));
                    break;
                            case 'cargo-options':
                // Cargo cards: look for divs with class "product-feature-card" (same as feature cards)
                cardContainers = Array.from(doc.querySelectorAll('div.product-feature-card'));
                break;
            case 'weather-protection':
                // Weather cards: look for divs with class "product-feature-card" (same as feature cards)
                cardContainers = Array.from(doc.querySelectorAll('div.product-feature-card'));
                break;
                case 'specification-table':
                    // Spec tables: look for table elements or divs with class "specs__table"
                    const tables = Array.from(doc.querySelectorAll('table, .specs__table'));
                    if (tables.length > 0) {
                        cardContainers = [doc.body]; // Treat the whole body as one container
                    }
                    break;
                default:
                    // Fallback: look for any div with headings
                    cardContainers = Array.from(doc.querySelectorAll('div')).filter(div => 
                        div.querySelector(selectors.titleSelector) || 
                        div.querySelector(selectors.headingSelector)
                    );
            }
            
            // If no specific containers found, try the fallback approach
            if (cardContainers.length === 0) {
                // Look for any div that has both a title/heading AND is a reasonable size (likely a card container)
                cardContainers = Array.from(doc.querySelectorAll('div')).filter(div => {
                    const hasTitle = div.querySelector(selectors.titleSelector);
                    const hasHeading = div.querySelector(selectors.headingSelector);
                    const hasContent = hasTitle || hasHeading;
                    
                    // Only consider divs that have content AND are likely card containers
                    // (not just inner content divs)
                    if (!hasContent) return false;
                    
                    // Check if this div looks like a card container (has meaningful content)
                    const textContent = div.textContent.trim();
                    
                    // Additional checks for different card formats:
                    // 1. Standard format: has meaningful content length
                    if (textContent.length > 50) return true;
                    
                    // 2. Has both h2/h3 and img elements (typical card structure)
                    if (div.querySelector('h2, h3') && div.querySelector('img')) {
                        return true;
                    }
                    
                    return false;
                });
            }
            
            console.log(`Found ${cardContainers.length} cards in ${columnName}`);
            
            // === FORMAT VALIDATION: Check if multiple cards in single cell ===
            if (cardContainers.length > 1) {
                console.log(`❌ FORMAT ERROR: Found ${cardContainers.length} cards in ${columnName} - this is incorrect format!`);
                
                // Create a single placeholder card for the entire cell
                const placeholderCard = {
                    id: `format_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    sku: row.sku && row.sku.trim(),
                    cardType: cardType,
                    position: 1,
                    title: `[FORMAT ERROR] Multiple cards in ${columnName}`,
                    subtitle: '',
                    content: generateMultipleCardsErrorContent(cardContainers, columnName),
                    imageUrl: '',
                    price: '',
                    hypaUpdated: true,
                    importedFromHypa: true,
                    lastModified: new Date().toISOString(),
                    isPlaceholder: true,
                    isFormatError: true,
                    formatErrorInfo: {
                        columnName: columnName,
                        cardCount: cardContainers.length,
                        originalContent: htmlContent,
                        needsRecreation: true
                    },
                    originalHypaData: {
                        productId: row.id,
                        columnName: columnName,
                        isFormatError: true
                    }
                };
                
                cards.push(placeholderCard);
                return cards;
            }
            
            // Process single card found in this cell
            if (cardContainers.length === 1) {
                const cardDiv = cardContainers[0];
                const card = extractCardFromDiv(cardDiv, cardType, columnName, row);
                if (card) {
                    cards.push(card);
                }
            }
            
            // If no cards with content found, try to extract from the body
            if (cardContainers.length === 0) {
                const card = extractCardFromDiv(doc.body, cardType, columnName, row);
                if (card) {
                    cards.push(card);
                }
            }
            
        } catch (err) {
            console.error(`Error parsing HTML block for ${columnName}:`, err);
        }
        
        return cards;
    }

    // === CARD TYPE SELECTORS ===
    function getCardTypeSelectors(cardType) {
        switch (cardType) {
            case 'feature':
                return {
                    titleSelector: 'h2, h3',
                    headingSelector: 'h2, h3',
                    descriptionSelector: 'p',
                    imageSelector: 'img',
                    priceSelector: null
                };
            case 'product-options':
                return {
                    titleSelector: '.card-title, h2, h3',
                    headingSelector: '.card-title, h2, h3',
                    descriptionSelector: '.card-description, p',
                    imageSelector: 'img',
                    priceSelector: '.card-price'
                };
            case 'cargo-options':
                return {
                    titleSelector: 'h2, h3',
                    headingSelector: 'h2, h3',
                    descriptionSelector: 'p',
                    imageSelector: 'img',
                    priceSelector: null
                };
            case 'weather-protection':
                return {
                    titleSelector: 'h2, h3',
                    headingSelector: 'h2, h3',
                    descriptionSelector: 'p',
                    imageSelector: 'img',
                    priceSelector: null
                };
            case 'specification-table':
                return {
                    titleSelector: 'h2, h3',
                    headingSelector: 'h2, h3',
                    descriptionSelector: 'table, .specs__table',
                    imageSelector: null,
                    priceSelector: null
                };
            default:
                return {
                    titleSelector: 'h2, h3',
                    headingSelector: 'h2, h3',
                    descriptionSelector: 'p',
                    imageSelector: 'img',
                    priceSelector: null
                };
        }
    }

    // === UNIFIED CARD EXTRACTION FROM DIV ===
    function extractCardFromDiv(cardDiv, cardType, columnName, row) {
        const selectors = getCardTypeSelectors(cardType);
        
        // Extract title
        const titleElement = cardDiv.querySelector(selectors.titleSelector);
        const title = titleElement ? titleElement.textContent.trim() : '';
        
        // Extract description/content
        const descriptionElement = cardDiv.querySelector(selectors.descriptionSelector);
        const description = descriptionElement ? descriptionElement.textContent.trim() : '';
        
        // Extract image
        const img = selectors.imageSelector ? cardDiv.querySelector(selectors.imageSelector) : null;
        const imageUrl = img ? img.getAttribute('src') : '';
        
        // Extract price (if applicable)
        let price = '';
        if (selectors.priceSelector) {
            const priceElement = cardDiv.querySelector(selectors.priceSelector);
            if (priceElement) {
                price = priceElement.textContent.trim();
            }
        }
        
        // Only create a card if it has meaningful content
        if (title || description || imageUrl) {
            console.log(`Found ${cardType} card in ${columnName}: "${title}"`);
            
            // Extract position from column name
            const positionMatch = columnName.match(/\d+/);
            const position = positionMatch ? parseInt(positionMatch[0]) : 1;
            
            return {
                id: Date.now().toString(),
                sku: row.sku && row.sku.trim(),
                cardType: cardType,
                position: position,
                title,
                content: description,
                imageUrl,
                price,
                hypaUpdated: true,
                importedFromHypa: true,
                lastModified: new Date().toISOString(),
                originalHypaData: {
                    productId: row.id,
                    columnName: columnName,
                    htmlSource: true
                }
            };
        } else {
            console.log(`Skipping ${cardType} card in ${columnName} - no valid content found`);
            return null;
        }
    }

    // === NEW: Card validation system with format comparison ===
    async function validateCard(card, row) {
        const errors = [];
        const warnings = [];
        
        // Basic structure validation
        if (!card.sku || !card.sku.trim()) {
            errors.push('Missing SKU');
        }
        
        if (!card.cardType || !card.cardType.trim()) {
            errors.push('Missing card type');
        }
        
        if (!card.title || !card.title.trim()) {
            errors.push('Missing title');
        }
        
        // Content validation based on card type
        switch (card.cardType) {
            case 'feature':
                if (!card.content || !card.content.trim()) {
                    warnings.push('Feature card has no description');
                }
                if (!card.imageUrl || !card.imageUrl.trim()) {
                    warnings.push('Feature card has no image');
                }
                break;
                
            case 'product-options':
            case 'cargo-options':
            case 'weather-protection':
                if (!card.content || !card.content.trim()) {
                    warnings.push(`${card.cardType} card has no description`);
                }
                if (!card.imageUrl || !card.imageUrl.trim()) {
                    warnings.push(`${card.cardType} card has no image`);
                }
                break;
                
            case 'specification-table':
                if (!card.content || !card.content.trim()) {
                    errors.push('Specification table has no content');
                }
                // Check if spec table has proper HTML structure
                if (card.content && !card.content.includes('<table') && !card.content.includes('<tr')) {
                    warnings.push('Specification table may not have proper table structure');
                }
                break;
        }
        
        // Image URL validation
        if (card.imageUrl && card.imageUrl.trim()) {
            const imageUrl = card.imageUrl.trim();
            if (!imageUrl.startsWith('http') && !imageUrl.startsWith('https') && !imageUrl.startsWith('data:')) {
                warnings.push('Image URL may not be valid');
            }
        }
        
        // Content length validation
        if (card.content && card.content.length > 5000) {
            warnings.push('Content is very long (>5000 chars)');
        }
        
        if (card.title && card.title.length > 200) {
            warnings.push('Title is very long (>200 chars)');
        }
        
        // HTML structure validation
        if (card.content && card.content.includes('<script')) {
            errors.push('Content contains script tags (security risk)');
        }
        
        if (card.content && card.content.includes('javascript:')) {
            errors.push('Content contains javascript: links (security risk)');
        }
        
        // Check for broken HTML
        if (card.content && (card.content.includes('<div') && !card.content.includes('</div>'))) {
            warnings.push('Content may have unclosed HTML tags');
        }
        
        // === NEW: Format comparison validation ===
        const formatValidation = await validateCardFormat(card);
        if (card.cardType === 'specification-table') {
            // For spec tables we keep strict validation – structural errors remain fatal
            errors.push(...formatValidation.errors);
        } else {
            // For other card types, treat format-mismatch as non-fatal warning so we don't turn every card into a placeholder
            warnings.push(...formatValidation.errors);
        }
        // All card types get the softer warnings too
        warnings.push(...formatValidation.warnings);
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            card: card,
            row: row,
            formatValidation: formatValidation
        };
    }

    // === NEW: Format comparison validation functions ===
    async function validateCardFormat(card) {
        const errors = [];
        const warnings = [];
        
        // Generate expected HTML format for this card
        const expectedHtml = await generateExpectedCardHtml(card);
        const actualHtml = card.content || '';
        
        if (!expectedHtml) {
            warnings.push('Could not generate expected format for this card type');
            return { errors, warnings };
        }
        
        // Compare the actual HTML with expected format
        const comparison = compareCardFormats(actualHtml, expectedHtml, card.cardType);
        
        if (comparison.majorDifferences.length > 0) {
            errors.push(`Format mismatch: ${comparison.majorDifferences.join(', ')}`);
        }
        
        if (comparison.minorDifferences.length > 0) {
            warnings.push(`Minor format differences: ${comparison.minorDifferences.join(', ')}`);
        }
        
        return { errors, warnings, comparison };
    }

    async function generateExpectedCardHtml(card) {
        const data = {
            title: card.title || '',
            subtitle: card.subtitle || '',
            description: card.content || '',
            imageUrl: card.imageUrl || '',
            price: card.price || ''
        };
        
        try {
            // Try to load template from template manager first
            const templateHtml = await loadTemplateForCardType(card.cardType);
            if (templateHtml) {
                return generateHtmlFromTemplate(templateHtml, data);
            }
        } catch (error) {
            console.log(`Could not load template for ${card.cardType}, falling back to hardcoded template:`, error.message);
        }
        
        // Fallback to hardcoded templates if template loading fails
        switch (card.cardType) {
            case 'feature':
                return generateExpectedFeatureCardHtml(data);
            case 'product-options':
                return generateExpectedProductOptionsCardHtml(data);
            case 'cargo-options':
                return generateExpectedCargoOptionsCardHtml(data);
            case 'weather-protection':
                return generateExpectedWeatherProtectionCardHtml(data);
            case 'specification-table':
                return generateExpectedSpecificationTableHtml(data);
            default:
                return null;
        }
    }

    async function loadTemplateForCardType(cardType) {
        try {
            // Map card types to template names
            const templateMap = {
                'feature': 'feature',
                'product-options': 'product-options',
                'cargo-options': 'cargo-options',
                'weather-protection': 'weather-protection',
                'specification-table': 'specification-table'
            };
            
            const templateName = templateMap[cardType];
            if (!templateName) return null;
            
            // Try to load from master templates
            const templatePath = `renderer/templates/master/${templateName}.html`;
            const response = await fetch(templatePath);
            if (response.ok) {
                return await response.text();
            }
            
            return null;
        } catch (error) {
            console.error(`Error loading template for ${cardType}:`, error);
            return null;
        }
    }

    function generateHtmlFromTemplate(templateHtml, data) {
        // Replace placeholders in template with actual data
        let html = templateHtml;
        
        // Replace basic placeholders
        html = html.replace(/{title}/g, data.title || '');
        html = html.replace(/{subtitle}/g, data.subtitle || '');
        html = html.replace(/{content}/g, data.description || '');
        html = html.replace(/{imageUrl}/g, data.imageUrl || '');
        html = html.replace(/{price}/g, data.price || '');
        
        // Handle missing images
        if (!data.imageUrl) {
            html = html.replace(/<img[^>]*src="\{imageUrl\}"[^>]*>/g, 
                '<div style="width: 100%; height: 100%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Enter an image URL to see a preview</div>');
        }
        
        return html;
    }

    function generateExpectedFeatureCardHtml(data) {
        const title = data.title || '';
        const subtitle = data.subtitle || '';
        const description = data.description || '';
        const imageSrc = data.imageUrl || '';
        
        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div style="width: 100%; height: 100%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; text-align: center; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 0.75rem;">Enter an image URL to see a preview</div>`;
        
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border: 1px solid #e5e7eb; border-radius: 0.5rem; background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem;">
                    <!-- Text content -->
                    <div style="flex: 1 1 55%;">
                        <h2 style="font-size: 1rem; font-weight: 500; margin: 0 0 0.25rem 0; color: #111827; letter-spacing: -0.025em;">${title}</h2>
                        ${subtitle ? `<h3 style="font-size: 0.875rem; font-weight: 500; margin: 0 0 0.75rem 0; color: #374151;">${subtitle}</h3>` : ''}
                        <p style="font-size: 0.75rem; line-height: 1.4; margin: 0; color: #4b5563;">${description}</p>
                    </div>
                    <!-- Image -->
                    <div style="flex: 1 1 40%; aspect-ratio: 16 / 10;">
                        ${imageHtml}
                    </div>
                </div>
            </div>`;
    }

    function generateExpectedProductOptionsCardHtml(data) {
        const title = data.title || '';
        const description = data.description || '';
        let price = (data.price || '').trim();
        const imageSrc = data.imageUrl || '';

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

    function generateExpectedCargoOptionsCardHtml(data) {
        const title = data.title || '';
        const subtitle = data.subtitle || '';
        const description = data.description || '';
        const price = data.price || '';
        const imageSrc = data.imageUrl || '';

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

    function generateExpectedWeatherProtectionCardHtml(data) {
        const title = data.title || '';
        const subtitle = data.subtitle || '';
        const description = data.description || '';
        const price = data.price || '';
        const imageSrc = data.imageUrl || '';

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

    function generateExpectedSpecificationTableHtml(data) {
        const htmlContent = data.description || '';
        
        if (!htmlContent.trim()) {
            return `
                <div style="border: 1px solid #e0e0e0; border-radius: 4px; padding: 20px; text-align: center; background: #fff; font-family: sans-serif;">
                    <p style="color: #666; margin: 0;">Paste specification table HTML content above to see preview</p>
                </div>
            `;
        }
        
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
                ${htmlContent}
            </div>`;
    }

    function compareCardFormats(actualHtml, expectedHtml, cardType) {
        const majorDifferences = [];
        const minorDifferences = [];
        
        // Normalize HTML for comparison (remove whitespace, normalize quotes)
        const normalizeHtml = (html) => {
            return html
                .replace(/\s+/g, ' ')
                .replace(/"/g, '"')
                .replace(/'/g, "'")
                .trim();
        };
        
        const normalizedActual = normalizeHtml(actualHtml);
        const normalizedExpected = normalizeHtml(expectedHtml);
        
        // Check for major structural differences
        const actualDoc = new DOMParser().parseFromString(actualHtml, 'text/html');
        const expectedDoc = new DOMParser().parseFromString(expectedHtml, 'text/html');
        
        // Check for required elements based on card type
        switch (cardType) {
            case 'feature':
                if (!actualDoc.querySelector('h2')) {
                    majorDifferences.push('Missing title (h2) element');
                }
                if (!actualDoc.querySelector('p')) {
                    majorDifferences.push('Missing description (p) element');
                }
                if (!actualDoc.querySelector('img') && !actualDoc.querySelector('div[style*="background-color"]')) {
                    majorDifferences.push('Missing image or placeholder');
                }
                break;
                
            case 'product-options':
                if (!actualDoc.querySelector('.card-info')) {
                    majorDifferences.push('Missing card-info container');
                }
                if (!actualDoc.querySelector('button[class*="more-info"]')) {
                    majorDifferences.push('Missing "More Information" button');
                }
                break;
                
            case 'cargo-options':
            case 'weather-protection':
                if (!actualDoc.querySelector('h2')) {
                    majorDifferences.push('Missing title (h2) element');
                }
                if (!actualDoc.querySelector('p')) {
                    majorDifferences.push('Missing description (p) element');
                }
                break;
                
            case 'specification-table':
                if (!actualDoc.querySelector('table') && !actualDoc.querySelector('.specs')) {
                    minorDifferences.push('May not have proper table structure');
                }
                break;
        }
        
        // Check for styling differences
        if (!normalizedActual.includes('border-radius') && normalizedExpected.includes('border-radius')) {
            minorDifferences.push('Missing border-radius styling');
        }
        
        if (!normalizedActual.includes('box-shadow') && normalizedExpected.includes('box-shadow')) {
            minorDifferences.push('Missing box-shadow styling');
        }
        
        if (!normalizedActual.includes('font-family') && normalizedExpected.includes('font-family')) {
            minorDifferences.push('Missing font-family styling');
        }
        
        return { majorDifferences, minorDifferences };
    }

    async function validateAndFilterCards(cards, row) {
        const validCards = [];
        const invalidCards = [];
        const placeholderCards = [];
        
        for (const card of cards) {
            const validation = await validateCard(card, row);
            
            if (validation.isValid) {
                // Add validation info to card for reference
                card.validationInfo = {
                    hasWarnings: validation.warnings.length > 0,
                    warnings: validation.warnings
                };
                validCards.push(card);
            } else {
                // Store invalid card with validation details
                invalidCards.push({
                    card: card,
                    validation: validation,
                    sku: row.sku,
                    rowId: row.id
                });
                
                // Create placeholder card for invalid card
                const placeholderCard = createPlaceholderCard(card, validation, row);
                placeholderCards.push(placeholderCard);
            }
        }
        
        return { validCards, invalidCards, placeholderCards };
    }

    function createPlaceholderCard(originalCard, validation, row) {
        const placeholderId = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
            id: placeholderId,
            sku: originalCard.sku || row.sku,
            cardType: originalCard.cardType || 'unknown',
            position: originalCard.position || 1,
            title: originalCard.title || `[PLACEHOLDER] ${originalCard.cardType || 'Unknown'} Card`,
            subtitle: '',
            content: generatePlaceholderContent(originalCard, validation),
            imageUrl: '',
            price: originalCard.price || '',
            hypaUpdated: true,
            importedFromHypa: true,
            lastModified: new Date().toISOString(),
            isPlaceholder: true,
            placeholderInfo: {
                originalCard: originalCard,
                validation: validation,
                rowId: row.id,
                createdAt: new Date().toISOString(),
                needsRecreation: true
            },
            originalHypaData: {
                productId: row.id,
                isPlaceholder: true,
                originalCardType: originalCard.cardType,
                originalPosition: originalCard.position
            }
        };
    }

    function generatePlaceholderContent(originalCard, validation) {
        const cardTypeDisplay = getCardTypeDisplayName(originalCard.cardType || 'unknown');
        const errorList = validation.errors.map(error => `• ${error}`).join('\n');
        const warningList = validation.warnings.map(warning => `• ${warning}`).join('\n');
        
        let content = `
<div style="
    background: #fff3cd;
    border: 2px dashed #ffc107;
    border-radius: 8px;
    padding: 20px;
    margin: 10px 0;
    text-align: center;
    font-family: Arial, sans-serif;
">
    <div style="
        background: #ffc107;
        color: #212529;
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 15px;
        font-weight: bold;
        font-size: 1.1rem;
    ">
        ⚠️ PLACEHOLDER CARD - NEEDS RECREATION
    </div>
    
    <div style="margin-bottom: 15px;">
        <strong>Original Card Type:</strong> ${cardTypeDisplay}<br>
        <strong>Original Title:</strong> ${originalCard.title || 'No title provided'}<br>
        <strong>Position:</strong> ${originalCard.position || 'Unknown'}
    </div>
    
    <div style="
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 15px;
        margin: 15px 0;
        text-align: left;
    ">
        <strong style="color: #dc3545;">Validation Errors:</strong>
        <div style="margin: 10px 0; color: #dc3545; font-family: monospace; font-size: 0.9rem;">
            ${errorList || 'None'}
        </div>
        
        ${warningList ? `
        <strong style="color: #ffc107;">Warnings:</strong>
        <div style="margin: 10px 0; color: #856404; font-family: monospace; font-size: 0.9rem;">
            ${warningList}
        </div>
        ` : ''}
    </div>
    
    <div style="
        background: #e7f3ff;
        border: 1px solid #b3d9ff;
        border-radius: 6px;
        padding: 15px;
        margin: 15px 0;
        font-size: 0.9rem;
    ">
        <strong>Action Required:</strong><br>
        This card could not be imported due to format issues. Please recreate it using the Card Creator with the correct format.
    </div>
    
    <div style="
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 10px;
        margin: 15px 0;
        font-size: 0.8rem;
        color: #6c757d;
    ">
        <strong>Original Content Preview:</strong><br>
        ${originalCard.content ? 
            originalCard.content.substring(0, 200) + (originalCard.content.length > 200 ? '...' : '') : 
            'No content available'
        }
    </div>
</div>
        `;
        
        return content;
    }

    function generateMultipleCardsErrorContent(divsWithHeadings, columnName) {
        const cardTitles = divsWithHeadings.map((div, index) => {
            const title = (div.querySelector('h2') || div.querySelector('h3'))?.textContent?.trim() || '';
            return `${index + 1}. ${title || 'Untitled Card'}`;
        }).join('\n');
        
        return `
<div style="
    background: #f8d7da;
    border: 2px dashed #dc3545;
    border-radius: 8px;
    padding: 20px;
    margin: 10px 0;
    text-align: center;
    font-family: Arial, sans-serif;
">
    <div style="
        background: #dc3545;
        color: #ffffff;
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 15px;
        font-weight: bold;
        font-size: 1.1rem;
    ">
        🚨 FORMAT ERROR - MULTIPLE CARDS IN SINGLE CELL
    </div>
    
    <div style="margin-bottom: 15px;">
        <strong>Problem:</strong> Found ${divsWithHeadings.length} cards in ${columnName}<br>
        <strong>Expected:</strong> 1 card per cell<br>
        <strong>Action Required:</strong> Recreate cards with correct format
    </div>
    
    <div style="
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 15px;
        margin: 15px 0;
        text-align: left;
    ">
        <strong style="color: #dc3545;">Cards Found in ${columnName}:</strong>
        <div style="margin: 10px 0; color: #dc3545; font-family: monospace; font-size: 0.9rem; white-space: pre-line;">
${cardTitles}
        </div>
    </div>
    
    <div style="
        background: #e7f3ff;
        border: 1px solid #b3d9ff;
        border-radius: 6px;
        padding: 15px;
        margin: 15px 0;
        font-size: 0.9rem;
    ">
        <strong>How to Fix:</strong><br>
        1. Use the Card Creator to recreate each card individually<br>
        2. Each card should be in its own column (shared.feature-1-card, shared.feature-2-card, etc.)<br>
        3. Export with correct format: 1 card per cell
    </div>
    
    <div style="
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 6px;
        padding: 10px;
        margin: 15px 0;
        font-size: 0.8rem;
        color: #856404;
    ">
        <strong>Note:</strong> This placeholder represents ${divsWithHeadings.length} cards that need to be recreated with the correct format.
    </div>
</div>
        `;
    }

    // === OLD FUNCTIONS REMOVED - Now using unified column-driven approach ===

    function extractOptionCards(row, columns) {
        const cards = [];
        
        // Dynamically find all option card columns
        const optionColumns = columns.filter(col => col.match(/^shared\.option-\d+-card$/));
        const maxOptionIndex = optionColumns.length > 0 ? 
            Math.max(...optionColumns.map(col => parseInt(col.match(/option-(\d+)-card/)[1]))) : 0;
        
        console.log(`Found ${optionColumns.length} option card columns (max index: ${maxOptionIndex})`);
        
        // Debug: Show what content is in each option column for this SKU
        console.log(`=== DEBUG: Content in option columns for SKU ${row.sku} ===`);
        for (let i = 1; i <= 12; i++) {
            const columnName = `shared.option-${i}-card`;
            const content = row[columnName];
            if (content && content.trim()) {
                console.log(`${columnName}: Has content (${content.length} chars)`);
                console.log(`  Preview: ${content.substring(0, 100)}...`);
            } else {
                console.log(`${columnName}: Empty`);
            }
        }
        console.log('==========================================');
        
        // Check for HTML blocks in shared.option-X-card columns
        for (let i = 1; i <= maxOptionIndex; i++) {
            const columnName = `shared.option-${i}-card`;
            const htmlContent = row[columnName];
            
            console.log(`Checking ${columnName}: ${htmlContent ? 'Has content' : 'Empty'} (length: ${htmlContent ? htmlContent.length : 0})`);
            
            if (htmlContent && htmlContent.trim()) {
                try {
                    console.log(`Processing ${columnName} for SKU ${row.sku}`);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    
                    // Enhanced approach: Handle multiple cards per cell (OPTION CARDS)
                    const allDivs = Array.from(doc.querySelectorAll('div'));
                    // For option cards, look for both h2/h3 tags AND card-title divs
                    const divsWithHeadings = allDivs.filter(div => 
                        div.querySelector('h2') || 
                        div.querySelector('h3') || 
                        div.querySelector('.card-title')
                    );
                    
                    console.log(`Found ${divsWithHeadings.length} cards in ${columnName}`);
                    
                    // === FORMAT VALIDATION: Check if multiple cards in single cell ===
                    if (divsWithHeadings.length > 1) {
                        console.log(`❌ FORMAT ERROR: Found ${divsWithHeadings.length} cards in ${columnName} - this is incorrect format!`);
                        
                        // Create a single placeholder card for the entire cell
                        const placeholderCard = {
                            id: `format_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            sku: row.sku && row.sku.trim(),
                            cardType: 'product-options',
                            position: i * 100,
                            title: `[FORMAT ERROR] Multiple cards in ${columnName}`,
                            subtitle: '',
                            content: generateMultipleCardsErrorContent(divsWithHeadings, columnName),
                            imageUrl: '',
                            price: '',
                            hypaUpdated: true,
                            importedFromHypa: true,
                            lastModified: new Date().toISOString(),
                            isPlaceholder: true,
                            isFormatError: true,
                            formatErrorInfo: {
                                columnName: columnName,
                                cardCount: divsWithHeadings.length,
                                originalContent: htmlContent,
                                needsRecreation: true
                            },
                            originalHypaData: {
                                productId: row.id,
                                optionIndex: i,
                                isFormatError: true,
                                columnName: columnName
                            }
                        };
                        
                        cards.push(placeholderCard);
                        continue; // Skip processing individual cards, but continue with other columns
                    }
                    
                    // Process single card found in this cell
                    if (divsWithHeadings.length === 1) {
                        const cardDiv = divsWithHeadings[0];
                        // For option cards, also look for .card-title divs
                        const title = (cardDiv.querySelector('h2') || cardDiv.querySelector('h3') || cardDiv.querySelector('.card-title'))?.textContent?.trim() || '';
                        const description = (cardDiv.querySelector('p') || cardDiv.querySelector('.card-description')) ? 
                            (cardDiv.querySelector('p') || cardDiv.querySelector('.card-description')).textContent.trim() : '';
                        const img = cardDiv.querySelector('img');
                        const imageUrl = img ? img.getAttribute('src') : '';
                        
                        // Try to extract price from the card content (look for .card-price divs too)
                        let price = '';
                        const priceElement = cardDiv.querySelector('[style*="font-weight: bold"]') || 
                                           cardDiv.querySelector('[style*="color: #"]') ||
                                           cardDiv.querySelector('.card-price');
                        if (priceElement) {
                            price = priceElement.textContent.trim();
                        }
                        
                        // Only create a card if it has meaningful content
                        if (title || description || imageUrl) {
                            console.log(`Found option card in ${columnName}: "${title}"`);
                            cards.push({
                                id: Date.now().toString(),
                                sku: row.sku && row.sku.trim(),
                                cardType: 'product-options',
                                position: i * 100,
                                title,
                                content: description,
                                imageUrl,
                                price,
                                hypaUpdated: true,
                                importedFromHypa: true,
                                lastModified: new Date().toISOString(),
                                originalHypaData: {
                                    productId: row.id,
                                    optionIndex: i,
                                    htmlSource: true,
                                    columnName: columnName
                                }
                            });
                        } else {
                            console.log(`Skipping option card in ${columnName} - no valid content found`);
                        }
                    }
                    
                    // If no cards with headings found, try to extract from the body
                    if (divsWithHeadings.length === 0) {
                        const title = (doc.body.querySelector('h2') || doc.body.querySelector('h3'))?.textContent?.trim() || '';
                        const description = (doc.body.querySelector('p')) ? doc.body.querySelector('p').textContent.trim() : '';
                        const img = doc.body.querySelector('img');
                        const imageUrl = img ? img.getAttribute('src') : '';
                        
                        // Try to extract price from the body
                        let price = '';
                        const priceElement = doc.body.querySelector('[style*="font-weight: bold"]') || 
                                           doc.body.querySelector('[style*="color: #"]');
                        if (priceElement) {
                            price = priceElement.textContent.trim();
                        }
                        
                        if (title || description || imageUrl) {
                            console.log(`Found 1 fallback option card in ${columnName}: "${title}"`);
                            cards.push({
                                id: Date.now().toString(),
                                sku: row.sku && row.sku.trim(),
                                cardType: 'product-options',
                                position: i,
                                title,
                                content: description,
                                imageUrl,
                                price,
                                hypaUpdated: true,
                                importedFromHypa: true,
                                lastModified: new Date().toISOString(),
                                originalHypaData: {
                                    productId: row.id,
                                    optionIndex: i,
                                    htmlSource: true,
                                    columnName: columnName
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Error parsing HTML block for ${columnName}:`, err);
                }
            }
        }
        
        return cards;
    }

    function extractCargoCards(row, columns) {
        const cards = [];
        
        // Dynamically find all cargo card columns
        const cargoColumns = columns.filter(col => col.match(/^shared\.cargo-option-\d+-card$/));
        const maxCargoIndex = cargoColumns.length > 0 ? 
            Math.max(...cargoColumns.map(col => parseInt(col.match(/cargo-option-(\d+)-card/)[1]))) : 0;
        
        console.log(`Found ${cargoColumns.length} cargo card columns (max index: ${maxCargoIndex})`);
        
        // Debug: Show what content is in each cargo column for this SKU
        console.log(`=== DEBUG: Content in cargo columns for SKU ${row.sku} ===`);
        for (let i = 1; i <= 12; i++) {
            const columnName = `shared.cargo-option-${i}-card`;
            const content = row[columnName];
            if (content && content.trim()) {
                console.log(`${columnName}: Has content (${content.length} chars)`);
                console.log(`  Preview: ${content.substring(0, 100)}...`);
            } else {
                console.log(`${columnName}: Empty`);
            }
        }
        console.log('==========================================');
        
        // Check for HTML blocks in shared.cargo-option-X-card columns
        for (let i = 1; i <= maxCargoIndex; i++) {
            const columnName = `shared.cargo-option-${i}-card`;
            const htmlContent = row[columnName];
            
            if (htmlContent && htmlContent.trim()) {
                try {
                    console.log(`Processing ${columnName} for SKU ${row.sku}`);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    
                    // Simple approach: One card per cell, but only if it's a valid single card
                    // Check if this cell contains multiple cards (old format) - if so, skip it
                    const allDivs = Array.from(doc.querySelectorAll('div'));
                    const divsWithHeadings = allDivs.filter(div => div.querySelector('h2') || div.querySelector('h3'));
                    
                    // === FORMAT VALIDATION: Check if multiple cards in single cell ===
                    if (divsWithHeadings.length > 1) {
                        console.log(`❌ FORMAT ERROR: Found ${divsWithHeadings.length} cards in ${columnName} - this is incorrect format!`);
                        
                        // Create a single placeholder card for the entire cell
                        const placeholderCard = {
                            id: `format_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            sku: row.sku && row.sku.trim(),
                            cardType: 'cargo-options',
                            position: i * 100,
                            title: `[FORMAT ERROR] Multiple cards in ${columnName}`,
                            subtitle: '',
                            content: generateMultipleCardsErrorContent(divsWithHeadings, columnName),
                            imageUrl: '',
                            price: '',
                            hypaUpdated: true,
                            importedFromHypa: true,
                            lastModified: new Date().toISOString(),
                            isPlaceholder: true,
                            isFormatError: true,
                            formatErrorInfo: {
                                columnName: columnName,
                                cardCount: divsWithHeadings.length,
                                originalContent: htmlContent,
                                needsRecreation: true
                            },
                            originalHypaData: {
                                productId: row.id,
                                cargoIndex: i,
                                isFormatError: true,
                                columnName: columnName
                            }
                        };
                        
                        cards.push(placeholderCard);
                        continue; // Skip processing individual cards
                    }
                    
                    // Extract the single card from this cell
                    const cardDiv = divsWithHeadings[0] || doc.body;
                    const title = (cardDiv.querySelector('h2') || cardDiv.querySelector('h3'))?.textContent?.trim() || '';
                    const description = (cardDiv.querySelector('p')) ? cardDiv.querySelector('p').textContent.trim() : '';
                    const img = cardDiv.querySelector('img');
                    const imageUrl = img ? img.getAttribute('src') : '';
                    
                    // Try to extract price from the card content
                    let price = '';
                    const priceElement = cardDiv.querySelector('[style*="font-weight: bold"]') || 
                                       cardDiv.querySelector('[style*="color: #"]');
                    if (priceElement) {
                        price = priceElement.textContent.trim();
                    }
                    
                    // Only create a card if it has meaningful content
                    if (title || description || imageUrl) {
                        console.log(`Found 1 valid cargo card in ${columnName}: "${title}"`);
                        cards.push({
                            id: Date.now().toString(),
                            sku: row.sku && row.sku.trim(),
                            cardType: 'cargo-options',
                            position: i, // Simple position based on column number
                            title,
                            content: description,
                            imageUrl,
                            price,
                            hypaUpdated: true,
                            importedFromHypa: true,
                            lastModified: new Date().toISOString(),
                            originalHypaData: {
                                productId: row.id,
                                cargoIndex: i,
                                htmlSource: true,
                                columnName: columnName
                            }
                        });
                    } else {
                        console.log(`Skipping ${columnName} - no valid card content found`);
                    }
                } catch (err) {
                    console.error(`Error parsing HTML block for ${columnName}:`, err);
                }
            }
        }
        
        return cards;
    }

    function extractWeatherCards(row, columns) {
        const cards = [];
        
        // Dynamically find all weather card columns
        const weatherColumns = columns.filter(col => col.match(/^shared\.weather-option-\d+-card$/));
        const maxWeatherIndex = weatherColumns.length > 0 ? 
            Math.max(...weatherColumns.map(col => parseInt(col.match(/weather-option-(\d+)-card/)[1]))) : 0;
        
        console.log(`Found ${weatherColumns.length} weather card columns (max index: ${maxWeatherIndex})`);
        
        // Check for HTML blocks in shared.weather-option-X-card columns
        for (let i = 1; i <= maxWeatherIndex; i++) {
            const columnName = `shared.weather-option-${i}-card`;
            const htmlContent = row[columnName];
            
            if (htmlContent && htmlContent.trim()) {
                try {
                    console.log(`Processing ${columnName} for SKU ${row.sku}`);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    
                    // Simple approach: One card per cell, but only if it's a valid single card
                    // Check if this cell contains multiple cards (old format) - if so, skip it
                    const allDivs = Array.from(doc.querySelectorAll('div'));
                    const divsWithHeadings = allDivs.filter(div => div.querySelector('h2') || div.querySelector('h3'));
                    
                    // If there are multiple divs with headings, this might be an old multi-card cell - skip it
                    if (divsWithHeadings.length > 1) {
                        console.log(`Skipping ${columnName} - contains ${divsWithHeadings.length} cards (old multi-card format)`);
                        continue;
                    }
                    
                    // Extract the single card from this cell
                    const cardDiv = divsWithHeadings[0] || doc.body;
                    const title = (cardDiv.querySelector('h2') || cardDiv.querySelector('h3'))?.textContent?.trim() || '';
                    const description = (cardDiv.querySelector('p')) ? cardDiv.querySelector('p').textContent.trim() : '';
                    const img = cardDiv.querySelector('img');
                    const imageUrl = img ? img.getAttribute('src') : '';
                    
                    // Try to extract price from the card content
                    let price = '';
                    const priceElement = cardDiv.querySelector('[style*="font-weight: bold"]') || 
                                       cardDiv.querySelector('[style*="color: #"]');
                    if (priceElement) {
                        price = priceElement.textContent.trim();
                    }
                    
                    // Only create a card if it has meaningful content
                    if (title || description || imageUrl) {
                        console.log(`Found 1 valid weather card in ${columnName}: "${title}"`);
                        cards.push({
                            id: Date.now().toString(),
                            sku: row.sku && row.sku.trim(),
                            cardType: 'weather-protection',
                            position: i, // Simple position based on column number
                            title,
                            content: description,
                            imageUrl,
                            price,
                            hypaUpdated: true,
                            importedFromHypa: true,
                            lastModified: new Date().toISOString(),
                            originalHypaData: {
                                productId: row.id,
                                weatherIndex: i,
                                htmlSource: true,
                                columnName: columnName
                            }
                        });
                    } else {
                        console.log(`Skipping ${columnName} - no valid card content found`);
                    }
                } catch (err) {
                    console.error(`Error parsing HTML block for ${columnName}:`, err);
                }
            }
        }
        
        return cards;
    }

    function extractSpecTable(row, columns) {
        // Check for spec table in shared.spec-table column
        const specTableContent = row['shared.spec-table'];
        
        // Debug: Show spec table content for this SKU
        console.log(`=== DEBUG: Spec table content for SKU ${row.sku} ===`);
        if (specTableContent && specTableContent.trim()) {
            console.log(`shared.spec-table: Has content (${specTableContent.length} chars)`);
            console.log(`  Preview: ${specTableContent.substring(0, 100)}...`);
        } else {
            console.log(`shared.spec-table: Empty`);
        }
        console.log('==========================================');
        
        if (specTableContent && specTableContent.trim()) {
            try {
                console.log(`Processing spec table for SKU ${row.sku}`);
                let title = '';
                const parser = new DOMParser();
                const doc = parser.parseFromString(specTableContent, 'text/html');
                const h2 = doc.querySelector('h2');
                if (h2 && h2.textContent) {
                    title = h2.textContent.trim();
                }
                
                if (!title) {
                    title = row['product_name'] || row['name'] || row['title'] || `Specifications for ${row.sku}`;
                }
                
                return {
                    id: Date.now().toString(),
                    sku: row.sku && row.sku.trim(),
                    cardType: 'specification-table',
                    title: title.trim(),
                    content: specTableContent,
                    hypaUpdated: true,
                    importedFromHypa: true,
                    lastModified: new Date().toISOString(),
                    originalHypaData: {
                        productId: row.id,
                        specTableFlag: true,
                        originalContent: specTableContent,
                        columnName: 'shared.spec-table'
                    }
                };
            } catch (err) {
                console.error('Error parsing spec table HTML:', err);
            }
        }
        
        return null;
    }

    function importHypaData() {
        const fileInput = document.getElementById('hypaCsvFile');
        const file = fileInput.files[0];
        
        if (!file) {
            showAnalysisToast('Please select a Hypa CSV file first.', 'warning');
            return;
        }

        // If we already have analyzed data, proceed with import
        if (window.hypaCsvData) {
            confirmHypaImport();
        } else {
            // Show file preview and validation
            showHypaFilePreview(file);
        }
    }

    // Global functions for BigCommerce import
    window.updateFieldMapping = function(field, value) {
        // Store field mapping for later use
        if (!window.bigcommerceFieldMappings) {
            window.bigcommerceFieldMappings = {};
        }
        window.bigcommerceFieldMappings[field] = value;
    };

    // Initialize the application
    initializeElements();

    // Test function for debugging
    async function testHypaFlow() {
        console.log('Testing Hypa flow...');
        const testData = [
            {
                sku: 'TEST-SKU-001',
                id: '123',
                'shared.feature-1-card': 'enabled',
                'features.feature_1_title': 'Test Feature',
                'features.feature_1_description': 'Test Description'
            }
        ];
        console.log('Test data created:', testData);
        await showHypaValidationResults(testData);
        console.log('Test validation results shown');
    }

    // Mobile-friendly card backup functions
    function exportCardsToFile() {
        try {
            const dataStr = JSON.stringify(cards, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `cards-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showAnalysisToast('Cards exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting cards:', error);
            showAnalysisToast('Error exporting cards: ' + error.message, 'error');
        }
    }

    function importCardsFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedCards = JSON.parse(e.target.result);
                    if (Array.isArray(importedCards)) {
                        cards = importedCards;
                        localStorage.setItem('cards', JSON.stringify(cards));
                        saveCardsToFile();
                        showAnalysisToast(`Imported ${cards.length} cards successfully!`, 'success');
                        resolve(cards);
                    } else {
                        reject(new Error('Invalid cards file format'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // === NEW: Validation results modal ===
    function showValidationResultsModal() {
        if (!window.invalidCardsForReview || window.invalidCardsForReview.length === 0) {
            return;
        }
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="validationResultsModal" tabindex="-1" aria-labelledby="validationResultsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title" id="validationResultsModalLabel">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Cards Requiring Re-creation
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>${window.invalidCardsForReview.length} cards were skipped</strong> due to validation issues. 
                                These cards need to be re-created manually to ensure they work properly with the app.
                            </div>
                            
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6>Invalid Cards Summary</h6>
                                <button class="btn btn-outline-primary btn-sm" onclick="exportInvalidCards()">
                                    <i class="fas fa-download me-2"></i>Export for Review
                                </button>
                            </div>
                            
                            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-sm table-striped">
                                    <thead class="table-dark sticky-top">
                                        <tr>
                                            <th>SKU</th>
                                            <th>Card Type</th>
                                            <th>Title</th>
                                            <th>Errors</th>
                                            <th>Warnings</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="invalidCardsTableBody">
                                        ${window.invalidCardsForReview.map((item, index) => `
                                            <tr>
                                                <td><strong>${item.sku || 'Unknown'}</strong></td>
                                                <td><span class="badge bg-secondary">${item.card.cardType || 'Unknown'}</span></td>
                                                <td>${item.card.title || 'No Title'}</td>
                                                <td>
                                                    ${item.validation.errors.map(error => 
                                                        `<span class="badge bg-danger me-1">${error}</span>`
                                                    ).join('')}
                                                </td>
                                                <td>
                                                    ${item.validation.warnings.map(warning => 
                                                        `<span class="badge bg-warning me-1">${warning}</span>`
                                                    ).join('')}
                                                </td>
                                                <td>
                                                    <button class="btn btn-outline-info btn-sm" onclick="viewInvalidCardDetails(${index})">
                                                        <i class="fas fa-eye"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="mt-3">
                                <h6>Common Issues and Solutions:</h6>
                                <ul class="list-unstyled">
                                    <li><i class="fas fa-check text-success me-2"></i><strong>Missing title:</strong> Add a descriptive title for the card</li>
                                    <li><i class="fas fa-check text-success me-2"></i><strong>Missing content:</strong> Add description text to the card</li>
                                    <li><i class="fas fa-check text-success me-2"></i><strong>Invalid image URL:</strong> Ensure image URLs are valid and accessible</li>
                                    <li><i class="fas fa-check text-success me-2"></i><strong>Security issues:</strong> Remove any script tags or javascript: links</li>
                                    <li><i class="fas fa-check text-success me-2"></i><strong>Broken HTML:</strong> Fix unclosed HTML tags</li>
                                </ul>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="exportInvalidCards()">
                                <i class="fas fa-download me-2"></i>Export Invalid Cards
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page if it doesn't exist
        if (!document.getElementById('validationResultsModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('validationResultsModal'));
        modal.show();
    }

    function viewInvalidCardDetails(index) {
        const item = window.invalidCardsForReview[index];
        if (!item) return;
        
        const detailsHtml = `
            <div class="modal fade" id="invalidCardDetailsModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Card Details - ${item.sku}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Card Information</h6>
                                    <table class="table table-sm">
                                        <tr><td><strong>SKU:</strong></td><td>${item.sku || 'Unknown'}</td></tr>
                                        <tr><td><strong>Card Type:</strong></td><td>${item.card.cardType || 'Unknown'}</td></tr>
                                        <tr><td><strong>Title:</strong></td><td>${item.card.title || 'No Title'}</td></tr>
                                        <tr><td><strong>Position:</strong></td><td>${item.card.position || 'Unknown'}</td></tr>
                                        <tr><td><strong>Image URL:</strong></td><td>${item.card.imageUrl || 'No Image'}</td></tr>
                                    </table>
                                </div>
                                <div class="col-md-6">
                                    <h6>Validation Issues</h6>
                                    ${item.validation.errors.length > 0 ? `
                                        <div class="alert alert-danger">
                                            <strong>Errors:</strong>
                                            <ul class="mb-0">
                                                ${item.validation.errors.map(error => `<li>${error}</li>`).join('')}
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${item.validation.warnings.length > 0 ? `
                                        <div class="alert alert-warning">
                                            <strong>Warnings:</strong>
                                            <ul class="mb-0">
                                                ${item.validation.warnings.map(warning => `<li>${warning}</li>`).join('')}
                                            </ul>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="mt-3">
                                <h6>Card Content Preview</h6>
                                <div class="border p-3 bg-light" style="max-height: 200px; overflow-y: auto; font-size: 0.9rem;">
                                    ${item.card.content ? item.card.content.substring(0, 500) + (item.card.content.length > 500 ? '...' : '') : 'No content'}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if present
        const existingModal = document.getElementById('invalidCardDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add and show modal
        document.body.insertAdjacentHTML('beforeend', detailsHtml);
        const modal = new bootstrap.Modal(document.getElementById('invalidCardDetailsModal'));
        modal.show();
    }

    function exportInvalidCards() {
        if (!window.invalidCardsForReview || window.invalidCardsForReview.length === 0) {
            showAnalysisToast('No invalid cards to export.', 'warning');
            return;
        }
        
        try {
            const exportData = window.invalidCardsForReview.map(item => ({
                sku: item.sku,
                cardType: item.card.cardType,
                title: item.card.title,
                position: item.card.position,
                imageUrl: item.card.imageUrl,
                content: item.card.content,
                errors: item.validation.errors,
                warnings: item.validation.warnings,
                rowId: item.rowId
            }));
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `invalid-cards-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showAnalysisToast(`Exported ${exportData.length} invalid cards for review.`, 'success');
        } catch (error) {
            console.error('Error exporting invalid cards:', error);
            showAnalysisToast('Error exporting invalid cards: ' + error.message, 'error');
        }
    }

    // === NEW: Placeholder card management functions ===
    function findPlaceholderCards() {
        if (!cards || !Array.isArray(cards)) {
            return [];
        }
        return cards.filter(card => card.isPlaceholder === true);
    }

    function getPlaceholderCardSummary() {
        const placeholderCards = findPlaceholderCards();
        if (placeholderCards.length === 0) {
            return null;
        }

        const summary = {
            total: placeholderCards.length,
            byCardType: {},
            bySku: {}
        };

        placeholderCards.forEach(card => {
            // Count by card type
            const cardType = card.cardType || 'unknown';
            summary.byCardType[cardType] = (summary.byCardType[cardType] || 0) + 1;

            // Count by SKU
            const sku = card.sku || 'unknown';
            if (!summary.bySku[sku]) {
                summary.bySku[sku] = [];
            }
            summary.bySku[sku].push({
                id: card.id,
                cardType: card.cardType,
                title: card.title,
                position: card.position
            });
        });

        return summary;
    }

    function showPlaceholderCardSummary() {
        const summary = getPlaceholderCardSummary();
        if (!summary) {
            showAnalysisToast('No placeholder cards found.', 'info');
            return;
        }

        const modalHtml = `
            <div class="modal fade" id="placeholderSummaryModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Placeholder Cards Summary
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>${summary.total} placeholder cards found</strong> that need to be recreated.
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>By Card Type</h6>
                                    <div class="list-group">
                                        ${Object.entries(summary.byCardType).map(([cardType, count]) => `
                                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                                <span>${getCardTypeDisplayName(cardType)}</span>
                                                <span class="badge bg-warning rounded-pill">${count}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <h6>By SKU</h6>
                                    <div class="list-group" style="max-height: 300px; overflow-y: auto;">
                                        ${Object.entries(summary.bySku).map(([sku, cardList]) => `
                                            <div class="list-group-item">
                                                <div class="d-flex justify-content-between align-items-center">
                                                    <strong>${sku}</strong>
                                                    <span class="badge bg-secondary rounded-pill">${cardList.length}</span>
                                                </div>
                                                <small class="text-muted">
                                                    ${cardList.map(card => `${getCardTypeDisplayName(card.cardType)} (${card.position})`).join(', ')}
                                                </small>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-3">
                                <h6>Next Steps:</h6>
                                <ol>
                                    <li>Go to the <strong>Card Manager</strong> to see all placeholder cards</li>
                                    <li>Filter by "Placeholder" status to find cards that need recreation</li>
                                    <li>Use the <strong>Card Creator</strong> to recreate each card with proper format</li>
                                    <li>Replace placeholder cards with the newly created ones</li>
                                </ol>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="window.open('card-manager.html', '_blank')">
                                <i class="fas fa-external-link-alt me-2"></i>Open Card Manager
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page if it doesn't exist
        if (!document.getElementById('placeholderSummaryModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('placeholderSummaryModal'));
        modal.show();
    }

    // Make it available globally for testing
    window.testHypaFlow = testHypaFlow;
    window.exportCardsToFile = exportCardsToFile;
    window.importCardsFromFile = importCardsFromFile;
    window.confirmHypaImport = confirmHypaImport;
    window.hasSavedImportState = hasSavedImportState;
    window.viewInvalidCardDetails = viewInvalidCardDetails;
    window.exportInvalidCards = exportInvalidCards;
    window.findPlaceholderCards = findPlaceholderCards;
    window.getPlaceholderCardSummary = getPlaceholderCardSummary;
    window.showPlaceholderCardSummary = showPlaceholderCardSummary;

    // Card migration and renewal system
    function migrateAndUpdateCards() {
        console.log('Starting card migration and update process...');
        
        const oldCards = cards.filter(card => {
            // Check for old format indicators
            return !card.lastModified || 
                   !card.hypaUpdated || 
                   !card.importedFromHypa ||
                   card.cardType === 'old-format' ||
                   !card.id;
        });
        
        if (oldCards.length === 0) {
            showAnalysisToast('No cards need migration!', 'success');
            return;
        }
        
        showCardMigrationModal(oldCards);
    }

    function showCardMigrationModal(oldCards) {
        const modalBody = document.querySelector('#importHypaModal .modal-body');
        modalBody.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Card Migration Required:</strong> Found ${oldCards.length} cards that need to be updated to the current format.
            </div>
            
            <div class="table-responsive" style="max-height: 400px;">
                <table class="table table-sm table-striped">
                    <thead class="table-dark">
                        <tr>
                            <th>SKU</th>
                            <th>Card Type</th>
                            <th>Title</th>
                            <th>Content Preview</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${oldCards.map((card, index) => `
                            <tr>
                                <td><strong>${card.sku || 'Unknown'}</strong></td>
                                <td><span class="badge bg-secondary">${card.cardType || 'Unknown'}</span></td>
                                <td>${card.title || 'No Title'}</td>
                                <td>
                                    <small class="text-muted">
                                        ${(card.content || card.description || '').substring(0, 50)}${(card.content || card.description || '').length > 50 ? '...' : ''}
                                    </small>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary" onclick="viewCardDetails(${index})">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                    <button class="btn btn-sm btn-outline-success" onclick="renewCard(${index})">
                                        <i class="fas fa-sync"></i> Renew
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="alert alert-info mt-3">
                <i class="fas fa-info-circle me-2"></i>
                <strong>How to Renew:</strong> Click "View" to see the full card content, then "Renew" to create a new card with the current format. 
                You can copy and paste the content from the old card.
            </div>
        `;

        // Update modal footer
        const modalFooter = document.querySelector('#importHypaModal .modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-warning" onclick="bulkMigrateCards()">
                <i class="fas fa-magic me-2"></i>Auto-Migrate All
            </button>
        `;
    }

    function viewCardDetails(cardIndex) {
        const oldCards = cards.filter(card => {
            return !card.lastModified || 
                   !card.hypaUpdated || 
                   !card.importedFromHypa ||
                   card.cardType === 'old-format' ||
                   !card.id;
        });
        
        const card = oldCards[cardIndex];
        if (!card) return;

        const modalBody = document.querySelector('#importHypaModal .modal-body');
        modalBody.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Card Details:</strong> View the content of this card to copy for renewal.
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="fas fa-file-alt me-2"></i>Card Information</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-2">
                                <strong>SKU:</strong> ${card.sku || 'Unknown'}
                            </div>
                            <div class="mb-2">
                                <strong>Card Type:</strong> <span class="badge bg-secondary">${card.cardType || 'Unknown'}</span>
                            </div>
                            <div class="mb-2">
                                <strong>Position:</strong> ${card.position || 'N/A'}
                            </div>
                            <div class="mb-2">
                                <strong>Last Modified:</strong> ${card.lastModified || 'Unknown'}
                            </div>
                            <div class="mb-2">
                                <strong>Image URL:</strong> 
                                <small class="text-muted">${card.imageUrl || card.image || 'None'}</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0"><i class="fas fa-copy me-2"></i>Content to Copy</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label"><strong>Title:</strong></label>
                                <textarea class="form-control" rows="2" readonly>${card.title || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label"><strong>Content:</strong></label>
                                <textarea class="form-control" rows="6" readonly>${card.content || card.description || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label"><strong>Price (if applicable):</strong></label>
                                <input type="text" class="form-control" value="${card.price || ''}" readonly>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-warning mt-3">
                <i class="fas fa-lightbulb me-2"></i>
                <strong>Copy the content above, then click "Renew Card" to create a new card with the current format.</strong>
            </div>
        `;

        // Update modal footer
        const modalFooter = document.querySelector('#importHypaModal .modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="showCardMigrationModal()">
                <i class="fas fa-arrow-left me-2"></i>Back to List
            </button>
            <button type="button" class="btn btn-success" onclick="renewCard(${cardIndex})">
                <i class="fas fa-sync me-2"></i>Renew Card
            </button>
        `;
    }

    function renewCard(cardIndex) {
        const oldCards = cards.filter(card => {
            return !card.lastModified || 
                   !card.hypaUpdated || 
                   !card.importedFromHypa ||
                   card.cardType === 'old-format' ||
                   !card.id;
        });
        
        const oldCard = oldCards[cardIndex];
        if (!oldCard) return;

        // Create new card with current format
        const newCard = {
            id: Date.now().toString(),
            sku: oldCard.sku || 'Unknown',
            cardType: oldCard.cardType || 'feature',
            position: oldCard.position || 1,
            title: oldCard.title || '',
            content: oldCard.content || oldCard.description || '',
            imageUrl: oldCard.imageUrl || oldCard.image || '',
            price: oldCard.price || '',
            hypaUpdated: true,
            importedFromHypa: true,
            lastModified: new Date().toISOString(),
            migratedFrom: {
                oldCardId: oldCard.id,
                migrationDate: new Date().toISOString()
            }
        };

        // Remove old card and add new one
        const oldCardIndex = cards.findIndex(c => c.id === oldCard.id);
        if (oldCardIndex !== -1) {
            cards.splice(oldCardIndex, 1);
        }
        cards.push(newCard);

        // Save changes
        saveCardsToFile();
        
        showAnalysisToast(`Card renewed successfully! SKU: ${newCard.sku}`, 'success');
        
        // Refresh the migration modal
        setTimeout(() => {
            migrateAndUpdateCards();
        }, 1000);
    }

    function bulkMigrateCards() {
        const oldCards = cards.filter(card => {
            return !card.lastModified || 
                   !card.hypaUpdated || 
                   !card.importedFromHypa ||
                   card.cardType === 'old-format' ||
                   !card.id;
        });

        let migratedCount = 0;
        oldCards.forEach(oldCard => {
            const newCard = {
                id: Date.now().toString() + migratedCount.toString(),
                sku: oldCard.sku || 'Unknown',
                cardType: oldCard.cardType || 'feature',
                position: oldCard.position || 1,
                title: oldCard.title || '',
                content: oldCard.content || oldCard.description || '',
                imageUrl: oldCard.imageUrl || oldCard.image || '',
                price: oldCard.price || '',
                hypaUpdated: true,
                importedFromHypa: true,
                lastModified: new Date().toISOString(),
                migratedFrom: {
                    oldCardId: oldCard.id,
                    migrationDate: new Date().toISOString()
                }
            };

            // Remove old card and add new one
            const oldCardIndex = cards.findIndex(c => c.id === oldCard.id);
            if (oldCardIndex !== -1) {
                cards.splice(oldCardIndex, 1);
            }
            cards.push(newCard);
            migratedCount++;
        });

        // Save changes
        saveCardsToFile();
        
        showAnalysisToast(`Bulk migration completed! ${migratedCount} cards updated.`, 'success');
        
        // Close modal and refresh
        const modal = bootstrap.Modal.getInstance(document.getElementById('importHypaModal'));
        modal.hide();
        
        // Refresh analysis
        performAnalysis();
        renderAnalysisTable();
    }

    // Make migration functions available globally
    window.migrateAndUpdateCards = migrateAndUpdateCards;
    window.viewCardDetails = viewCardDetails;
    window.renewCard = renewCard;
    window.bulkMigrateCards = bulkMigrateCards;

    // Export back to Hypa format with perfect round-trip preservation
    async function exportToHypaFormat() {
        try {
            // Try to load Hypa CSV data from cache first
            let hypaCsvData = originalHypaCsvData;
            let hypaCsvHeaders = originalHypaCsvHeaders;
            
            if (!hypaCsvData || !hypaCsvHeaders) {
                try {
                    const cacheResponse = await fetch('/api/hypa-csv-cache');
                    if (cacheResponse.ok) {
                        const cacheData = await cacheResponse.json();
                        if (cacheData && cacheData.data && cacheData.headers) {
                            hypaCsvData = cacheData.data;
                            hypaCsvHeaders = cacheData.headers;
                            console.log('Loaded Hypa data from cache for export:', hypaCsvData.length, 'rows');
                        }
                    }
                } catch (error) {
                    console.log('No Hypa CSV cache found:', error.message);
                }
            }
            
            if (!hypaCsvData || !hypaCsvHeaders) {
                showAnalysisToast('No original Hypa CSV data found. Please import from Hypa first.', 'error');
                return;
            }

            console.log('Exporting to Hypa format with original structure preservation');
            console.log('Original headers:', hypaCsvHeaders);
            console.log('Original data rows:', hypaCsvData.length);

            // Get selected items for export
            const selectedItems = window.selectedExportItems;
            if (!selectedItems || selectedItems.length === 0) {
                showAnalysisToast('No cards selected for export. Please go through the export selection process first.', 'error');
                return;
            }

            console.log(`Exporting ${selectedItems.length} selected items to Hypa format`);

            // Get all SKUs from selected items (main SKU + variant SKUs)
            const allSelectedSkus = new Set();
            
            selectedItems.forEach(item => {
                // Add main SKU
                if (item.sku) {
                    allSelectedSkus.add(item.sku);
                }
                
                // Add variant SKUs from configuration
                if (item.configuration && item.configuration.variants) {
                    item.configuration.variants.forEach(variant => {
                        if (typeof variant === 'string') {
                            // Old format: string variant
                            allSelectedSkus.add(variant);
                        } else if (typeof variant === 'object' && variant.sku) {
                            // New format: object with sku property
                            allSelectedSkus.add(variant.sku);
                        }
                    });
                }
                
                // Add SKUs from associatedSkus if available
                if (item.associatedSkus && Array.isArray(item.associatedSkus)) {
                    item.associatedSkus.forEach(sku => allSelectedSkus.add(sku));
                }
            });
            
            const selectedSkus = Array.from(allSelectedSkus);
            console.log('All selected SKUs for export (main + variants):', selectedSkus);

            // Filter the original data to only include rows for selected SKUs
            const exportData = hypaCsvData
                .filter(row => selectedSkus.includes(row.sku))
                .map(row => ({ ...row }));

            console.log(`Filtered export data to ${exportData.length} rows (from ${hypaCsvData.length} original rows)`);

                    // Get the selected numbering system
        const numberingSystem = document.getElementById('cardNumberingSystem')?.value || 'sequential';
        
        // Apply the selected numbering system
        switch (numberingSystem) {
            case 'sequential':
                // Simple sequential numbering across all selected cards (1, 2, 3, 4, 5...)
                selectedItems.forEach((item, index) => {
                    item.assignedPosition = index + 1;
                });
                break;
                
            case 'grouped':
                // Group by SKU and card type, then number within each group
                const skuCardGroups = new Map();
                selectedItems.forEach(item => {
                    const groupKey = `${item.sku}_${item.cardType}`;
                    if (!skuCardGroups.has(groupKey)) {
                        skuCardGroups.set(groupKey, []);
                    }
                    skuCardGroups.get(groupKey).push(item);
                });
                
                skuCardGroups.forEach((cards, groupKey) => {
                    cards.forEach((card, index) => {
                        card.assignedPosition = index + 1;
                    });
                });
                break;
                
            case 'alphabetical':
                // Sort by title alphabetically, then assign sequential numbers
                const sortedByTitle = [...selectedItems].sort((a, b) => {
                    const titleA = (a.title || '').toLowerCase();
                    const titleB = (b.title || '').toLowerCase();
                    return titleA.localeCompare(titleB);
                });
                
                sortedByTitle.forEach((item, index) => {
                    item.assignedPosition = index + 1;
                });
                break;
                
            case 'creation-date':
                // Sort by creation date (oldest first), then assign sequential numbers
                const sortedByCreation = [...selectedItems].sort((a, b) => {
                    const dateA = new Date(a.createdDate || 0);
                    const dateB = new Date(b.createdDate || 0);
                    return dateA - dateB;
                });
                
                sortedByCreation.forEach((item, index) => {
                    item.assignedPosition = index + 1;
                });
                break;
                
            case 'last-modified':
                // Sort by last modified date (newest first), then assign sequential numbers
                const sortedByModified = [...selectedItems].sort((a, b) => {
                    const dateA = new Date(a.lastModified || 0);
                    const dateB = new Date(b.lastModified || 0);
                    return dateB - dateA; // Newest first
                });
                
                sortedByModified.forEach((item, index) => {
                    item.assignedPosition = index + 1;
                });
                break;
                
            case 'price':
                // Sort by price (lowest first), then assign sequential numbers
                const sortedByPrice = [...selectedItems].sort((a, b) => {
                    const priceA = parseFloat(a.price || 0);
                    const priceB = parseFloat(b.price || 0);
                    return priceA - priceB;
                });
                
                sortedByPrice.forEach((item, index) => {
                    item.assignedPosition = index + 1;
                });
                break;
                
            default:
                // Fallback to sequential
                selectedItems.forEach((item, index) => {
                    item.assignedPosition = index + 1;
                });
                break;
        }
        
        // Map our selected cards back to the original CSV structure
        selectedItems.forEach(item => {
            // Use assigned position if available, otherwise use original position
            const finalPosition = item.assignedPosition || item.position || 1;
            
            // Create a unique identifier using SKU + title + cardType + assigned position
            const uniqueId = `${item.sku}_${item.title || 'no-title'}_${item.cardType}_${finalPosition}`;
            
            // Get all SKUs for this card (main SKU + variant SKUs)
            const allCardSkus = new Set();
            
            // Add main SKU
            if (item.sku) {
                allCardSkus.add(item.sku);
            }
            
            // Add variant SKUs from configuration
            if (item.configuration && item.configuration.variants) {
                item.configuration.variants.forEach(variant => {
                    if (typeof variant === 'string') {
                        allCardSkus.add(variant);
                    } else if (typeof variant === 'object' && variant.sku) {
                        allCardSkus.add(variant.sku);
                    }
                });
            }
            
            // Add SKUs from associatedSkus if available
            if (item.associatedSkus && Array.isArray(item.associatedSkus)) {
                item.associatedSkus.forEach(sku => allCardSkus.add(sku));
            }
            
            console.log(`Processing card: ${uniqueId} for SKUs: ${Array.from(allCardSkus).join(', ')}, card type: ${item.cardType}, position: ${item.position}, action: ${item.action}`);
            
            // Process each SKU for this card
            Array.from(allCardSkus).forEach(cardSku => {
                // Find the corresponding row in the original data for this SKU
                const rowIndex = exportData.findIndex(row => row.sku === cardSku);
                if (rowIndex === -1) {
                    console.log(`Card for SKU ${cardSku} not found in original data, skipping`);
                    return;
                }

                const row = exportData[rowIndex];
                console.log(`Processing card: ${uniqueId} for SKU ${item.sku}, card type: ${item.cardType}, position: ${item.position}, action: ${item.action}`);

                // Validate card format before processing
                const validationResult = validateCardForHypaExport(item, hypaCsvHeaders);
                if (!validationResult.isValid) {
                    console.error(`Validation failed for ${uniqueId}: ${validationResult.error}`);
                    showAnalysisToast(`Export validation failed for ${uniqueId}: ${validationResult.error}`, 'error');
                    return;
                }

                // Update the appropriate columns based on card type
                switch (item.cardType) {
                    case 'feature':
                        if (finalPosition) {
                            // Update feature card with HTML content
                            const featureFlag = `shared.feature-${finalPosition}-card`;
                            if (hypaCsvHeaders.includes(featureFlag)) {
                                try {
                                    // Clear any existing content first
                                    row[featureFlag] = '';
                                    
                                    // Generate HTML using local function (fallback if CardManager not available)
                                    const htmlContent = generateFeatureCardHtml(item);
                                    if (!htmlContent) {
                                        throw new Error(`Failed to generate HTML for feature card ${finalPosition} (${uniqueId})`);
                                    }

                                    // Add single card HTML to its dedicated column
                                    row[featureFlag] = htmlContent;
                                    
                                    console.log(`Exported feature card ${finalPosition} to column ${featureFlag} for ${uniqueId}`);
                                } catch (error) {
                                    console.error(`Error exporting feature card ${finalPosition} (${uniqueId}):`, error);
                                    showAnalysisToast(`Failed to export feature card: ${error.message}`, 'error');
                                    return;
                                }
                            } else {
                                console.warn(`Feature card column ${featureFlag} not found in Hypa headers for ${uniqueId}`);
                            }
                        }
                        break;

                    case 'product-options':
                        if (finalPosition) {
                            // Update option card with HTML content
                            const optionFlag = `shared.option-${finalPosition}-card`;
                            if (hypaCsvHeaders.includes(optionFlag)) {
                                try {
                                    // Clear any existing content first
                                    row[optionFlag] = '';
                                    
                                    const htmlContent = generateProductOptionCardHtml(item);
                                    
                                    // Validate generated HTML against reference template
                                    const validation = validateGeneratedHtml(item, htmlContent);
                                    if (!validation.isValid) {
                                        console.error(`HTML validation failed for ${uniqueId}, product option card ${item.position}:`, validation.errors);
                                        showAnalysisToast(`HTML validation failed for ${uniqueId}: ${validation.errors.join(', ')}`, 'error');
                                        return;
                                    }
                                    
                                    row[optionFlag] = htmlContent;
                                    console.log(`Exported product option card ${finalPosition} to column ${optionFlag} for ${uniqueId}`);
                                } catch (error) {
                                    console.error(`Error exporting product option card ${finalPosition} (${uniqueId}):`, error);
                                    showAnalysisToast(`Failed to export product option card: ${error.message}`, 'error');
                                    return;
                                }
                            } else {
                                console.warn(`Product option card column ${optionFlag} not found in Hypa headers for ${uniqueId}`);
                            }
                        }
                        break;
                        
                    case 'specification-table':
                    case 'spec':
                        if (hypaCsvHeaders.includes('shared.spec-table')) {
                            try {
                                // Clear any existing content first
                                row['shared.spec-table'] = '';
                                
                                // For specification tables, put the content directly in the cell
                                const content = item.content || item.description || '';
                                row['shared.spec-table'] = content;
                                
                                console.log(`Exported specification table to column shared.spec-table for ${uniqueId}`);
                            } catch (error) {
                                console.error(`Error exporting specification table (${uniqueId}):`, error);
                                showAnalysisToast(`Failed to export specification table: ${error.message}`, 'error');
                                return;
                            }
                        } else {
                            console.warn(`Specification table column shared.spec-table not found in Hypa headers for ${uniqueId}`);
                        }
                        break;
                        
                    case 'cargo-options':
                        if (finalPosition) {
                            // Update cargo option card with HTML content
                            const cargoFlag = `shared.cargo-option-${finalPosition}-card`;
                            if (hypaCsvHeaders.includes(cargoFlag)) {
                                try {
                                    // Clear any existing content first
                                    row[cargoFlag] = '';
                                    
                                    // Generate HTML content for the cargo option card
                                    const htmlContent = generateCargoOptionCardHtml(item);
                                    
                                    // Validate generated HTML against reference template
                                    const validation = validateGeneratedHtml(item, htmlContent);
                                    if (!validation.isValid) {
                                        console.error(`HTML validation failed for ${uniqueId}, cargo option card ${item.position}:`, validation.errors);
                                        showAnalysisToast(`HTML validation failed for ${uniqueId}: ${validation.errors.join(', ')}`, 'error');
                                        return;
                                    }
                                    
                                    row[cargoFlag] = htmlContent;
                                    console.log(`Exported cargo option card ${finalPosition} to column ${cargoFlag} for ${uniqueId}`);
                                } catch (error) {
                                    console.error(`Error exporting cargo option card ${finalPosition} (${uniqueId}):`, error);
                                    showAnalysisToast(`Failed to export cargo option card: ${error.message}`, 'error');
                                    return;
                                }
                            } else {
                                console.warn(`Cargo option card column ${cargoFlag} not found in Hypa headers for ${uniqueId}`);
                            }
                        }
                        break;
                        
                    case 'weather-protection':
                        if (finalPosition) {
                            // Update weather protection card with HTML content
                            const weatherFlag = `shared.weather-option-${finalPosition}-card`;
                            if (hypaCsvHeaders.includes(weatherFlag)) {
                                try {
                                    // Clear any existing content first
                                    row[weatherFlag] = '';
                                    
                                    const htmlContent = generateWeatherProtectionCardHtml(item);
                                    
                                    // Validate generated HTML against reference template
                                    const validation = validateGeneratedHtml(item, htmlContent);
                                    if (!validation.isValid) {
                                        console.error(`HTML validation failed for ${uniqueId}, weather protection card ${item.position}:`, validation.errors);
                                        showAnalysisToast(`HTML validation failed for ${uniqueId}: ${validation.errors.join(', ')}`, 'error');
                                        return;
                                    }
                                    
                                    row[weatherFlag] = htmlContent;
                                    console.log(`Exported weather protection card ${finalPosition} to column ${weatherFlag} for ${uniqueId}`);
                                } catch (error) {
                                    console.error(`Error exporting weather protection card ${finalPosition} (${uniqueId}):`, error);
                                    showAnalysisToast(`Failed to export weather protection card: ${error.message}`, 'error');
                                    return;
                                }
                            } else {
                                console.warn(`Weather protection card column ${weatherFlag} not found in Hypa headers for ${uniqueId}`);
                            }
                        }
                        break;
                        
                    default:
                        console.warn(`Unknown card type: ${item.cardType} for ${uniqueId}`);
                        break;
                }
                // Mark item as exported to Hypa
                item.exportedToHypa = true;
            }); // End of forEach(cardSku)
        }); // End of forEach(selectedItems)
                
            // Determine export format
            const exportFormat = document.getElementById('exportFormat')?.value || 'csv';
            let exportContent, mimeType, fileExtension;
            if (exportFormat === 'json') {
                exportContent = JSON.stringify(exportData, null, 2);
                mimeType = 'application/json';
                fileExtension = 'json';
            } else {
                // Use PapaParse to convert to CSV
                exportContent = Papa.unparse(exportData, { columns: hypaCsvHeaders });
                mimeType = 'text/csv';
                fileExtension = 'csv';
            }

            // Trigger download
            const blob = new Blob([exportContent], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hypa-export-${new Date().toISOString().replace(/[:.]/g, '-')}.${fileExtension}`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            showAnalysisToast('Export completed! Download started.', 'success');
        } catch (error) {
            console.error('Error during export:', error);
            showAnalysisToast('Export failed: ' + error.message, 'error');
        }
    }

    // Validate card format for Hypa export
    function validateCardForHypaExport(card, hypaHeaders) {
        const errors = [];
        
        // Check required fields based on card type
        switch (card.cardType) {
            case 'feature':
                if (!card.position) errors.push('Missing position for feature card');
                if (!card.title) errors.push('Missing title for feature card');
                if (!card.content && !card.description) errors.push('Missing content/description for feature card');
                break;
            case 'product-options':
                if (!card.position) errors.push('Missing position for product option card');
                if (!card.title) errors.push('Missing title for product option card');
                if (!card.content && !card.description) errors.push('Missing content/description for product option card');
                if (!card.price) errors.push('Missing price for product option card');
                break;
            case 'specification-table':
            case 'spec':
                if (!card.content) errors.push('Missing content for specification table card');
                break;
            case 'cargo-options':
                if (!card.position) errors.push('Missing position for cargo option card');
                if (!card.title) errors.push('Missing title for cargo option card');
                if (!card.content && !card.description) errors.push('Missing content/description for cargo option card');
                if (!card.price) errors.push('Missing price for cargo option card');
                break;
            case 'weather-protection':
                if (!card.position) errors.push('Missing position for weather protection card');
                if (!card.title) errors.push('Missing title for weather protection card');
                if (!card.content && !card.description) errors.push('Missing content/description for weather protection card');
                if (!card.price) errors.push('Missing price for weather protection card');
                break;
            default:
                errors.push(`Unknown card type: ${card.cardType}`);
        }
        
        // Check if required Hypa headers exist (only check for the actual combined card columns)
        if (card.cardType === 'feature' && card.position) {
            const requiredHeader = `shared.feature-${card.position}-card`;
            if (!hypaHeaders.includes(requiredHeader)) {
                errors.push(`Missing required Hypa header: ${requiredHeader}`);
            }
        }
        
        if (card.cardType === 'product-options' && card.position) {
            const requiredHeader = `shared.option-${card.position}-card`;
            if (!hypaHeaders.includes(requiredHeader)) {
                errors.push(`Missing required Hypa header: ${requiredHeader}`);
            }
        }
        
        if (card.cardType === 'specification-table' || card.cardType === 'spec') {
            const requiredHeader = 'shared.spec-table';
            if (!hypaHeaders.includes(requiredHeader)) {
                errors.push(`Missing required Hypa header: ${requiredHeader}`);
            }
        }
        
        if (card.cardType === 'cargo-options' && card.position) {
            const requiredHeader = `shared.cargo-option-${card.position}-card`;
            if (!hypaHeaders.includes(requiredHeader)) {
                errors.push(`Missing required Hypa header: ${requiredHeader}`);
            }
        }
        
        if (card.cardType === 'weather-protection' && card.position) {
            const requiredHeader = `shared.weather-option-${card.position}-card`;
            if (!hypaHeaders.includes(requiredHeader)) {
                errors.push(`Missing required Hypa header: ${requiredHeader}`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            error: errors.join(', ')
        };
    }

    // Helper function to get the correct image URL (WebDAV if available, otherwise original)
    function getCorrectImageUrl(card) {
        // If card has been uploaded to WebDAV, use the WebDAV URL
        if (card.webdavPath) {
            // Convert internal webdavPath to public URL
            let path = card.webdavPath.replace(/^\/dav/, '/product_images');
            path = path.replace(/\/product_images\/product_images\//, '/product_images/');
            path = path.replace(/([^:])\/+/, '$1/');
            const webdavUrl = 'https://store-c8jhcan2jv.mybigcommerce.com' + path;
            console.log(`Using WebDAV URL for card ${card.id}: ${webdavUrl}`);
            return webdavUrl;
        }
        
        // Otherwise use the original imageUrl
        console.log(`Using original imageUrl for card ${card.id}: ${card.imageUrl}`);
        return card.imageUrl || '';
    }

    // Generate HTML for feature cards
    function generateFeatureCardHtml(card) {
        const title = card.title || '';
        const subtitle = card.subtitle || '';
        const description = card.description || card.content || '';
        const imageUrl = getCorrectImageUrl(card);
        
        return `<!-- Product feature card container -->

<div style="display: flex; align-items: center; gap: 20px; max-width: 1200px; margin: 10px auto 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; flex-wrap: wrap;">
<!-- Text content -->

<div style="flex: 1; min-width: 300px;">
<h2>${title}</h2>
<h3>
</h3>
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

    // Generate HTML for product option cards
    function generateProductOptionCardHtml(card) {
        const title = card.title || '';
        const description = card.description || card.content || '';
        const price = card.price || '';
        const imageUrl = getCorrectImageUrl(card);
        
        return `<!-- Example of another card -->

<div class="swiper-slide">
  ${imageUrl ? `<div class="se-component se-image-container __se__float- __se__float-none"><figure>
  <img src="${imageUrl}" alt="${title}" data-proportion="true" data-align="none" data-file-name="${imageUrl.split('/').pop()}" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto" data-index="0">
  </figure>
  </div>` : ''}
  <div class="card">
  <div class="card-info">
  <div class="card-title">${title}</div>
  <div class="card-description">${description}</div>
  <div class="card-price">${price || ''}</div>
  <button class="more-info-btn">More Information</button>
  </div>
  </div>
  </div>`;
    }

    // Generate HTML for cargo option cards
    function generateCargoOptionCardHtml(card) {
        const title = card.title || '';
        const description = card.description || card.content || '';
        const price = card.price || '';
        const imageUrl = getCorrectImageUrl(card);
        
        return `<!-- Product feature card container -->
<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>${title}</h2>

${price ? `<h3>&pound;${price}</h3>` : ''}

<p>${description}</p>
</div>

<!-- Image -->
${imageUrl ? `<div class="se-component se-image-container __se__float- __se__float-none">
    <figure>
      <img src="${imageUrl}" alt="${title}" data-proportion="true" data-align="none" data-index="0" data-file-name="${imageUrl.split('/').pop()}" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto">
    </figure>
</div>` : ''}
</div>`;
    }

    // Generate HTML for weather protection cards
    function generateWeatherProtectionCardHtml(card) {
        const title = card.title || '';
        const description = card.description || card.content || '';
        const price = card.price || '';
        const imageUrl = getCorrectImageUrl(card);
        
        return `<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>${title}</h2>

${price ? `<h3>&pound;${price}</h3>` : ''}

<p>${description}</p>
</div>

<!-- Image -->
${imageUrl ? `<div class="se-component se-image-container __se__float- __se__float-none">
    <figure>
      <img src="${imageUrl}" alt="${title}" data-proportion="true" data-align="none" data-index="0" data-file-name="${imageUrl.split('/').pop()}" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto">
    </figure>
</div>` : ''}
</div>`;
    }

    // Validate generated HTML against reference templates
    function validateGeneratedHtml(card, generatedHtml) {
        const errors = [];
        
        // Load reference template based on card type
        let referenceTemplate = '';
        switch (card.cardType) {
            case 'feature':
                referenceTemplate = `<!-- Product feature card container -->
<div style="display: flex; align-items: center; gap: 20px; max-width: 1200px; margin: 10px auto 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; flex-wrap: wrap;">
<!-- Text content -->
<div style="flex: 1; min-width: 300px;">
<h2>TITLE_PLACEHOLDER</h2>
<h3>SUBTITLE_PLACEHOLDER</h3>
<p>DESCRIPTION_PLACEHOLDER</p>
</div>
<!-- Image -->
<div style="flex: 0 0 auto; max-width: 400px; min-width: 250px;">
</div>
<div class="se-component se-image-container __se__float-"><figure style="width: 400px;">
<img src="IMAGE_URL_PLACEHOLDER" alt="TITLE_PLACEHOLDER" style="max-width: 100%; height: auto; display: block; border-radius: 5px; width: 400px;" data-proportion="true" width="400" height="auto" data-size="400px,auto" data-align="" data-index="2" data-file-name="FILENAME_PLACEHOLDER" data-file-size="0" origin-size="1600,1067" data-origin="400px,auto">
</figure>
</div>
<div style="flex: 0 0 auto; max-width: 400px; min-width: 250px;">
</div>
</div>`;
                break;
            case 'cargo-options':
                referenceTemplate = `<!-- Product feature card container -->
<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>TITLE_PLACEHOLDER</h2>

<h3>PRICE_PLACEHOLDER</h3>

<p>DESCRIPTION_PLACEHOLDER</p>
</div>

<!-- Image -->
<div class="se-component se-image-container __se__float- __se__float-none">
    <figure>
      <img src="IMAGE_URL_PLACEHOLDER" alt="TITLE_PLACEHOLDER" data-proportion="true" data-align="none" data-index="0" data-file-name="FILENAME_PLACEHOLDER" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto">
    </figure>
</div>
</div>`;
                break;
            case 'product-options':
                referenceTemplate = `<!-- Example of another card -->

<div class="swiper-slide">
  <div class="se-component se-image-container __se__float- __se__float-none"><figure>
  <img src="IMAGE_URL_PLACEHOLDER" alt="TITLE_PLACEHOLDER" data-proportion="true" data-align="none" data-file-name="FILENAME_PLACEHOLDER" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto" data-index="0">
  </figure>
  </div>
  <div class="card">
  <div class="card-info">
  <div class="card-title">TITLE_PLACEHOLDER</div>
  <div class="card-description">DESCRIPTION_PLACEHOLDER</div>
  <div class="card-price">PRICE_PLACEHOLDER</div>
  <button class="more-info-btn">More Information</button>
  </div>
</div>
</div>`;
                break;
            case 'weather-protection':
                referenceTemplate = `<div class="product-feature-card">
<!-- Text content -->
<div class="feature-content">
<h2>TITLE_PLACEHOLDER</h2>

<h3>PRICE_PLACEHOLDER</h3>

<p>DESCRIPTION_PLACEHOLDER</p>
</div>

<!-- Image -->
<div class="se-component se-image-container __se__float- __se__float-none">
    <figure>
      <img src="IMAGE_URL_PLACEHOLDER" alt="TITLE_PLACEHOLDER" data-proportion="true" data-align="none" data-index="0" data-file-name="FILENAME_PLACEHOLDER" data-file-size="0" data-origin="," data-size="," data-rotate="" data-rotatex="" data-rotatey="" style="" width="" height="" data-percentage="auto,auto">
    </figure>
</div>
</div>`;
                break;
        }
        
        if (!referenceTemplate) {
            return { isValid: true, errors: [] }; // No template to validate against
        }
        
        // Normalize both HTML strings for comparison
        const normalizeHtml = (html) => {
            return html
                .replace(/\s+/g, ' ')
                .replace(/>\s+</g, '><')
                .trim();
        };
        
        const normalizedGenerated = normalizeHtml(generatedHtml);
        const normalizedReference = normalizeHtml(referenceTemplate);
        
        // Check for required structural elements
        const requiredElements = {
            'feature': ['h2', 'p', 'div[style*="display: flex"]'],
            'cargo-options': ['h2', 'p', '.product-feature-card', '.feature-content'],
            'product-options': ['.swiper-slide', '.card', '.card-title', '.card-description', '.more-info-btn'],
            'weather-protection': ['h2', 'p', '.product-feature-card', '.feature-content']
        };
        
        const elements = requiredElements[card.cardType] || [];
        const parser = new DOMParser();
        const generatedDoc = parser.parseFromString(generatedHtml, 'text/html');
        
        elements.forEach(element => {
            if (!generatedDoc.querySelector(element)) {
                errors.push(`Missing required element: ${element}`);
            }
        });
        
        // Check for required CSS classes
        const requiredClasses = {
            'cargo-options': ['product-feature-card', 'feature-content'],
            'product-options': ['swiper-slide', 'card', 'card-info', 'card-title', 'card-description', 'card-price', 'more-info-btn'],
            'weather-protection': ['product-feature-card', 'feature-content']
        };
        
        const classes = requiredClasses[card.cardType] || [];
        classes.forEach(className => {
            if (!generatedDoc.querySelector(`.${className}`)) {
                errors.push(`Missing required CSS class: ${className}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Make export function available globally
    window.exportToHypaFormat = exportToHypaFormat;

    // Export cards to a simple CSV format (fallback when no Hypa data)
    async function exportCardsToSimpleCsv() {
        try {
            // Load cards data
            let localCards = [];
            if (!window.cards || window.cards.length === 0) {
                console.log('Loading cards from server for simple export...');
                try {
                    const response = await fetch('/api/cards');
                    if (response.ok) {
                        localCards = await response.json();
                        console.log('Loaded cards for simple export:', localCards.length);
                    } else {
                        console.error('Failed to load cards for simple export, status:', response.status);
                        showAnalysisToast('Failed to load cards data for export.', 'error');
                        return;
                    }
                } catch (error) {
                    console.error('Error loading cards for simple export:', error);
                    showAnalysisToast('Error loading cards data for export.', 'error');
                    return;
                }
            } else {
                localCards = window.cards;
                console.log('Using existing cards data for simple export:', localCards.length);
            }

            if (localCards.length === 0) {
                showAnalysisToast('No cards found to export. Please create some cards first.', 'warning');
                return;
            }

            // Create a simple CSV structure
            const csvData = localCards.map(card => ({
                SKU: card.sku || '',
                'Card Type': card.cardType || '',
                'Position': card.position || '',
                'Title': card.title || '',
                'Content': card.content || card.description || '',
                'Image URL': card.imageUrl || '',
                'WebDAV Path': card.webdavPath || '',
                'Price': card.price || '',
                'Created Date': card.createdDate || new Date().toISOString(),
                'Last Modified': card.lastModified || new Date().toISOString()
            }));

            // Convert to CSV
            const csvContent = Papa.unparse(csvData);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cards-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            showAnalysisToast('Simple CSV export completed! Download started.', 'success');
        } catch (error) {
            console.error('Error during simple export:', error);
            showAnalysisToast('Simple export failed: ' + error.message, 'error');
        }
    }

    // Make simple export function available globally
    window.exportCardsToSimpleCsv = exportCardsToSimpleCsv;

    // Initialize export modal when it opens
    async function initializeExportModal() {
        console.log('Initializing export modal...');
        
        // Load local cards data immediately
        let localCards = [];
        try {
            const response = await fetch('/api/cards');
            if (response.ok) {
                localCards = await response.json();
                console.log('Loaded cards for modal initialization:', localCards.length);
                window.cards = localCards;
            } else {
                console.error('Failed to load cards for modal initialization, status:', response.status);
            }
        } catch (err) {
            console.error('Error loading cards for modal initialization:', err);
        }
        
        // Calculate local stats
        const localTotalCards = localCards.length;
        const localWithWebdavImages = localCards.filter(card => {
            if ((card.id && String(card.id).toLowerCase().includes('placeholder')) || 
                (card.title && String(card.title).toLowerCase().includes('placeholder'))) {
                return false;
            }
            return card.webdavPath && card.uploadDate;
        }).length;
        const localReadyToExport = localCards.filter(card => {
            if ((card.id && String(card.id).toLowerCase().includes('placeholder')) || 
                (card.title && String(card.title).toLowerCase().includes('placeholder'))) {
                return false;
            }
            let ready = false;
            let missing = [];
            const type = (card.cardType || card.type || '').toLowerCase();
            if (type === 'feature') {
                if (!card.title) missing.push('title');
                if (!card.description) missing.push('description');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            } else if (type === 'product-options' || type === 'option') {
                if (!card.title) missing.push('title');
                if (!card.price) missing.push('price');
                if (!card.description) missing.push('description');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            } else if (type === 'specification-table' || type === 'spec') {
                if (!card.content) missing.push('content');
                ready = missing.length === 0;
            } else if (type === 'cargo-options' || type === 'cargo') {
                if (!card.title) missing.push('title');
                if (!card.description) missing.push('description');
                if (!card.price) missing.push('price');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            } else if (type === 'weather-protection' || type === 'weather') {
                if (!card.title) missing.push('title');
                if (!card.description) missing.push('description');
                if (!card.price) missing.push('price');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            }
            return ready;
        }).length;
        
        // Update local stats immediately
        document.getElementById('localTotalCards').textContent = localTotalCards;
        document.getElementById('localWithImages').textContent = localWithWebdavImages;
        document.getElementById('localReadyToExport').textContent = localReadyToExport;
        
        // Load Hypa data from cache immediately
        let hypaData = null;
        let hypaLastUpdated = 'Not imported';
        let hypaStatus = 'No data';
        
        try {
            const cacheResponse = await fetch('/api/hypa-csv-cache');
            if (cacheResponse.ok) {
                const cacheData = await cacheResponse.json();
                if (cacheData && cacheData.data && cacheData.data.length > 0) {
                    hypaData = cacheData.data;
                    hypaLastUpdated = cacheData.timestamp ? new Date(cacheData.timestamp).toLocaleString() : 'Available';
                    hypaStatus = 'Connected';
                    console.log('Loaded Hypa data from cache for modal initialization:', hypaData.length, 'rows');
                }
            }
        } catch (error) {
            console.log('No Hypa CSV cache found for modal initialization:', error.message);
        }
        
        // Fallback to window.hypaCsvData if cache is not available
        if (!hypaData && window.hypaCsvData) {
            hypaData = window.hypaCsvData;
            hypaLastUpdated = 'Available (in memory)';
            hypaStatus = 'Connected';
            console.log('Using Hypa data from memory for modal initialization:', hypaData.length, 'rows');
        }
        
        const hypaTotalMetafields = hypaData ? hypaData.length : 0;
        
        // Update Hypa stats immediately
        document.getElementById('hypaExistingCount').textContent = hypaTotalMetafields;
        document.getElementById('hypaLastUpdated').textContent = hypaLastUpdated;
        document.getElementById('hypaConnectionStatus').textContent = hypaStatus;
        
        console.log('Export modal initialized with:', {
            localCards: localTotalCards,
            localWithImages: localWithWebdavImages,
            localReadyToExport: localReadyToExport,
            hypaTotalMetafields: hypaTotalMetafields,
            hypaLastUpdated: hypaLastUpdated,
            hypaStatus: hypaStatus
        });
    }

    // Add export modal event listener
    const exportHypaModal = document.getElementById('exportHypaModal');
    if (exportHypaModal) {
        exportHypaModal.addEventListener('shown.bs.modal', function () {
            console.log('Export modal shown, initializing...');
            initializeExportModal();
        });
    }

    // Add this at the top of the file, before showHypaValidationResults
    function validateHypaData(data) {
        console.log('validateHypaData called with data length:', data.length);
        console.log('First few rows:', data.slice(0, 3));
        const validation = {
            validCards: 0,
            invalidRows: 0,
            missingSkus: 0,
            detectedFields: {},
            errors: [],
            cardTypes: {
                feature: 0,
                option: 0,
                cargo: 0,
                weather: 0,
                specTable: 0
            }
        };
        // Hypa-specific field patterns
        const hypaFieldPatterns = {
            sku: ['sku'],
            productId: ['id'],
            featureCards: /^shared\.feature-\d+-card$/,
            optionCards: /^shared\.option-\d+-card$/,
            cargoCards: /^shared\.cargo-option-\d+-card$/,
            weatherCards: /^shared\.weather-option-\d+-card$/,
            specTable: /^shared\.spec-table$/,
            featureContent: /^features\.feature_\d+_(title|subtitle|description|image)$/,
            optionContent: /^options\.option_\d+_(title|description|image|price)$/,
            cargoContent: /^cargo\.cargo_\d+_(title|description|image|price)$/,
            weatherContent: /^weather\.weather_\d+_(title|description|image|price)$/
        };
        if (data.length > 0) {
            const firstRow = data[0];
            const columns = Object.keys(firstRow);
            columns.forEach(column => {
                if (hypaFieldPatterns.featureCards.test(column)) {
                    validation.cardTypes.feature++;
                } else if (hypaFieldPatterns.optionCards.test(column)) {
                    validation.cardTypes.option++;
                } else if (hypaFieldPatterns.cargoCards.test(column)) {
                    validation.cardTypes.cargo++;
                } else if (hypaFieldPatterns.weatherCards.test(column)) {
                    validation.cardTypes.weather++;
                } else if (hypaFieldPatterns.specTable.test(column)) {
                    validation.cardTypes.specTable++;
                }
            });
            validation.detectedFields.sku = firstRow.hasOwnProperty('sku') ? 100 : 0;
            validation.detectedFields.productId = firstRow.hasOwnProperty('id') ? 100 : 0;
        }
        data.forEach((row, index) => {
            const rowNum = index + 1;
            let isValid = true;
            let hasSku = false;
            let hasCards = false;
            const sku = row.sku;
            if (sku && sku.trim()) {
                hasSku = true;
            } else {
                validation.missingSkus++;
                validation.errors.push({
                    row: rowNum,
                    issue: 'Missing SKU',
                    data: `Row ${rowNum}: No SKU found`
                });
                isValid = false;
            }
            const columns = Object.keys(row);
            const enabledCards = columns.filter(col => {
                return (hypaFieldPatterns.featureCards.test(col) || 
                        hypaFieldPatterns.optionCards.test(col) || 
                        hypaFieldPatterns.cargoCards.test(col) || 
                        hypaFieldPatterns.weatherCards.test(col) || 
                        hypaFieldPatterns.specTable.test(col)) && 
                       row[col] && row[col].trim();
            });
            if (enabledCards.length > 0) {
                hasCards = true;
            } else {
                validation.errors.push({
                    row: rowNum,
                    issue: 'No Cards Enabled',
                    data: `Row ${rowNum}: SKU ${sku} - No cards are enabled`
                });
                isValid = false;
            }
            if (isValid && hasSku && hasCards) {
                validation.validCards++;
            } else {
                validation.invalidRows++;
            }
        });
        console.log('Validation completed:', validation);
        return validation;
    }

    // Add this helper near the top (after other helpers or before showHypaValidationResults)
    function getCardTypeDisplayName(cardType) {
        switch (cardType) {
            case 'feature': return 'Feature';
            case 'product-options': return 'Option';
            case 'cargo-options': return 'Cargo';
            case 'weather-protection': return 'Weather';
            case 'specification-table': return 'Spec';
            default: return cardType;
        }
    }

    // Add this helper function for modal display (at the bottom of the file):
    function showCardDetailsModal(card) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Card Details: ${getCardTypeDisplayName(card.cardType)}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <h4>${card.title || ''}</h4>
                ${card.subtitle ? `<h5>${card.subtitle}</h5>` : ''}
                ${card.imageUrl ? `<img src="${card.imageUrl}" alt="" style="max-width:200px;max-height:100px;" class="mb-3">` : ''}
                ${card.content ? `<p>${card.content}</p>` : ''}
                ${card.price ? `<p><strong>Price:</strong> ${card.price}</p>` : ''}
                <pre style="white-space:pre-wrap;">${card.description || ''}</pre>
                <hr>
                <pre style="font-size:0.9em;">${JSON.stringify(card, null, 2)}</pre>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => {
          document.body.removeChild(modal);
        });
    }

    // === NEW: Function to show validation details modal ===
    function showHypaValidationDetails() {
        const stats = window.hypaValidationStats;
        if (!stats || stats.validationErrors.length === 0) {
            showAnalysisToast('No validation errors to display.', 'info');
            return;
        }
        
        // Group errors by type
        const errorGroups = {};
        stats.validationErrors.forEach(error => {
            error.errors.forEach(err => {
                if (!errorGroups[err]) {
                    errorGroups[err] = [];
                }
                errorGroups[err].push(error);
            });
        });
        
        let modalContent = `
            <div class="modal-header">
                <h5 class="modal-title">
                    <i class="fas fa-exclamation-triangle me-2"></i>Validation Details
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
            <div class="alert alert-warning">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>${stats.invalidCards} cards failed validation</strong> and were replaced with placeholder cards.
                    You can review the details below and decide if you want to adjust the validation rules.
            </div>
            
                <div class="accordion" id="validationAccordion">
    `;
        
        Object.entries(errorGroups).forEach(([errorType, errors], index) => {
            const errorCount = errors.length;
            modalContent += `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                            <span class="badge bg-danger me-2">${errorCount}</span>
                            ${errorType}
                        </button>
                    </h2>
                    <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#validationAccordion">
                        <div class="accordion-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                        <tr>
                            <th>SKU</th>
                                            <th>Card Title</th>
                            <th>Card Type</th>
                                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        errors.forEach(error => {
            modalContent += `
                <tr>
                    <td><code>${error.sku}</code></td>
                    <td>${error.cardTitle}</td>
                    <td><span class="badge bg-secondary">${error.cardType}</span></td>
                    <td>
                        <button type="button" class="btn btn-outline-info btn-sm" onclick="viewHypaCardDetails('${error.sku}', '${error.cardTitle}')">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                </td>
                            </tr>
            `;
        });
        
        modalContent += `
                    </tbody>
                </table>
            </div>
                        </div>
                    </div>
            </div>
        `;
        });
        
        modalContent += `
                </div>
            </div>
            <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-warning" onclick="exportHypaValidationReport()">
                    <i class="fas fa-download me-2"></i>Export Report
            </button>
            </div>
        `;
        
        // Create and show modal
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'hypaValidationModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    ${modalContent}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Clean up modal when hidden
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    // === NEW: Function to view specific card details ===
    function viewHypaCardDetails(sku, cardTitle) {
        // This would show the original card content vs expected format
        showAnalysisToast(`Viewing details for ${cardTitle} (SKU: ${sku})`, 'info');
        // TODO: Implement detailed card comparison view
    }

    // === NEW: Function to export validation report ===
    function exportHypaValidationReport() {
        const stats = window.hypaValidationStats;
        if (!stats) return;
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalCards: stats.totalCards,
                validCards: stats.validCards,
                invalidCards: stats.invalidCards,
                placeholderCards: stats.placeholderCards
            },
            errorTypes: stats.errorTypes,
            validationErrors: stats.validationErrors
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hypa-validation-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAnalysisToast('Validation report exported successfully.', 'success');
    }

    // Make functions globally available
    window.showHypaValidationDetails = showHypaValidationDetails;
    window.viewHypaCardDetails = viewHypaCardDetails;
    window.exportHypaValidationReport = exportHypaValidationReport;

    // === EXPORT WORKFLOW FUNCTIONS ===
    
    // Step 1: Start Analysis
    async function startExportAnalysis() {
        console.log('Starting export analysis...');
        
        // Update progress
        updateExportProgress(1, 'Analyzing local cards and Hypa metafields...');
        
        // Always fetch cards from disk via API
        let localCards = [];
        try {
            const response = await fetch('/api/cards');
            if (response.ok) {
                localCards = await response.json();
                console.log('[Export Analysis] Loaded cards from disk:', localCards.length);
                console.log('[Export Analysis] Card data sample:', localCards.slice(0, 3)); // Show first 3 cards for inspection
            } else {
                console.error('[Export Analysis] Failed to load cards from disk, status:', response.status);
            }
        } catch (err) {
            console.error('[Export Analysis] Error loading cards from disk:', err);
        }
        
        const localTotalCards = localCards.length;
        const localWithWebdavImages = localCards.filter(card => {
            // Exclude placeholder cards from image count too
            if ((card.id && String(card.id).toLowerCase().includes('placeholder')) || 
                (card.title && String(card.title).toLowerCase().includes('placeholder'))) {
                return false;
            }
            return card.webdavPath && card.uploadDate;
        }).length;
        const localReadyToExport = localCards.filter(card => {
            // Exclude placeholder cards by id or title
            if ((card.id && String(card.id).toLowerCase().includes('placeholder')) || (card.title && String(card.title).toLowerCase().includes('placeholder'))) {
                return false;
            }
            let ready = false;
            let missing = [];
            const type = (card.cardType || card.type || '').toLowerCase();
            if (type === 'feature') {
                if (!card.title) missing.push('title');
                if (!card.description) missing.push('description');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            } else if (type === 'product-options' || type === 'option') {
                if (!card.title) missing.push('title');
                if (!card.price) missing.push('price');
                if (!card.description) missing.push('description');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            } else if (type === 'specification-table' || type === 'spec') {
                if (!card.content) missing.push('content');
                ready = missing.length === 0;
            } else if (type === 'cargo-options' || type === 'cargo') {
                if (!card.title) missing.push('title');
                if (!card.description) missing.push('description');
                if (!card.price) missing.push('price');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            } else if (type === 'weather-protection' || type === 'weather') {
                if (!card.title) missing.push('title');
                if (!card.description) missing.push('description');
                if (!card.price) missing.push('price');
                if (!card.webdavPath) missing.push('webdavPath');
                ready = missing.length === 0;
            }
            if (!ready) {
                console.log(`[Not Ready] Card ID: ${card.id || card.sku}, Type: ${type}, Missing: ${missing.join(', ')}`);
            }
            return ready;
        }).length;
        
        // Update local stats
        document.getElementById('localTotalCards').textContent = localTotalCards;
        document.getElementById('localWithImages').textContent = localWithWebdavImages;
        document.getElementById('localReadyToExport').textContent = localReadyToExport;
        
        console.log('Local stats updated:', { localTotalCards, localWithWebdavImages, localReadyToExport });
        
        // Check for existing Hypa data from cache
        let hypaData = null;
        let hypaLastUpdated = 'Not imported';
        let hypaStatus = 'No data';
        
        try {
            // Try to load from Hypa CSV cache first
            const cacheResponse = await fetch('/api/hypa-csv-cache');
            if (cacheResponse.ok) {
                const cacheData = await cacheResponse.json();
                if (cacheData && cacheData.data && cacheData.data.length > 0) {
                    hypaData = cacheData.data;
                    hypaLastUpdated = cacheData.timestamp ? new Date(cacheData.timestamp).toLocaleString() : 'Available';
                    hypaStatus = 'Connected';
                    console.log('Loaded Hypa data from cache:', hypaData.length, 'rows');
                }
            }
        } catch (error) {
            console.log('No Hypa CSV cache found or error loading:', error.message);
        }
        
        // Fallback to window.hypaCsvData if cache is not available
        if (!hypaData && window.hypaCsvData) {
            hypaData = window.hypaCsvData;
            hypaLastUpdated = 'Available (in memory)';
            hypaStatus = 'Connected';
            console.log('Using Hypa data from memory:', hypaData.length, 'rows');
        }
        
        const hypaTotalMetafields = hypaData ? hypaData.length : 0;
        
        // Update Hypa stats (fix IDs to match HTML)
        document.getElementById('hypaExistingCount').textContent = hypaTotalMetafields;
        document.getElementById('hypaLastUpdated').textContent = hypaLastUpdated;
        document.getElementById('hypaConnectionStatus').textContent = hypaStatus;
        
        console.log('Hypa stats updated:', { hypaTotalMetafields, hypaLastUpdated, hypaStatus });
        
        // Perform comparison and store results
        console.log('Performing export comparison...');
        const comparisonResults = await performExportComparison(localCards);
        window.exportComparisonResults = comparisonResults;
        
        // Move to step 2
        console.log('Analysis complete. Moving to comparison step...');
        showExportStep(2);
    }
    
    // Perform comparison between local cards and Hypa data
    async function performExportComparison(localCards) {
        console.log('Performing export comparison...');
        
        const results = {
            new: [],
            updates: [],
            keep: [],
            remove: [],
            excluded: [], // New: SKUs excluded due to incomplete cards
            summary: {
                new: 0,
                updates: 0,
                keep: 0,
                remove: 0,
                excluded: 0
            }
        };
        
        // Try to load Hypa data from cache if not available
        let hypaData = originalHypaCsvData;
        if (!hypaData || hypaData.length === 0) {
                try {
                    const cacheResponse = await fetch('/api/hypa-csv-cache');
                    if (cacheResponse.ok) {
                        const cacheData = await cacheResponse.json();
                    if (cacheData && cacheData.data && cacheData.data.length > 0) {
                        hypaData = cacheData.data;
                        console.log('Loaded Hypa data from cache for comparison:', hypaData.length, 'rows');
                        }
                    }
                } catch (error) {
                console.log('No Hypa CSV cache found for comparison:', error.message);
            }
        }
        
        // If no Hypa data, no cards can be exported (criteria #1: SKU must exist in original CSV)
        if (!hypaData || hypaData.length === 0) {
            localCards.forEach(card => {
                results.remove.push({
                    ...card,
                    action: 'remove',
                    reason: 'Cannot export: No Hypa CSV imported (SKU validation required)'
                });
            });
            results.summary.remove = localCards.length;
            return results;
        }
        
        // Group cards by SKU to check completeness
        // Each card can have multiple SKUs from its configuration.variants
        const cardsBySku = {};
        localCards.forEach(card => {
            // Get all SKUs for this card (primary SKU + variant SKUs)
            const cardSkus = [card.sku];
            
            // Add variant SKUs if they exist
            if (card.configuration && card.configuration.variants) {
                card.configuration.variants.forEach(variant => {
                    if (variant.sku && !cardSkus.includes(variant.sku)) {
                        cardSkus.push(variant.sku);
                    }
                });
            }
            
            // Add this card to each of its associated SKUs
            cardSkus.forEach(sku => {
                if (!cardsBySku[sku]) {
                    cardsBySku[sku] = [];
                }
                cardsBySku[sku].push(card);
            });
        });
        
        // Check each SKU for completeness
        const incompleteSkus = [];
        const completeCards = [];
        
        Object.entries(cardsBySku).forEach(([sku, cards]) => {
            const incompleteCards = [];
            const skuCompleteCards = [];
            
            cards.forEach(card => {
                const completenessCheck = checkCardCompleteness(card);
                
                // Debug logging for F01169, F01170, F01171
                if (card.sku === 'F01169' || card.sku === 'F01170' || card.sku === 'F01171') {
                    console.log(`🔍 COMPLETENESS CHECK for ${card.sku} - ${card.cardType}:`);
                    console.log(`  Is complete: ${completenessCheck.isComplete}`);
                    console.log(`  Missing fields: ${completenessCheck.missingFields.join(', ')}`);
                }
                
                if (!completenessCheck.isComplete) {
                    incompleteCards.push({
                        ...card,
                        missingFields: completenessCheck.missingFields
                    });
                } else {
                    skuCompleteCards.push(card);
                }
            });
            
            if (incompleteCards.length > 0) {
                // SKU has incomplete cards - exclude entire SKU
                incompleteSkus.push({
                    sku: sku,
                    incompleteCards: incompleteCards,
                    reason: `SKU excluded: ${incompleteCards.length} incomplete cards`
                });
                results.excluded.push(...incompleteCards);
                results.summary.excluded += incompleteCards.length;
                
                // Debug logging for F01169, F01170, F01171
                if (sku === 'F01169' || sku === 'F01170' || sku === 'F01171') {
                    console.log(`❌ SKU ${sku} EXCLUDED due to incomplete cards:`);
                    incompleteCards.forEach(card => {
                        console.log(`  - ${card.cardType}: missing ${card.missingFields.join(', ')}`);
                    });
                }
            } else {
                // SKU is complete - add all cards for processing
                completeCards.push(...skuCompleteCards);
                
                // Debug logging for F01169, F01170, F01171
                if (sku === 'F01169' || sku === 'F01170' || sku === 'F01171') {
                    console.log(`✅ SKU ${sku} COMPLETE - ${skuCompleteCards.length} cards ready for export`);
                }
            }
        });
        
        console.log(`Export validation: ${Object.keys(cardsBySku).length} SKUs checked`);
        console.log(`- ${completeCards.length} complete cards ready for export`);
        console.log(`- ${incompleteSkus.length} SKUs excluded due to incomplete cards`);
        
        // Store excluded SKUs info for display
        results.excludedSkus = incompleteSkus;
        
        // First pass: Process cards individually to determine initial actions
        const cardActions = new Map(); // Map to store card -> action
        const skuUpdateFlags = new Map(); // Map to track which SKUs need updates
        
        completeCards.forEach(card => {
            // Get all SKUs for this card (primary SKU + variant SKUs)
            const cardSkus = [card.sku];
            
            // Add variant SKUs if they exist
            if (card.configuration && card.configuration.variants) {
                card.configuration.variants.forEach(variant => {
                    if (variant.sku && !cardSkus.includes(variant.sku)) {
                        cardSkus.push(variant.sku);
                    }
                });
            }
            
            // Debug logging for F01169, F01170, F01171
            if (card.sku === 'F01169' || card.sku === 'F01170' || card.sku === 'F01171') {
                console.log(`🔍 PROCESSING CARD for ${card.sku}:`);
                console.log(`  Card type: "${card.cardType}"`);
                console.log(`  All associated SKUs: ${cardSkus.join(', ')}`);
            }
            
            // Handle different card types differently:
            // - Shared cards (feature, cargo, product-options): appear once but associated with all SKUs
            // - Spec cards: appear once per SKU (unique per SKU)
            const isSharedCard = ['feature', 'cargo-options', 'product-options', 'weather-protection'].includes(card.cardType);
            const isSpecCard = card.cardType === 'specification-table';
            
            if (isSharedCard) {
                // Shared card: process once but associate with all SKUs
                // Find if ANY of the associated SKUs exist in Hypa data
                const validSkus = [];
                const invalidSkus = [];
                
                cardSkus.forEach(sku => {
                    const hypaRow = hypaData.find(row => {
                        const hypaSku = row.sku || row.SKU || row.sku_number || row['SKU Number'];
                        if (!hypaSku) return false;
                        
                        const cleanHypaSku = hypaSku.trim().toLowerCase();
                        const cleanCardSku = sku.trim().toLowerCase();
                        
                        return cleanHypaSku === cleanCardSku;
                    });
                    
                    if (hypaRow) {
                        validSkus.push({ sku, hypaRow });
                            } else {
                        invalidSkus.push(sku);
                    }
                });
                
                // If any SKU is valid, the card can be exported
                if (validSkus.length > 0) {
                    // Use the first valid SKU for processing, but show all associated SKUs
                    const primarySku = validSkus[0];
                    
                    // Debug logging for F01169, F01170, F01171
                    if (card.sku === 'F01169' || card.sku === 'F01170' || card.sku === 'F01171') {
                        console.log(`🔍 SHARED CARD ${card.sku}:`);
                        console.log(`  Valid SKUs: ${validSkus.map(v => v.sku).join(', ')}`);
                        console.log(`  Invalid SKUs: ${invalidSkus.join(', ')}`);
                    }
                    
                    // Check if card exists in Hypa
                    const cardExistsInHypa = checkCardExistsInHypa(card, primarySku.hypaRow);
                    
                    if (!cardExistsInHypa) {
                        // New shared card
                        const action = 'new';
                        cardActions.set(card, {
                            ...card,
                            sku: primarySku.sku,
                            associatedSkus: cardSkus,
                            action: action,
                            reason: 'Shared card type not found in Hypa data'
                        });
                        
                        // Mark all associated SKUs as needing updates
                        cardSkus.forEach(sku => {
                            skuUpdateFlags.set(sku, true);
                        });
                    } else {
                        // Check if content is different
                        const contentChanged = checkCardContentChanged(card, primarySku.hypaRow);
                        
                        if (contentChanged) {
                            const action = 'update';
                            cardActions.set(card, {
                                ...card,
                                sku: primarySku.sku,
                                associatedSkus: cardSkus,
                                action: action,
                                reason: 'Shared card content differs from Hypa version'
                            });
                            
                            // Mark all associated SKUs as needing updates
                            cardSkus.forEach(sku => {
                                skuUpdateFlags.set(sku, true);
                            });
                        } else {
                            const action = 'keep';
                            cardActions.set(card, {
                                ...card,
                                sku: primarySku.sku,
                                associatedSkus: cardSkus,
                                action: action,
                                reason: 'Shared card identical to Hypa version (no changes needed)'
                            });
                        }
                    }
                } else {
                    // No valid SKUs found
                    cardActions.set(card, {
                        ...card,
                        sku: card.sku,
                        associatedSkus: cardSkus,
                        action: 'remove',
                        reason: 'Cannot export: No associated SKUs found in original Hypa CSV'
                    });
                }
            } else if (isSpecCard) {
                // Spec card: process once with all SKUs
                // Find if ANY of the associated SKUs exist in Hypa data
                const validSkus = [];
                const invalidSkus = [];
                
                cardSkus.forEach(sku => {
                    // Debug: Log the SKU we're looking for
                    console.log(`Looking for SKU: "${sku}" in Hypa data`);
                    
                    // Special debug for F01169, F01170 and F01171
                    if (sku === 'F01169' || sku === 'F01170' || sku === 'F01171') {
                        console.log(`🔍 SPECIAL DEBUG for ${sku}:`);
                        console.log(`  Card SKU: "${sku}"`);
                        console.log(`  Card type: "${card.cardType}"`);
                        console.log(`  Available Hypa SKUs (first 10):`, hypaData.slice(0, 10).map(row => row.sku || row.SKU || row.sku_number || row['SKU Number']));
                    }
                    
                    // Try different SKU field names and formats
                    let hypaRow = hypaData.find(row => {
                        const hypaSku = row.sku || row.SKU || row.sku_number || row['SKU Number'];
                        if (!hypaSku) return false;
                        
                        // Clean and normalize SKUs for comparison
                        const cleanHypaSku = hypaSku.trim().toLowerCase();
                        const cleanCardSku = sku.trim().toLowerCase();
                        
                        // Special debug for F01169, F01170 and F01171
                        if (sku === 'F01169' || sku === 'F01170' || sku === 'F01171') {
                            console.log(`  Comparing "${cleanCardSku}" with "${cleanHypaSku}"`);
                        }
                        
                        // Direct match only - each SKU is unique
                        if (cleanHypaSku === cleanCardSku) {
                            console.log(`✓ Direct match found: "${sku}" = "${hypaSku}"`);
                            return true;
                        }
                        
                        return false;
                    });
                    
                    if (!hypaRow) {
                        // Debug: Log available SKUs in Hypa data for comparison
                        console.log(`❌ No match found for SKU: "${sku}"`);
                        console.log('Available SKUs in Hypa data (first 5):', hypaData.slice(0, 5).map(row => row.sku || row.SKU || row.sku_number || row['SKU Number']));
                    }
                    
                                        if (hypaRow) {
                        validSkus.push({ sku, hypaRow });
                    } else {
                        invalidSkus.push(sku);
                    }
                });

                // If any SKU is valid, the card can be exported
                if (validSkus.length > 0) {
                    // Use the first valid SKU for processing, but show all associated SKUs
                    const primarySku = validSkus[0];
                    
                    // Debug logging for F01169, F01170, F01171
                    if (card.sku === 'F01169' || card.sku === 'F01170' || card.sku === 'F01171') {
                        console.log(`🔍 SPEC CARD ${card.sku}:`);
                        console.log(`  Valid SKUs: ${validSkus.map(v => v.sku).join(', ')}`);
                        console.log(`  Invalid SKUs: ${invalidSkus.join(', ')}`);
                    }
                    
                    // Check if card exists in Hypa
                    const cardExistsInHypa = checkCardExistsInHypa(card, primarySku.hypaRow);
                    
                    if (!cardExistsInHypa) {
                        // New spec card
                        const action = 'new';
                        cardActions.set(card, {
                            ...card,
                            sku: primarySku.sku,
                            associatedSkus: cardSkus,
                            action: action,
                            reason: 'Spec card type not found in Hypa data'
                        });
                        
                        // Mark all associated SKUs as needing updates
                        cardSkus.forEach(sku => {
                            skuUpdateFlags.set(sku, true);
                        });
                    } else {
                        // Check if content is different
                        const contentChanged = checkCardContentChanged(card, primarySku.hypaRow);
                        
                        if (contentChanged) {
                            const action = 'update';
                            cardActions.set(card, {
                                ...card,
                                sku: primarySku.sku,
                                associatedSkus: cardSkus,
                                action: action,
                                reason: 'Spec card content differs from Hypa version'
                            });
                            
                            // Mark all associated SKUs as needing updates
                            cardSkus.forEach(sku => {
                                skuUpdateFlags.set(sku, true);
                            });
                        } else {
                            const action = 'keep';
                            cardActions.set(card, {
                                ...card,
                                sku: primarySku.sku,
                                associatedSkus: cardSkus,
                                action: action,
                                reason: 'Spec card identical to Hypa version (no changes needed)'
                            });
                        }
                    }
                } else {
                    // No valid SKUs found
                    cardActions.set(card, {
                        ...card,
                        sku: card.sku,
                        associatedSkus: cardSkus,
                        action: 'remove',
                        reason: 'Cannot export: No associated SKUs found in original Hypa CSV'
                    });
                }
            }
        });
        
        // Second pass: Apply SKU-level rule - if ANY card in a SKU needs updating, ALL cards for that SKU get updated
        console.log('=== APPLYING SKU-LEVEL RULE ===');
        console.log('SKUs that need updates:', Array.from(skuUpdateFlags.keys()));
        
        cardActions.forEach((cardData, card) => {
            const cardSkus = cardData.associatedSkus || [cardData.sku];
            const needsUpdate = cardSkus.some(sku => skuUpdateFlags.get(sku));
            
            if (needsUpdate && cardData.action === 'keep') {
                // Upgrade from 'keep' to 'update' if any card in the SKU needs updating
                cardData.action = 'update';
                cardData.reason = 'SKU-level rule: Other cards in this SKU need updating';
                console.log(`🔄 Upgraded card ${card.sku} (${card.cardType}) from 'keep' to 'update' due to SKU-level rule`);
            }
            
            // Add to appropriate results array
            switch (cardData.action) {
                case 'new':
                    results.new.push(cardData);
                    results.summary.new++;
                    break;
                case 'update':
                    results.updates.push(cardData);
                    results.summary.updates++;
                    break;
                case 'keep':
                    results.keep.push(cardData);
                    results.summary.keep++;
                    break;
                case 'remove':
                    results.remove.push(cardData);
                    results.summary.remove++;
                    break;
            }
        });
        
        // Find cards in Hypa that should be removed (not in local cards)
        hypaData.forEach(hypaRow => {
            const sku = hypaRow.sku;
            const localCardsForSku = completeCards.filter(card => card.sku === sku);
            
            // Check for cards in Hypa that don't exist locally
            const hypaCardTypes = getHypaCardTypes(hypaRow);
            hypaCardTypes.forEach(cardType => {
                const localCardExists = localCardsForSku.some(card => 
                    card.cardType === cardType.cardType && card.position === cardType.position
                );
                
                if (!localCardExists) {
                    results.remove.push({
                        sku: sku,
                        cardType: cardType.cardType,
                        position: cardType.position,
                        action: 'remove',
                        reason: 'Card exists in Hypa but not locally'
                    });
                    results.summary.remove++;
                }
            });
        });
        
        // Debug: Show SKU comparison
        const localSkus = completeCards.map(card => card.sku).filter(sku => sku);
        const hypaSkus = hypaData.map(row => row.sku || row.SKU || row.sku_number || row['SKU Number']).filter(sku => sku);
        
        console.log('=== SKU COMPARISON DEBUG ===');
        console.log('Local SKUs (first 10):', localSkus.slice(0, 10));
        console.log('Hypa SKUs (first 10):', hypaSkus.slice(0, 10));
        
        // Show which specific SKUs are missing
        const missingSkus = localSkus.filter(sku => !hypaSkus.includes(sku));
        if (missingSkus.length > 0) {
            console.log('❌ Missing SKUs (not in Hypa data):', missingSkus.slice(0, 10));
        }
        
        // Count exact matches only
        const matchingSkus = localSkus.filter(sku => hypaSkus.includes(sku));
        console.log('Matching SKUs (exact matches only):', matchingSkus.length, 'out of', localSkus.length);
        
        // Show sample of matching SKUs
        if (matchingSkus.length > 0) {
            console.log('✅ Sample matching SKUs:', matchingSkus.slice(0, 5));
        }
        console.log('================================');
        
        console.log('Export comparison results:', results);
        return results;
    }
    
    // Check if a card is complete and ready for export (criteria #2)
    function checkCardCompleteness(card) {
        const missingFields = [];
        const type = (card.cardType || card.type || '').toLowerCase();
        
        // Check for placeholder cards
        if ((card.id && String(card.id).toLowerCase().includes('placeholder')) || 
            (card.title && String(card.title).toLowerCase().includes('placeholder'))) {
            missingFields.push('placeholder card detected');
        }
        
        // Check required fields based on card type
        if (type === 'feature') {
            if (!card.title || card.title.trim() === '') missingFields.push('title');
            if ((!card.description || card.description.trim() === '') && (!card.content || card.content.trim() === '')) missingFields.push('description');
            if (card.imageUrl && (!card.webdavPath || !card.uploadDate)) missingFields.push('image not uploaded to WebDAV');
        } else if (type === 'product-options' || type === 'option') {
            if (!card.title || card.title.trim() === '') missingFields.push('title');
            if (!card.price || card.price.trim() === '') missingFields.push('price');
            if ((!card.description || card.description.trim() === '') && (!card.content || card.content.trim() === '')) missingFields.push('description');
            if (card.imageUrl && (!card.webdavPath || !card.uploadDate)) missingFields.push('image not uploaded to WebDAV');
        } else if (type === 'specification-table' || type === 'spec') {
            if ((!card.content || card.content.trim() === '') && (!card.description || card.description.trim() === '')) missingFields.push('content');
        } else if (type === 'cargo-options' || type === 'cargo') {
            if (!card.title || card.title.trim() === '') missingFields.push('title');
            if ((!card.description || card.description.trim() === '') && (!card.content || card.content.trim() === '')) missingFields.push('description');
            if (!card.price || card.price.trim() === '') missingFields.push('price');
            if (card.imageUrl && (!card.webdavPath || !card.uploadDate)) missingFields.push('image not uploaded to WebDAV');
        } else if (type === 'weather-protection' || type === 'weather') {
            if (!card.title || card.title.trim() === '') missingFields.push('title');
            if ((!card.description || card.description.trim() === '') && (!card.content || card.content.trim() === '')) missingFields.push('description');
            if (!card.price || card.price.trim() === '') missingFields.push('price');
            if (card.imageUrl && (!card.webdavPath || !card.uploadDate)) missingFields.push('image not uploaded to WebDAV');
        }
        
        return {
            isComplete: missingFields.length === 0,
            missingFields: missingFields
        };
    }
    
    // Check if a card exists in Hypa data
    function checkCardExistsInHypa(card, hypaRow) {
        const columns = Object.keys(hypaRow);
        
        switch (card.cardType) {
            case 'feature':
                if (card.position) {
                    const featureFlag = `shared.feature-${card.position}-card`;
                    return columns.includes(featureFlag) && (hypaRow[featureFlag] === 'enabled' || hypaRow[featureFlag].trim() !== '');
                }
                break;
            case 'product-options':
                if (card.position) {
                    const optionFlag = `shared.option-${card.position}-card`;
                    return columns.includes(optionFlag) && (hypaRow[optionFlag] === 'enabled' || hypaRow[optionFlag].trim() !== '');
                }
                break;
            case 'specification-table':
            case 'spec':
                return columns.includes('shared.spec-table') && (hypaRow['shared.spec-table'] === 'enabled' || hypaRow['shared.spec-table'].trim() !== '');
            case 'cargo-options':
                if (card.position) {
                    const cargoFlag = `shared.cargo-option-${card.position}-card`;
                    return columns.includes(cargoFlag) && (hypaRow[cargoFlag] === 'enabled' || hypaRow[cargoFlag].trim() !== '');
                }
                break;
            case 'weather-protection':
                if (card.position) {
                    const weatherFlag = `shared.weather-option-${card.position}-card`;
                    return columns.includes(weatherFlag) && (hypaRow[weatherFlag] === 'enabled' || hypaRow[weatherFlag].trim() !== '');
                }
                break;
        }
        return false;
    }
    
    // Check if card content has changed
    function checkCardContentChanged(card, hypaRow) {
        const columns = Object.keys(hypaRow);
        
        // For cards imported from Hypa, always mark as needing update to ensure fresh HTML generation
        if (card.importedFromHypa) {
            return true;
        }
        
        switch (card.cardType) {
            case 'feature':
                if (card.position) {
                    const titleField = `features.feature_${card.position}_title`;
                    const descField = `features.feature_${card.position}_description`;
                    const imageField = `features.feature_${card.position}_image`;
                    
                    return (columns.includes(titleField) && hypaRow[titleField] !== card.title) ||
                           (columns.includes(descField) && hypaRow[descField] !== card.content) ||
                           (columns.includes(imageField) && hypaRow[imageField] !== card.imageUrl);
                }
                break;
            case 'product-options':
                if (card.position) {
                    const titleField = `options.option_${card.position}_title`;
                    const descField = `options.option_${card.position}_description`;
                    const imageField = `options.option_${card.position}_image`;
                    
                    return (columns.includes(titleField) && hypaRow[titleField] !== card.title) ||
                           (columns.includes(descField) && hypaRow[descField] !== card.content) ||
                           (columns.includes(imageField) && hypaRow[imageField] !== card.imageUrl);
                }
                break;
            case 'specification-table':
            case 'spec':
                const specField = 'specification_table_content';
                return columns.includes(specField) && hypaRow[specField] !== card.content;
        }
        return false;
    }
    
    // Get card types from Hypa row
    function getHypaCardTypes(hypaRow) {
        const cardTypes = [];
        const columns = Object.keys(hypaRow);
        
        columns.forEach(column => {
            if (column.match(/^shared\.feature-\d+-card$/) && (hypaRow[column] === 'enabled' || hypaRow[column].trim() !== '')) {
                const position = column.match(/feature-(\d+)-card/)[1];
                cardTypes.push({ cardType: 'feature', position: parseInt(position) });
            } else if (column.match(/^shared\.option-\d+-card$/) && (hypaRow[column] === 'enabled' || hypaRow[column].trim() !== '')) {
                const position = column.match(/option-(\d+)-card/)[1];
                cardTypes.push({ cardType: 'product-options', position: parseInt(position) });
            } else if (column.match(/^shared\.cargo-option-\d+-card$/) && (hypaRow[column] === 'enabled' || hypaRow[column].trim() !== '')) {
                const position = column.match(/cargo-option-(\d+)-card/)[1];
                cardTypes.push({ cardType: 'cargo-options', position: parseInt(position) });
            } else if (column.match(/^shared\.weather-option-\d+-card$/) && (hypaRow[column] === 'enabled' || hypaRow[column].trim() !== '')) {
                const position = column.match(/weather-option-(\d+)-card/)[1];
                cardTypes.push({ cardType: 'weather-protection', position: parseInt(position) });
            } else if (column === 'shared.spec-table' && (hypaRow[column] === 'enabled' || hypaRow[column].trim() !== '')) {
                cardTypes.push({ cardType: 'specification-table', position: 1 });
            }
        });
        
        return cardTypes;
    }
    
    // Step 2: Show comparison results
    function showExportComparisonResults() {
        const results = window.exportComparisonResults;
        if (!results) {
            showAnalysisToast('No comparison results available. Please run analysis first.', 'error');
            return;
        }
        
        // Update counts
        document.getElementById('exportNewCount').textContent = results.summary.new;
        document.getElementById('exportUpdateCount').textContent = results.summary.updates;
        document.getElementById('exportSkipCount').textContent = results.summary.keep;
        document.getElementById('exportConflictCount').textContent = results.summary.remove;
        
        // Add excluded count if element exists
        const excludedCountElement = document.getElementById('exportExcludedCount');
        if (excludedCountElement) {
            excludedCountElement.textContent = results.summary.excluded;
        }
        
        // Show excluded SKUs summary
        if (results.excludedSkus && results.excludedSkus.length > 0) {
            const excludedSummary = document.getElementById('excludedSkusSummary');
            if (excludedSummary) {
                const excludedList = results.excludedSkus.map(skuInfo => 
                    `${skuInfo.sku} (${skuInfo.incompleteCards.length} incomplete cards)`
                ).join(', ');
                
                excludedSummary.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>${results.excludedSkus.length} SKUs excluded from export:</strong> ${excludedList}
                        <br><small>These SKUs have incomplete cards and will not be included in the export to prevent data loss.</small>
                    </div>
                `;
            }
        }
        
        // Build comparison table
        const tableBody = document.getElementById('exportComparisonTableBody');
        tableBody.innerHTML = '';
        
        const allResults = [...results.new, ...results.updates, ...results.keep, ...results.remove];
        
        allResults.forEach(item => {
            const row = document.createElement('tr');
            
            // Determine Hypa status based on action
            let hypaStatus, hypaStatusClass;
            if (item.action === 'new') {
                hypaStatus = '✗ Hypa';
                hypaStatusClass = 'danger';
            } else if (item.action === 'update') {
                hypaStatus = '✓ Hypa (different)';
                hypaStatusClass = 'warning';
            } else if (item.action === 'keep') {
                hypaStatus = '✓ Hypa (same)';
                hypaStatusClass = 'info';
            } else if (item.action === 'remove') {
                hypaStatus = '✓ Hypa (will remove)';
                hypaStatusClass = 'danger';
            } else {
                hypaStatus = '? Hypa';
                hypaStatusClass = 'secondary';
            }
            
            row.innerHTML = `
                <td>${item.sku || 'N/A'}</td>
                <td><span class="badge bg-secondary">${getCardTypeDisplayName(item.cardType)}</span></td>
                <td><span class="badge bg-success">✓ Local</span></td>
                <td><span class="badge bg-${hypaStatusClass}">${hypaStatus}</span></td>
                <td><span class="badge bg-${getActionBadgeClass(item.action)}">${getActionText(item.action)}</span></td>
                <td><small>${item.reason}</small></td>
            `;
            tableBody.appendChild(row);
        });
        
        updateExportProgress(2, 'Comparison completed');
    }
    
    // Step 3: Show selection interface
    function showExportSelection() {
        const results = window.exportComparisonResults;
        if (!results) {
            showAnalysisToast('No comparison results available. Please run analysis first.', 'error');
            return;
        }
        
        // Store all results for filtering/sorting (including excluded cards)
        window.allExportResults = [...results.new, ...results.updates, ...results.keep, ...results.remove, ...results.excluded];
        
        // Show override options if there are excluded cards
        const overrideOptions = document.getElementById('overrideOptions');
        if (results.excluded && results.excluded.length > 0) {
            overrideOptions.style.display = 'block';
        } else {
            overrideOptions.style.display = 'none';
        }
        
        // Populate filter dropdowns
        populateExportFilterDropdowns();
        
        // Build selection table with sorting and filtering
        buildExportSelectionTable();
        
        // Attach filter event listeners
        attachExportFilterListeners();
        
        // Update summary panel
        updateExportSelectionSummary();
        
        updateExportProgress(3, 'Selection ready');
    }
    
    // Populate filter dropdowns with available values
    function populateExportFilterDropdowns() {
        const allResults = window.allExportResults || [];
        
        // Use the actual model and generation fields from card configuration
        const itemsWithModelGen = allResults.map(item => {
            const model = item.configuration?.model || '';
            const generation = item.configuration?.generation || '';
            return { ...item, model, generation };
        });
        
        // Update the allExportResults with model and generation
        window.allExportResults = itemsWithModelGen;
        
        // Get unique models and generations
        const models = [...new Set(itemsWithModelGen.map(item => item.model).filter(Boolean))].sort();
        const generations = [...new Set(itemsWithModelGen.map(item => item.generation).filter(Boolean))].sort();
        
        console.log('Available models from configuration:', models);
        console.log('Available generations from configuration:', generations);
        
        // Populate model filter
        const modelFilter = document.getElementById('modelFilter');
        if (modelFilter) {
            modelFilter.innerHTML = '<option value="">All Models</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelFilter.appendChild(option);
            });
        }
        
        // Populate generation filter
        const generationFilter = document.getElementById('generationFilter');
        if (generationFilter) {
            generationFilter.innerHTML = '<option value="">All Generations</option>';
            generations.forEach(generation => {
                const option = document.createElement('option');
                option.value = generation;
                option.textContent = generation;
                generationFilter.appendChild(option);
            });
        }
    }
    
    // Build the export selection table with current filters
    function buildExportSelectionTable() {
        const tableBody = document.getElementById('exportSelectionTableBody');
        tableBody.innerHTML = '';
        
        let filteredResults = [...window.allExportResults];
        
        // Check if user wants to include excluded cards
        const includeExcludedCards = document.getElementById('includeExcludedCards')?.checked || false;
        
        // Filter out excluded cards unless override is enabled
        if (!includeExcludedCards) {
            filteredResults = filteredResults.filter(item => item.action !== 'excluded');
        }
        
        // Apply filters
        const skuFilter = document.getElementById('skuSearchFilter')?.value?.toLowerCase() || '';
        const modelFilter = document.getElementById('modelFilter')?.value || '';
        const generationFilter = document.getElementById('generationFilter')?.value || '';
        const cardTypeFilter = document.getElementById('cardTypeFilter')?.value || '';
        const actionFilter = document.getElementById('actionFilter')?.value || '';
        
        if (skuFilter) {
            filteredResults = filteredResults.filter(item => 
                (item.sku && item.sku.toLowerCase().includes(skuFilter)) ||
                (item.title && item.title.toLowerCase().includes(skuFilter))
            );
        }
        
        if (modelFilter) {
            filteredResults = filteredResults.filter(item => item.model === modelFilter);
        }
        
        if (generationFilter) {
            filteredResults = filteredResults.filter(item => item.generation === generationFilter);
        }
        
        if (cardTypeFilter) {
            filteredResults = filteredResults.filter(item => item.cardType === cardTypeFilter);
        }
        
        if (actionFilter) {
            filteredResults = filteredResults.filter(item => item.action === actionFilter);
        }
        
        // Apply sorting
        const sortBy = document.getElementById('sortFilter')?.value || 'sku';
        filteredResults.sort((a, b) => {
            switch (sortBy) {
                case 'sku':
                    return (a.sku || '').localeCompare(b.sku || '');
                case 'sku-desc':
                    return (b.sku || '').localeCompare(a.sku || '');
                case 'model':
                    return (a.model || '').localeCompare(b.model || '');
                case 'generation':
                    return (a.generation || '').localeCompare(b.generation || '');
                case 'cardType':
                    return (a.cardType || '').localeCompare(b.cardType || '');
                case 'action':
                    return (a.action || '').localeCompare(b.action || '');
                case 'lastModified':
                    return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
            default:
                    return 0;
            }
        });
        
        // Group cards by their unique identifier (combination of cardType, title, and content)
        const uniqueCards = new Map();
        
        filteredResults.forEach(item => {
            const cardKey = `${item.cardType}_${item.title}_${item.content}`;
            if (!uniqueCards.has(cardKey)) {
                uniqueCards.set(cardKey, item);
            } else {
                // Merge SKUs if this is another instance of the same card
                const existingCard = uniqueCards.get(cardKey);
                if (item.associatedSkus) {
                    existingCard.associatedSkus = [...new Set([
                        ...(existingCard.associatedSkus || []),
                        ...(item.associatedSkus || [])
                    ])];
                }
            }
        });
        
        // Build table rows for unique cards
        Array.from(uniqueCards.values()).forEach((item, index) => {
            const originalIndex = window.allExportResults.indexOf(item);
            const row = document.createElement('tr');
            
            // Determine action display and class
            let actionDisplay = getActionText(item.action);
            let actionClass = getActionBadgeClass(item.action);
            let isChecked = true;
            let isDisabled = false;
            
            // Special handling for different action types
            if (item.action === 'remove') {
                actionDisplay = 'Remove (can override)';
                actionClass = 'warning';
                isChecked = false;
            } else if (item.action === 'excluded') {
                actionDisplay = 'Excluded (incomplete)';
                actionClass = 'secondary';
                isChecked = false;
                isDisabled = !includeExcludedCards;
            }
            
            // Calculate position based on current numbering system
            const numberingSystem = document.getElementById('cardNumberingSystem')?.value || 'sequential';
            const position = calculateCardPosition(item, Array.from(uniqueCards.values()), numberingSystem, index);
            
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="form-check-input export-checkbox" 
                           data-action="${item.action}" data-index="${originalIndex}" 
                           data-original-action="${item.action}"
                           ${isChecked ? 'checked' : ''}
                           ${isDisabled ? 'disabled' : ''}>
                </td>
                <td>
                    <span class="badge bg-primary">${position}</span>
                </td>
                <td>
                    <strong>${item.sku || 'N/A'}</strong>
                    ${item.associatedSkus ? 
                        `<br><small class="text-muted">Also: ${item.associatedSkus.filter(sku => sku !== item.sku).join(', ')}</small>` 
                        : ''}
                </td>
                <td><span class="badge bg-secondary">${getCardTypeDisplayName(item.cardType)}</span></td>
                <td>${item.title || item.sku || 'N/A'}</td>
                <td><span class="badge bg-${actionClass}">${actionDisplay}</span></td>
                <td>${item.lastModified || 'Unknown'}</td>
                <td><span class="badge bg-${item.action === 'excluded' ? 'warning' : 'success'}">${item.action === 'excluded' ? 'Incomplete' : 'Ready'}</span></td>
            `;
            tableBody.appendChild(row);
        });
        
        // Update row count display
        const totalCount = window.allExportResults.length;
        const filteredCount = filteredResults.length;
        const countDisplay = document.getElementById('exportSelectionCount');
        if (countDisplay) {
            countDisplay.textContent = `Showing ${filteredCount} of ${totalCount} cards`;
        }
        
        // Add CSS for SKU grouping if not already added
        if (!document.getElementById('sku-grouping-styles')) {
            const style = document.createElement('style');
            style.id = 'sku-grouping-styles';
            style.textContent = `
                .sku-group-start {
                    border-left: 3px solid #007bff !important;
                    background-color: #f8f9fa;
                }
                .sku-group-start small {
                    display: block;
                    margin-top: 2px;
                    font-size: 0.85em;
                    color: #6c757d;
                }
                .sku-group-continue {
                    border-left: 3px solid #dee2e6;
                    padding-left: 10px;
                }
                .sku-group-continue span {
                    color: #6c757d;
                    font-size: 0.9em;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Calculate card position based on numbering system
    function calculateCardPosition(item, allItems, numberingSystem, currentIndex) {
        switch (numberingSystem) {
            case 'sequential':
                return currentIndex + 1;
                
            case 'grouped':
                // Find position within the same SKU and card type group
                const groupKey = `${item.sku}_${item.cardType}`;
                const groupItems = allItems.filter(i => `${i.sku}_${i.cardType}` === groupKey);
                const groupIndex = groupItems.findIndex(i => i === item);
                return groupIndex + 1;
                
            case 'alphabetical':
                // Find position in alphabetical order
                const sortedByTitle = [...allItems].sort((a, b) => {
                    const titleA = (a.title || '').toLowerCase();
                    const titleB = (b.title || '').toLowerCase();
                    return titleA.localeCompare(titleB);
                });
                const alphaIndex = sortedByTitle.findIndex(i => i === item);
                return alphaIndex + 1;
                
            case 'creation-date':
                // Find position by creation date (oldest first)
                const sortedByCreation = [...allItems].sort((a, b) => {
                    const dateA = new Date(a.createdDate || 0);
                    const dateB = new Date(b.createdDate || 0);
                    return dateA - dateB;
                });
                const creationIndex = sortedByCreation.findIndex(i => i === item);
                return creationIndex + 1;
                
            case 'last-modified':
                // Find position by last modified date (newest first)
                const sortedByModified = [...allItems].sort((a, b) => {
                    const dateA = new Date(a.lastModified || 0);
                    const dateB = new Date(b.lastModified || 0);
                    return dateB - dateA;
                });
                const modifiedIndex = sortedByModified.findIndex(i => i === item);
                return modifiedIndex + 1;
                
            case 'price':
                // Find position by price (lowest first)
                const sortedByPrice = [...allItems].sort((a, b) => {
                    const priceA = parseFloat(a.price || 0);
                    const priceB = parseFloat(b.price || 0);
                    return priceA - priceB;
                });
                const priceIndex = sortedByPrice.findIndex(i => i === item);
                return priceIndex + 1;
                
            default:
                return currentIndex + 1;
        }
    }

    // Attach event listeners for filtering and sorting
    function attachExportFilterListeners() {
        const filters = ['skuSearchFilter', 'modelFilter', 'generationFilter', 'cardTypeFilter', 'actionFilter', 'sortFilter', 'cardNumberingSystem'];
        
        filters.forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', buildExportSelectionTable);
                if (filterId === 'skuSearchFilter') {
                    element.addEventListener('input', buildExportSelectionTable);
                }
            }
        });
        
        // Select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.export-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
                updateExportSelectionSummary();
            });
        }
        
        // Individual checkboxes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('export-checkbox')) {
                updateExportSelectionSummary();
                }
            });
        }
        
    // Clear all export filters
    function clearExportFilters() {
        document.getElementById('skuSearchFilter').value = '';
        document.getElementById('modelFilter').value = '';
        document.getElementById('generationFilter').value = '';
        document.getElementById('cardTypeFilter').value = '';
        document.getElementById('actionFilter').value = '';
        document.getElementById('sortFilter').value = 'sku';
        document.getElementById('cardNumberingSystem').value = 'sequential';
        buildExportSelectionTable();
    }
    
    // Step 4: Final export
    function performFinalExport() {
        const results = window.exportComparisonResults;
        if (!results) {
            showAnalysisToast('No comparison results available. Please run analysis first.', 'error');
            return;
        }
        
        // Get selected items
        const selectedCheckboxes = document.querySelectorAll('.export-checkbox:checked');
        const selectedItems = [];
        
        selectedCheckboxes.forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            const originalAction = checkbox.dataset.originalAction;
            const allResults = [...results.new, ...results.updates, ...results.keep, ...results.remove];
            if (allResults[index]) {
                const item = { ...allResults[index] };
                
                // If this was originally a "remove" item but is now checked, treat it as "force export"
                if (originalAction === 'remove') {
                    item.action = 'force-export';
                    item.reason = 'User override: Force export despite removal recommendation';
                }
                
                selectedItems.push(item);
            }
        });
        
        // Update final counts
        const finalCounts = {
            new: selectedItems.filter(item => item.action === 'new').length,
            updates: selectedItems.filter(item => item.action === 'update').length,
            forceExport: selectedItems.filter(item => item.action === 'force-export').length,
            total: selectedItems.length
        };
        
        document.getElementById('finalExportNewCount').textContent = finalCounts.new;
        document.getElementById('finalExportUpdateCount').textContent = finalCounts.updates;
        document.getElementById('finalExportConflictCount').textContent = finalCounts.forceExport;
        document.getElementById('finalExportTotalCount').textContent = finalCounts.total;
        
        // Store selected items for export
        window.selectedExportItems = selectedItems;
        
        updateExportProgress(4, 'Ready to export');
    }
    
    // Helper functions
    function updateExportProgress(step, description) {
        const progress = (step / 4) * 100;
        document.getElementById('exportProgress').style.width = `${progress}%`;
        
        // Update step badges
        for (let i = 1; i <= 4; i++) {
            const badge = document.getElementById(`exportStep${i}Badge`);
            if (badge) {
                if (i < step) {
                    badge.className = 'badge bg-success';
                } else if (i === step) {
                    badge.className = 'badge bg-warning';
                } else {
                    badge.className = 'badge bg-secondary';
                }
            }
        }
    }
    
    function showExportStep(step) {
        // Hide all steps
        document.getElementById('exportAnalysisStep').style.display = 'none';
        document.getElementById('exportComparisonStep').style.display = 'none';
        document.getElementById('exportSelectionStep').style.display = 'none';
        document.getElementById('exportFinalStep').style.display = 'none';
        
        // Show current step
        switch (step) {
            case 1:
                document.getElementById('exportAnalysisStep').style.display = 'block';
                break;
            case 2:
                document.getElementById('exportComparisonStep').style.display = 'block';
                showExportComparisonResults();
                break;
            case 3:
                document.getElementById('exportSelectionStep').style.display = 'block';
                showExportSelection();
                break;
            case 4:
                document.getElementById('exportFinalStep').style.display = 'block';
                performFinalExport();
                break;
        }
    }
    
    function getActionBadgeClass(action) {
        switch (action) {
            case 'new': return 'success';
            case 'update': return 'warning';
            case 'keep': return 'info';
            case 'remove': return 'danger';
            case 'excluded': return 'secondary';
            default: return 'secondary';
        }
    }
    
    function getActionText(action) {
        switch (action) {
            case 'new': return 'Add';
            case 'update': return 'Update';
            case 'keep': return 'Keep';
            case 'remove': return 'Remove';
            case 'excluded': return 'Excluded';
            default: return action;
        }
    }
    
    function updateExportSelectionSummary() {
        const checkboxes = document.querySelectorAll('.export-checkbox');
        const summary = {
            new: 0,
            updates: 0,
            keep: 0,
            remove: 0,
            forceExport: 0,
            excluded: 0
        };
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const originalAction = checkbox.dataset.originalAction;
                const action = checkbox.dataset.action;
                
                if (originalAction === 'remove') {
                    summary.forceExport++;
                } else if (originalAction === 'excluded') {
                    summary.excluded++;
                } else {
                    summary[action]++;
                }
            }
        });
        
        const summaryPanel = document.getElementById('exportSelectionSummaryPanel');
        const total = summary.new + summary.updates + summary.keep + summary.forceExport + summary.excluded;
        
        let summaryText = `${summary.new} new, ${summary.updates} updates, ${summary.keep} keep`;
        if (summary.forceExport > 0) {
            summaryText += `, ${summary.forceExport} force export`;
        }
        if (summary.excluded > 0) {
            summaryText += `, ${summary.excluded} excluded (incomplete)`;
        }
        
        summaryPanel.innerHTML = `
            <div class="alert alert-info">
                <strong>Selected for export:</strong> 
                ${summaryText} (${total} total)
</div>
        `;
    }
    
    // Event listeners for export workflow
    function attachExportEventListeners() {
        // Step 1: Start Analysis
        const startAnalysisBtn = document.getElementById('startAnalysisBtn');
        if (startAnalysisBtn) {
            startAnalysisBtn.addEventListener('click', async () => {
                await startExportAnalysis();
            });
        }
        
        // Step 2: Continue to Selection
        const continueToSelectionBtn = document.getElementById('continueToSelectionBtn');
        if (continueToSelectionBtn) {
            continueToSelectionBtn.addEventListener('click', () => showExportStep(3));
        }
        
        // Step 3: Continue to Export
        const continueToExportBtn = document.getElementById('continueToExportBtn');
        if (continueToExportBtn) {
            continueToExportBtn.addEventListener('click', () => showExportStep(4));
        }
        
        // Back buttons
        const backToAnalysisBtn = document.getElementById('backToAnalysisBtn');
        if (backToAnalysisBtn) {
            backToAnalysisBtn.addEventListener('click', () => showExportStep(1));
        }
        
        const backToComparisonBtn = document.getElementById('backToComparisonBtn');
        if (backToComparisonBtn) {
            backToComparisonBtn.addEventListener('click', () => showExportStep(2));
        }
        
        const backToSelectionBtn = document.getElementById('backToSelectionBtn');
        if (backToSelectionBtn) {
            backToSelectionBtn.addEventListener('click', () => showExportStep(3));
        }
        
        // Selection checkboxes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('export-checkbox')) {
                updateExportSelectionSummary();
            }
        });
        
        // Select all checkboxes
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.export-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
                updateExportSelectionSummary();
            });
        }
        
        // Category select all checkboxes
        ['selectAllAdd', 'selectAllUpdates', 'selectAllKeep', 'selectAllRemove'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    const action = id.replace('selectAll', '').toLowerCase();
                    const checkboxes = document.querySelectorAll(`.export-checkbox[data-action="${action}"]`);
                    checkboxes.forEach(cb => {
                        cb.checked = e.target.checked;
                    });
                    updateExportSelectionSummary();
                });
            }
        });
        
        // Override checkbox for excluded cards
        const includeExcludedCards = document.getElementById('includeExcludedCards');
        if (includeExcludedCards) {
            includeExcludedCards.addEventListener('change', () => {
                buildExportSelectionTable();
                updateExportSelectionSummary();
            });
        }
        
        // Final export button
        const confirmExportBtn = document.getElementById('confirmExportBtn');
        if (confirmExportBtn) {
            confirmExportBtn.addEventListener('click', () => {
                // Use the existing export function but with selected items
                exportToHypaFormat();
            });
        }
    }
    
    // Call this when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        attachExportEventListeners();
    });

    // Attach event listener when the Export to Hypa modal is shown
    if (exportHypaModal) {
        exportHypaModal.addEventListener('shown.bs.modal', function () {
            console.log('Export to Hypa modal shown, attaching export event listeners');
            setTimeout(() => {
                attachExportEventListeners();
            }, 100);
        });
    }
}); 
