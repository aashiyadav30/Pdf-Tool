// Global Variables
let currentTool = 'select';
let isDrawing = false;
let currentPage = 1;
let totalPages = 1;
let zoomScale = 1;
let pdfDocument = null;
let canvas = document.getElementById('pdfCanvas');
let ctx = canvas.getContext('2d');
let annotations = [];
let selectedElement = null;
let drawingPaths = [];
let pdfPages = []; // Store PDF pages as images

// Initialize canvas
canvas.width = 800;
canvas.height = 600;

// Tool Management
function setTool(tool) {
    currentTool = tool;
    
    // Update active tool button
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tool + 'Tool').classList.add('active');
    
    // Update canvas cursor
    canvas.className = 'pdf-canvas';
    if (tool === 'text') {
        canvas.classList.add('text-mode');
        canvas.style.cursor = 'text';
    } else if (tool === 'select') {
        canvas.classList.add('select-mode');
        canvas.style.cursor = 'default';
    } else if (tool === 'draw') {
        canvas.style.cursor = 'crosshair';
    } else if (tool === 'eraser') {
        canvas.style.cursor = 'crosshair';
    } else if (tool === 'image') {
        canvas.style.cursor = 'copy';
    }
    
    // Show/hide property panels
    const drawingProps = document.getElementById('drawingProps');
    const textProps = document.getElementById('textProps');
    
    if (tool === 'draw' || tool === 'eraser') {
        drawingProps.style.display = 'flex';
        textProps.style.display = 'none';
    } else if (tool === 'text') {
        drawingProps.style.display = 'none';
        textProps.style.display = 'flex';
    } else {
        drawingProps.style.display = 'flex';
        textProps.style.display = 'none';
    }
}

// PDF Loading
async function loadPDF(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        try {
            // Create FormData to send file to server
            const formData = new FormData();
            formData.append('file', file);
            
            // Send file to server to get pages as images
            const response = await fetch('/pdf-to-images', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                pdfPages = data.pages;
                totalPages = data.total_pages;
                currentPage = 1;
                await renderPage();
                updatePageInfo();
                updateDocumentTitle(file.name);
            } else {
                throw new Error('Failed to process PDF');
            }
        } catch (error) {
            alert('Error loading PDF: ' + error.message);
            console.error('PDF loading error:', error);
        }
    }
}

// PDF Rendering
async function renderPage() {
    if (!pdfPages || pdfPages.length === 0) {
        // Show empty canvas with placeholder
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Load a PDF to start editing', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const pageData = pdfPages[currentPage - 1];
    if (!pageData) return;
    
    // Create image from base64 data
    const img = new Image();
    img.onload = function() {
        // Adjust canvas size based on zoom
        canvas.width = img.width * zoomScale;
        canvas.height = img.height * zoomScale;
        
        // Clear canvas with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw PDF page
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Render annotations for current page
        renderAnnotations();
    };
    img.src = pageData;
}

// Canvas Event Handlers
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('click', handleCanvasClick);

function handleMouseDown(e) {
    if (currentTool === 'draw' || currentTool === 'eraser') {
        startDrawing(e);
    } else if (currentTool === 'select') {
        // Handle selection of existing elements
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on any annotation elements
        const textElements = document.querySelectorAll('.text-input');
        const imageElements = document.querySelectorAll('.image-element');
        
        // Deselect all elements first
        [...textElements, ...imageElements].forEach(el => {
            el.style.border = '1px dashed #ccc';
            selectedElement = null;
        });
        
        // Check for element at click position
        const elementAtPosition = document.elementFromPoint(e.clientX, e.clientY);
        if (elementAtPosition && (elementAtPosition.classList.contains('text-input') || 
            elementAtPosition.classList.contains('image-element') ||
            elementAtPosition.closest('.text-input') || 
            elementAtPosition.closest('.image-element'))) {
            
            const element = elementAtPosition.classList.contains('text-input') || 
                          elementAtPosition.classList.contains('image-element') ? 
                          elementAtPosition : 
                          (elementAtPosition.closest('.text-input') || elementAtPosition.closest('.image-element'));
            
            element.style.border = '2px solid #007acc';
            selectedElement = element;
        }
    }
}

function handleMouseMove(e) {
    if ((currentTool === 'draw' || currentTool === 'eraser') && isDrawing) {
        draw(e);
    }
}

function handleMouseUp(e) {
    if ((currentTool === 'draw' || currentTool === 'eraser') && isDrawing) {
        stopDrawing();
    }
}

function handleCanvasClick(e) {
    if (currentTool === 'text') {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        createTextInput(x, y);
    } else if (currentTool === 'image') {
        document.getElementById('imageInput').click();
    }
}

// Drawing Functions
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomScale; // Adjust for zoom
    const y = (e.clientY - rect.top) / zoomScale;  // Adjust for zoom

    const color = document.getElementById('colorPicker').value;
    const size = parseInt(document.getElementById('brushSize').value);
    const opacity = parseFloat(document.getElementById('opacity').value);

    ctx.beginPath();
    ctx.moveTo(x * zoomScale, y * zoomScale); // Scale back for drawing

    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
    }

    ctx.lineWidth = size * zoomScale; // Scale line width with zoom
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const currentPath = {
        type: currentTool,
        points: [{ x, y }],
        color: currentTool === 'eraser' ? 'eraser' : color,
        size,
        opacity,
        page: currentPage
    };
    drawingPaths.push(currentPath);
}

function draw(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomScale; // Adjust for zoom
    const y = (e.clientY - rect.top) / zoomScale;  // Adjust for zoom
    
    ctx.lineTo(x * zoomScale, y * zoomScale); // Scale back for drawing
    ctx.stroke();
    
    // Add point to current path
    const currentPath = drawingPaths[drawingPaths.length - 1];
    if (currentPath) {
        currentPath.points.push({x, y});
    }
}

function stopDrawing() {
    isDrawing = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
}

// Text Functions
function createTextInput(x, y) {
    const textInput = document.createElement('div');
    textInput.className = 'text-input';
    textInput.contentEditable = true;
    textInput.style.position = 'absolute';
    textInput.style.left = (x + canvas.offsetLeft) + 'px'; // Position relative to canvas
    textInput.style.top = (y + canvas.offsetTop) + 'px';   // Position relative to canvas
    textInput.style.fontSize = (document.getElementById('fontSize')?.value || 16) + 'px';
    textInput.style.fontFamily = document.getElementById('fontFamily')?.value || 'Arial';
    textInput.style.color = document.getElementById('textColor')?.value || '#000000';
    textInput.style.border = '1px dashed #007acc';
    textInput.style.padding = '4px';
    textInput.style.background = 'rgba(255,255,255,0.9)';
    textInput.style.minWidth = '100px';
    textInput.style.minHeight = '20px';
    textInput.style.zIndex = '1000';
    textInput.innerHTML = 'Type here...';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.style.position = 'absolute';
    deleteBtn.style.top = '-10px';
    deleteBtn.style.right = '-10px';
    deleteBtn.style.width = '20px';
    deleteBtn.style.height = '20px';
    deleteBtn.style.border = 'none';
    deleteBtn.style.borderRadius = '50%';
    deleteBtn.style.background = '#ff4444';
    deleteBtn.style.color = 'white';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        textInput.remove();
    };
    textInput.appendChild(deleteBtn);
    
    document.body.appendChild(textInput); // Append to body for better positioning
    textInput.focus();
    
    // Select placeholder text
    textInput.addEventListener('focus', function() {
        if (this.textContent === 'Type here...') {
            this.textContent = '';
        }
    });
    
    // Handle blur event
    textInput.addEventListener('blur', function() {
        if (this.textContent.trim() === '') {
            this.remove();
        } else {
            // Save text annotation
            annotations.push({
                type: 'text',
                page: currentPage,
                x: x,
                y: y,
                text: this.textContent,
                fontSize: document.getElementById('fontSize')?.value || 16,
                fontFamily: document.getElementById('fontFamily')?.value || 'Arial',
                color: document.getElementById('textColor')?.value || '#000000'
            });
        }
    });
    
    // Handle enter key
    textInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.blur();
        }
    });
    
    // Make draggable
    makeDraggable(textInput);
}

// Image Functions
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Get canvas position for placing image at center
                const rect = canvas.getBoundingClientRect();
                const centerX = rect.left + (canvas.width / 2) - 100; // Center horizontally
                const centerY = rect.top + (canvas.height / 2) - 100; // Center vertically
                
                // Create draggable image element
                createImageElement(img, centerX, centerY);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    // Clear the input so same file can be selected again
    event.target.value = '';
}

function createImageElement(img, x, y) {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'image-element';
    imageDiv.style.left = x + 'px';
    imageDiv.style.top = y + 'px';
    imageDiv.style.position = 'absolute';
    imageDiv.style.cursor = 'move';
    imageDiv.style.border = '2px dashed #007acc';
    imageDiv.style.padding = '5px';
    imageDiv.style.background = 'rgba(255,255,255,0.9)';
    imageDiv.style.zIndex = '1000';
    imageDiv.style.borderRadius = '4px';
    
    const imgElement = document.createElement('img');
    imgElement.src = img.src;
    imgElement.style.maxWidth = '200px';
    imgElement.style.maxHeight = '200px';
    imgElement.style.display = 'block';
    imgElement.draggable = false;
    
    // Resize handles
    const resizeHandle = document.createElement('div');
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.bottom = '-5px';
    resizeHandle.style.right = '-5px';
    resizeHandle.style.width = '10px';
    resizeHandle.style.height = '10px';
    resizeHandle.style.background = '#007acc';
    resizeHandle.style.cursor = 'se-resize';
    resizeHandle.style.borderRadius = '2px';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.style.position = 'absolute';
    deleteBtn.style.top = '-10px';
    deleteBtn.style.right = '-10px';
    deleteBtn.style.width = '20px';
    deleteBtn.style.height = '20px';
    deleteBtn.style.border = 'none';
    deleteBtn.style.borderRadius = '50%';
    deleteBtn.style.background = '#ff4444';
    deleteBtn.style.color = 'white';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        imageDiv.remove();
    };
    
    imageDiv.appendChild(imgElement);
    imageDiv.appendChild(resizeHandle);
    imageDiv.appendChild(deleteBtn);
    document.body.appendChild(imageDiv); // Append to body for better positioning
    
    // Make draggable
    makeDraggable(imageDiv);
    
    // Make resizable
    makeResizable(imageDiv, resizeHandle, imgElement);
    
    // Save image annotation
    annotations.push({
        type: 'image',
        page: currentPage,
        x: x,
        y: y,
        src: img.src,
        width: imgElement.width,
        height: imgElement.height
    });
}

// Navigation Functions
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPage();
        updatePageInfo();
        hideCurrentPageElements();
        showCurrentPageElements();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderPage();
        updatePageInfo();
        hideCurrentPageElements();
        showCurrentPageElements();
    }
}

function hideCurrentPageElements() {
    // Hide all text and image elements when changing pages
    document.querySelectorAll('.text-input, .image-element').forEach(el => {
        el.style.display = 'none';
    });
}

function showCurrentPageElements() {
    // Show elements for current page
    annotations.forEach(annotation => {
        if (annotation.page === currentPage) {
            // Re-create elements for current page
            if (annotation.type === 'text') {
                // Create text element at saved position
                const textEl = document.querySelector(`[data-annotation-id="${annotation.id}"]`);
                if (!textEl) {
                    // Create if doesn't exist
                    createTextInputFromAnnotation(annotation);
                }
            }
        }
    });
}

function updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

function updateDocumentTitle(filename) {
    const titleElement = document.getElementById('documentTitle');
    if (titleElement) {
        titleElement.textContent = filename;
    }
}

// Zoom Functions
function zoomIn() {
    zoomScale = Math.min(zoomScale * 1.25, 3);
    renderPage();
    updateZoomInfo();
}

function zoomOut() {
    zoomScale = Math.max(zoomScale / 1.25, 0.25);
    renderPage();
    updateZoomInfo();
}

function resetZoom() {
    zoomScale = 1;
    renderPage();
    updateZoomInfo();
}

function updateZoomInfo() {
    const zoomInfo = document.getElementById('zoomInfo');
    if (zoomInfo) {
        zoomInfo.textContent = Math.round(zoomScale * 100) + '%';
    }
}

// Annotation Rendering
function renderAnnotations() {
    // Render drawing paths for current page
    drawingPaths.forEach(path => {
        if (path.page === currentPage) {
            ctx.beginPath();
            ctx.globalAlpha = path.opacity;
            ctx.lineWidth = path.size * zoomScale; // Scale with zoom
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            if (path.type === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = path.color;
            }
            
            path.points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x * zoomScale, point.y * zoomScale);
                } else {
                    ctx.lineTo(point.x * zoomScale, point.y * zoomScale);
                }
            });
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
    });
}

// Utility Functions
function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    element.addEventListener('mousedown', function(e) {
        // Only start dragging if not clicking on delete button or resize handle
        if (e.target.classList.contains('delete-btn') || e.target.style.cursor === 'se-resize') {
            return;
        }
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = parseInt(element.style.left) || 0;
        initialY = parseInt(element.style.top) || 0;
        element.style.zIndex = 1001;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            element.style.left = (initialX + deltaX) + 'px';
            element.style.top = (initialY + deltaY) + 'px';
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            element.style.zIndex = '1000';
        }
    });
}

function makeResizable(element, handle, imgElement) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    handle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(window.getComputedStyle(imgElement).width, 10);
        startHeight = parseInt(window.getComputedStyle(imgElement).height, 10);
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isResizing) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const newWidth = Math.max(50, startWidth + deltaX);
            const newHeight = Math.max(50, startHeight + deltaY);
            
            imgElement.style.width = newWidth + 'px';
            imgElement.style.height = newHeight + 'px';
        }
    });
    
    document.addEventListener('mouseup', function() {
        isResizing = false;
    });
}

// Delete selected element function
function deleteSelected() {
    if (selectedElement) {
        selectedElement.remove();
        selectedElement = null;
    }
}

// Save/Export Functions
async function savePDF() {
    if (!pdfPages || pdfPages.length === 0) {
        alert('No PDF loaded to save');
        return;
    }
    
    try {
        // Capture all pages with annotations
        const editedPages = [];
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            // Temporarily switch to this page and render
            const originalPage = currentPage;
            currentPage = pageNum;
            await renderPage();
            
            // Capture canvas as base64
            const pageData = canvas.toDataURL('image/png');
            editedPages.push({
                page: pageNum,
                data: pageData
            });
            
            // Restore original page
            currentPage = originalPage;
        }
        
        // Restore current page view
        await renderPage();
        
        // Send to server to create PDF
        const response = await fetch('/save-edited-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pages: editedPages,
                annotations: annotations,
                drawingPaths: drawingPaths
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'edited-document.pdf';
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            throw new Error('Failed to save PDF');
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Error saving PDF: ' + error.message);
    }
}

function saveAsImage() {
    const link = document.createElement('a');
    link.download = 'edited-pdf-page.png';
    link.href = canvas.toDataURL();
    link.click();
}

function printPDF() {
    if (!pdfPages || pdfPages.length === 0) {
        alert('No PDF loaded to print');
        return;
    }
    window.print();
}

// Clear Functions
function clearAnnotations() {
    if (confirm('Are you sure you want to clear all annotations on this page?')) {
        // Remove annotations for current page
        annotations = annotations.filter(ann => ann.page !== currentPage);
        drawingPaths = drawingPaths.filter(path => path.page !== currentPage);
        
        // Remove text and image elements for current page
        document.querySelectorAll('.text-input, .image-element').forEach(el => el.remove());
        
        // Re-render page
        renderPage();
    }
}

function undoLast() {
    // Remove last drawing path on current page
    for (let i = drawingPaths.length - 1; i >= 0; i--) {
        if (drawingPaths[i].page === currentPage) {
            drawingPaths.splice(i, 1);
            break;
        }
    }
    renderPage();
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    // File input
    const fileInput = document.getElementById('pdfInput');
    if (fileInput) {
        fileInput.addEventListener('change', loadPDF);
    }
    
    // Image input
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }
    
    // Tool buttons
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tool = this.id.replace('Tool', '');
            setTool(tool);
        });
    });
    
    // Navigation buttons
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    if (prevBtn) prevBtn.addEventListener('click', prevPage);
    if (nextBtn) nextBtn.addEventListener('click', nextPage);
    
    // Zoom buttons
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const resetZoomBtn = document.getElementById('resetZoom');
    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
    if (resetZoomBtn) resetZoomBtn.addEventListener('click', resetZoom);
    
    // Action buttons
    const saveBtn = document.getElementById('savePDF');
    const printBtn = document.getElementById('printPDF');
    const clearBtn = document.getElementById('clearAnnotations');
    const undoBtn = document.getElementById('undoBtn');
    if (saveBtn) saveBtn.addEventListener('click', savePDF);
    if (printBtn) printBtn.addEventListener('click', printPDF);
    if (clearBtn) clearBtn.addEventListener('click', clearAnnotations);
    if (undoBtn) undoBtn.addEventListener('click', undoLast);
    
    // Property panel updates
    const colorPicker = document.getElementById('colorPicker');
    const brushSize = document.getElementById('brushSize');
    const opacity = document.getElementById('opacity');
    const textColor = document.getElementById('textColor');
    const fontSize = document.getElementById('fontSize');
    const fontFamily = document.getElementById('fontFamily');
    
    // Color picker update
    if (colorPicker) {
        colorPicker.addEventListener('input', function() {
            const colorLabel = document.querySelector('.color-label');
            if (colorLabel) {
                colorLabel.textContent = this.value;
            }
        });
    }
    
    // Brush size update
    if (brushSize) {
        brushSize.addEventListener('input', function() {
            const sizeDisplay = document.getElementById('sizeDisplay');
            if (sizeDisplay) {
                sizeDisplay.textContent = this.value + 'px';
            }
        });
        // Trigger initial update
        brushSize.dispatchEvent(new Event('input'));
    }
    
    // Opacity update
    if (opacity) {
        opacity.addEventListener('input', function() {
            const opacityDisplay = document.getElementById('opacityDisplay');
            if (opacityDisplay) {
                opacityDisplay.textContent = Math.round(this.value * 100) + '%';
            }
        });
        // Trigger initial update
        opacity.dispatchEvent(new Event('input'));
    }
    
    // Font size update
    if (fontSize) {
        fontSize.addEventListener('input', function() {
            const sizeDisplay = document.getElementById('fontSizeDisplay');
            if (sizeDisplay) {
                sizeDisplay.textContent = this.value + 'px';
            }
        });
    }
    
    // Initialize default tool
    setTool('select');
    renderPage();
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ignore if user is typing in an input field
    if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 's':
                e.preventDefault();
                savePDF();
                break;
            case 'p':
                e.preventDefault();
                printPDF();
                break;
            case '=':
            case '+':
                e.preventDefault();
                zoomIn();
                break;
            case '-':
                e.preventDefault();
                zoomOut();
                break;
            case '0':
                e.preventDefault();
                resetZoom();
                break;
            case 'z':
                e.preventDefault();
                undoLast();
                break;
        }
    }
    
    // Tool shortcuts
    switch(e.key) {
        case 'v':
            setTool('select');
            break;
        case 'd':
            setTool('draw');
            break;
        case 't':
            setTool('text');
            break;
        case 'i':
            setTool('image');
            break;
        case 'e':
            setTool('eraser');
            break;
        case 'ArrowLeft':
            prevPage();
            break;
        case 'ArrowRight':
            nextPage();
            break;
        case 'Escape':
            setTool('select');
            break;
        case 'Delete':
        case 'Backspace':
            deleteSelected();
            break;
    }
});