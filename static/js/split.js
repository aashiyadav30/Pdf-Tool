let selectedFile = null;
let currentSplitMode = 'range';
let currentExtractMode = 'all';
let currentRangeMode = 'custom';
let selectedPages = [];
let totalPages = 0;
let rangeCounter = 1;
let pdfDocument = null; // Store PDF document for previews
let blankPages = []; // Store detected blank pages

// File handling
function handleSplitFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        selectedFile = file;
        // Get actual PDF info from server
        getPDFInfo(file);
    }
}

// Get PDF information from server
async function getPDFInfo(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/pdf-info', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            totalPages = data.total_pages;
            loadPDF(file);
        } else {
            const error = await response.json();
            alert(`Error reading PDF: ${error.error}`);
        }
    } catch (error) {
        console.error('Error getting PDF info:', error);
        // Fallback to simulated page count
        totalPages = Math.floor(Math.random() * 50) + 20;
        loadPDF(file);
    }
}

// Load PDF for preview using PDF.js
async function loadPDFForPreview(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
        generatePagesGridWithPreviews();
        
        // Start blank page detection in background
        detectBlankPages();
    } catch (error) {
        console.error('Error loading PDF for preview:', error);
        generatePagesGrid(); // Fallback to simple grid
    }
}

function loadPDF(file) {
    // Update file info
    document.getElementById('fileInfo').textContent = 
        `${formatFileSize(file.size)} - ${totalPages} pages`;
    
    // Show split interface
    document.getElementById('uploadArea').style.display = 'none';
    document.getElementById('splitInterface').style.display = 'block';
    
    // Load PDF for previews
    loadPDFForPreview(file);
    
    // Update max values for range inputs
    updateRangeInputLimits();
    
    // Add merge option if it doesn't exist
    updateSplitInterface();
    
    // Update interface based on current mode
    updateInterface();
}

// Detect blank pages in the PDF
async function detectBlankPages() {
    if (!pdfDocument) return;
    
    blankPages = [];
    const blankThreshold = 0.98; // 98% white pixels threshold
    
    // Show progress indicator
    showBlankDetectionProgress();
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
            const page = await pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Analyze pixel data to detect blank pages
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const isBlank = analyzePageContent(imageData, blankThreshold);
            
            if (isBlank) {
                blankPages.push(pageNum);
                // Mark blank page in UI
                markPageAsBlank(pageNum);
            }
            
            // Update progress
            updateBlankDetectionProgress(pageNum, totalPages);
            
        } catch (error) {
            console.error(`Error analyzing page ${pageNum}:`, error);
        }
    }
    
    hideBlankDetectionProgress();
    updateBlankPageInfo();
}

// Analyze page content to determine if it's blank
function analyzePageContent(imageData, threshold) {
    const data = imageData.data;
    let whitePixels = 0;
    const totalPixels = data.length / 4; // 4 values per pixel (RGBA)
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];
        
        // Consider pixel as white if RGB values are high and alpha is not transparent
        if (r > 240 && g > 240 && b > 240 && alpha > 200) {
            whitePixels++;
        }
    }
    
    const whiteRatio = whitePixels / totalPixels;
    return whiteRatio >= threshold;
}

// Show blank page detection progress
function showBlankDetectionProgress() {
    const progressDiv = document.createElement('div');
    progressDiv.id = 'blankDetectionProgress';
    progressDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        text-align: center;
        min-width: 300px;
    `;
    
    progressDiv.innerHTML = `
        <div style="margin-bottom: 15px; font-weight: 600;">Detecting Blank Pages</div>
        <div style="background: #f0f0f0; border-radius: 10px; height: 20px; margin-bottom: 10px; overflow: hidden;">
            <div id="progressBar" style="background: #007bff; height: 100%; width: 0%; transition: width 0.3s;"></div>
        </div>
        <div id="progressText">Analyzing page 1 of ${totalPages}...</div>
    `;
    
    document.body.appendChild(progressDiv);
}

// Update blank page detection progress
function updateBlankDetectionProgress(currentPage, totalPages) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar && progressText) {
        const percentage = (currentPage / totalPages) * 100;
        progressBar.style.width = percentage + '%';
        progressText.textContent = `Analyzing page ${currentPage} of ${totalPages}...`;
    }
}

// Hide blank page detection progress
function hideBlankDetectionProgress() {
    const progressDiv = document.getElementById('blankDetectionProgress');
    if (progressDiv) {
        progressDiv.remove();
    }
}

// Mark a page as blank in the UI
function markPageAsBlank(pageNum) {
    const pageItem = document.querySelector(`[data-page="${pageNum}"]`);
    if (pageItem) {
        pageItem.classList.add('blank-page');
        
        // Add blank page indicator
        const blankIndicator = document.createElement('div');
        blankIndicator.className = 'blank-indicator';
        blankIndicator.textContent = 'BLANK';
        blankIndicator.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: #ff6b6b;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
        `;
        
        pageItem.style.position = 'relative';
        pageItem.appendChild(blankIndicator);
    }
}

// Update blank page information
function updateBlankPageInfo() {
    if (blankPages.length > 0) {
        const blankInfoDiv = document.createElement('div');
        blankInfoDiv.id = 'blankPageInfo';
        blankInfoDiv.style.cssText = `
            margin: 15px 0;
            padding: 15px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
        `;
        
        blankInfoDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 10px; color: #856404;">
                📄 Blank Pages Detected: ${blankPages.length} pages
            </div>
            <div style="font-size: 14px; color: #856404; margin-bottom: 15px;">
                Pages ${blankPages.join(', ')} appear to be blank or nearly blank.
            </div>
            <button onclick="removeBlankPages()" 
                    style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: 500;">
                📥 Download PDF Without Blank Pages
            </button>
            <div style="font-size: 12px; color: #6c757d; margin-top: 8px;">
                This will create a new PDF with ${totalPages - blankPages.length} pages (${blankPages.length} blank pages removed)
            </div>
        `;
        
        // Insert after file info
        const fileInfoElement = document.getElementById('fileInfo').parentElement;
        fileInfoElement.insertAdjacentElement('afterend', blankInfoDiv);
    }
}

// Remove blank pages and download clean PDF
async function removeBlankPages() {
    if (!selectedFile || blankPages.length === 0) {
        alert('No blank pages to remove');
        return;
    }

    const removeBtn = event.target;
    const originalText = removeBtn.textContent;
    removeBtn.disabled = true;
    removeBtn.innerHTML = '🔄 Processing...';

    try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("removeBlankPages", "true");
        formData.append("blankPages", JSON.stringify(blankPages));

        const response = await fetch("/remove-blank-pages", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove blank pages');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        
        // Generate filename
        const originalName = selectedFile.name.replace('.pdf', '');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
        a.download = `${originalName}_no_blanks_${timestamp}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Success! Removed ${blankPages.length} blank pages. New PDF has ${totalPages - blankPages.length} pages.`);
        
    } catch (error) {
        console.error('Error removing blank pages:', error);
        showWarning("Failed to remove blank pages: " + error.message);
    } finally {
        removeBtn.disabled = false;
        removeBtn.innerHTML = originalText;
    }
}

// Add merge option interface
function updateSplitInterface() {
    // Check if merge option already exists
    if (!document.getElementById('includeMergedPdf')) {
        const mergeOptionHTML = `
            <div class="merge-option" style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa;">
                <label style="display: flex; align-items: center; gap: 10px; font-weight: 500; cursor: pointer;">
                    <input type="checkbox" id="includeMergedPdf" checked style="transform: scale(1.2);">
                    <span>Include merged PDF with all split content</span>
                </label>
                <div style="font-size: 13px; color: #666; margin-top: 8px; margin-left: 30px; line-height: 1.4;">
                    The ZIP file will contain:
                    <ul style="margin: 5px 0 0 20px; padding: 0;">
                        <li>Individual PDFs for each split range/page</li>
                        <li>One merged PDF containing all the split content (if checked)</li>
                    </ul>
                </div>
            </div>
        `;
        
        // Insert before the split button
        const splitBtn = document.getElementById('splitBtn');
        if (splitBtn) {
            splitBtn.insertAdjacentHTML('beforebegin', mergeOptionHTML);
        }
    }
}

// Generate pages grid with actual PDF previews
async function generatePagesGridWithPreviews() {
    const pagesGrid = document.getElementById('pagesGrid');
    pagesGrid.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.dataset.page = i;
        pageItem.onclick = () => togglePageSelection(i);
        
        const pagePreview = document.createElement('div');
        pagePreview.className = 'page-preview';
        pagePreview.style.cssText = `
            width: 100%;
            height: 120px;
            border: 1px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            position: relative;
            overflow: hidden;
        `;
        
        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = i;
        
        pageItem.appendChild(pagePreview);
        pageItem.appendChild(pageNumber);
        pagesGrid.appendChild(pageItem);
        
        // Generate preview asynchronously
        generatePagePreview(i, pagePreview);
    }
}

// Generate individual page preview
async function generatePagePreview(pageNum, previewElement) {
    try {
        if (!pdfDocument) return;
        
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.3 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        canvas.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        `;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        previewElement.innerHTML = '';
        previewElement.appendChild(canvas);
    } catch (error) {
        console.error(`Error generating preview for page ${pageNum}:`, error);
        previewElement.innerHTML = `<div style="font-size: 8px; color: #999;">Page ${pageNum}<br>Preview unavailable</div>`;
    }
}

// Fallback function for simple grid without previews
function generatePagesGrid() {
    const pagesGrid = document.getElementById('pagesGrid');
    pagesGrid.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.dataset.page = i;
        pageItem.onclick = () => togglePageSelection(i);
        
        pageItem.innerHTML = `
            <div class="page-preview" style="width: 100%; height: 120px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; background: white;">
                <div style="font-size: 8px; color: #999;">Page Content<br>Preview unavailable</div>
            </div>
            <div class="page-number">${i}</div>
        `;
        
        pagesGrid.appendChild(pageItem);
    }
}

function updateRangeInputLimits() {
    // Update all existing range inputs with proper limits
    const rangeInputs = document.querySelectorAll('.range-input');
    rangeInputs.forEach(input => {
        input.max = totalPages;
        if (parseInt(input.value) > totalPages) {
            input.value = totalPages;
        }
    });
}

function togglePageSelection(pageNumber) {
    const pageItem = document.querySelector(`[data-page="${pageNumber}"]`);
    const isSelected = selectedPages.includes(pageNumber);
    
    if (isSelected) {
        selectedPages = selectedPages.filter(p => p !== pageNumber);
        pageItem.classList.remove('selected');
    } else {
        selectedPages.push(pageNumber);
        pageItem.classList.add('selected');
    }
    
    updatePDFCount();
}

function setSplitMode(mode) {
    currentSplitMode = mode;
    
    // Update active split option
    document.querySelectorAll('.split-option').forEach(option => {
        option.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    
    updateInterface();
}

function setExtractMode(mode) {
    currentExtractMode = mode;
    
    // Update active extract mode button
    document.querySelectorAll('[data-extract]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-extract="${mode}"]`).classList.add('active');
    
    updateInterface();
}

function setRangeMode(mode) {
    currentRangeMode = mode;
    
    // Update active range mode button
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-range="${mode}"]`).classList.add('active');
}

function updateInterface() {
    const pagesGrid = document.getElementById('pagesGrid');
    const extractMode = document.getElementById('extractMode');
    const rangeControls = document.getElementById('rangeControls');
    
    // Hide all first
    pagesGrid.style.display = 'none';
    extractMode.style.display = 'none';
    rangeControls.classList.remove('active');
    
    // Show relevant controls based on mode
    if (currentSplitMode === 'pages') {
        pagesGrid.style.display = 'grid';
        extractMode.style.display = 'block';
    } else if (currentSplitMode === 'range') {
        rangeControls.classList.add('active');
    }
    
    updatePDFCount();
}

function updatePDFCount() {
    const pdfCountElement = document.getElementById('pdfCount');
    let count = 0;
    
    if (currentSplitMode === 'pages') {
        if (currentExtractMode === 'all') {
            count = totalPages;
        } else {
            count = selectedPages.length;
        }
    } else if (currentSplitMode === 'range') {
        count = document.querySelectorAll('.range-inputs').length;
    }
    
    if (pdfCountElement) {
        pdfCountElement.textContent = `${count} PDF`;
    }
}

function addRange() {
    rangeCounter++;
    const customInputs = document.getElementById('customRangeInputs');
    
    const newRange = document.createElement('div');
    newRange.className = 'range-inputs';
    newRange.innerHTML = `
        <label>Range ${rangeCounter}</label>
        <span>from page</span>
        <input type="number" class="range-input" value="1" min="1" max="${totalPages}" onchange="validateRangeInput(this)">
        <span>to</span>
        <input type="number" class="range-input" value="${totalPages}" min="1" max="${totalPages}" onchange="validateRangeInput(this)">
        <button type="button" onclick="this.parentElement.remove(); updatePDFCount();" 
                style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">×</button>
    `;
    
    customInputs.insertBefore(newRange, customInputs.querySelector('.add-range-btn'));
    updatePDFCount();
}

function validateRangeInput(input) {
    const value = parseInt(input.value);
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    
    if (value < min) {
        input.value = min;
        showWarning(`Page number cannot be less than ${min}`);
    } else if (value > max) {
        input.value = max;
        showWarning(`Page number cannot be greater than ${max}. This PDF has only ${totalPages} pages.`);
    }
    
    // Validate range logic (start <= end)
    const rangeInputs = input.parentElement.querySelectorAll('.range-input');
    if (rangeInputs.length === 2) {
        const startPage = parseInt(rangeInputs[0].value);
        const endPage = parseInt(rangeInputs[1].value);
        
        if (startPage > endPage) {
            showWarning(`Start page (${startPage}) cannot be greater than end page (${endPage})`);
            // Auto-correct: if start > end, swap them
            rangeInputs[0].value = endPage;
            rangeInputs[1].value = startPage;
        }
    }
}

function showWarning(message) {
    // Create or update warning message
    let warningDiv = document.getElementById('warningMessage');
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'warningMessage';
        warningDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            max-width: 300px;
            font-size: 14px;
        `;
        document.body.appendChild(warningDiv);
    }
    
    warningDiv.textContent = message;
    warningDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (warningDiv) {
            warningDiv.style.display = 'none';
        }
    }, 5000);
}

function validateAllRanges() {
    const errors = [];
    const ranges = [];
    
    // Collect and validate all ranges
    document.querySelectorAll('.range-inputs').forEach((rangeDiv, index) => {
        const inputs = rangeDiv.querySelectorAll('.range-input');
        if (inputs.length === 2) {
            const startPage = parseInt(inputs[0].value);
            const endPage = parseInt(inputs[1].value);
            
            // Validate bounds
            if (startPage < 1 || startPage > totalPages) {
                errors.push(`Range ${index + 1}: Start page ${startPage} is out of bounds (1-${totalPages})`);
            }
            if (endPage < 1 || endPage > totalPages) {
                errors.push(`Range ${index + 1}: End page ${endPage} is out of bounds (1-${totalPages})`);
            }
            if (startPage > endPage) {
                errors.push(`Range ${index + 1}: Start page ${startPage} cannot be greater than end page ${endPage}`);
            }
            
            if (startPage >= 1 && endPage <= totalPages && startPage <= endPage) {
                ranges.push([startPage, endPage]);
            }
        }
    });
    
    return { errors, ranges };
}

async function splitPDF() {
    if (!selectedFile) {
        alert('Please select a PDF file first');
        return;
    }

    const splitBtn = document.getElementById('splitBtn');
    const originalText = splitBtn.textContent;
    splitBtn.disabled = true;
    splitBtn.innerHTML = 'Splitting...';

    const formData = new FormData();
    formData.append("file", selectedFile);

    // Check if user wants merged PDF included
    const includeMergedCheckbox = document.getElementById('includeMergedPdf');
    const includeMerged = includeMergedCheckbox ? includeMergedCheckbox.checked : false;
    
    // Always create ZIP file (remove singlePDF parameter)
    // Add mergeAll parameter if user wants merged PDF
    if (includeMerged) {
        formData.append("mergeAll", "true");
    }

    try {
        // Determine split type and validate
        if (currentSplitMode === 'range') {
            const { errors, ranges } = validateAllRanges();
            
            if (errors.length > 0) {
                showWarning('Validation errors: ' + errors.join('; '));
                return;
            }
            
            if (ranges.length === 0) {
                showWarning('Please add at least one valid range');
                return;
            }
            
            formData.append("ranges", JSON.stringify(ranges));
            
        } else if (currentSplitMode === 'pages') {
            // Validate selected pages
            const invalidPages = selectedPages.filter(page => page < 1 || page > totalPages);
            if (invalidPages.length > 0) {
                showWarning(`Invalid pages: ${invalidPages.join(', ')}. Valid range is 1-${totalPages}`);
                return;
            }
            
            if (currentExtractMode === 'selected' && selectedPages.length === 0) {
                showWarning('Please select at least one page');
                return;
            }
            
            const pagesToSplit = currentExtractMode === 'all' ? 
                Array.from({length: totalPages}, (_, i) => i + 1) : selectedPages;
            
            formData.append("splitPages", JSON.stringify(pagesToSplit));
        }

        const res = await fetch("/split-pdf", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error + (errorData.details ? ': ' + errorData.details.join('; ') : ''));
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
        a.download = `split_pdfs_${timestamp}.zip`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const successMessage = includeMerged ? 
            "PDF split successfully! ZIP contains individual PDFs and merged PDF." :
            "PDF split successfully! ZIP contains individual PDFs.";
        alert(successMessage);
        
    } catch (err) {
        console.error(err);
        showWarning("Failed to split PDF: " + err.message);
    } finally {
        splitBtn.disabled = false;
        splitBtn.innerHTML = originalText;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize drag and drop
function initializeUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && files[0].type === 'application/pdf') {
            selectedFile = files[0];
            getPDFInfo(files[0]);
        }
    });
}

// Add event listeners for existing range inputs
function addRangeValidationToExistingInputs() {
    document.querySelectorAll('.range-input').forEach(input => {
        input.addEventListener('change', () => validateRangeInput(input));
        input.max = totalPages;
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeUploadArea();
    addRangeValidationToExistingInputs();
});