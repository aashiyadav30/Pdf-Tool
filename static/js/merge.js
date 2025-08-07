// File handling for merge page
let selectedFiles = [];
let fileCounter = 0;
let draggedElement = null;
let originalOrder = []; // Store original order for restoration

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    addFiles(files);
}

function addFiles(files) {
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    pdfFiles.forEach(file => {
        const fileObj = {
            id: ++fileCounter,
            file: file,
            name: file.name,
            size: file.size,
            pages: Math.floor(Math.random() * 50) + 1, // Simulated page count
            rotation: 0
        };
        selectedFiles.push(fileObj);
    });
    
    // Update original order when files are added
    originalOrder = [...selectedFiles];
    
    updateInterface();
}

function updateInterface() {
    const uploadArea = document.getElementById('uploadArea');
    const mergeInterface = document.getElementById('mergeInterface');
    
    if (selectedFiles.length > 0) {
        uploadArea.style.display = 'none';
        mergeInterface.style.display = 'block';
        updateFileGrid();
        updateFileCount();
        updateMergeButton();
    } else {
        uploadArea.style.display = 'block';
        mergeInterface.style.display = 'none';
    }
}

function updateFileGrid() {
    const fileGrid = document.getElementById('fileGrid');
    fileGrid.innerHTML = '';
    
    selectedFiles.forEach((fileObj, index) => {
        const fileCard = createFileCard(fileObj, index);
        fileGrid.appendChild(fileCard);
    });
}

function createFileCard(fileObj, index) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.draggable = true;
    card.dataset.fileId = fileObj.id;
    
    card.innerHTML = `
        <div class="file-controls">
            <button class="control-btn rotate-btn" onclick="rotateFile(${fileObj.id})" title="Rotate">↻</button>
            <button class="control-btn delete-btn" onclick="removeFile(${fileObj.id})" title="Remove">×</button>
        </div>
        <div class="file-preview-thumb" style="transform: rotate(${fileObj.rotation}deg)">
            <div class="page-indicator">${fileObj.pages}p</div>
            PDF
        </div>
        <div class="file-info">${formatFileSize(fileObj.size)}</div>
        <div class="file-name-small">${fileObj.name}</div>
    `;
    
    // Add drag and drop event listeners
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

function updateFileCount() {
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalPages = selectedFiles.reduce((sum, file) => sum + file.pages, 0);
    
    document.getElementById('fileCountInfo').textContent = 
        `${formatFileSize(totalSize)} - ${totalPages} pages`;
}

function updateMergeButton() {
    const mergeBtn = document.getElementById('mergeBtn');
    if (selectedFiles.length >= 2) {
        mergeBtn.disabled = false;
        mergeBtn.textContent = `Merge ${selectedFiles.length} PDFs`;
    } else {
        mergeBtn.disabled = true;
        mergeBtn.textContent = 'Select at least 2 files to merge';
    }
}

function rotateFile(fileId) {
    const fileObj = selectedFiles.find(f => f.id === fileId);
    if (fileObj) {
        fileObj.rotation = (fileObj.rotation + 90) % 360;
        updateFileGrid();
        console.log(`File ${fileObj.name} rotated to ${fileObj.rotation} degrees`);
    }
}

function removeFile(fileId) {
    selectedFiles = selectedFiles.filter(f => f.id !== fileId);
    // Also remove from original order
    originalOrder = originalOrder.filter(f => f.id !== fileId);
    updateInterface();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Sorting functions
function sortFiles(order) {
    // Store original order if not already stored
    if (originalOrder.length === 0) {
        originalOrder = [...selectedFiles];
    }
    
    switch (order) {
        case 'asc':
            selectedFiles.sort((a, b) => a.name.localeCompare(b.name));
            updateSortButtonState('asc');
            break;
        case 'desc':
            selectedFiles.sort((a, b) => b.name.localeCompare(a.name));
            updateSortButtonState('desc');
            break;
        case 'original':
            selectedFiles = [...originalOrder];
            updateSortButtonState('original');
            break;
        default:
            console.error('Invalid sort order:', order);
            return;
    }
    
    updateFileGrid();
    console.log('Files sorted:', order, selectedFiles.map(f => f.name));
}

// Function to update sort button states
function updateSortButtonState(activeSort) {
    const sortButtons = document.querySelectorAll('.sort-btn');
    sortButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to the appropriate button
    switch (activeSort) {
        case 'asc':
            const ascBtn = document.querySelector('.sort-btn[onclick="sortFiles(\'asc\')"]');
            if (ascBtn) ascBtn.classList.add('active');
            break;
        case 'desc':
            const descBtn = document.querySelector('.sort-btn[onclick="sortFiles(\'desc\')"]');
            if (descBtn) descBtn.classList.add('active');
            break;
        case 'original':
            const origBtn = document.querySelector('.sort-btn[onclick="sortFiles(\'original\')"]');
            if (origBtn) origBtn.classList.add('active');
            break;
    }
}

// Drag and drop functionality
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const draggedId = parseInt(draggedElement.dataset.fileId);
        const targetId = parseInt(this.dataset.fileId);
        
        const draggedIndex = selectedFiles.findIndex(f => f.id === draggedId);
        const targetIndex = selectedFiles.findIndex(f => f.id === targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Swap the files in the array
            const temp = selectedFiles[draggedIndex];
            selectedFiles[draggedIndex] = selectedFiles[targetIndex];
            selectedFiles[targetIndex] = temp;
            
            updateFileGrid();
            // Reset to original order button state since manual reordering occurred
            updateSortButtonState('original');
            console.log('Files reordered via drag and drop');
        }
    }
    
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedElement = null;
}

// Clear all files function
function clearAllFiles() {
    selectedFiles = [];
    originalOrder = [];
    fileCounter = 0;
    updateInterface();
}

// Enhanced merge pdf functionality with rotation and order support
async function mergePDFs() {
    if (selectedFiles.length < 2) {
        alert('Please select at least 2 PDF files to merge');
        return;
    }

    const mergeBtn = document.getElementById('mergeBtn');
    const originalText = mergeBtn.textContent;
    mergeBtn.disabled = true;
    mergeBtn.textContent = 'Merging...';

    try {
        const formData = new FormData();
        
        // Add files in the current order
        selectedFiles.forEach((fileObj, index) => {
            formData.append("files", fileObj.file);
        });
        
        // Add metadata about file rotations
        const metadata = {};
        selectedFiles.forEach((fileObj, index) => {
            if (fileObj.rotation !== 0) {
                metadata[index] = {
                    rotation: fileObj.rotation,
                    name: fileObj.name
                };
            }
        });
        
        if (Object.keys(metadata).length > 0) {
            formData.append("metadata", JSON.stringify(metadata));
        }

        console.log('Sending merge request with file order:', selectedFiles.map(f => f.name));
        console.log('File rotations:', metadata);

        const response = await fetch("/merge", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || "Merge failed");
        }

        // Get the filename from the response headers if available
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'merged_pdf.pdf';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("PDFs merged successfully!");
        console.log(`Downloaded merged PDF: ${filename}`);
    } catch (error) {
        console.error("Merge failed:", error);
        alert(`Merge failed: ${error.message}. Please try again.`);
    } finally {
        mergeBtn.disabled = false;
        mergeBtn.textContent = originalText;
    }
}

// Initialize drag and drop on upload area
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
        addFiles(files); 
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeUploadArea();
});