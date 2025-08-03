# Export Modal Fix Script
# This script will fix the export modal to properly show local cards count

Write-Host "Fixing export modal to show local cards count..." -ForegroundColor Green

# Read the current file
 = "renderer/import-analysis.js"
 = Get-Content  -Raw

# Fix 1: Add global cards assignment after line 393
 =  -replace "cards = cardsData;", "cards = cardsData;
            // Make cards globally accessible for export functions
            window.cards = cards;"

# Fix 2: Replace the startExportAnalysis function
 = @'
    function startExportAnalysis\(\) \{
        console\.log\('Starting export analysis\.\.\.'\);
        
        // Update progress
        updateExportProgress\(1, 'Analyzing local cards and Hypa metafields\.\.\.'\);
        
        // Get local cards count
        const localCards = cards \|\| \[\];
        const localTotalCards = localCards\.length;
        const localWithImages = localCards\.filter\(card => card\.imageUrl\)\.length;
        const localReadyToExport = localCards\.filter\(card => card\.title && card\.content\)\.length;
        
        // Update local stats
        document\.getElementById\('localTotalCards'\)\.textContent = localTotalCards;
        document\.getElementById\('localWithImages'\)\.textContent = localWithImages;
        document\.getElementById\('localReadyToExport'\)\.textContent = localReadyToExport;
        
        // Check if we have Hypa data
        const hasHypaData = originalHypaCsvData && originalHypaCsvData\.length > 0;
        const hypaExistingCount = hasHypaData ? originalHypaCsvData\.length : 0;
        const hypaLastUpdated = hasHypaData ? 'Available' : 'Not imported';
        const hypaConnectionStatus = hasHypaData ? 'Connected' : 'No data';
        
        // Update Hypa stats
        document\.getElementById\('hypaExistingCount'\)\.textContent = hypaExistingCount;
        document\.getElementById\('hypaLastUpdated'\)\.textContent = hypaLastUpdated;
        document\.getElementById\('hypaConnectionStatus'\)\.textContent = hypaConnectionStatus;
        
        // Perform comparison
        const comparisonResults = performExportComparison\(localCards\);
        
        // Store results for next step
        window\.exportComparisonResults = comparisonResults;
        
        // Move to step 2
        showExportStep\(2\);
    \}
'@

 = @'
    function startExportAnalysis() {
        console.log('Starting export analysis...');
        
        // Update progress
        updateExportProgress(1, 'Analyzing local cards and Hypa metafields...');
        
        // Get local cards count - ensure cards are loaded
        const localCards = window.cards || cards || [];
        console.log('Local cards found:', localCards.length);
        
        const localTotalCards = localCards.length;
        const localWithImages = localCards.filter(card => card.imageUrl && card.imageUrl.trim() !== '').length;
        const localReadyToExport = localCards.filter(card => 
            card.title && card.title.trim() !== '' && 
            card.content && card.content.trim() !== '' && 
            card.imageUrl && card.imageUrl.trim() !== ''
        ).length;
        
        console.log('Cards with images:', localWithImages);
        console.log('Cards ready to export:', localReadyToExport);
        
        // Update local stats
        document.getElementById('localTotalCards').textContent = localTotalCards;
        document.getElementById('localWithImages').textContent = localWithImages;
        document.getElementById('localReadyToExport').textContent = localReadyToExport;
        
        // Check if we have Hypa data
        const hasHypaData = originalHypaCsvData && originalHypaCsvData.length > 0;
        const hypaExistingCount = hasHypaData ? originalHypaCsvData.length : 0;
        const hypaLastUpdated = hasHypaData ? 'Available' : 'Not imported';
        const hypaConnectionStatus = hasHypaData ? 'Connected' : 'No data';
        
        // Update Hypa stats
        document.getElementById('hypaExistingCount').textContent = hypaExistingCount;
        document.getElementById('hypaLastUpdated').textContent = hypaLastUpdated;
        document.getElementById('hypaConnectionStatus').textContent = hypaConnectionStatus;
        
        // Perform comparison
        const comparisonResults = performExportComparison(localCards);
        
        // Store results for next step
        window.exportComparisonResults = comparisonResults;
        
        // Move to step 2
        showExportStep(2);
    }
'@

 =  -replace , 

# Fix 3: Add export modal initialization functions before the closing });
 = @'

    // Initialize export modal when it opens
    function initializeExportModal() {
        console.log('Initializing export modal...');
        
        // Ensure data is loaded
        if (!cards || cards.length === 0) {
            console.log('No cards loaded, attempting to load data...');
            loadData().then(() => {
                console.log('Data loaded, cards count:', cards ? cards.length : 0);
                // Make cards globally accessible
                window.cards = cards;
            });
        } else {
            console.log('Cards already loaded, count:', cards.length);
            // Make cards globally accessible
            window.cards = cards;
        }
    }

    // Add export modal event listener
    const exportHypaModal = document.getElementById('exportHypaModal');
    if (exportHypaModal) {
        exportHypaModal.addEventListener('shown.bs.modal', function () {
            console.log('Export modal shown, initializing...');
            initializeExportModal();
        });
    }
'@

 =  -replace "    // Call this when the page loads", "

    // Call this when the page loads"

# Write the updated content back to the file
Set-Content   -Encoding UTF8

Write-Host "Export modal fixes applied successfully!" -ForegroundColor Green
Write-Host "The export modal should now properly show your local cards count." -ForegroundColor Yellow
Write-Host "Restart the app to see the changes." -ForegroundColor Yellow
