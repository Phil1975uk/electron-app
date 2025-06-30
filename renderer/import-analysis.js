// Import Analysis Dashboard
window.addEventListener('load', () => {
    // Data storage
    let configurations = [];
    let cards = [];
    let analysisData = [];
    let originalHypaCsvData = null; // Store original Hypa CSV for perfect round-trip
    let originalHypaCsvHeaders = null; // Store original column headers
    
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
        // if (importHypaBtn) {
        //     importHypaBtn.addEventListener('click', importHypaData);
        // }

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

            // Load cards data - try localStorage first for mobile compatibility
            let cardsData = null;
            
            // Try localStorage first
            const localStorageCards = localStorage.getItem('cards');
            if (localStorageCards) {
                try {
                    cardsData = JSON.parse(localStorageCards);
                    console.log('Loaded cards from localStorage:', cardsData.length);
                } catch (error) {
                    console.error('Error parsing localStorage cards:', error);
                }
            }
            
            // If no localStorage data, try server
            if (!cardsData) {
                const cardsResponse = await fetch('/api/cards');
                if (cardsResponse.ok) {
                    cardsData = await cardsResponse.json();
                    console.log('Loaded cards from server:', cardsData.length);
                    // Save to localStorage for future mobile access
                    localStorage.setItem('cards', JSON.stringify(cardsData));
                } else {
                    console.log('No cards found on server, starting with empty array');
                    cardsData = [];
                }
            }

            // Ensure both are arrays
            if (!Array.isArray(configurations)) {
                configurations = [];
            }
            if (!Array.isArray(cardsData)) {
                cardsData = [];
            }
            
            cards = cardsData;

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
                        if (card.hypaUpdated) {
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

        // Update overview cards
        document.getElementById('totalConfigs').textContent = totalConfigs;
        document.getElementById('totalCards').textContent = totalCards;
        document.getElementById('totalImages').textContent = totalImages;
        document.getElementById('totalHypa').textContent = totalHypa;

        // Update progress bars
        const cardsProgress = totalConfigs > 0 ? (totalCards / totalConfigs) * 100 : 0;
        const imagesProgress = totalConfigs > 0 ? (totalImages / totalConfigs) * 100 : 0;
        const hypaProgress = totalConfigs > 0 ? (totalHypa / totalConfigs) * 100 : 0;
        const completeProgress = totalConfigs > 0 ? (analysisData.filter(item => item.overallStatus === 'complete').length / totalConfigs) * 100 : 0;

        document.getElementById('cardsProgress').style.width = cardsProgress + '%';
        document.getElementById('imagesProgress').style.width = imagesProgress + '%';
        document.getElementById('hypaProgress').style.width = hypaProgress + '%';
        document.getElementById('completeProgress').style.width = completeProgress + '%';

        document.getElementById('cardsProgressText').textContent = `${totalCards} of ${totalConfigs} configurations have cards`;
        document.getElementById('imagesProgressText').textContent = `${totalImages} of ${totalConfigs} configurations have images`;
        document.getElementById('hypaProgressText').textContent = `${totalHypa} of ${totalConfigs} configurations have Hypa metafields`;
        document.getElementById('completeProgressText').textContent = `${analysisData.filter(item => item.overallStatus === 'complete').length} of ${totalConfigs} configurations are complete`;
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
                    id: Date.now() + Math.random(),
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
        const file = event.target.files[0];
        console.log('File input event triggered:', event);
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
    }

    function showHypaFilePreview(file) {
        console.log('showHypaFilePreview called with file:', file.name);
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('File read successfully, parsing CSV...');
            try {
                console.log('Papa Parse available:', typeof Papa !== 'undefined');
                if (typeof Papa === 'undefined') {
                    console.error('Papa Parse is not loaded!');
                    showAnalysisToast('CSV parsing library not loaded. Please refresh the page.', 'error');
                    return;
                }
                const csvData = Papa.parse(e.target.result, { header: true });
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
                
                // Store the original CSV data for perfect round-trip export
                originalHypaCsvData = csvData.data;
                originalHypaCsvHeaders = csvData.meta.fields;
                console.log('Original Hypa CSV data stored for round-trip export');
                console.log('Original headers:', originalHypaCsvHeaders);
                console.log('Original data rows:', originalHypaCsvData.length);
                
                // Store the parsed data for later use
                window.hypaCsvData = csvData.data;
                console.log('CSV data stored in window.hypaCsvData');
                console.log('Data length:', csvData.data.length);
                console.log('First row sample:', csvData.data[0]);
                
                // Show validation results
                console.log('Calling showHypaValidationResults...');
                showHypaValidationResults(csvData.data);
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

    function showHypaValidationResults(data) {
        console.log('showHypaValidationResults called with data:', data);
        const modalBody = document.querySelector('#importHypaModal .modal-body');
        console.log('Modal body found:', modalBody);
        
        // Validate Hypa data structure
        const validation = validateHypaData(data);
        console.log('Validation results:', validation);
        
        // Check which SKUs exist in local configurations
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
        
        const missingSkus = [];
        const existingSkusInData = [];
        
        data.forEach(row => {
            if (row.sku && row.sku.trim()) {
                const trimmedSku = row.sku.trim();
                if (existingSkus.has(trimmedSku)) {
                    existingSkusInData.push(trimmedSku);
                } else {
                    missingSkus.push(trimmedSku);
                }
            }
        });
        
        const uniqueMissingSkus = [...new Set(missingSkus)];
        const uniqueExistingSkus = [...new Set(existingSkusInData)];
        
        modalBody.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Hypa CSV Validation:</strong> Analyzing the structure and content of your Hypa export file.
            </div>
            
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card border-primary">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="fas fa-file-csv me-2"></i>File Analysis</h6>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between mb-2">
                                <span>Total Rows:</span>
                                <span class="badge bg-primary">${data.length}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Valid Products:</span>
                                <span class="badge bg-success">${validation.validCards}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Invalid Rows:</span>
                                <span class="badge bg-warning">${validation.invalidRows}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Missing SKUs:</span>
                                <span class="badge bg-danger">${validation.missingSkus}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card border-info">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0"><i class="fas fa-columns me-2"></i>Detected Card Types</h6>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between mb-1">
                                <span>Feature Cards:</span>
                                <span class="badge bg-info">${validation.cardTypes.feature}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>Option Cards:</span>
                                <span class="badge bg-info">${validation.cardTypes.option}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>Cargo Cards:</span>
                                <span class="badge bg-info">${validation.cardTypes.cargo}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>Weather Cards:</span>
                                <span class="badge bg-info">${validation.cardTypes.weather}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>Spec Tables:</span>
                                <span class="badge bg-info">${validation.cardTypes.specTable}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card border-success">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0"><i class="fas fa-check-circle me-2"></i>Products Ready for Import</h6>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between mb-2">
                                <span>Found in Local Configs:</span>
                                <span class="badge bg-success">${uniqueExistingSkus.length}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Cards Available:</span>
                                <span class="badge bg-success">${validation.validCards}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Status:</span>
                                <span class="badge bg-success">Ready to Import</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card border-warning">
                        <div class="card-header bg-warning text-dark">
                            <h6 class="mb-0"><i class="fas fa-exclamation-triangle me-2"></i>Products Not Found</h6>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between mb-2">
                                <span>Missing from Configs:</span>
                                <span class="badge bg-warning">${uniqueMissingSkus.length}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Action Required:</span>
                                <span class="badge bg-warning">Import from BigCommerce</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span>Status:</span>
                                <span class="badge bg-warning">Will be Skipped</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${uniqueMissingSkus.length > 0 ? `
            <div class="alert alert-warning">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Missing Product Configurations</h6>
                <p class="mb-2">Found ${uniqueMissingSkus.length} products in the Hypa export that don't exist in your local configurations:</p>
                <div class="mb-2">
                    <small class="text-muted">
                        ${uniqueMissingSkus.slice(0, 10).join(', ')}${uniqueMissingSkus.length > 10 ? ` and ${uniqueMissingSkus.length - 10} more...` : ''}
                    </small>
                </div>
                <p class="mb-0"><strong>To import cards for these products:</strong></p>
                <ol class="mb-0">
                    <li>Import the products from BigCommerce first, OR</li>
                    <li>Create configurations for these SKUs manually</li>
                </ol>
            </div>
            ` : ''}
            
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Import Summary:</strong> Only cards for products that exist in your local configurations will be imported. 
                ${uniqueMissingSkus.length > 0 ? `Cards for ${uniqueMissingSkus.length} missing products will be skipped.` : 'All products are ready for import.'}
            </div>
            <div class="mt-4">
                <h6><i class="fas fa-list me-2"></i>SKU Match Table</h6>
                <div class="table-responsive" style="max-height: 300px;">
                    <table class="table table-sm table-bordered table-striped">
                        <thead class="table-light">
                            <tr>
                                <th>SKU</th>
                                <th>In Hypa Import</th>
                                <th>In Configs</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="skuMatchTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;

        // Add filter checkbox above the table
        modalBody.innerHTML += `
            <div class="d-flex align-items-center mb-2">
                <input type="checkbox" id="showMatchedOnly" class="form-check-input me-2" checked>
                <label for="showMatchedOnly" class="form-label mb-0">Show Matched Only</label>
            </div>
        `;
        // ... existing code for table header ...
        modalBody.innerHTML += `
            <div class="table-responsive" style="max-height: 300px;">
                <table class="table table-sm table-bordered table-striped" id="skuMatchTable">
                    <thead class="table-light">
                        <tr>
                            <th></th>
                            <th>SKU</th>
                            <th>In Hypa Import</th>
                            <th>In Configs</th>
                            <th>Model</th>
                            <th>Generation</th>
                            <th>Variant Name</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="skuMatchTableBody"></tbody>
                </table>
            </div>
        `;

        // Build SKU match data
        const hypaSkus = new Set(data.map(row => row.sku && row.sku.trim()).filter(Boolean));
        const configSkus = new Set();
        const skuToConfigInfo = {};
        if (configurations && configurations.length > 0) {
            configurations.forEach(config => {
                if (config.variants && Array.isArray(config.variants)) {
                    config.variants.forEach(variant => {
                        if (variant.sku) {
                            const trimmedSku = variant.sku.trim();
                            configSkus.add(trimmedSku);
                            skuToConfigInfo[trimmedSku] = {
                                model: config.model,
                                generation: config.generation,
                                variantName: variant.name || '',
                            };
                        }
                    });
                }
            });
        }
        const allSkus = new Set([...hypaSkus, ...configSkus]);
        // Build card details for each SKU from hypaCsvData
        const skuToCards = {};
        data.forEach(row => {
            const sku = row.sku && row.sku.trim();
            if (!sku) return;
            if (!skuToCards[sku]) skuToCards[sku] = [];
            // Extract card types and titles
            const columns = Object.keys(row);
            // Feature cards
            columns.forEach(col => {
                if (/^shared\.feature-\d+-card$/.test(col) && row[col] && row[col].trim()) {
                    const pos = col.match(/feature-(\d+)-card/)[1];
                    const title = row[`features.feature_${pos}_title`] || '(No Title)';
                    skuToCards[sku].push({ type: 'Feature', title: title.trim() });
                }
                if (/^shared\.option-\d+-card$/.test(col) && row[col] && row[col].trim()) {
                    const pos = col.match(/option-(\d+)-card/)[1];
                    const title = row[`options.option_${pos}_title`] || '(No Title)';
                    skuToCards[sku].push({ type: 'Option', title: title.trim() });
                }
                if (/^shared\.cargo-option-\d+-card$/.test(col) && row[col] && row[col].trim()) {
                    const pos = col.match(/cargo-option-(\d+)-card/)[1];
                    const title = row[`cargo.cargo_${pos}_title`] || '(No Title)';
                    skuToCards[sku].push({ type: 'Cargo', title: title.trim() });
                }
                if (/^shared\.weather-option-\d+-card$/.test(col) && row[col] && row[col].trim()) {
                    const pos = col.match(/weather-option-(\d+)-card/)[1];
                    const title = row[`weather.weather_${pos}_title`] || '(No Title)';
                    skuToCards[sku].push({ type: 'Weather', title: title.trim() });
                }
                if (/^shared\.spec-table$/.test(col) && row[col] && row[col].trim()) {
                    skuToCards[sku].push({ type: 'Spec Table', title: 'Specification Table' });
                }
            });
        });
        // Render table rows with expand/collapse
        function renderSkuTableRows(showMatchedOnly) {
            const tableRows = [];
            allSkus.forEach(sku => {
                const inHypa = hypaSkus.has(sku);
                const inConfig = configSkus.has(sku);
                let status = '';
                if (inHypa && inConfig) status = 'Matched';
                else if (inHypa) status = 'Only in Hypa';
                else status = 'Only in Configs';
                if (showMatchedOnly && status !== 'Matched') return;
                const configInfo = skuToConfigInfo[sku] || {};
                const cardList = skuToCards[sku] || [];
                const rowId = `skuRow_${sku.replace(/[^a-zA-Z0-9]/g, '')}`;
                const expandId = `expand_${sku.replace(/[^a-zA-Z0-9]/g, '')}`;
                tableRows.push(`
                    <tr>
                        <td style="width:32px"><button class="btn btn-sm btn-link p-0" data-bs-toggle="collapse" data-bs-target="#${expandId}" aria-expanded="false" aria-controls="${expandId}">▶</button></td>
                        <td>${sku}</td>
                        <td>${inHypa ? '✅' : ''}</td>
                        <td>${inConfig ? '✅' : ''}</td>
                        <td>${configInfo.model || ''}</td>
                        <td>${configInfo.generation || ''}</td>
                        <td>${configInfo.variantName || ''}</td>
                        <td>${status}</td>
                    </tr>
                    <tr class="collapse" id="${expandId}">
                        <td colspan="8">
                            <div><strong>Imported Cards:</strong></div>
                            ${cardList.length === 0 ? '<span class="text-muted">No cards imported for this SKU.</span>' :
                                `<ul class="mb-0">${cardList.map(card => `<li><span class="badge bg-secondary me-2">${card.type}</span> ${card.title}</li>`).join('')}</ul>`}
                        </td>
                    </tr>
                `);
            });
            document.getElementById('skuMatchTableBody').innerHTML = tableRows.join('');
        }
        // Initial render (matched only)
        renderSkuTableRows(true);
        // Add filter event
        document.getElementById('showMatchedOnly').addEventListener('change', function() {
            renderSkuTableRows(this.checked);
        });
    }

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
            // Card type flags
            featureCards: /^shared\.feature-\d+-card$/,
            optionCards: /^shared\.option-\d+-card$/,
            cargoCards: /^shared\.cargo-option-\d+-card$/,
            weatherCards: /^shared\.weather-option-\d+-card$/,
            specTable: /^shared\.spec-table$/,
            // Content fields
            featureContent: /^features\.feature_\d+_(title|subtitle|description|image)$/,
            optionContent: /^options\.option_\d+_(title|description|image|price)$/,
            cargoContent: /^cargo\.cargo_\d+_(title|description|image|price)$/,
            weatherContent: /^weather\.weather_\d+_(title|description|image|price)$/
        };

        // Analyze field detection
        if (data.length > 0) {
            const firstRow = data[0];
            const columns = Object.keys(firstRow);
            
            // Count detected field types
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

            // Check for basic required fields
            validation.detectedFields.sku = firstRow.hasOwnProperty('sku') ? 100 : 0;
            validation.detectedFields.productId = firstRow.hasOwnProperty('id') ? 100 : 0;
        }

        // Validate each row
        data.forEach((row, index) => {
            const rowNum = index + 1;
            let isValid = true;
            let hasSku = false;
            let hasCards = false;

            // Check for SKU
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

            // Check for any enabled cards
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

    function confirmHypaImport() {
        console.log('=== confirmHypaImport function called ===');
        console.log('window.hypaCsvData:', window.hypaCsvData);
        const data = window.hypaCsvData;
        console.log('Hypa CSV data:', data);
        if (!data || data.length === 0) {
            console.error('No data available for import');
            showAnalysisToast('No data available for import.', 'error');
            return;
        }

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

        data.forEach(row => {
            const sku = row.sku;
            if (!sku || !sku.trim()) {
                skippedCount++;
                return;
            }

            const trimmedSku = sku.trim();
            
            // Only process cards for products that exist in local configurations
            if (!existingSkus.has(trimmedSku)) {
                console.log(`Skipping SKU ${trimmedSku} - not found in local configurations`);
                notFoundCount++;
                missingSkus.push(trimmedSku);
                return;
            }

            // Extract enabled cards from this row
            const cardsFromRow = extractCardsFromHypaRow(row);
            
            if (cardsFromRow.length > 0) {
                importedCards.push(...cardsFromRow);
                importedCount += cardsFromRow.length;
            } else {
                skippedCount++;
            }
        });

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

        // Add to existing cards (avoid duplicates by SKU + card type + position)
        const existingCardKeys = new Set(cards.map(card => `${card.sku}-${card.cardType}-${card.position || 1}`));
        const newCards = importedCards.filter(card => {
            const cardKey = `${card.sku}-${card.cardType}-${card.position || 1}`;
            return !existingCardKeys.has(cardKey);
        });
        
        cards.push(...newCards);
        
        // Save to file-based storage
        saveCardsToFile();
        
        let message = `Hypa import completed! ${newCards.length} new cards imported for existing products, ${importedCards.length - newCards.length} duplicates skipped.`;
        
        if (missingSkus.length > 0) {
            message += `\n\n${missingSkus.length} products skipped (not found in local configurations).`;
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
        console.log('extractCardsFromHypaRow called for SKU:', row.sku);
        const cards = [];
        const columns = Object.keys(row);
        
        console.log('Available columns:', columns);
        
        // Extract feature cards
        const featureCards = extractFeatureCards(row, columns);
        cards.push(...featureCards);
        
        // Extract option cards
        const optionCards = extractOptionCards(row, columns);
        cards.push(...optionCards);
        
        // Extract cargo cards
        const cargoCards = extractCargoCards(row, columns);
        cards.push(...cargoCards);
        
        // Extract weather cards
        const weatherCards = extractWeatherCards(row, columns);
        cards.push(...weatherCards);
        
        // Extract spec table
        const specTable = extractSpecTable(row, columns);
        if (specTable) {
            cards.push(specTable);
        }
        
        console.log(`Total cards extracted for SKU ${row.sku}:`, cards.length);
        console.log('Card types:', cards.map(c => c.cardType));
        
        return cards;
    }

    function extractFeatureCards(row, columns) {
        console.log('extractFeatureCards called with columns:', columns);
        console.log('Row data:', row);
        
        const cards = [];
        
        // Find enabled feature cards
        const enabledFeatures = columns.filter(col => 
            /^shared\.feature-\d+-card$/.test(col) && row[col] && row[col].trim()
        );
        
        console.log('Enabled feature cards:', enabledFeatures);
        
        enabledFeatures.forEach(featureFlag => {
            const position = featureFlag.match(/feature-(\d+)-card/)[1];
            console.log(`Processing feature position ${position}`);
            
            // Extract content for this feature
            const title = row[`features.feature_${position}_title`] || '';
            const subtitle = row[`features.feature_${position}_subtitle`] || '';
            const description = row[`features.feature_${position}_description`] || '';
            const imageUrl = row[`features.feature_${position}_image`] || '';
            
            console.log(`Feature ${position} content:`, { title, subtitle, description, imageUrl });
            
            if (title || description) {
                cards.push({
                    id: Date.now() + Math.random(),
                    sku: row.sku.trim(),
                    cardType: 'feature',
                    position: parseInt(position),
                    title: title.trim(),
                    subtitle: subtitle.trim(),
                    content: description.trim(),
                    imageUrl: imageUrl.trim(),
                    hypaUpdated: true,
                    importedFromHypa: true,
                    lastModified: new Date().toISOString(),
                    originalHypaData: {
                        productId: row.id,
                        featureFlag: featureFlag
                    }
                });
            }
        });
        
        console.log(`Extracted ${cards.length} feature cards`);
        return cards;
    }

    function extractOptionCards(row, columns) {
        const cards = [];
        
        // Find enabled option cards
        const enabledOptions = columns.filter(col => 
            /^shared\.option-\d+-card$/.test(col) && row[col] && row[col].trim()
        );
        
        enabledOptions.forEach(optionFlag => {
            const position = optionFlag.match(/option-(\d+)-card/)[1];
            
            // Extract content for this option
            const title = row[`options.option_${position}_title`] || '';
            const description = row[`options.option_${position}_description`] || '';
            const imageUrl = row[`options.option_${position}_image`] || '';
            const price = row[`options.option_${position}_price`] || '';
            
            if (title || description) {
                cards.push({
                    id: Date.now() + Math.random(),
                    sku: row.sku.trim(),
                    cardType: 'product-options',
                    position: parseInt(position),
                    title: title.trim(),
                    content: description.trim(),
                    imageUrl: imageUrl.trim(),
                    price: price.trim(),
                    hypaUpdated: true,
                    importedFromHypa: true,
                    lastModified: new Date().toISOString(),
                    originalHypaData: {
                        productId: row.id,
                        optionFlag: optionFlag
                    }
                });
            }
        });
        
        return cards;
    }

    function extractCargoCards(row, columns) {
        const cards = [];
        
        // Find enabled cargo cards
        const enabledCargo = columns.filter(col => 
            /^shared\.cargo-option-\d+-card$/.test(col) && row[col] && row[col].trim()
        );
        
        enabledCargo.forEach(cargoFlag => {
            const position = cargoFlag.match(/cargo-option-(\d+)-card/)[1];
            
            // Extract content for this cargo option
            const title = row[`cargo.cargo_${position}_title`] || '';
            const description = row[`cargo.cargo_${position}_description`] || '';
            const imageUrl = row[`cargo.cargo_${position}_image`] || '';
            const price = row[`cargo.cargo_${position}_price`] || '';
            
            if (title || description) {
                cards.push({
                    id: Date.now() + Math.random(),
                    sku: row.sku.trim(),
                    cardType: 'cargo-options',
                    position: parseInt(position),
                    title: title.trim(),
                    content: description.trim(),
                    imageUrl: imageUrl.trim(),
                    price: price.trim(),
                    hypaUpdated: true,
                    importedFromHypa: true,
                    lastModified: new Date().toISOString(),
                    originalHypaData: {
                        productId: row.id,
                        cargoFlag: cargoFlag
                    }
                });
            }
        });
        
        return cards;
    }

    function extractWeatherCards(row, columns) {
        const cards = [];
        
        // Find enabled weather cards
        const enabledWeather = columns.filter(col => 
            /^shared\.weather-option-\d+-card$/.test(col) && row[col] && row[col].trim()
        );
        
        enabledWeather.forEach(weatherFlag => {
            const position = weatherFlag.match(/weather-option-(\d+)-card/)[1];
            
            // Extract content for this weather option
            const title = row[`weather.weather_${position}_title`] || '';
            const description = row[`weather.weather_${position}_description`] || '';
            const imageUrl = row[`weather.weather_${position}_image`] || '';
            const price = row[`weather.weather_${position}_price`] || '';
            
            if (title || description) {
                cards.push({
                    id: Date.now() + Math.random(),
                    sku: row.sku.trim(),
                    cardType: 'weather-protection',
                    position: parseInt(position),
                    title: title.trim(),
                    content: description.trim(),
                    imageUrl: imageUrl.trim(),
                    price: price.trim(),
                    hypaUpdated: true,
                    importedFromHypa: true,
                    lastModified: new Date().toISOString(),
                    originalHypaData: {
                        productId: row.id,
                        weatherFlag: weatherFlag
                    }
                });
            }
        });
        
        return cards;
    }

    function extractSpecTable(row, columns) {
        console.log('extractSpecTable called with columns:', columns);
        console.log('Row data:', row);
        
        // Check if spec table is enabled
        const specTableEnabled = columns.find(col => 
            /^shared\.spec-table$/.test(col) && row[col] && row[col].trim()
        );
        
        if (specTableEnabled) {
            // Look for spec table content in dedicated columns
            const specTableContent = row['specifications.spec_table_content'] || 
                                   row['specifications.content'] || 
                                   row['spec_table.content'] ||
                                   row['specifications'] ||
                                   '';
            
            // If no dedicated content column, try to find any content in the row
            let content = specTableContent;
            if (!content || !content.trim()) {
                // Look for any column that might contain spec table data
                const specColumns = columns.filter(col => 
                    col.includes('spec') || col.includes('table') || col.includes('specification')
                );
                
                for (const col of specColumns) {
                    if (row[col] && row[col].trim() && col !== specTableEnabled) {
                        content = row[col];
                        break;
                    }
                }
            }
            
            // If still no content, use a placeholder
            if (!content || !content.trim()) {
                content = 'Specification table content not found in import data.';
            }
            
            // Generate a meaningful title from SKU or product info
            const title = row['product_name'] || 
                         row['name'] || 
                         row['title'] || 
                         `Specifications for ${row.sku}`;
            
            return {
                id: Date.now() + Math.random(),
                sku: row.sku.trim(),
                cardType: 'specification-table',
                title: title.trim(),
                content: content.trim(),
                hypaUpdated: true,
                importedFromHypa: true,
                lastModified: new Date().toISOString(),
                originalHypaData: {
                    productId: row.id,
                    specTableFlag: specTableEnabled,
                    originalContent: content
                }
            };
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
    function testHypaFlow() {
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
        showHypaValidationResults(testData);
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

    // Make it available globally for testing
    window.testHypaFlow = testHypaFlow;
    window.exportCardsToFile = exportCardsToFile;
    window.importCardsFromFile = importCardsFromFile;

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
            id: Date.now() + Math.random(),
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
                id: Date.now() + Math.random() + migratedCount,
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
    function exportToHypaFormat() {
        if (!originalHypaCsvData || !originalHypaCsvHeaders) {
            showAnalysisToast('No original Hypa CSV data found. Please import from Hypa first.', 'error');
            return;
        }

        console.log('Exporting to Hypa format with original structure preservation');
        console.log('Original headers:', originalHypaCsvHeaders);
        console.log('Original data rows:', originalHypaCsvData.length);

        // Create a copy of the original data to modify
        const exportData = originalHypaCsvData.map(row => ({ ...row }));

        // Map our local cards back to the original CSV structure
        cards.forEach(card => {
            // Find the corresponding row in the original data
            const rowIndex = exportData.findIndex(row => row.sku === card.sku);
            if (rowIndex === -1) {
                console.log(`Card for SKU ${card.sku} not found in original data, skipping`);
                return;
            }

            const row = exportData[rowIndex];
            console.log(`Updating row for SKU ${card.sku}, card type: ${card.cardType}`);

            // Update the appropriate columns based on card type
            switch (card.cardType) {
                case 'feature':
                    if (card.position) {
                        // Update feature card flag
                        const featureFlag = `shared.feature-${card.position}-card`;
                        if (originalHypaCsvHeaders.includes(featureFlag)) {
                            row[featureFlag] = 'enabled';
                        }
                        
                        // Update feature content
                        if (card.title && originalHypaCsvHeaders.includes(`features.feature_${card.position}_title`)) {
                            row[`features.feature_${card.position}_title`] = card.title;
                        }
                        if (card.content && originalHypaCsvHeaders.includes(`features.feature_${card.position}_description`)) {
                            row[`features.feature_${card.position}_description`] = card.content;
                        }
                        if (card.imageUrl && originalHypaCsvHeaders.includes(`features.feature_${card.position}_image`)) {
                            row[`features.feature_${card.position}_image`] = card.imageUrl;
                        }
                    }
                    break;

                case 'product-options':
                    if (card.position) {
                        // Update option card flag
                        const optionFlag = `shared.option-${card.position}-card`;
                        if (originalHypaCsvHeaders.includes(optionFlag)) {
                            row[optionFlag] = 'enabled';
                        }
                        
                        // Update option content
                        if (card.title && originalHypaCsvHeaders.includes(`options.option_${card.position}_title`)) {
                            row[`options.option_${card.position}_title`] = card.title;
                        }
                        if (card.content && originalHypaCsvHeaders.includes(`options.option_${card.position}_description`)) {
                            row[`options.option_${card.position}_description`] = card.content;
                        }
                        if (card.imageUrl && originalHypaCsvHeaders.includes(`options.option_${card.position}_image`)) {
                            row[`options.option_${card.position}_image`] = card.imageUrl;
                        }
                        if (card.price && originalHypaCsvHeaders.includes(`options.option_${card.position}_price`)) {
                            row[`options.option_${card.position}_price`] = card.price;
                        }
                    }
                    break;

                case 'specification-table':
                    // Update spec table flag
                    if (originalHypaCsvHeaders.includes('shared.spec-table')) {
                        row['shared.spec-table'] = 'enabled';
                    }
                    
                    // Update spec table content if we have a content column
                    if (card.content) {
                        const specContentColumns = [
                            'specifications.spec_table_content',
                            'specifications.content',
                            'spec_table.content',
                            'specifications'
                        ];
                        
                        for (const col of specContentColumns) {
                            if (originalHypaCsvHeaders.includes(col)) {
                                row[col] = card.content;
                                break;
                            }
                        }
                    }
                    break;

                // Add other card types as needed
                default:
                    console.log(`Unknown card type: ${card.cardType}, skipping`);
            }
        });

        // Convert back to CSV format
        const csvContent = Papa.unparse({
            fields: originalHypaCsvHeaders,
            data: exportData
        });

        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `hypa-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showAnalysisToast('Hypa export completed! File downloaded with original structure preserved.', 'success');
        console.log('Hypa export completed with', exportData.length, 'rows preserved');
    }

    // Make export function available globally
    window.exportToHypaFormat = exportToHypaFormat;

    // Clean up bad cards that were imported incorrectly
    function cleanupBadCards() {
        console.log('Starting cleanup of bad cards...');
        
        // Find cards that are likely bad imports
        const badCards = cards.filter(card => {
            // Check for cards with generic titles or no content
            const hasGenericTitle = card.title === 'Specification Table' || 
                                   card.title === 'Specifications for ' + card.sku ||
                                   card.title.includes('specification-table') ||
                                   card.title === card.sku;
            
            const hasNoContent = !card.content || 
                                card.content.trim() === '' || 
                                card.content === 'Specification table content not found in import data.';
            
            const isSpecTable = card.cardType === 'specification-table';
            
            // Consider it bad if it's a spec table with generic title or no content
            return isSpecTable && (hasGenericTitle || hasNoContent);
        });
        
        console.log('Found bad cards to remove:', badCards.length);
        console.log('Bad cards:', badCards.map(c => ({ sku: c.sku, title: c.title, content: c.content?.substring(0, 50) })));
        
        if (badCards.length === 0) {
            showAnalysisToast('No bad cards found to clean up!', 'success');
            return;
        }
        
        // Remove bad cards
        const originalCount = cards.length;
        cards = cards.filter(card => {
            const isBad = badCards.some(badCard => badCard.id === card.id);
            return !isBad;
        });
        
        // Save updated cards
        saveCardsToFile();
        
        // Update localStorage
        localStorage.setItem('cards', JSON.stringify(cards));
        
        const removedCount = originalCount - cards.length;
        showAnalysisToast(`Cleaned up ${removedCount} bad cards successfully!`, 'success');
        
        // Refresh analysis
        performAnalysis();
        renderAnalysisTable();
        
        console.log(`Cleanup completed. Removed ${removedCount} bad cards.`);
    }

    // Make cleanup function available globally
    window.cleanupBadCards = cleanupBadCards;

    // Add sticky header CSS for the SKU match table
    const stickyHeaderStyle = document.createElement('style');
    stickyHeaderStyle.innerHTML = `
        #importHypaModal .table-responsive {
            max-height: 300px;
            overflow-y: auto;
        }
        #importHypaModal table thead th {
            position: sticky;
            top: 0;
            background: #f8f9fa;
            z-index: 2;
        }
    `;
    document.head.appendChild(stickyHeaderStyle);

    // --- Data persistence functions for import state (must be global) ---
    function hasSavedImportState() {
        try {
            const savedState = localStorage.getItem('bigcommerceImportState');
            if (!savedState) return false;
            const importState = JSON.parse(savedState);
            const hoursSinceSave = (Date.now() - importState.timestamp) / (1000 * 60 * 60);
            return hoursSinceSave <= 24;
        } catch (error) {
            return false;
        }
    }

    function saveImportState() {
        const importState = {
            timestamp: Date.now(),
            bigcommerceCsvData: window.bigcommerceCsvData,
            bigcommerceFieldMappings: window.bigcommerceFieldMappings,
            bigcommerceProcessedData: window.bigcommerceProcessedData,
            bigcommerceGroupedData: window.bigcommerceGroupedData,
            selectedConfigGroups: Array.from(window.selectedConfigGroups || []),
            selectedConfigVariants: Array.from(window.selectedConfigVariants || []),
            currentStep: window.currentBigcommerceStep || 1
        };
        try {
            localStorage.setItem('bigcommerceImportState', JSON.stringify(importState));
            if (window.showAnalysisToast) {
                window.showAnalysisToast('Import state saved successfully!', 'success');
            }
            console.log('Import state saved:', importState);
        } catch (error) {
            console.error('Error saving import state:', error);
            if (window.showAnalysisToast) {
                window.showAnalysisToast('Error saving import state. Data may be too large.', 'error');
            }
        }
    }

    function loadImportState() {
        try {
            const savedState = localStorage.getItem('bigcommerceImportState');
            if (!savedState) return false;
            const importState = JSON.parse(savedState);
            const hoursSinceSave = (Date.now() - importState.timestamp) / (1000 * 60 * 60);
            if (hoursSinceSave > 24) {
                console.log('Saved import state is older than 24 hours, clearing...');
                clearImportState();
                return false;
            }
            window.bigcommerceCsvData = importState.bigcommerceCsvData;
            window.bigcommerceFieldMappings = importState.bigcommerceFieldMappings;
            window.bigcommerceProcessedData = importState.bigcommerceProcessedData;
            window.bigcommerceGroupedData = importState.bigcommerceGroupedData;
            window.selectedConfigGroups = new Set(importState.selectedConfigGroups || []);
            window.selectedConfigVariants = new Set(importState.selectedConfigVariants || []);
            window.currentBigcommerceStep = importState.currentStep || 1;
            console.log('Import state restored:', importState);
            return true;
        } catch (error) {
            console.error('Error loading import state:', error);
            return false;
        }
    }

    function clearImportState() {
        try {
            localStorage.removeItem('bigcommerceImportState');
            console.log('Import state cleared');
        } catch (error) {
            console.error('Error clearing import state:', error);
        }
    }

    function autoSaveImportState() {
        if (window.bigcommerceCsvData && window.bigcommerceCsvData.length > 0) {
            saveImportState();
        }
    }
    // --- End data persistence functions ---

    // Global function to restore import state
    window.restoreImportState = function() {
        if (loadImportState()) {
            if (window.showAnalysisToast) {
                window.showAnalysisToast('Previous import state restored successfully!', 'success');
            }
            
            // Show the appropriate step based on saved state
            const currentStep = window.currentBigcommerceStep || 1;
            if (currentStep >= 2 && window.showBigcommerceStep) {
                window.showBigcommerceStep(currentStep);
            }
        } else {
            if (window.showAnalysisToast) {
                window.showAnalysisToast('No saved import state found or it has expired.', 'warning');
            }
        }
    };
}); 

// Initialize elements when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing elements...');
    
    // Check for saved import state and show restore button if available
    if (hasSavedImportState()) {
        const restoreBtn = document.getElementById('restoreImportStateBtn');
        if (restoreBtn) {
            restoreBtn.style.display = 'inline-block';
        }
    }
    
    initializeElements();
}); 