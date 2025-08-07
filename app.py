from flask import Flask, render_template, request, send_file, redirect, url_for, flash, jsonify
import os
import PyPDF2
from werkzeug.utils import secure_filename
from io import BytesIO
from zipfile import ZipFile
from datetime import datetime
import json
import base64
import fitz  # PyMuPDF for compression
from PIL import Image
import io

app = Flask(__name__)
app.secret_key = 'bda1e89cf55792f1d13c3c51b2fbabe3'
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/merge')
def merge_page():
    return render_template('merge.html')

@app.route('/split')
def split_page():
    return render_template('split.html')

@app.route('/compress')
def compress_page():
    return render_template('compress.html')

@app.route('/edit')
def edit_page():
    return render_template('edit.html')


# ===== PDF TO IMAGES ROUTE (Required for Editor) =====
@app.route('/pdf-to-images', methods=['POST'])
def pdf_to_images():
    """Convert PDF pages to base64 encoded images for editing"""
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.pdf'):
            return jsonify({'error': 'Invalid PDF file'}), 400
        
        # Read PDF file
        file_bytes = file.read()
        
        # Open PDF with PyMuPDF
        pdf_doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        
        # Convert each page to image
        for page_num in range(len(pdf_doc)):
            page = pdf_doc.load_page(page_num)
            
            # Render page as image with high DPI for better quality
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            
            # Convert to base64
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            pages.append(f"data:image/png;base64,{img_base64}")
        
        pdf_doc.close()
        
        return jsonify({
            'pages': pages,
            'total_pages': len(pages)
        })
        
    except Exception as e:
        print(f"Error converting PDF to images: {str(e)}")
        return jsonify({'error': f'Failed to convert PDF: {str(e)}'}), 500


# ===== SAVE EDITED PDF ROUTE =====
@app.route('/save-edited-pdf', methods=['POST'])
def save_edited_pdf():
    """Save edited PDF with annotations"""
    try:
        data = request.get_json()
        
        if not data or 'pages' not in data:
            return jsonify({'error': 'No page data provided'}), 400
        
        pages_data = data['pages']
        
        # Create a new PDF document
        pdf_doc = fitz.open()
        
        for page_info in pages_data:
            page_num = page_info['page']
            page_data = page_info['data']
            
            # Remove data URL prefix if present
            if page_data.startswith('data:image/png;base64,'):
                page_data = page_data.split(',')[1]
            
            # Decode base64 image
            img_bytes = base64.b64decode(page_data)
            
            # Open image with PIL to get dimensions
            img = Image.open(io.BytesIO(img_bytes))
            img_width, img_height = img.size
            
            # Create new page in PDF with image dimensions
            page = pdf_doc.new_page(width=img_width, height=img_height)
            
            # Insert the edited page image
            page.insert_image(fitz.Rect(0, 0, img_width, img_height), stream=img_bytes)
        
        # Save PDF to BytesIO
        pdf_stream = BytesIO()
        pdf_bytes = pdf_doc.tobytes()
        pdf_stream.write(pdf_bytes)
        pdf_stream.seek(0)
        
        pdf_doc.close()
        
        # Generate filename with timestamp
        current_time = datetime.now()
        filename = f"edited_pdf_{current_time.strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_stream,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Error saving edited PDF: {str(e)}")
        return jsonify({'error': f'Failed to save PDF: {str(e)}'}), 500


# ===== PDF COMPRESSION ROUTE =====
@app.route('/compress', methods=['POST'])
def compress_pdf():
    try:
        files = request.files.getlist('files')
        compression_level = request.form.get('level', 'recommended')
        
        if not files or len(files) == 0:
            return jsonify({'error': 'No files provided'}), 400
        
        # Validate all files are PDFs
        valid_files = []
        for file in files:
            if file and file.filename.endswith('.pdf'):
                valid_files.append(file)
        
        if not valid_files:
            return jsonify({'error': 'No valid PDF files found'}), 400
        
        # Compression settings based on level
        compression_settings = {
            'less': {
                'deflate_level': 1,
                'image_quality': 95,
                'image_resolution': 300
            },
            'recommended': {
                'deflate_level': 6,
                'image_quality': 75,
                'image_resolution': 150
            },
            'extreme': {
                'deflate_level': 9,
                'image_quality': 50,
                'image_resolution': 72
            }
        }
        
        settings = compression_settings.get(compression_level, compression_settings['recommended'])
        
        # If single file, return compressed PDF directly
        if len(valid_files) == 1:
            compressed_pdf = compress_single_pdf(valid_files[0], settings)
            
            # Generate filename
            original_name = valid_files[0].filename
            name_without_ext = os.path.splitext(original_name)[0]
            current_time = datetime.now()
            filename = f"{name_without_ext}_compressed_{current_time.strftime('%Y%m%d_%H%M%S')}.pdf"
            
            return send_file(
                compressed_pdf,
                as_attachment=True,
                download_name=filename,
                mimetype='application/pdf'
            )
        
        # Multiple files - create ZIP
        else:
            zip_stream = BytesIO()
            
            with ZipFile(zip_stream, 'w') as zipf:
                for i, file in enumerate(valid_files):
                    try:
                        compressed_pdf = compress_single_pdf(file, settings)
                        
                        # Generate filename for each compressed PDF
                        original_name = file.filename
                        name_without_ext = os.path.splitext(original_name)[0]
                        filename = f"{name_without_ext}_compressed.pdf"
                        
                        # Add to ZIP
                        zipf.writestr(filename, compressed_pdf.read())
                        
                    except Exception as e:
                        print(f"Error compressing file {file.filename}: {str(e)}")
                        continue
            
            zip_stream.seek(0)
            
            # Generate ZIP filename
            current_time = datetime.now()
            zip_filename = f"compressed_pdfs_{current_time.strftime('%Y%m%d_%H%M%S')}.zip"
            
            return send_file(
                zip_stream,
                as_attachment=True,
                download_name=zip_filename,
                mimetype='application/zip'
            )
    
    except Exception as e:
        print(f"Error in compress_pdf: {str(e)}")
        return jsonify({'error': f'Compression failed: {str(e)}'}), 500


def compress_single_pdf(file, settings):
    """Compress a single PDF file using PyMuPDF"""
    try:
        # Read the uploaded file
        file_bytes = file.read()
        
        # Open with PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        
        # Create a new PDF for the compressed version
        compressed_doc = fitz.open()
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            
            # Get page as pixmap with specified resolution
            mat = fitz.Matrix(settings['image_resolution']/72, settings['image_resolution']/72)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert pixmap to image bytes
            img_data = pix.tobytes("png")
            
            # Create new page in compressed document
            new_page = compressed_doc.new_page(width=page.rect.width, height=page.rect.height)
            
            # Insert the image
            img_rect = fitz.Rect(0, 0, page.rect.width, page.rect.height)
            new_page.insert_image(img_rect, stream=img_data)
        
        # Save compressed PDF to BytesIO
        compressed_stream = BytesIO()
        compressed_pdf_bytes = compressed_doc.tobytes(
            deflate=True,
            deflate_level=settings['deflate_level'],
            garbage=4,
            clean=True
        )
        compressed_stream.write(compressed_pdf_bytes)
        compressed_stream.seek(0)
        
        # Close documents
        doc.close()
        compressed_doc.close()
        
        return compressed_stream
        
    except Exception as e:
        print(f"Error in compress_single_pdf: {str(e)}")
        # Fallback: Try basic compression with PyPDF2
        return compress_with_pypdf2(file, settings)


def compress_with_pypdf2(file, settings):
    """Fallback compression method using PyPDF2"""
    try:
        file.seek(0)  # Reset file pointer
        reader = PyPDF2.PdfReader(file)
        writer = PyPDF2.PdfWriter()
        
        # Copy all pages
        for page in reader.pages:
            # Remove images if extreme compression
            if settings['deflate_level'] >= 9:
                # This is a basic approach - removes some content
                page.compress_content_streams()
            writer.add_page(page)
        
        # Apply compression
        writer.compress_identical_objects(remove_duplicates=True)
        
        # Save to BytesIO
        compressed_stream = BytesIO()
        writer.write(compressed_stream)
        compressed_stream.seek(0)
        
        return compressed_stream
        
    except Exception as e:
        print(f"Error in compress_with_pypdf2: {str(e)}")
        # Last resort: return original file
        file.seek(0)
        return BytesIO(file.read())


# ===== ENHANCED MERGE PDF ROUTE =====
@app.route('/merge', methods=['POST'])
def merge_pdf():
    try:
        files = request.files.getlist('files')
        
        if len(files) < 2:
            return jsonify({'error': 'At least 2 PDF files are required'}), 400
        
        # Get file order and rotation data from form if available
        file_metadata = {}
        if 'metadata' in request.form:
            try:
                file_metadata = json.loads(request.form['metadata'])
            except:
                pass
        
        merger = PyPDF2.PdfMerger()
        
        # Process files in the order they were sent
        for i, file in enumerate(files):
            if file and file.filename.endswith('.pdf'):
                try:
                    reader = PyPDF2.PdfReader(file)
                    
                    # Get rotation for this file if available
                    rotation = 0
                    if str(i) in file_metadata:
                        rotation = file_metadata[str(i)].get('rotation', 0)
                    
                    # Apply rotation to each page of the PDF
                    if rotation != 0:
                        writer = PyPDF2.PdfWriter()
                        for page in reader.pages:
                            rotated_page = page.rotate(rotation)
                            writer.add_page(rotated_page)
                        
                        # Create a BytesIO object for the rotated PDF
                        rotated_stream = BytesIO()
                        writer.write(rotated_stream)
                        rotated_stream.seek(0)
                        
                        # Append the rotated PDF to merger
                        merger.append(rotated_stream)
                    else:
                        # No rotation needed, append directly
                        file.seek(0)  # Reset file pointer
                        merger.append(file)
                        
                except Exception as e:
                    print(f"Error processing file {file.filename}: {str(e)}")
                    continue
        
        # Create merged PDF
        merged_stream = BytesIO()
        merger.write(merged_stream)
        merger.close()
        merged_stream.seek(0)
        
        # Generate filename with current date and time
        current_time = datetime.now()
        filename = f"merged_pdf_{current_time.strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            merged_stream,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
    
    except Exception as e:
        print(f"Error in merge_pdf: {str(e)}")
        return jsonify({'error': 'Failed to merge PDFs'}), 500


# ===== ENHANCED SPLIT PDF ROUTE WITH SINGLE PDF OPTION =====
@app.route('/split-pdf', methods=['POST'])
def split_pdf():
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.pdf'):
            return jsonify({'error': 'Invalid PDF file'}), 400

        # Read the PDF
        reader = PyPDF2.PdfReader(file)
        total_pages = len(reader.pages)
        
        # Get parameters from request
        ranges_data = request.form.get('ranges', '[]')
        split_pages_data = request.form.get('splitPages', '[]')
        single_pdf = request.form.get('singlePDF', 'false').lower() == 'true'
        merge_all = request.form.get('mergeAll', 'false').lower() == 'true'
        
        try:
            ranges = json.loads(ranges_data) if ranges_data != '[]' else []
            split_pages = json.loads(split_pages_data) if split_pages_data != '[]' else []
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid range data'}), 400
        
        # Validate ranges and pages
        validation_errors = []
        
        # Validate custom ranges
        if ranges:
            for i, (start, end) in enumerate(ranges):
                if start < 1 or start > total_pages:
                    validation_errors.append(f"Range {i+1}: Start page {start} is out of bounds (1-{total_pages})")
                if end < 1 or end > total_pages:
                    validation_errors.append(f"Range {i+1}: End page {end} is out of bounds (1-{total_pages})")
                if start > end:
                    validation_errors.append(f"Range {i+1}: Start page {start} cannot be greater than end page {end}")
        
        # Validate individual pages
        if split_pages:
            for page in split_pages:
                if page < 1 or page > total_pages:
                    validation_errors.append(f"Page {page} is out of bounds (1-{total_pages})")
        
        if validation_errors:
            return jsonify({'error': 'Validation errors', 'details': validation_errors}), 400
        
        # Collect all pages to be extracted
        pages_to_extract = []
        
        # Process custom ranges
        if ranges:
            for start, end in ranges:
                for page_num in range(start, end + 1):  # Include end page
                    if page_num not in pages_to_extract:
                        pages_to_extract.append(page_num)
        
        # Process individual pages
        elif split_pages:
            pages_to_extract = sorted(list(set(split_pages)))  # Remove duplicates and sort
        
        # Default: all pages
        else:
            pages_to_extract = list(range(1, total_pages + 1))
        
        # Sort pages to maintain order
        pages_to_extract.sort()
        
        # If single PDF is requested, create one PDF with all selected pages
        if single_pdf:
            writer = PyPDF2.PdfWriter()
            
            # Add all selected pages to the writer
            for page_num in pages_to_extract:
                writer.add_page(reader.pages[page_num - 1])  # Convert to 0-based indexing
            
            # Create the PDF
            pdf_stream = BytesIO()
            writer.write(pdf_stream)
            pdf_stream.seek(0)
            
            # Generate filename with timestamp
            current_time = datetime.now()
            download_filename = f"extracted_pages_{current_time.strftime('%Y%m%d_%H%M%S')}.pdf"
            
            return send_file(
                pdf_stream,
                as_attachment=True,
                download_name=download_filename,
                mimetype='application/pdf'
            )
        
        # Otherwise, create zip file with separate PDFs (original behavior)
        else:
            zip_stream = BytesIO()
            all_pages_for_merge = []  # Store all pages for merged PDF if needed
            
            with ZipFile(zip_stream, 'w') as zipf:
                
                # Process custom ranges
                if ranges:
                    for i, (start, end) in enumerate(ranges):
                        writer = PyPDF2.PdfWriter()
                        
                        # Add pages from start to end (inclusive)
                        for page_num in range(start - 1, end):  # Convert to 0-based indexing
                            writer.add_page(reader.pages[page_num])
                            if merge_all:
                                all_pages_for_merge.append(page_num)
                        
                        # Save range as PDF
                        range_stream = BytesIO()
                        writer.write(range_stream)
                        range_stream.seek(0)
                        
                        filename = f'pages_{start}_to_{end}.pdf'
                        zipf.writestr(filename, range_stream.read())
                
                # Process individual pages
                elif split_pages:
                    for page_num in split_pages:
                        writer = PyPDF2.PdfWriter()
                        writer.add_page(reader.pages[page_num - 1])  # Convert to 0-based indexing
                        
                        if merge_all:
                            all_pages_for_merge.append(page_num - 1)
                        
                        page_stream = BytesIO()
                        writer.write(page_stream)
                        page_stream.seek(0)
                        
                        filename = f'page_{page_num}.pdf'
                        zipf.writestr(filename, page_stream.read())
                
                # Default: split into individual pages
                else:
                    for i in range(total_pages):
                        writer = PyPDF2.PdfWriter()
                        writer.add_page(reader.pages[i])
                        
                        if merge_all:
                            all_pages_for_merge.append(i)
                        
                        page_stream = BytesIO()
                        writer.write(page_stream)
                        page_stream.seek(0)
                        
                        filename = f'page_{i+1}.pdf'
                        zipf.writestr(filename, page_stream.read())
                
                # Create merged PDF if checkbox is checked
                if merge_all and all_pages_for_merge:
                    merged_writer = PyPDF2.PdfWriter()
                    
                    # Sort pages to maintain order
                    all_pages_for_merge.sort()
                    
                    # Add all pages to merged PDF
                    for page_num in all_pages_for_merge:
                        merged_writer.add_page(reader.pages[page_num])
                    
                    # Save merged PDF
                    merged_stream = BytesIO()
                    merged_writer.write(merged_stream)
                    merged_stream.seek(0)
                    
                    # Add merged PDF to zip
                    zipf.writestr('merged_all_splits.pdf', merged_stream.read())

            zip_stream.seek(0)
            
            # Generate filename with timestamp
            current_time = datetime.now()
            download_filename = f"split_pdfs_{current_time.strftime('%Y%m%d_%H%M%S')}.zip"
            
            return send_file(
                zip_stream,
                as_attachment=True,
                download_name=download_filename,
                mimetype='application/zip'
            )
    
    except Exception as e:
        print(f"Error in split_pdf: {str(e)}")
        return jsonify({'error': 'Failed to split PDF', 'details': str(e)}), 500


# ===== GET PDF INFO ROUTE =====
@app.route('/pdf-info', methods=['POST'])
def get_pdf_info():
    """Get PDF information like total pages"""
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.pdf'):
            return jsonify({'error': 'Invalid PDF file'}), 400
        
        reader = PyPDF2.PdfReader(file)
        total_pages = len(reader.pages)
        
        return jsonify({
            'total_pages': total_pages,
            'filename': file.filename,
            'size': len(file.read())
        })
    
    except Exception as e:
        print(f"Error getting PDF info: {str(e)}")
        return jsonify({'error': 'Failed to get PDF info'}), 500


# ===== GET PDF PAGE PREVIEWS ROUTE =====
@app.route('/pdf-previews', methods=['POST'])
def get_pdf_previews():
    """Get base64 encoded previews of PDF pages"""
    try:
        file = request.files.get('file')
        if not file or not file.filename.endswith('.pdf'):
            return jsonify({'error': 'Invalid PDF file'}), 400
        
        # Try using PyMuPDF for previews
        try:
            file_bytes = file.read()
            pdf_doc = fitz.open(stream=file_bytes, filetype="pdf")
            
            previews = []
            max_pages = min(len(pdf_doc), 20)  # Limit to first 20 pages for performance
            
            for page_num in range(max_pages):
                page = pdf_doc.load_page(page_num)
                
                # Render page as image with lower DPI for preview
                mat = fitz.Matrix(0.5, 0.5)  # Lower resolution for preview
                pix = page.get_pixmap(matrix=mat)
                
                # Convert to base64
                img_data = pix.tobytes("png")
                img_str = base64.b64encode(img_data).decode()
                
                previews.append({
                    'page': page_num + 1,
                    'image': f'data:image/png;base64,{img_str}'
                })
            
            pdf_doc.close()
            
            return jsonify({
                'previews': previews,
                'has_more': len(pdf_doc) > 20
            })
            
        except Exception as e:
            print(f"PyMuPDF preview error: {str(e)}")
            # Fallback: Return page info without images
            file.seek(0)  # Reset file pointer
            reader = PyPDF2.PdfReader(file)
            total_pages = len(reader.pages)
            
            previews = []
            for i in range(min(total_pages, 20)):  # Limit to first 20 pages
                # Extract text from page for preview
                try:
                    page_text = reader.pages[i].extract_text()[:200]  # First 200 chars
                except:
                    page_text = "Unable to extract text"
                
                previews.append({
                    'page': i + 1,
                    'text': page_text,
                    'image': None
                })
            
            return jsonify({
                'previews': previews,
                'has_more': total_pages > 20,
                'text_only': True
            })
    
    except Exception as e:
        print(f"Error getting PDF previews: {str(e)}")
        return jsonify({'error': 'Failed to get PDF previews'}), 500
    
    


if __name__ == '__main__':
    app.run(debug=True)