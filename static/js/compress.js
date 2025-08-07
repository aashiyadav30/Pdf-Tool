let selectedFiles = [];
let compressionLevel = 'recommended';
let sortOrder = 'name'; // 'name', 'size', 'name-desc', 'size-desc'

// File input handler
document.getElementById('fileInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        selectedFiles = files;
        showCompressionInterface();
        displayFiles();
    }
});

// Drag and drop functionality for file upload
const uploadArea = document.querySelector('.upload-area');

uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.style.borderColor = '#e74c3c';
    this.style.background = '#fef9f9';
});

uploadArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.style.borderColor = '#ddd';
    this.style.background = 'white';
});

uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    this.style.borderColor = '#ddd';
    this.style.background = 'white';
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (files.length > 0) {
        selectedFiles = files;
        showCompressionInterface();
        displayFiles();
        // Update file input to reflect dropped files
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        document.getElementById('fileInput').files = dt.files;
    } else {
        showNotification('Please drop only PDF files', 'error');
    }
});

// Show compression interface
function showCompressionInterface() {
    document.getElementById('uploadInterface').style.display = 'none';
    document.getElementById('compressionInterface').style.display = 'block';
}

// Drag and drop functionality for file reordering
let draggedIndex = -1;

function setupDragAndDrop() {
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach((item, index) => {
        item.addEventListener('dragstart', function(e) {
            draggedIndex = index;
            this.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        });
        
        item.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
            draggedIndex = -1;
        });
        
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.style.borderTop = '3px solid #e74c3c';
        });
        
        item.addEventListener('dragleave', function(e) {
            this.style.borderTop = 'none';
        });
        
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderTop = 'none';
            
            const dropIndex = parseInt(this.dataset.index);
            
            if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
                // Reorder the files array
                const draggedFile = selectedFiles[draggedIndex];
                selectedFiles.splice(draggedIndex, 1);
                selectedFiles.splice(dropIndex, 0, draggedFile);
                
                // Refresh the display
                displayFiles();
                showNotification('Files reordered successfully', 'success');
            }
        });
    });
}

// Sort functionality
function sortFiles() {
    const sortBtn = document.querySelector('.sort-btn');
    
    // Cycle through sort options
    switch(sortOrder) {
        case 'name':
            sortOrder = 'name-desc';
            selectedFiles.sort((a, b) => b.name.localeCompare(a.name));
            sortBtn.textContent = '↓';
            sortBtn.title = 'Sort by name (Z-A)';
            break;
        case 'name-desc':
            sortOrder = 'size';
            selectedFiles.sort((a, b) => a.size - b.size);
            sortBtn.textContent = '↕';
            sortBtn.title = 'Sort by size (smallest first)';
            break;
        case 'size':
            sortOrder = 'size-desc';
            selectedFiles.sort((a, b) => b.size - a.size);
            sortBtn.textContent = '↓';
            sortBtn.title = 'Sort by size (largest first)';
            break;
        case 'size-desc':
            sortOrder = 'name';
            selectedFiles.sort((a, b) => a.name.localeCompare(b.name));
            sortBtn.textContent = '↑';
            sortBtn.title = 'Sort by name (A-Z)';
            break;
    }
    
    displayFiles();
    showNotification(`Files sorted by ${sortOrder.replace('-desc', ' (descending)')}`, 'info');
}

// Display selected files with enhanced preview
function displayFiles() {
    const fileGrid = document.getElementById('fileGrid');
    const totalFilesCounter = document.getElementById('totalFiles');
    
    fileGrid.innerHTML = '';
    totalFilesCounter.textContent = selectedFiles.length;

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.draggable = true;
        fileItem.dataset.index = index;
        
        // Calculate file size in appropriate units
        const fileSize = formatFileSize(file.size);
        
        // Create preview content with file info
        const previewImages = [
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRkY2NzMzIi8+Cjx0ZXh0IHg9IjUwIiB5PSI2MCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCI+UERGPC90ZXh0Pgo8L3N2Zz4K',
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNEREREREQiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSIxMDAiPgo8bGluZSB4MT0iMCIgeTE9IjEwIiB4Mj0iODAiIHkyPSIxMCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz4KPHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTAwIj4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHg9IjEwIiB5PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI0U3NEMzQyIvPgo8L3N2Zz4KPHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNSIgeD0iNDAiIHk9IjI1Ij4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjUiIGZpbGw9IiNEREQiLz4KPC9zdmc+Cjxzdmcgd2lkdGg9IjcwIiBoZWlnaHQ9IjMiIHg9IjEwIiB5PSI1MCI+CjxyZWN0IHdpZHRoPSI3MCIgaGVpZ2h0PSIzIiBmaWxsPSIjRERkIi8+Cjwvc3ZnPgo8c3ZnIHdpZHRoPSI2MCIgaGVpZ2h0PSIzIiB4PSIxMCIgeT0iNjAiPgo8cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iMyIgZmlsbD0iI0RERCIvPgo8L3N2Zz4KPC9zdmc+Cjwvc3ZnPgo8L3N2Zz4K',
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNEREREREQiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSIxMDAiPgo8cGF0aCBkPSJNIDEwIDEwIEwgNzAgMTAgTCA3MCAzMCBMIDEwIDMwIFoiIGZpbGw9IiNGRkQ3MDAiLz4KPHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNSIgeD0iMTAiIHk9IjUwIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjUiIGZpbGw9IiNEREQiLz4KPC9zdmc+Cjxzdmcgd2lkdGg9IjcwIiBoZWlnaHQ9IjUiIHg9IjEwIiB5PSI2MCI+CjxyZWN0IHdpZHRoPSI3MCIgaGVpZ2h0PSI1IiBmaWxsPSIjREREIi8+Cjwvc3ZnPgo8c3ZnIHdpZHRoPSI1MCIgaGVpZ2h0PSI1IiB4PSIxMCIgeT0iNzAiPgo8cmVjdCB3aWR0aD0iNTAiIGhlaWdodD0iNSIgZmlsbD0iI0RERCIvPgo8L3N2Zz4KPC9zdmc+Cjwvc3ZnPgo='
        ];
        
        const previewContent = `<img src="${previewImages[index % previewImages.length]}" alt="PDF Preview">`;

        fileItem.innerHTML = `
            <div class="file-counter">${index + 1}</div>
            <div class="file-preview">${previewContent}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${truncateFileName(file.name, 20)}</div>
                <div class="file-size">${fileSize}</div>
            </div>
            <div class="remove-btn" onclick="removeFile(${index})">×</div>
            <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        `;
        
        fileGrid.appendChild(fileItem);
    });
    
    // Setup drag and drop after creating elements
    setupDragAndDrop();
    updateTotalSize();
}

// Remove file function
function removeFile(index) {
    selectedFiles.splice(index, 1);
    if (selectedFiles.length === 0) {
        document.getElementById('uploadInterface').style.display = 'block';
        document.getElementById('compressionInterface').style.display = 'none';
    } else {
        displayFiles();
    }
}

// Compression level selection
document.addEventListener('DOMContentLoaded', function() {
    const compressionOptions = document.querySelectorAll('.compression-option');
    
    compressionOptions.forEach(option => {
        option.addEventListener('click', function() {
            compressionOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            compressionLevel = this.dataset.level;
            updateCompressionInfo();
        });
    });
    
    // Set default compression level
    const recommendedOption = document.querySelector('[data-level="recommended"]');
    if (recommendedOption) {
        recommendedOption.classList.add('selected');
    }
    
    // Setup sort button
    const sortBtn = document.querySelector('.sort-btn');
    if (sortBtn) {
        sortBtn.addEventListener('click', sortFiles);
        sortBtn.title = 'Sort by name (A-Z)';
    }
});

// Update compression info display
function updateCompressionInfo() {
    const info = {
        'less': 'High quality, less compression - Preserves maximum image quality',
        'recommended': 'Good quality, good compression - Balanced approach for most use cases',
        'extreme': 'Less quality, high compression - Maximum file size reduction'
    };
    
    const infoElement = document.getElementById('compressionInfo');
    if (infoElement) {
        infoElement.textContent = info[compressionLevel];
    }
    
    showNotification(`Compression level set to: ${compressionLevel.toUpperCase()}`, 'info');
}

// Start compression process - UPDATED TO WORK WITH FLASK BACKEND
async function startCompression() {
    if (selectedFiles.length === 0) {
        showNotification('Please select files first', 'error');
        return;
    }
    
    const compressBtn = document.getElementById('compressBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // Show progress and disable button
    compressBtn.disabled = true;
    compressBtn.textContent = 'Compressing...';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Preparing files for compression...';
    
    try {
        // Create FormData to send files to Flask backend
        const formData = new FormData();
        
        // Add all selected files in their current order
        selectedFiles.forEach((file, index) => {
            formData.append('files', file);
            formData.append(`file_order_${index}`, index.toString());
        });
        
        // Add compression level
        formData.append('level', compressionLevel);
        
        // Update progress
        progressText.textContent = 'Uploading and compressing files...';
        progressBar.style.width = '30%';
        
        // Send request to Flask backend
        const response = await fetch('/compress', {
            method: 'POST',
            body: formData
        });
        
        progressBar.style.width = '70%';
        progressText.textContent = 'Processing compression...';
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Compression failed');
        }
        
        // Get the compressed file(s)
        const blob = await response.blob();
        
        progressBar.style.width = '90%';
        progressText.textContent = 'Preparing download...';
        
        // Create download
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'compressed_files.pdf';
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        // Determine file type from content-type or filename
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('zip')) {
            filename = filename.endsWith('.zip') ? filename : filename.replace(/\.[^/.]+$/, '') + '.zip';
        }
        
        // Download the file
        downloadBlob(blob, filename);
        
        progressBar.style.width = '100%';
        progressText.textContent = 'Compression completed!';
        
        showNotification('Files compressed successfully!', 'success');
        
        // Optional: Reset after successful compression
        setTimeout(() => {
            resetUpload();
        }, 2000);
        
    } catch (error) {
        console.error('Compression error:', error);
        showNotification(`Compression failed: ${error.message}`, 'error');
    } finally {
        // Reset UI
        setTimeout(() => {
            compressBtn.disabled = false;
            compressBtn.textContent = 'Compress PDF';
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
        }, 1000);
    }
}

// Download blob function
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateFileName(fileName, maxLength) {
    if (fileName.length <= maxLength) return fileName;
    
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
    
    return truncatedName + '.' + extension;
}

function updateTotalSize() {
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeElement = document.getElementById('totalSize');
    if (totalSizeElement) {
        totalSizeElement.textContent = formatFileSize(totalSize);
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        opacity: 0;
        transform: translateX(300px);
        transition: all 0.3s ease;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    // Set background color based on type
    const colors = {
        'success': '#27ae60',
        'error': '#e74c3c',
        'info': '#3498db',
        'warning': '#f39c12'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(300px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Reset functionality
function resetUpload() {
    selectedFiles = [];
    compressionLevel = 'recommended';
    sortOrder = 'name';
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    document.getElementById('uploadInterface').style.display = 'block';
    document.getElementById('compressionInterface').style.display = 'none';
    
    // Reset compression level options
    const compressionOptions = document.querySelectorAll('.compression-option');
    compressionOptions.forEach(opt => opt.classList.remove('selected'));
    const recommendedOption = document.querySelector('[data-level="recommended"]');
    if (recommendedOption) {
        recommendedOption.classList.add('selected');
    }
    
    // Reset sort button
    const sortBtn = document.querySelector('.sort-btn');
    if (sortBtn) {
        sortBtn.textContent = '↕';
        sortBtn.title = 'Sort by name (A-Z)';
    }
    
    showNotification('Upload reset successfully', 'info');
}

// Event listeners for buttons
document.addEventListener('DOMContentLoaded', function() {
    const compressBtn = document.querySelector('.compress-final-btn');
    const resetBtn = document.getElementById('resetBtn');
    
    if (compressBtn) {
        compressBtn.addEventListener('click', startCompression);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetUpload);
    }
    
    // Initialize compression info
    updateCompressionInfo();
});