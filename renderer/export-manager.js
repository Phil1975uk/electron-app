/**
 * Export Manager - Handles all export-related functionality
 * Separated from import-analysis.js for better organization and debugging
 */

class ExportManager {
    constructor() {
        this.currentProductCards = [];
        this.exportableItems = [];
        this.exportSummary = {
            new: 0,
            updated: 0,
            remove: 0,
            total: 0
        };
    }

    /**
     * Initialize the export selection interface
     */
    initExportSelection() {
        console.log('🚀 Initializing export selection...');
        console.log('Window allExportResults:', window.allExportResults ? window.allExportResults.length : 'undefined');
        
        try {
            this.buildExportSelectionCards();
            console.log('✅ buildExportSelectionCards() completed');
        } catch (error) {
            console.error('❌ Error in buildExportSelectionCards():', error);
            throw error;
        }
        
        try {
            this.attachSimpleFilterListeners();
            console.log('✅ attachSimpleFilterListeners() completed');
        } catch (error) {
            console.error('❌ Error in attachSimpleFilterListeners():', error);
            throw error;
        }
        
        try {
            this.updateExportSummary();
            console.log('✅ updateExportSummary() completed');
        } catch (error) {
            console.error('❌ Error in updateExportSummary():', error);
            throw error;
        }
        
        console.log('✅ Export selection initialized');
    }

    /**
     * Build the export selection cards interface
     */
    buildExportSelectionCards() {
        console.log('Building export selection cards...');
        
        // Get all exportable items
        this.exportableItems = this.getExportableItems();
        console.log(`Found ${this.exportableItems.length} exportable items`);

        // Apply filters
        let filteredResults = this.applyFilters(this.exportableItems);
        console.log(`After filtering: ${filteredResults.length} items`);

        // Group by SKU (for CSV export - one row per SKU)
        const groupedBySku = this.groupBySku(filteredResults);
        console.log(`Grouped into ${Object.keys(groupedBySku).length} SKUs`);

        // Convert to array and sort
        const skuArray = Object.values(groupedBySku).sort((a, b) => {
            // Sort by brand, then model, then generation, then SKU
            if (a.brand !== b.brand) return (a.brand || '').localeCompare(b.brand || '');
            if (a.model !== b.model) return (a.model || '').localeCompare(b.model || '');
            if (a.generation !== b.generation) return (a.generation || '').localeCompare(b.generation || '');
            return (a.sku || '').localeCompare(b.sku || '');
        });

        // Build the HTML
        const container = document.getElementById('productCardsContainer');
        if (!container) {
            console.error('productCardsContainer not found');
            return;
        }

        container.innerHTML = '';

        skuArray.forEach((skuGroup, index) => {
            console.log(`Rendering SKU ${index + 1}:`, skuGroup);
            
            const skuCard = document.createElement('div');
            skuCard.className = 'sku-card card mb-3';
            skuCard.dataset.skuIndex = index;
            
            skuCard.innerHTML = `
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0">
                            <i class="fas fa-cube me-2"></i>
                            <strong>${skuGroup.brand || 'Unknown Brand'} ${skuGroup.model || ''} ${skuGroup.generation || ''}</strong>
                            <span class="text-primary ms-2">SKU: ${skuGroup.sku}</span>
                            <span class="text-muted ms-2">(${skuGroup.cards.length} cards)</span>
                        </h6>
                        <div class="sku-details">
                            ${skuGroup.brand ? `<span class="badge bg-secondary me-1">${skuGroup.brand}</span>` : ''}
                            ${skuGroup.model ? `<span class="badge bg-primary me-1">${skuGroup.model}</span>` : ''}
                            ${skuGroup.generation ? `<span class="badge bg-info me-1">${skuGroup.generation}</span>` : ''}
                            <span class="badge bg-dark me-1">SKU: ${skuGroup.sku}</span>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="window.exportManager.selectSkuCards(${index}, 'exportable')">
                            <i class="fas fa-check"></i> Select Exportable
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.exportManager.selectSkuCards(${index}, 'all')">
                            <i class="fas fa-check-double"></i> Select All
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-2">
                            <div class="card card-sm">
                                <div class="card-header bg-primary text-white">
                                    <i class="fas fa-star"></i> Features (${skuGroup.cardTypes.feature.length})
                                </div>
                                <div class="card-body p-2" style="max-height: 200px; overflow-y: auto;">
                                    ${this.renderCardList(skuGroup.cardTypes.feature)}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card card-sm">
                                <div class="card-header bg-success text-white">
                                    <i class="fas fa-cog"></i> Product Options (${skuGroup.cardTypes['product-options'].length})
                                </div>
                                <div class="card-body p-2" style="max-height: 200px; overflow-y: auto;">
                                    ${this.renderCardList(skuGroup.cardTypes['product-options'])}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="card card-sm">
                                <div class="card-header bg-info text-white">
                                    <i class="fas fa-truck"></i> Cargo (${skuGroup.cardTypes['cargo-options'].length})
                                </div>
                                <div class="card-body p-2" style="max-height: 200px; overflow-y: auto;">
                                    ${this.renderCardList(skuGroup.cardTypes['cargo-options'])}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="card card-sm">
                                <div class="card-header bg-warning text-dark">
                                    <i class="fas fa-cloud-rain"></i> Weather (${skuGroup.cardTypes['weather-protection'].length})
                                </div>
                                <div class="card-body p-2" style="max-height: 200px; overflow-y: auto;">
                                    ${this.renderCardList(skuGroup.cardTypes['weather-protection'])}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card card-sm">
                                <div class="card-header bg-secondary text-white">
                                    <i class="fas fa-table"></i> Spec Tables (${skuGroup.cardTypes['specification-table'].length})
                                </div>
                                <div class="card-body p-2" style="max-height: 200px; overflow-y: auto;">
                                    ${this.renderCardList(skuGroup.cardTypes['specification-table'])}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(skuCard);
        });

        // Store current SKU cards for selection functions
        this.currentSkuCards = skuArray;
        
        console.log('Export selection cards built successfully');
    }

    /**
     * Get all exportable items from the current data
     */
    getExportableItems() {
        const items = [];
        
        console.log('🔍 Getting exportable items...');
        console.log('🔍 window.allExportResults:', window.allExportResults);
        console.log('🔍 window.exportComparisonResults:', window.exportComparisonResults);
        
        // Get items from window.allExportResults (from export comparison)
        if (window.allExportResults && Array.isArray(window.allExportResults)) {
            // Transform import analysis format to export manager format
            const transformedItems = window.allExportResults.map(result => {
                // Handle both formats: direct card structure vs nested card structure
                const card = result.card || result;
                const sku = result.sku || card.sku;
                const action = result.action || card.action;
                
                return {
                    ...card,
                    sku: sku,
                    action: action,
                    configuration: card.configuration || {}
                };
            });
            items.push(...transformedItems);
            console.log('✅ Found items in window.allExportResults');
        } else {
            console.warn('❌ No export results available in window.allExportResults');
            
            // Try to get from exportComparisonResults as fallback
            if (window.exportComparisonResults) {
                console.log('🔍 Trying window.exportComparisonResults as fallback...');
                const results = window.exportComparisonResults;
                const allResults = [...(results.new || []), ...(results.updated || []), ...(results.keep || []), ...(results.remove || []), ...(results.excluded || [])];
                
                // Transform import analysis format to export manager format
                const transformedItems = allResults.map(result => {
                    const card = result.card || result;
                    const sku = result.sku || card.sku;
                    const action = result.action || card.action;
                    
                    return {
                        ...card,
                        sku: sku,
                        action: action,
                        configuration: card.configuration || {}
                    };
                });
                items.push(...transformedItems);
                console.log(`✅ Found ${allResults.length} items in window.exportComparisonResults`);
            } else {
                console.error('❌ No export results available anywhere. Please run export analysis first.');
            }
        }

        console.log(`Found ${items.length} exportable items total`);
        
        // Debug: Log first few items to see their structure
        if (items.length > 0) {
            console.log('🔍 First item structure:', items[0]);
            console.log('🔍 Item actions:', [...new Set(items.map(item => item.action))]);
        }
        
        // Debug: Check for Charger4 items in the raw data
        const charger4Items = items.filter(item => {
            const config = item.configuration || {};
            const model = config.model || item.model;
            return model && model.toLowerCase().includes('charger4');
        });
        console.log(`🔍 Raw data contains ${charger4Items.length} Charger4 items`);
        
        // Debug: Log Charger4 items by card type
        const charger4ByType = {};
        charger4Items.forEach(item => {
            const cardType = item.cardType || 'unknown';
            if (!charger4ByType[cardType]) {
                charger4ByType[cardType] = [];
            }
            charger4ByType[cardType].push(item);
        });
        console.log('🔍 Charger4 items by card type:', charger4ByType);
        
        // Debug: Log Charger4 items by action (new, update, keep, remove, excluded)
        const charger4ByAction = {};
        charger4Items.forEach(item => {
            const action = item.action || 'unknown';
            if (!charger4ByAction[action]) {
                charger4ByAction[action] = [];
            }
            charger4ByAction[action].push(item);
        });
        console.log('🔍 Charger4 items by action:', charger4ByAction);
        
        // Debug: Log unique models for Charger4 items
        const charger4Models = [...new Set(charger4Items.map(item => {
            const config = item.configuration || {};
            return config.model || item.model;
        }))];
        console.log(`🔍 Charger4 models found:`, charger4Models);
        
        // Debug: Log unique SKUs for Charger4 items
        const charger4Skus = [...new Set(charger4Items.map(item => item.sku))];
        console.log(`🔍 Charger4 SKUs found:`, charger4Skus);
        
        return items;
    }

    /**
     * Apply filters to the exportable items
     */
    applyFilters(items) {
        let filtered = [...items];

        // Debug: Log initial Charger4 count
        const initialCharger4Count = filtered.filter(item => {
            const config = item.configuration || {};
            const model = config.model || item.model;
            const generation = config.generation || item.generation;
            return (model && model.toLowerCase().includes('charger')) || 
                   (generation && generation.toLowerCase().includes('charger4'));
        }).length;
        console.log(`🔍 Initial Charger4 count: ${initialCharger4Count}`);

        // Apply search filter
        const searchFilter = document.getElementById('productSearchFilter')?.value?.toLowerCase();
        if (searchFilter) {
            const beforeSearch = filtered.length;
            filtered = filtered.filter(item => {
                const sku = (item.sku || '').toLowerCase();
                const model = (item.model || '').toLowerCase();
                const brand = (item.brand || '').toLowerCase();
                const title = (item.title || '').toLowerCase();
                const generation = (item.generation || '').toLowerCase();
                
                // Also check configuration fields
                const config = item.configuration || {};
                const configModel = (config.model || '').toLowerCase();
                const configGeneration = (config.generation || '').toLowerCase();
                const configBrand = (config.brand || '').toLowerCase();
                
                return sku.includes(searchFilter) || 
                       model.includes(searchFilter) || 
                       brand.includes(searchFilter) ||
                       title.includes(searchFilter) ||
                       generation.includes(searchFilter) ||
                       configModel.includes(searchFilter) ||
                       configGeneration.includes(searchFilter) ||
                       configBrand.includes(searchFilter);
            });
            const afterSearch = filtered.length;
            console.log(`🔍 Search filter "${searchFilter}": ${beforeSearch} → ${afterSearch} items`);
            
            // Debug: Log Charger4 count after search
            const charger4AfterSearch = filtered.filter(item => {
                const config = item.configuration || {};
                const model = config.model || item.model;
                const generation = config.generation || item.generation;
                return (model && model.toLowerCase().includes('charger')) || 
                       (generation && generation.toLowerCase().includes('charger4'));
            }).length;
            console.log(`🔍 Charger4 count after search: ${charger4AfterSearch}`);
        }

        // Apply action filter
        const showFilter = document.getElementById('showFilter')?.value;
        if (showFilter && showFilter !== 'all') {
            const beforeAction = filtered.length;
            filtered = filtered.filter(item => item.action === showFilter);
            const afterAction = filtered.length;
            console.log(`🔍 Action filter "${showFilter}": ${beforeAction} → ${afterAction} items`);
            
            // Debug: Log Charger4 count after action filter
            const charger4AfterAction = filtered.filter(item => {
                const config = item.configuration || {};
                const model = config.model || item.model;
                const generation = config.generation || item.generation;
                return (model && model.toLowerCase().includes('charger')) || 
                       (generation && generation.toLowerCase().includes('charger4'));
            }).length;
            console.log(`🔍 Charger4 count after action filter: ${charger4AfterAction}`);
        }

        return filtered;
    }

    /**
     * Group items by SKU (for CSV export - one row per SKU)
     */
    groupBySku(items) {
        const groupedBySku = {};
        
        // Debug: Log Charger4 items specifically
        const charger4Items = items.filter(item => {
            const config = item.configuration || {};
            const model = config.model || item.model;
            const generation = config.generation || item.generation;
            return (model && model.toLowerCase().includes('charger')) || 
                   (generation && generation.toLowerCase().includes('charger4'));
        });
        console.log(`🔍 Found ${charger4Items.length} Charger4 items in total`);
        
        items.forEach(item => {
            // Extract configuration data
            const config = item.configuration || {};
            const brand = config.brand || item.brand;
            const model = config.model || item.model;
            const generation = config.generation || item.generation;
            
            // Debug: Log Charger4 items specifically
            if ((model && model.toLowerCase().includes('charger')) || 
                (generation && generation.toLowerCase().includes('charger4'))) {
                console.log(`🔍 Charger4 item:`, {
                    sku: item.sku,
                    cardType: item.cardType,
                    position: item.position,
                    model: model,
                    generation: generation,
                    action: item.action
                });
            }
            
            // Get all SKUs for this card (primary SKU + variant SKUs)
            const cardSkus = [item.sku];
            
            // Add variant SKUs if they exist
            if (config.variants && config.variants.length > 0) {
                config.variants.forEach(variant => {
                    if (typeof variant === 'object' && variant.sku) {
                        if (!cardSkus.includes(variant.sku)) {
                            cardSkus.push(variant.sku);
                        }
                    } else if (typeof variant === 'string') {
                        if (!cardSkus.includes(variant)) {
                            cardSkus.push(variant);
                        }
                    }
                });
            }
            

            
            // Create separate entries for each SKU
            cardSkus.forEach(sku => {
                if (!groupedBySku[sku]) {
                    groupedBySku[sku] = {
                        sku: sku,
                        model: model,
                        generation: generation,
                        brand: brand,
                        cards: [],
                        summary: { new: 0, update: 0, keep: 0, remove: 0 },
                        cardTypes: {
                            feature: [],
                            'product-options': [],
                            'cargo-options': [],
                            'weather-protection': [],
                            'specification-table': []
                        }
                    };
                }
                
                // Add the card to this SKU group
                const cardCopy = {
                    ...item,
                    sku: sku
                };
                
                groupedBySku[sku].cards.push(cardCopy);
                groupedBySku[sku].summary[item.action]++;
                
                // Also organize by card type for easier display
                const cardType = item.cardType || 'unknown';
                if (groupedBySku[sku].cardTypes[cardType]) {
                    groupedBySku[sku].cardTypes[cardType].push(cardCopy);
                }
            });
        });

        // Debug: Log final grouped SKUs for Charger4
        const charger4Skus = Object.keys(groupedBySku).filter(sku => {
            const item = groupedBySku[sku];
            return item.model && item.model.toLowerCase().includes('charger4');
        });
        console.log(`🔍 Final Charger4 SKUs:`, charger4Skus);
        console.log(`🔍 Charger4 SKU details:`, charger4Skus.map(sku => ({
            sku: sku,
            product: groupedBySku[sku]
        })));

        return groupedBySku;
    }

    /**
     * Render a list of cards for a specific action type
     */
    renderCardList(cards) {
        if (cards.length === 0) {
            return '<div class="text-muted small">No cards</div>';
        }

        return cards.map(card => `
            <div class="form-check mb-1">
                <input class="form-check-input card-checkbox" type="checkbox" 
                       id="card_${card.id}" value="${card.id}" 
                       data-action="${card.action}" 
                       onchange="exportManager.updateExportSummary()">
                <label class="form-check-label small" for="card_${card.id}">
                    <strong>${card.cardType}</strong><br>
                    <span class="text-muted">${card.title}</span>
                </label>
            </div>
        `).join('');
    }

    /**
     * Select cards for a specific SKU
     */
    selectSkuCards(skuIndex, filterType) {
        const skuGroup = this.currentSkuCards[skuIndex];
        if (!skuGroup) {
            console.error(`SKU index ${skuIndex} not found`);
            return;
        }

        const checkboxes = document.querySelectorAll(`[data-sku-index="${skuIndex}"] .card-checkbox`);
        
        checkboxes.forEach(checkbox => {
            let shouldCheck = false;
            
            switch (filterType) {
                case 'all':
                    shouldCheck = true;
                    break;
                case 'exportable':
                    shouldCheck = ['new', 'update', 'keep'].includes(checkbox.dataset.action);
                    break;
                case 'new':
                    shouldCheck = checkbox.dataset.action === 'new';
                    break;
                case 'update':
                    shouldCheck = checkbox.dataset.action === 'update';
                    break;
                case 'keep':
                    shouldCheck = checkbox.dataset.action === 'keep';
                    break;
                case 'remove':
                    shouldCheck = checkbox.dataset.action === 'remove';
                    break;
            }
            
            checkbox.checked = shouldCheck;
        });

        this.updateExportSummary();
    }

    /**
     * Select all exportable cards
     */
    selectAllExportable() {
        const checkboxes = document.querySelectorAll('.card-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = ['new', 'update', 'keep'].includes(checkbox.dataset.action);
        });
        this.updateExportSummary();
    }

    /**
     * Clear all selections
     */
    clearAllSelections() {
        const checkboxes = document.querySelectorAll('.card-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateExportSummary();
    }

    /**
     * Update the export summary display
     */
    updateExportSummary() {
        const checkboxes = document.querySelectorAll('.card-checkbox:checked');
        
        this.exportSummary = {
            new: 0,
            updated: 0,
            remove: 0,
            total: 0
        };

        checkboxes.forEach(checkbox => {
            const action = checkbox.dataset.action;
            this.exportSummary.total++;
            
            switch (action) {
                case 'new':
                    this.exportSummary.new++;
                    break;
                case 'update':
                    this.exportSummary.updated++;
                    break;
                case 'remove':
                    this.exportSummary.remove++;
                    break;
            }
        });

        // Update the display
        const summaryNew = document.getElementById('summaryNew');
        const summaryUpdated = document.getElementById('summaryUpdated');
        const summaryRemove = document.getElementById('summaryRemove');
        const summaryTotal = document.getElementById('summaryTotal');
        const continueButton = document.getElementById('continueToExportBtn');

        if (summaryNew) summaryNew.textContent = this.exportSummary.new;
        if (summaryUpdated) summaryUpdated.textContent = this.exportSummary.updated;
        if (summaryRemove) summaryRemove.textContent = this.exportSummary.remove;
        if (summaryTotal) summaryTotal.textContent = this.exportSummary.total;

        // Enable/disable continue button
        if (continueButton) {
            continueButton.disabled = this.exportSummary.total === 0;
        }

        console.log('Export summary updated:', this.exportSummary);
    }

    /**
     * Get selected items for export
     */
    getSelectedItems() {
        const selectedIds = Array.from(document.querySelectorAll('.card-checkbox:checked'))
            .map(checkbox => checkbox.value);
        
        return this.exportableItems.filter(item => selectedIds.includes(item.id));
    }

    /**
     * Prepare selected items for CSV export - organize by SKU with proper column mapping
     */
    prepareForCsvExport() {
        const selectedItems = this.getSelectedItems();
        console.log(`Preparing ${selectedItems.length} selected items for CSV export`);
        
        // Group selected items by SKU
        const groupedBySku = this.groupBySku(selectedItems);
        
        // Prepare CSV rows - one row per SKU
        const csvRows = [];
        
        Object.values(groupedBySku).forEach(skuGroup => {
            console.log(`Processing SKU ${skuGroup.sku} with ${skuGroup.cards.length} cards`);
            
            // Create base row with SKU info
            const csvRow = {
                sku: skuGroup.sku,
                brand: skuGroup.brand,
                model: skuGroup.model,
                generation: skuGroup.generation
            };
            
            // Organize cards by type and position
            const cardsByType = {
                feature: [],
                'product-options': [],
                'cargo-options': [],
                'weather-protection': [],
                'specification-table': []
            };
            
            // Sort cards into their types
            skuGroup.cards.forEach(card => {
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
            
            // Map cards to CSV columns
            const csvColumns = this.mapCardsToCsvColumns(cardsByType);
            
            // Merge CSV columns into the row
            Object.assign(csvRow, csvColumns);
            
            csvRows.push(csvRow);
            
            // Debug logging for Charger4
            if (skuGroup.model && skuGroup.model.toLowerCase().includes('charger4')) {
                console.log(`🔍 CSV Row for ${skuGroup.sku}:`, {
                    sku: skuGroup.sku,
                    cardCounts: {
                        feature: cardsByType.feature.length,
                        productOptions: cardsByType['product-options'].length,
                        cargoOptions: cardsByType['cargo-options'].length,
                        weatherProtection: cardsByType['weather-protection'].length,
                        specTable: cardsByType['specification-table'].length
                    },
                    csvColumns: Object.keys(csvColumns).filter(key => csvColumns[key])
                });
            }
        });
        
        console.log(`Prepared ${csvRows.length} CSV rows for export`);
        return csvRows;
    }

    /**
     * Map cards to CSV column names based on type and position
     */
    mapCardsToCsvColumns(cardsByType) {
        const csvColumns = {};
        
        // Map feature cards (up to 12)
        cardsByType.feature.forEach((card, index) => {
            // Always use array index + 1 since cards are already sorted by position
            const position = index + 1;
            if (position <= 12) {
                const columnName = `shared.feature-${position}-card`;
                csvColumns[columnName] = card.content || card.description || '';
            }
        });
        
        // Map product option cards (up to 12)
        cardsByType['product-options'].forEach((card, index) => {
            // Always use array index + 1 since cards are already sorted by position
            const position = index + 1;
            if (position <= 12) {
                const columnName = `shared.option-${position}-card`;
                csvColumns[columnName] = card.content || card.description || '';
            }
        });
        
        // Map cargo option cards (up to 12)
        cardsByType['cargo-options'].forEach((card, index) => {
            // Always use array index + 1 since cards are already sorted by position
            const position = index + 1;
            if (position <= 12) {
                const columnName = `shared.cargo-option-${position}-card`;
                csvColumns[columnName] = card.content || card.description || '';
            }
        });
        
        // Map weather protection cards (up to 12)
        cardsByType['weather-protection'].forEach((card, index) => {
            // Always use array index + 1 since cards are already sorted by position
            const position = index + 1;
            if (position <= 12) {
                const columnName = `shared.weather-option-${position}-card`;
                csvColumns[columnName] = card.content || card.description || '';
            }
        });
        
        // Map specification table (only 1)
        if (cardsByType['specification-table'].length > 0) {
            const specCard = cardsByType['specification-table'][0];
            csvColumns['shared.spec-table'] = specCard.content || specCard.description || '';
        }
        
        return csvColumns;
    }

    /**
     * Attach filter event listeners
     */
    attachSimpleFilterListeners() {
        const searchFilter = document.getElementById('productSearchFilter');
        const showFilter = document.getElementById('showFilter');

        if (searchFilter) {
            searchFilter.addEventListener('input', () => {
                this.buildExportSelectionCards();
                this.updateExportSummary();
            });
        }

        if (showFilter) {
            showFilter.addEventListener('change', () => {
                this.buildExportSelectionCards();
                this.updateExportSummary();
            });
        }

        console.log('Filter listeners attached');
    }

    /**
     * Debug function to log current state
     */
    debugState() {
        console.log('=== Export Manager Debug State ===');
        console.log('Exportable items:', this.exportableItems.length);
        console.log('Current SKU cards:', this.currentSkuCards ? this.currentSkuCards.length : 0);
        console.log('Export summary:', this.exportSummary);
        console.log('Selected items:', this.getSelectedItems().length);
        console.log('🔍 Window state:');
        console.log('window.allExportResults:', window.allExportResults ? window.allExportResults.length : 'undefined');
        console.log('window.exportComparisonResults:', window.exportComparisonResults);
        console.log('window.exportManager:', window.exportManager);
        console.log('==================================');
    }

    /**
     * Test function to verify the export manager is working
     */
    test() {
        console.log('🧪 Testing Export Manager...');
        
        // Test 1: Check if we can get exportable items
        const items = this.getExportableItems();
        console.log('✅ Test 1 - Exportable items:', items.length);
        
        // Test 2: Check if we can apply filters
        const filtered = this.applyFilters(items);
        console.log('✅ Test 2 - Filtered items:', filtered.length);
        
        // Test 3: Check if we can group items
        const grouped = this.groupBySku(filtered);
        console.log('✅ Test 3 - Grouped SKUs:', Object.keys(grouped).length);
        
        // Test 4: Check if we can get selected items
        const selected = this.getSelectedItems();
        console.log('✅ Test 4 - Selected items:', selected.length);
        
        console.log('🎉 Export Manager tests completed!');
        return true;
    }

    // Simple test function that can be called from console
    quickTest() {
        console.log('🔍 Quick test of export manager...');
        console.log('Export manager available:', !!window.exportManager);
        console.log('allExportResults available:', !!window.allExportResults);
        console.log('allExportResults length:', window.allExportResults ? window.allExportResults.length : 'N/A');
        console.log('exportComparisonResults available:', !!window.exportComparisonResults);
        
        // Check original cards vs export results
        if (window.cards) {
            const charger4Cards = window.cards.filter(card => {
                const config = card.configuration || {};
                const model = config.model || card.model;
                return model && model.toLowerCase().includes('charger4');
            });
            console.log('🔍 Original cards contains', charger4Cards.length, 'Charger4 cards');
            
            const charger4OptionCards = charger4Cards.filter(card => card.cardType === 'product-options');
            console.log('🔍 Original cards contains', charger4OptionCards.length, 'Charger4 option cards');
        }
        
        return true;
    }

    // Debug function to check why only spec tables are showing
    debugExportCompleteness() {
        console.log('🔍 Debugging export completeness...');
        
        // Get all cards from window.cards
        const allCards = window.cards || [];
        console.log(`Total cards in system: ${allCards.length}`);
        
        // Filter for Charger4 cards
        const charger4Cards = allCards.filter(card => {
            const config = card.configuration || {};
            const model = config.model || card.model;
            return model && model.toLowerCase().includes('charger4');
        });
        console.log(`Charger4 cards found: ${charger4Cards.length}`);
        
        // Check completeness for each card type
        const completenessByType = {};
        charger4Cards.forEach(card => {
            const cardType = card.cardType || card.type || 'unknown';
            if (!completenessByType[cardType]) {
                completenessByType[cardType] = { complete: [], incomplete: [] };
            }
            
            // Simulate the completeness check
            const missingFields = [];
            if (cardType === 'feature') {
                if (!card.title || card.title.trim() === '') missingFields.push('title');
                if ((!card.description || card.description.trim() === '') && (!card.content || card.content.trim() === '')) missingFields.push('description');
                if (card.imageUrl && (!card.webdavPath || !card.uploadDate)) missingFields.push('image not uploaded to WebDAV');
            } else if (cardType === 'product-options' || cardType === 'option') {
                if (!card.title || card.title.trim() === '') missingFields.push('title');
                if (!card.price || card.price.trim() === '') missingFields.push('price');
                if ((!card.description || card.description.trim() === '') && (!card.content || card.content.trim() === '')) missingFields.push('description');
                if (card.imageUrl && (!card.webdavPath || !card.uploadDate)) missingFields.push('image not uploaded to WebDAV');
            } else if (cardType === 'specification-table' || cardType === 'spec') {
                if ((!card.content || card.content.trim() === '') && (!card.description || card.description.trim() === '')) missingFields.push('content');
            }
            
            const isComplete = missingFields.length === 0;
            if (isComplete) {
                completenessByType[cardType].complete.push(card);
            } else {
                completenessByType[cardType].incomplete.push({ card, missingFields });
            }
        });
        
        console.log('🔍 Completeness by card type:', completenessByType);
        
        // Show details for incomplete cards
        Object.entries(completenessByType).forEach(([cardType, data]) => {
            if (data.incomplete.length > 0) {
                console.log(`❌ ${cardType} cards with issues:`);
                data.incomplete.forEach(({ card, missingFields }) => {
                    console.log(`  - ${card.title || card.id}: missing ${missingFields.join(', ')}`);
                    if (missingFields.includes('image not uploaded to WebDAV')) {
                        console.log(`    Image URL: ${card.imageUrl}`);
                        console.log(`    WebDAV Path: ${card.webdavPath}`);
                        console.log(`    Upload Date: ${card.uploadDate}`);
                    }
                });
            }
        });
        
        return completenessByType;
    }

    // Debug function to check image status for cards
    debugImageStatus() {
        console.log('🔍 Debugging image status for cards...');
        
        // Get all cards from window.cards
        const allCards = window.cards || [];
        
        // Filter for Charger4 cards
        const charger4Cards = allCards.filter(card => {
            const config = card.configuration || {};
            const model = config.model || card.model;
            return model && model.toLowerCase().includes('charger4');
        });
        
        console.log(`Charger4 cards found: ${charger4Cards.length}`);
        
        // Check image status for each card
        charger4Cards.forEach(card => {
            const cardType = card.cardType || card.type || 'unknown';
            console.log(`\n🔍 Card: ${card.title || card.id} (${cardType})`);
            
            if (!card.imageUrl) {
                console.log(`  Image Status: No Image`);
            } else if (card.webdavPath && card.uploadDate) {
                console.log(`  Image Status: WebDAV Uploaded`);
                console.log(`    Image URL: ${card.imageUrl}`);
                console.log(`    WebDAV Path: ${card.webdavPath}`);
                console.log(`    Upload Date: ${card.uploadDate}`);
                
                // Check if WebDAV URL is accessible
                const webdavUrl = `https://webdav.ebikebarn.com.au/${card.webdavPath.replace(/^\/+/, '')}`;
                console.log(`    WebDAV URL: ${webdavUrl}`);
                
                // Test if image exists at WebDAV URL
                const img = new Image();
                img.onload = () => {
                    console.log(`    ✅ WebDAV image accessible`);
                };
                img.onerror = () => {
                    console.log(`    ❌ WebDAV image NOT accessible`);
                };
                img.src = webdavUrl + '?cb=' + Date.now();
                
            } else {
                console.log(`  Image Status: External URL`);
                console.log(`    Image URL: ${card.imageUrl}`);
            }
        });
    }
}

// Create global instance
window.exportManager = new ExportManager();

    // Test the export manager on load
    window.addEventListener('load', () => {
        if (window.exportManager) {
            console.log('🚀 Export Manager loaded successfully');
            console.log('🔍 Export Manager instance:', window.exportManager);
            
            // Add a global debug function
            window.debugExportManager = () => {
                console.log('🔍 Debugging Export Manager...');
                console.log('window.exportManager:', window.exportManager);
                console.log('window.allExportResults:', window.allExportResults);
                console.log('window.exportComparisonResults:', window.exportComparisonResults);
                console.log('window.lastComparisonResults:', window.lastComparisonResults);
                
                if (window.exportManager) {
                    console.log('Export Manager methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.exportManager)));
                    console.log('Export Manager state:', {
                        currentProductCards: window.exportManager.currentProductCards,
                        exportableItems: window.exportManager.exportableItems,
                        exportSummary: window.exportManager.exportSummary
                    });
                    
                    // Test getExportableItems
                    console.log('🔍 Testing getExportableItems...');
                    const items = window.exportManager.getExportableItems();
                    console.log('Items returned:', items.length);
                    if (items.length > 0) {
                        console.log('First item:', items[0]);
                    }
                    
                    // Test buildExportSelectionCards
                    console.log('🔍 Testing buildExportSelectionCards...');
                    try {
                        window.exportManager.buildExportSelectionCards();
                        console.log('✅ buildExportSelectionCards completed');
                    } catch (error) {
                        console.error('❌ Error in buildExportSelectionCards:', error);
                    }
                }
            };
            
            // Add a test function to run comparison and then export
            window.testExportFlow = async () => {
                console.log('🧪 Testing export flow...');
                
                // First, run the comparison
                if (typeof performExportComparison === 'function') {
                    console.log('🔍 Running performExportComparison...');
                    await performExportComparison();
                    console.log('✅ Comparison completed');
                } else {
                    console.error('❌ performExportComparison function not found');
                }
                
                // Then try to show export selection
                if (typeof showExportSelection === 'function') {
                    console.log('🔍 Running showExportSelection...');
                    showExportSelection();
                    console.log('✅ Export selection completed');
                } else {
                    console.error('❌ showExportSelection function not found');
                }
            };
            
            // Add a simple test to check if cards are loaded
            window.testCardsLoaded = () => {
                console.log('🧪 Testing if cards are loaded...');
                console.log('window.cards:', window.cards);
                console.log('cards.length:', window.cards ? window.cards.length : 'undefined');
                
                if (window.cards && window.cards.length > 0) {
                    console.log('✅ Cards are loaded!');
                    console.log('First card:', window.cards[0]);
                    console.log('Card types:', [...new Set(window.cards.map(c => c.cardType))]);
                    console.log('SKUs:', [...new Set(window.cards.map(c => c.sku))].slice(0, 5));
                } else {
                    console.log('❌ No cards loaded');
                }
            };
            
            // Uncomment the line below to run tests
            // window.exportManager.test();
        } else {
            console.error('❌ Export Manager failed to load');
        }
    });

// Also log when the script loads
console.log('📦 Export Manager script loaded'); 