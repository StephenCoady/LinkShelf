// LinkShelf Dashboard - Main JavaScript
class LinkShelfDashboard {
    constructor() {
        this.categories = [];
        this.currentEditingBookmark = null;
        this.currentEditingCategory = null;
        this.draggedElement = null;
        this.draggedType = null; // 'bookmark' or 'category'
        this.urlFetchTimeout = null; // For debouncing URL fetching
        this.categoryModalMode = 'create'; // 'create' or 'edit'
        this.editingCategoryIndex = null;
        this.columnCount = 4; // Default column count
        
        this.init();
    }

    // Initialize the dashboard
    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderDashboard();
    }

    // Data Management
    async loadData() {
        try {
            const result = await chrome.storage.local.get(['linkshelf_categories', 'linkshelf_column_count']);
            this.categories = result.linkshelf_categories || [];
            this.columnCount = result.linkshelf_column_count || 4;
            
            // Migrate existing categories to include column/position data if missing
            this.migrateCategoryData();
        } catch (error) {
            console.error('Error loading data:', error);
            this.categories = [];
            this.columnCount = 4;
        }
    }

    migrateCategoryData() {
        let needsSave = false;
        this.categories.forEach((category, index) => {
            if (category.column === undefined || category.position === undefined) {
                // Distribute existing categories across columns
                category.column = index % this.columnCount;
                category.position = Math.floor(index / this.columnCount);
                needsSave = true;
            }
        });
        
        if (needsSave) {
            this.saveData();
        }
    }

    findFirstAvailableSlot() {
        return this.findFirstAvailableSlotInRange(0, this.columnCount - 1);
    }

    async saveData() {
        try {
            await chrome.storage.local.set({ 
                linkshelf_categories: this.categories,
                linkshelf_column_count: this.columnCount
            });
        } catch (error) {
            console.error('Error saving data:', error);
            this.showToast('Error saving data', 'error');
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Header buttons
        document.getElementById('create-category-btn').addEventListener('click', () => this.openCreateCategoryModal());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettingsModal());

        // Category modal
        document.getElementById('create-category-form').addEventListener('submit', (e) => this.handleCategoryFormSubmit(e));
        document.getElementById('cancel-category').addEventListener('click', () => this.closeModal('create-category-modal'));

        // Bookmark modal
        document.getElementById('bookmark-form').addEventListener('submit', (e) => this.handleSaveBookmark(e));
        document.getElementById('cancel-bookmark').addEventListener('click', () => this.closeModal('bookmark-modal'));
        document.getElementById('bookmark-url').addEventListener('input', (e) => this.handleUrlInputDebounced(e));
        document.getElementById('bookmark-url').addEventListener('blur', (e) => this.handleUrlInputImmediate(e));
        document.getElementById('bookmark-favicon-url').addEventListener('input', (e) => this.handleFaviconUrlInput(e));
        document.getElementById('bookmark-favicon-url').addEventListener('blur', (e) => this.handleFaviconUrlInput(e));

        // Settings modal
        document.getElementById('export-bookmarks').addEventListener('click', () => this.exportBookmarks());
        document.getElementById('import-bookmarks').addEventListener('click', () => this.triggerImport());
        document.getElementById('import-file').addEventListener('change', (e) => this.importBookmarks(e));
        document.getElementById('column-count').addEventListener('change', (e) => this.handleColumnCountChange(e));

        // Confirmation modal
        document.getElementById('confirmation-cancel').addEventListener('click', () => this.closeModal('confirmation-modal'));

        // Modal close buttons and backdrop clicks
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // UI Rendering
    renderDashboard() {
        const container = document.getElementById('categories-container');
        
        // Update container class for column count
        container.className = `categories-container columns-${this.columnCount}`;
        
        if (this.categories.length === 0) {
            container.innerHTML = this.renderEmptyState();
            this.setupEmptyStateEventListeners();
            return;
        }

        // Create column structure with categories positioned by their column/position data
        const columns = Array(this.columnCount).fill(null).map(() => []);
        
        // Sort categories by column and position
        const sortedCategories = [...this.categories].sort((a, b) => {
            if (a.column !== b.column) return a.column - b.column;
            return a.position - b.position;
        });
        
        // Group categories by column
        sortedCategories.forEach((category, originalIndex) => {
            const columnIndex = category.column;
            if (columnIndex >= 0 && columnIndex < this.columnCount) {
                columns[columnIndex].push({ category, originalIndex: this.categories.indexOf(category) });
            }
        });

        // Render columns with drop zones
        container.innerHTML = columns.map((columnCategories, columnIndex) => 
            this.renderColumn(columnCategories, columnIndex)
        ).join('');

        this.setupCategoryEventListeners();
        this.setupColumnDropZones();
    }

    setupColumnDropZones() {
        // Setup drop zones for category positioning within columns
        document.querySelectorAll('.column-drop-zone').forEach(dropZone => {
            dropZone.addEventListener('dragover', (e) => this.handleColumnDropZoneDragOver(e));
            dropZone.addEventListener('dragleave', (e) => this.handleColumnDropZoneDragLeave(e));
            dropZone.addEventListener('drop', (e) => this.handleColumnDropZoneDrop(e));
        });
        
        // Setup grid columns for drag events
        document.querySelectorAll('.grid-column').forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
        });
    }

    handleColumnDropZoneDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        if (this.draggedType === 'category') {
            e.target.classList.add('drag-over');
        }
    }

    handleColumnDropZoneDragLeave(e) {
        // Only remove drag-over if we're actually leaving the drop zone
        if (!e.target.contains(e.relatedTarget)) {
            e.target.classList.remove('drag-over');
        }
    }

    handleColumnDropZoneDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove('drag-over');
        
        if (this.draggedType === 'category' && this.draggedElement) {
            const targetColumn = parseInt(e.target.dataset.columnIndex);
            const targetPosition = parseInt(e.target.dataset.position);
            const draggedCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            
            console.log(`Moving category ${draggedCategoryIndex} to column ${targetColumn}, position ${targetPosition}`);
            this.moveCategoryToSlot(draggedCategoryIndex, targetColumn, targetPosition);
        }
    }

    async moveCategoryToSlot(categoryIndex, targetColumn, targetPosition) {
        const category = this.categories[categoryIndex];
        const oldColumn = category.column;
        const oldPosition = category.position;
        
        // Update the category's position
        category.column = targetColumn;
        category.position = targetPosition;
        
        // Shift other categories in target column down
        this.categories.forEach((cat, index) => {
            if (index !== categoryIndex && cat.column === targetColumn && cat.position >= targetPosition) {
                cat.position += 1;
            }
        });
        
        // Shift categories in old column up to fill the gap
        this.categories.forEach((cat, index) => {
            if (index !== categoryIndex && cat.column === oldColumn && cat.position > oldPosition) {
                cat.position -= 1;
            }
        });
        
        await this.saveData();
        this.renderDashboard();
        this.showToast('Category moved successfully', 'success');
    }
    
    setupEmptyStateEventListeners() {
        // Empty state create category button
        const emptyCreateBtn = document.getElementById('empty-create-category-btn');
        if (emptyCreateBtn) {
            emptyCreateBtn.addEventListener('click', () => this.openCreateCategoryModal());
        }
    }

    renderEmptyState() {
        return `
            <div class="empty-dashboard">
                <h2>Welcome to LinkShelf</h2>
                <p>Create your first category to start organizing your bookmarks</p>
                <button class="btn btn-primary" id="empty-create-category-btn">+ Create Your First Category</button>
            </div>
        `;
    }

    renderColumn(columnCategories, columnIndex) {
        return `
            <div class="grid-column" data-column-index="${columnIndex}">
                <div class="column-drop-zone" data-column-index="${columnIndex}" data-position="0">
                    Drop categories here
                </div>
                ${columnCategories.map(({ category, originalIndex }, index) => 
                    `${this.renderCategory(category, originalIndex)}
                     <div class="column-drop-zone" data-column-index="${columnIndex}" data-position="${category.position + 1}">
                        Drop categories here
                     </div>`
                ).join('')}
                ${columnCategories.length === 0 ? '<div class="empty-column-message">Empty column - drag categories here</div>' : ''}
            </div>
        `;
    }

    renderCategory(category, categoryIndex) {
        return `
            <div class="category-column" data-category-index="${categoryIndex}" draggable="true">
                <div class="category-header">
                    <h3 class="category-title">${this.escapeHtml(category.name)}</h3>
                    <div class="category-actions">
                        <button class="category-action-btn category-edit-btn" data-category-index="${categoryIndex}" title="Edit Category">
                            ✏️
                        </button>
                        <button class="category-action-btn category-delete-btn" data-category-index="${categoryIndex}" title="Delete Category">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="category-body">
                    <ul class="bookmarks-list">
                        ${category.bookmarks.map((bookmark, bookmarkIndex) => 
                            this.renderBookmark(bookmark, categoryIndex, bookmarkIndex)
                        ).join('')}
                    </ul>
                    <button class="add-bookmark-btn" data-category-index="${categoryIndex}">
                        + Add Link
                    </button>
                </div>
            </div>
        `;
    }

    renderBookmark(bookmark, categoryIndex, bookmarkIndex) {
        const faviconSrc = bookmark.faviconData || this.getFallbackIcon();
        const fallbackIcon = this.getFallbackIcon();
        
        return `
            <li class="bookmark-item" data-category-index="${categoryIndex}" data-bookmark-index="${bookmarkIndex}" draggable="true">
                <a href="${this.escapeHtml(bookmark.url)}" target="_blank" class="bookmark-link">
                    <img class="bookmark-favicon" src="${faviconSrc}" alt="Favicon" onerror="this.src='${fallbackIcon}'">
                    <span class="bookmark-title">${this.escapeHtml(bookmark.name)}</span>
                </a>
                <div class="bookmark-actions">
                    <button class="bookmark-action-btn bookmark-edit-btn" data-category-index="${categoryIndex}" data-bookmark-index="${bookmarkIndex}" title="Edit Bookmark">
                        ✏️
                    </button>
                    <button class="bookmark-action-btn bookmark-delete-btn" data-category-index="${categoryIndex}" data-bookmark-index="${bookmarkIndex}" title="Delete Bookmark">
                        🗑️
                    </button>
                </div>
            </li>
        `;
    }

    setupCategoryEventListeners() {
        // Category drag start/end only
        document.querySelectorAll('.category-column').forEach(column => {
            column.addEventListener('dragstart', (e) => this.handleCategoryDragStart(e));
            column.addEventListener('dragend', (e) => this.handleCategoryDragEnd(e));
        });

        // Category action buttons
        document.querySelectorAll('.category-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.editCategory(categoryIndex);
            });
        });

        document.querySelectorAll('.category-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.deleteCategory(categoryIndex);
            });
        });

        // Add bookmark buttons
        document.querySelectorAll('.add-bookmark-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.openAddBookmarkModal(categoryIndex);
            });
        });

        // Bookmark drag and drop
        document.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleBookmarkDragStart(e));
            item.addEventListener('dragend', (e) => this.handleBookmarkDragEnd(e));
        });

        // Bookmark action buttons
        document.querySelectorAll('.bookmark-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                const bookmarkIndex = parseInt(e.target.dataset.bookmarkIndex);
                this.editBookmark(categoryIndex, bookmarkIndex);
            });
        });

        document.querySelectorAll('.bookmark-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                const bookmarkIndex = parseInt(e.target.dataset.bookmarkIndex);
                this.deleteBookmark(categoryIndex, bookmarkIndex);
            });
        });
    }

    // Category Management
    openCreateCategoryModal() {
        this.categoryModalMode = 'create';
        this.editingCategoryIndex = null;
        
        // Update modal content for create mode
        document.querySelector('#create-category-modal .modal-header h3').textContent = 'Create New Category';
        document.querySelector('#create-category-form button[type="submit"]').textContent = 'Create Category';
        
        document.getElementById('category-name').value = '';
        this.openModal('create-category-modal');
        document.getElementById('category-name').focus();
    }
    
    openEditCategoryModal(categoryIndex) {
        this.categoryModalMode = 'edit';
        this.editingCategoryIndex = categoryIndex;
        const category = this.categories[categoryIndex];
        
        // Update modal content for edit mode
        document.querySelector('#create-category-modal .modal-header h3').textContent = 'Edit Category';
        document.querySelector('#create-category-form button[type="submit"]').textContent = 'Update Category';
        
        document.getElementById('category-name').value = category.name;
        this.openModal('create-category-modal');
        document.getElementById('category-name').focus();
        document.getElementById('category-name').select(); // Select existing text for easy editing
    }

    async handleCategoryFormSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('category-name').value.trim();
        
        if (!name) {
            this.showToast('Category name is required', 'error');
            return;
        }

        if (this.categoryModalMode === 'create') {
            // Create new category - find first available slot in leftmost column
            const slot = this.findFirstAvailableSlot();
            const newCategory = {
                id: Date.now().toString(),
                name: name,
                bookmarks: [],
                column: slot.column,
                position: slot.position
            };

            this.categories.push(newCategory);
            await this.saveData();
            this.renderDashboard();
            this.closeModal('create-category-modal');
            this.showToast('Category created successfully', 'success');
        } else if (this.categoryModalMode === 'edit') {
            // Update existing category
            if (this.editingCategoryIndex !== null) {
                const oldName = this.categories[this.editingCategoryIndex].name;
                this.categories[this.editingCategoryIndex].name = name;
                await this.saveData();
                this.renderDashboard();
                this.closeModal('create-category-modal');
                this.showToast('Category updated successfully', 'success');
            }
        }
    }

    editCategory(categoryIndex) {
        this.openEditCategoryModal(categoryIndex);
    }

    deleteCategory(categoryIndex) {
        const category = this.categories[categoryIndex];
        const bookmarkCount = category.bookmarks.length;
        
        let message = `Are you sure you want to delete "${category.name}"?`;
        if (bookmarkCount > 0) {
            message += `\n\nThis will also delete ${bookmarkCount} bookmark${bookmarkCount > 1 ? 's' : ''}.`;
        }

        this.showConfirmation(
            'Delete Category',
            message,
            () => {
                this.categories.splice(categoryIndex, 1);
                this.saveData();
                this.renderDashboard();
                this.showToast('Category deleted successfully', 'success');
            }
        );
    }

    // Bookmark Management
    openAddBookmarkModal(categoryIndex) {
        this.currentEditingBookmark = null;
        this.currentEditingCategory = categoryIndex;
        
        document.getElementById('bookmark-modal-title').textContent = 'Add New Bookmark';
        document.getElementById('bookmark-url').value = '';
        document.getElementById('bookmark-name').value = '';
        document.getElementById('bookmark-favicon-url').value = '';
        document.getElementById('save-bookmark').textContent = 'Save Bookmark';
        this.hideBookmarkPreview();
        
        this.openModal('bookmark-modal');
        document.getElementById('bookmark-url').focus();
    }

    editBookmark(categoryIndex, bookmarkIndex) {
        const bookmark = this.categories[categoryIndex].bookmarks[bookmarkIndex];
        this.currentEditingBookmark = bookmarkIndex;
        this.currentEditingCategory = categoryIndex;
        
        document.getElementById('bookmark-modal-title').textContent = 'Edit Bookmark';
        document.getElementById('bookmark-url').value = bookmark.url;
        document.getElementById('bookmark-name').value = bookmark.name;
        document.getElementById('bookmark-favicon-url').value = ''; // Don't show cached data URL, user can enter new one
        document.getElementById('save-bookmark').textContent = 'Update Bookmark';
        
        // Show preview with cached favicon
        const preview = document.querySelector('.bookmark-preview');
        const favicon = document.getElementById('bookmark-favicon');
        const titlePreview = document.getElementById('bookmark-title-preview');
        
        favicon.src = bookmark.faviconData || this.getFallbackIcon();
        titlePreview.textContent = bookmark.name;
        preview.classList.add('visible');
        
        this.openModal('bookmark-modal');
    }

    async handleSaveBookmark(e) {
        e.preventDefault();
        const rawUrl = document.getElementById('bookmark-url').value.trim();
        const name = document.getElementById('bookmark-name').value.trim();
        const rawFaviconUrl = document.getElementById('bookmark-favicon-url').value.trim();
        
        if (!rawUrl || !name) {
            this.showToast('URL and name are required', 'error');
            return;
        }

        // Normalize URLs by adding https:// if missing
        const url = this.normalizeUrl(rawUrl);
        const faviconUrl = rawFaviconUrl ? this.normalizeUrl(rawFaviconUrl) : '';

        // Update input field with normalized URL so user sees the complete URL
        document.getElementById('bookmark-url').value = url;
        if (faviconUrl) {
            document.getElementById('bookmark-favicon-url').value = faviconUrl;
        }

        if (!this.isValidUrl(url)) {
            this.showToast('Please enter a valid URL', 'error');
            return;
        }

        if (faviconUrl && !this.isValidUrl(faviconUrl)) {
            this.showToast('Please enter a valid favicon URL or leave it blank', 'error');
            return;
        }

        // Show loading state
        const saveBtn = document.getElementById('save-bookmark');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Caching favicon...';
        saveBtn.disabled = true;

        try {
            const bookmark = { url, name };
            
            // Handle favicon caching
            if (faviconUrl) {
                // Use custom favicon URL, cache it locally
                bookmark.faviconData = await this.cacheFavicon(faviconUrl);
            } else {
                // Try to cache the auto-detected favicon
                const autoFaviconUrl = this.getFaviconUrl(url);
                bookmark.faviconData = await this.cacheFavicon(autoFaviconUrl);
            }
            
            if (this.currentEditingBookmark !== null) {
                // Update existing bookmark
                this.categories[this.currentEditingCategory].bookmarks[this.currentEditingBookmark] = bookmark;
                this.showToast('Bookmark updated successfully', 'success');
            } else {
                // Add new bookmark
                this.categories[this.currentEditingCategory].bookmarks.push(bookmark);
                this.showToast('Bookmark added successfully', 'success');
            }

            await this.saveData();
            this.renderDashboard();
            this.closeModal('bookmark-modal');
        } catch (error) {
            console.error('Error saving bookmark:', error);
            this.showToast('Error saving bookmark', 'error');
        } finally {
            // Reset button state
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    deleteBookmark(categoryIndex, bookmarkIndex) {
        const bookmark = this.categories[categoryIndex].bookmarks[bookmarkIndex];
        
        this.showConfirmation(
            'Delete Bookmark',
            `Are you sure you want to delete "${bookmark.name}"?`,
            () => {
                this.categories[categoryIndex].bookmarks.splice(bookmarkIndex, 1);
                this.saveData();
                this.renderDashboard();
                this.showToast('Bookmark deleted successfully', 'success');
            }
        );
    }

    // URL and Favicon Handling
    handleUrlInputDebounced(e) {
        // Clear any existing timeout
        if (this.urlFetchTimeout) {
            clearTimeout(this.urlFetchTimeout);
        }
        
        // Set a new timeout to fetch after user stops typing
        this.urlFetchTimeout = setTimeout(() => {
            this.processUrlInput(e.target.value.trim());
        }, 1000); // Wait 1 second after user stops typing
    }
    
    handleUrlInputImmediate(e) {
        // Clear any pending debounced fetch
        if (this.urlFetchTimeout) {
            clearTimeout(this.urlFetchTimeout);
            this.urlFetchTimeout = null;
        }
        
        // Process immediately when user leaves the field
        this.processUrlInput(e.target.value.trim());
    }
    
    async processUrlInput(rawUrl) {
        // Normalize URL by adding https:// if missing
        const url = this.normalizeUrl(rawUrl);
        
        if (this.isValidUrl(url)) {
            // Update the input field with normalized URL so user sees https://
            document.getElementById('bookmark-url').value = url;
            
            // Get custom favicon URL if user provided one
            const customFaviconUrl = document.getElementById('bookmark-favicon-url').value.trim() || null;
            
            try {
                // Show a nice fallback name immediately
                const fallbackName = this.getUrlDisplayName(url);
                await this.showBookmarkPreview(url, fallbackName, customFaviconUrl);
                
                // Try to fetch the real title
                const title = await this.fetchPageTitle(url);
                
                // Only update if we got a real title (not just the fallback)
                if (title && title !== fallbackName && title !== url) {
                    if (!document.getElementById('bookmark-name').value || document.getElementById('bookmark-name').value === fallbackName) {
                        document.getElementById('bookmark-name').value = title;
                        // No need to update preview again as favicon is already cached
                        document.getElementById('bookmark-title-preview').textContent = title;
                    }
                } else {
                    // Use fallback if no title was fetched
                    if (!document.getElementById('bookmark-name').value) {
                        document.getElementById('bookmark-name').value = fallbackName;
                    }
                }
            } catch (error) {
                console.error('Error processing URL input:', error);
                const fallbackName = this.getUrlDisplayName(url);
                if (!document.getElementById('bookmark-name').value) {
                    document.getElementById('bookmark-name').value = fallbackName;
                }
                await this.showBookmarkPreview(url, fallbackName, customFaviconUrl);
            }
        } else {
            this.hideBookmarkPreview();
        }
    }
    
    async handleFaviconUrlInput(e) {
        // Update preview when custom favicon URL changes
        const url = document.getElementById('bookmark-url').value.trim();
        const title = document.getElementById('bookmark-name').value.trim();
        const rawFaviconUrl = e.target.value.trim();
        
        let customFaviconUrl = null;
        if (rawFaviconUrl) {
            customFaviconUrl = this.normalizeUrl(rawFaviconUrl);
            // Update input field with normalized URL
            e.target.value = customFaviconUrl;
        }
        
        if (this.isValidUrl(url)) {
            await this.showBookmarkPreview(url, title || this.getUrlDisplayName(url), customFaviconUrl);
        }
    }

    async fetchPageTitle(url) {
        // Method 1: Try direct fetch with Chrome extension permissions
        try {
            const response = await fetch(url, { 
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Chrome Extension)'
                }
            });
            
            if (response.ok) {
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const titleElement = doc.querySelector('title');
                
                if (titleElement && titleElement.textContent.trim()) {
                    const title = titleElement.textContent.trim();
                    // Clean up common title patterns
                    return title.replace(/\s+/g, ' ').substring(0, 100); // Limit length
                }
                
                // Try meta title if no title tag
                const metaTitle = doc.querySelector('meta[property="og:title"]');
                if (metaTitle && metaTitle.getAttribute('content')) {
                    return metaTitle.getAttribute('content').trim().substring(0, 100);
                }
            }
        } catch (error) {
            // Fetch failed (likely due to CORS), will use fallback
        }
        
        // Method 2: Return null so the calling function uses fallback
        return null;
    }
    
    getUrlDisplayName(url) {
        try {
            const urlObj = new URL(url);
            let hostname = urlObj.hostname.replace('www.', '');
            
            // Create a more readable name from the hostname
            const parts = hostname.split('.');
            if (parts.length >= 2) {
                // Take the main domain name and capitalize it
                const mainDomain = parts[parts.length - 2];
                return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
            }
            
            return hostname;
        } catch {
            return 'Bookmark';
        }
    }

    getFaviconUrl(url, customFaviconUrl = null) {
        // Use custom favicon URL if provided
        if (customFaviconUrl) {
            return customFaviconUrl;
        }
        
        // Otherwise use standard favicon.ico approach
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
        } catch {
            return this.getFallbackIcon();
        }
    }
    
    getFallbackIcon() {
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Cpath fill="%23C0C9D1" d="M8 2a6 6 0 100 12A6 6 0 008 2zM7 5a1 1 0 012 0v3a1 1 0 01-2 0V5zm1 5.25a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/%3E%3C/svg%3E';
    }
    
    async cacheFavicon(faviconUrl) {
        if (!faviconUrl || !this.isValidUrl(faviconUrl)) {
            return this.getFallbackIcon();
        }
        
        try {
            console.log('Caching favicon:', faviconUrl);
            
            // Fetch the favicon
            const response = await fetch(faviconUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Get the image as blob
            const blob = await response.blob();
            
            // Convert to base64 data URL
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(this.getFallbackIcon());
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.log('Failed to cache favicon:', error.message);
            return this.getFallbackIcon();
        }
    }

    async showBookmarkPreview(url, title, customFaviconUrl = null) {
        const preview = document.querySelector('.bookmark-preview');
        const favicon = document.getElementById('bookmark-favicon');
        const titlePreview = document.getElementById('bookmark-title-preview');
        
        titlePreview.textContent = title || url;
        preview.classList.add('visible');
        
        // Show fallback icon immediately
        favicon.src = this.getFallbackIcon();
        
        // Cache and show the real favicon
        const faviconUrl = customFaviconUrl || this.getFaviconUrl(url);
        if (faviconUrl && faviconUrl !== this.getFallbackIcon()) {
            try {
                const cachedFavicon = await this.cacheFavicon(faviconUrl);
                favicon.src = cachedFavicon;
            } catch (error) {
                console.log('Failed to preview favicon:', error);
                // Keep fallback icon
            }
        }
    }

    hideBookmarkPreview() {
        const preview = document.querySelector('.bookmark-preview');
        preview.classList.remove('visible');
    }

    // Drag and Drop
    handleCategoryDragStart(e) {
        this.draggedElement = e.target;
        this.draggedType = 'category';
        e.target.classList.add('dragging');
        document.body.classList.add('dragging-category');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleCategoryDragEnd(e) {
        e.target.classList.remove('dragging');
        document.body.classList.remove('dragging-category');
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up any remaining drag-over classes
        document.querySelectorAll('.column-drop-zone.drag-over').forEach(zone => {
            zone.classList.remove('drag-over');
        });
    }

    handleBookmarkDragStart(e) {
        e.stopPropagation(); // Prevent category drag
        this.draggedElement = e.target;
        this.draggedType = 'bookmark';
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleBookmarkDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedElement = null;
        this.draggedType = null;
    }

    handleCategoryDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleCategoryDrop(e) {
        e.preventDefault();
        
        if (!this.draggedElement) return;
        
        if (this.draggedType === 'bookmark') {
            this.handleBookmarkMove(e);
        }
        // Category reordering is now handled by drop zones
    }

    handleBookmarkMove(e) {
        const targetColumn = e.target.closest('.category-column');
        if (!targetColumn) return;
        
        const targetCategoryIndex = parseInt(targetColumn.dataset.categoryIndex);
        const draggedCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
        const draggedBookmarkIndex = parseInt(this.draggedElement.dataset.bookmarkIndex);
        
        // Remove bookmark from source category
        const bookmark = this.categories[draggedCategoryIndex].bookmarks.splice(draggedBookmarkIndex, 1)[0];
        
        // Add bookmark to target category
        this.categories[targetCategoryIndex].bookmarks.push(bookmark);
        
        this.saveData();
        this.renderDashboard();
        this.showToast('Bookmark moved successfully', 'success');
    }

    // Import/Export
    exportBookmarks() {
        let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

        this.categories.forEach(category => {
            html += `    <DT><H3>${this.escapeHtml(category.name)}</H3>\n    <DL><p>\n`;
            category.bookmarks.forEach(bookmark => {
                html += `        <DT><A HREF="${this.escapeHtml(bookmark.url)}">${this.escapeHtml(bookmark.name)}</A>\n`;
            });
            html += `    </DL><p>\n`;
        });

        html += `</DL><p>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'linkshelf_bookmarks.html';
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Bookmarks exported successfully', 'success');
        this.closeModal('settings-modal');
    }

    triggerImport() {
        document.getElementById('import-file').click();
    }

    async importBookmarks(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Show loading state
        const importBtn = document.getElementById('import-bookmarks');
        const originalText = importBtn.textContent;
        importBtn.textContent = 'Importing...';
        importBtn.disabled = true;

        try {
            const text = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            const folders = doc.querySelectorAll('DT > H3');
            let importedCount = 0;
            const bookmarksToCache = [];
            
            folders.forEach(folder => {
                const categoryName = folder.textContent.trim();
                if (!categoryName) return;
                
                // Create or find category
                let category = this.categories.find(cat => cat.name === categoryName);
                if (!category) {
                    const slot = this.findFirstAvailableSlot();
                    category = {
                        id: Date.now().toString() + Math.random(),
                        name: categoryName,
                        bookmarks: [],
                        column: slot.column,
                        position: slot.position
                    };
                    this.categories.push(category);
                }
                
                // Find bookmarks in this folder
                const folderContainer = folder.parentElement.nextElementSibling;
                if (folderContainer && folderContainer.tagName === 'DL') {
                    const links = folderContainer.querySelectorAll('DT > A');
                    links.forEach(link => {
                        const url = link.getAttribute('HREF');
                        const name = link.textContent.trim();
                        
                        if (url && name) {
                            // Check if bookmark already exists
                            const exists = category.bookmarks.some(bookmark => bookmark.url === url);
                            if (!exists) {
                                const bookmark = { url, name };
                                category.bookmarks.push(bookmark);
                                bookmarksToCache.push(bookmark);
                                importedCount++;
                            }
                        }
                    });
                }
            });

            // Save immediately with fallback icons
            bookmarksToCache.forEach(bookmark => {
                bookmark.faviconData = this.getFallbackIcon();
            });
            
            await this.saveData();
            this.renderDashboard();
            this.showToast(`Successfully imported ${importedCount} bookmarks`, 'success');
            this.closeModal('settings-modal');
            
            // Cache favicons in background
            if (bookmarksToCache.length > 0) {
                this.showToast(`Caching ${bookmarksToCache.length} favicons in background...`, 'info');
                this.cacheFaviconsInBackground(bookmarksToCache);
            }
            
        } catch (error) {
            console.error('Error importing bookmarks:', error);
            this.showToast('Error importing bookmarks', 'error');
        } finally {
            // Reset button state
            importBtn.textContent = originalText;
            importBtn.disabled = false;
            // Reset file input
            e.target.value = '';
        }
    }
    
    async cacheFaviconsInBackground(bookmarks) {
        let cached = 0;
        for (const bookmark of bookmarks) {
            try {
                const faviconUrl = this.getFaviconUrl(bookmark.url);
                const faviconData = await this.cacheFavicon(faviconUrl);
                bookmark.faviconData = faviconData;
                cached++;
                
                // Save progress periodically
                if (cached % 5 === 0) {
                    await this.saveData();
                    this.renderDashboard();
                }
            } catch (error) {
                console.log(`Failed to cache favicon for ${bookmark.name}:`, error);
            }
        }
        
        // Final save
        await this.saveData();
        this.renderDashboard();
        this.showToast(`Cached ${cached} favicons successfully`, 'success');
    }

    // Modal Management
    openModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        document.body.style.overflow = '';
        
        // Clean up any pending URL fetch timeouts when closing bookmark modal
        if (modalId === 'bookmark-modal' && this.urlFetchTimeout) {
            clearTimeout(this.urlFetchTimeout);
            this.urlFetchTimeout = null;
        }
        
        // Reset category modal state when closing
        if (modalId === 'create-category-modal') {
            this.categoryModalMode = 'create';
            this.editingCategoryIndex = null;
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = '';
        
        // Clean up any pending URL fetch timeouts
        if (this.urlFetchTimeout) {
            clearTimeout(this.urlFetchTimeout);
            this.urlFetchTimeout = null;
        }
        
        // Reset category modal state
        this.categoryModalMode = 'create';
        this.editingCategoryIndex = null;
    }

    openSettingsModal() {
        // Update the column count dropdown to show current value
        document.getElementById('column-count').value = this.columnCount.toString();
        this.openModal('settings-modal');
    }

    async handleColumnCountChange(e) {
        const newColumnCount = parseInt(e.target.value);
        if (newColumnCount >= 1 && newColumnCount <= 7) {
            const oldColumnCount = this.columnCount;
            this.columnCount = newColumnCount;
            
            // Redistribute categories that are now outside the column range
            this.categories.forEach(category => {
                if (category.column >= newColumnCount) {
                    // Find first available slot in valid columns
                    const slot = this.findFirstAvailableSlotInRange(0, newColumnCount - 1);
                    category.column = slot.column;
                    category.position = slot.position;
                }
            });
            
            await this.saveData();
            this.renderDashboard();
            this.showToast(`Layout updated to ${newColumnCount} column${newColumnCount > 1 ? 's' : ''}`, 'success');
        }
    }

    findFirstAvailableSlotInRange(minColumn, maxColumn) {
        // Create a map of occupied slots
        const occupiedSlots = new Map();
        this.categories.forEach(category => {
            const key = `${category.column}-${category.position}`;
            occupiedSlots.set(key, true);
        });
        
        // Find first available slot in the specified column range
        for (let column = minColumn; column <= maxColumn; column++) {
            for (let position = 0; position < 1000; position++) { // Arbitrary limit
                const key = `${column}-${position}`;
                if (!occupiedSlots.has(key)) {
                    return { column, position };
                }
            }
        }
        
        // Fallback to first column, position 0
        return { column: minColumn, position: 0 };
    }

    showConfirmation(title, message, onConfirm) {
        document.getElementById('confirmation-title').textContent = title;
        document.getElementById('confirmation-message').textContent = message;
        
        // Remove any existing event listeners
        const confirmBtn = document.getElementById('confirmation-confirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.closeModal('confirmation-modal');
        });
        
        this.openModal('confirmation-modal');
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Utility Functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    normalizeUrl(url) {
        if (!url) return url;
        
        // Trim whitespace
        url = url.trim();
        
        // If URL already has a protocol, return as-is
        if (/^https?:\/\//.test(url)) {
            return url;
        }
        
        // If URL starts with '//' (protocol-relative), add https:
        if (url.startsWith('//')) {
            return 'https:' + url;
        }
        
        // Otherwise, prepend https://
        return 'https://' + url;
    }
    
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new LinkShelfDashboard();
    // Make dashboard globally available for any remaining onclick handlers
    window.dashboard = dashboard;
});
