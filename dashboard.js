// LinkShelf Dashboard - Main JavaScript
class LinkShelfDashboard {
    constructor() {
        this.categories = [];
        this.favourites = [];
        this.inbox = [];
        this.columnCount = 3;
        this.showFavourites = true;
        this.favouritesEditMode = false;
        this.openLinksInNewTab = true; // Default to opening in new tab
        this.categoryModalMode = 'create'; // 'create' or 'edit'
        this.editingCategoryIndex = null;
        this.currentEditingBookmark = null;
        this.currentEditingCategory = null;
        this.currentEditingFavourite = null;
        this.editingFavouriteIndex = null;
        this.draggedElement = null;
        this.draggedType = null;
        this.sidebarOpen = false;
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
            const result = await chrome.storage.local.get([
                'linkshelf_categories', 
                'linkshelf_column_count',
                'linkshelf_favourites',
                'linkshelf_show_favourites',
                'linkshelf_open_links_new_tab',
                'linkshelf_inbox'
            ]);
            
            this.categories = result.linkshelf_categories || [];
            this.columnCount = result.linkshelf_column_count || 3;
            this.favourites = result.linkshelf_favourites || [];
            this.inbox = result.linkshelf_inbox || [];
            this.showFavourites = result.linkshelf_show_favourites !== false; // Default to true
            this.openLinksInNewTab = result.linkshelf_open_links_new_tab !== false; // Default to true
            
            let needsSave = false;
            
            // Migration and validation logic for categories
            this.categories.forEach((category, index) => {
                // Ensure each category has required properties
                if (!category.id) {
                    category.id = this.generateId();
                    needsSave = true;
                }
                
                // Position categories if they don't have column/position data
            if (category.column === undefined || category.position === undefined) {
                    const slot = this.findFirstAvailableSlot();
                category.column = slot.column;
                category.position = slot.position;
                needsSave = true;
            }
            
                // Migrate bookmarks from subsections back to category (removing subsections)
                if (category.subsections && category.subsections.length > 0) {
                    // Move all bookmarks from all subsections to the main category bookmarks array
                    category.subsections.forEach(subsection => {
                        if (subsection.bookmarks && subsection.bookmarks.length > 0) {
                            category.bookmarks = category.bookmarks || [];
                            category.bookmarks.push(...subsection.bookmarks);
                        }
                    });
                    // Remove the subsections data structure
                    delete category.subsections;
                    needsSave = true;
                }
                
                // Initialize empty bookmarks array if it doesn't exist
                if (!category.bookmarks) {
                    category.bookmarks = [];
                    needsSave = true;
            }
        });
        
        if (needsSave) {
            this.saveData();
        }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async saveData() {
        try {
            await chrome.storage.local.set({ 
                'linkshelf_categories': this.categories,
                'linkshelf_column_count': this.columnCount,
                'linkshelf_favourites': this.favourites,
                'linkshelf_inbox': this.inbox,
                'linkshelf_show_favourites': this.showFavourites,
                'linkshelf_open_links_new_tab': this.openLinksInNewTab
            });
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    // Event Listeners
    setupEventListeners() {
        // Header buttons
        document.getElementById('create-category-btn').addEventListener('click', () => this.openCreateCategoryModal());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());

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
        document.getElementById('show-favourites').addEventListener('change', (e) => this.handleShowFavouritesChange(e));
        document.getElementById('open-links-new-tab').addEventListener('change', (e) => this.handleOpenLinksInNewTabChange(e));

        // Favourite modal
        document.getElementById('favourite-form').addEventListener('submit', (e) => this.handleSaveFavourite(e));
        document.getElementById('cancel-favourite').addEventListener('click', () => this.closeModal('favourite-modal'));
        document.getElementById('favourite-url').addEventListener('input', (e) => this.handleFavouriteUrlInputDebounced(e));
        document.getElementById('favourite-url').addEventListener('blur', (e) => this.handleFavouriteUrlInputImmediate(e));
        document.getElementById('favourite-favicon').addEventListener('input', (e) => this.handleFavouriteFaviconUrlInput(e));
        document.getElementById('favourite-favicon').addEventListener('blur', (e) => this.handleFavouriteFaviconUrlInput(e));

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

        // Global click handler to close dropdowns
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.category-actions')) {
                    this.closeCategoryDropdowns();
                }
        });

        // Global escape key handler to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAnyOpenModal();
            }
        });
    }

    attachDynamicEventListeners() {
        // This method attaches event listeners to dynamically generated elements
        // It gets called after each render to ensure all elements have proper listeners
        
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

        // Favicon error handling for bookmarks
        document.querySelectorAll('.bookmark-favicon').forEach(img => {
            img.addEventListener('error', (e) => {
                const fallbackIcon = e.target.dataset.fallback;
                if (fallbackIcon && e.target.src !== fallbackIcon) {
                    e.target.src = fallbackIcon;
                }
            });
        });
    }

    // UI Rendering
    renderDashboard() {
        // Render inbox sidebar
        this.renderInbox();
        
        // Render favourites bar
        this.renderFavouritesBar();
        
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
        this.setupBookmarkDragDrop();
        this.setupInboxDropZone();
        this.attachDynamicEventListeners();
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
        let bodyContent = '';
        
        // Render category bookmarks
        if (category.bookmarks && category.bookmarks.length > 0) {
            bodyContent += `
                <ul class="bookmarks-list" data-category-index="${categoryIndex}">
                    ${category.bookmarks.map((bookmark, bookmarkIndex) => 
                        this.renderBookmark(bookmark, categoryIndex, bookmarkIndex)
                    ).join('')}
                </ul>
            `;
        }
        
        return `
            <div class="category-column" data-category-index="${categoryIndex}" draggable="true">
                <div class="category-header">
                    <h3 class="category-title">${this.escapeHtml(category.name)}</h3>
                    <button class="add-bookmark-plus-btn" data-category-index="${categoryIndex}" title="Add Link to Category">
                        +
                    </button>
                    <div class="category-actions">
                        <button class="category-menu-btn" data-category-index="${categoryIndex}" title="Category Actions">
                            ⋯
                        </button>
                        <div class="category-dropdown-menu" data-category-index="${categoryIndex}">
                            <button class="dropdown-item category-edit-btn" data-category-index="${categoryIndex}">Edit Category</button>
                            <button class="dropdown-item category-delete-btn" data-category-index="${categoryIndex}">Delete Category</button>
                        </div>
                    </div>
                </div>
                <div class="category-body">
                    ${bodyContent}
                </div>
            </div>
        `;
    }

    renderBookmark(bookmark, categoryIndex, bookmarkIndex) {
        const faviconSrc = bookmark.faviconData || this.getFallbackIcon();
        const fallbackIcon = this.getFallbackIcon();
        
        return `
            <li class="bookmark-item" data-category-index="${categoryIndex}" data-bookmark-index="${bookmarkIndex}" draggable="true">
                <a href="${this.escapeHtml(bookmark.url)}" ${this.openLinksInNewTab ? 'target="_blank"' : ''} class="bookmark-link">
                    <img class="bookmark-favicon" src="${faviconSrc}" alt="Favicon" data-fallback="${fallbackIcon}">
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

    // Category Management
    openCreateCategoryModal() {
        this.categoryModalMode = 'create';
        this.editingCategoryIndex = null;
        
        document.getElementById('create-category-modal-title').textContent = 'Create New Category';
        document.getElementById('category-name').value = '';
        document.getElementById('save-category').textContent = 'Create Category';
        
        this.openModal('create-category-modal');
        document.getElementById('category-name').focus();
    }
    
    openEditCategoryModal(categoryIndex) {
        this.categoryModalMode = 'edit';
        this.editingCategoryIndex = categoryIndex;
        
        const category = this.categories[categoryIndex];
        
        document.getElementById('create-category-modal-title').textContent = 'Edit Category';
        document.getElementById('category-name').value = category.name;
        document.getElementById('save-category').textContent = 'Update Category';
        
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
            // Find first available slot in grid
            const slot = this.findFirstAvailableSlot();
            
            const newCategory = {
                id: this.generateId(),
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
        
        let message = `Are you sure you want to delete the category "${category.name}"?`;
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

    // Category Dropdown Management
    toggleCategoryDropdown(categoryIndex) {
        const dropdown = document.querySelector(`.category-dropdown-menu[data-category-index="${categoryIndex}"]`);
        if (!dropdown) return;
        
        const isCurrentlyOpen = dropdown.classList.contains('show');
        
        // Close all dropdowns first
        this.closeCategoryDropdowns();
        
        // If the clicked dropdown wasn't open, open it
        if (!isCurrentlyOpen) {
            dropdown.classList.add('show');
            // Add high z-index class to the category
            const categoryColumn = dropdown.closest('.category-column');
            if (categoryColumn) {
                categoryColumn.classList.add('dropdown-open');
            }
        }
    }

    closeCategoryDropdowns() {
        document.querySelectorAll('.category-dropdown-menu').forEach(dropdown => {
            dropdown.classList.remove('show');
            // Remove high z-index class from the category
            const categoryColumn = dropdown.closest('.category-column');
            if (categoryColumn) {
                categoryColumn.classList.remove('dropdown-open');
            }
        });
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
        
        if (!rawUrl) {
            this.showToast('URL is required', 'error');
            return;
        }

        if (!name) {
            this.showToast('Bookmark name is required', 'error');
            return;
        }

        const saveBtn = document.getElementById('save-bookmark');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            // Normalize URL
            const normalizedUrl = this.normalizeUrl(rawUrl);
            
            let faviconData = null;
            
            // Use custom favicon if provided, otherwise try to fetch from domain
            if (rawFaviconUrl) {
                try {
                    faviconData = await this.fetchFaviconAsDataUrl(rawFaviconUrl);
                } catch (error) {
                    console.warn('Could not fetch custom favicon:', error);
                }
            }
            
            // If no custom favicon or it failed, try domain favicon
            if (!faviconData) {
                try {
                    faviconData = await this.fetchFaviconAsDataUrl(normalizedUrl);
                } catch (error) {
                    console.warn('Could not fetch domain favicon:', error);
                }
            }

            const bookmarkData = {
                id: this.generateId(),
                name: name,
                url: normalizedUrl,
                faviconData: faviconData
            };
            
            if (this.currentEditingBookmark !== null) {
                if (this.currentEditingCategory === 'inbox') {
                    // Update existing inbox item
                    this.inbox[this.currentEditingBookmark] = bookmarkData;
                    this.showToast('Inbox item updated successfully', 'success');
                } else {
                    // Update existing bookmark
                    this.categories[this.currentEditingCategory].bookmarks[this.currentEditingBookmark] = bookmarkData;
                    this.showToast('Bookmark updated successfully', 'success');
                }
            } else {
                // Add new bookmark
                this.categories[this.currentEditingCategory].bookmarks.push(bookmarkData);
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

    hideBookmarkPreview() {
        const preview = document.querySelector('.bookmark-preview');
        if (preview) {
            preview.classList.remove('visible');
        }
    }

    handleUrlInputDebounced(e) {
        // Debounced URL input handler for bookmarks
        clearTimeout(this.bookmarkUrlTimeout);
        this.bookmarkUrlTimeout = setTimeout(() => {
            this.handleUrlInputImmediate(e);
        }, 500);
    }

    handleUrlInputImmediate(e) {
        // Immediate URL input handler for bookmarks
        clearTimeout(this.bookmarkUrlTimeout);
        this.handleBookmarkUrlInput(e);
    }

    async handleBookmarkUrlInput(e) {
        const url = e.target.value.trim();
        const nameInput = document.getElementById('bookmark-name');
        
        if (!url) {
            return;
        }

        try {
            const normalizedUrl = this.normalizeUrl(url);
            
            // Try to fetch title if name field is empty
            if (!nameInput.value.trim()) {
                const response = await fetch(normalizedUrl);
                const text = await response.text();
                const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
                if (titleMatch) {
                    nameInput.value = titleMatch[1].trim();
                }
            }
        } catch (error) {
            console.warn('Could not fetch page title:', error);
        }
    }

    handleFaviconUrlInput(e) {
        // Handle custom favicon URL input for bookmarks
        const faviconUrl = e.target.value.trim();
        const preview = document.querySelector('.bookmark-preview');
        const favicon = document.getElementById('bookmark-favicon');
        
        if (faviconUrl && favicon) {
            // Show preview with custom favicon
            favicon.src = faviconUrl;
            preview.classList.add('visible');
        }
    }

    deleteBookmark(categoryIndex, bookmarkIndex) {
        const bookmarksArray = this.categories[categoryIndex].bookmarks;
        const bookmark = bookmarksArray[bookmarkIndex];
        
        this.showConfirmation(
            'Delete Bookmark',
            `Are you sure you want to delete "${bookmark.name}"?`,
            () => {
                bookmarksArray.splice(bookmarkIndex, 1);
                this.saveData();
                this.renderDashboard();
                this.showToast('Bookmark deleted successfully', 'success');
            }
        );
    }

    async moveBookmarkToPosition(sourceCategoryIndex, sourceBookmarkIndex, targetCategoryIndex, targetPosition) {
        // Get the bookmark being moved from source category
        const bookmark = this.categories[sourceCategoryIndex].bookmarks[sourceBookmarkIndex];
        if (!bookmark) {
            console.error('Bookmark not found at source position');
            return;
        }
        
        // Remove bookmark from source category
        this.categories[sourceCategoryIndex].bookmarks.splice(sourceBookmarkIndex, 1);
        
        if (sourceCategoryIndex === targetCategoryIndex) {
            // Moving within the same category - adjust target position if needed
            let adjustedTargetPosition = targetPosition;
            if (sourceBookmarkIndex < targetPosition) {
                adjustedTargetPosition = targetPosition - 1;
            }
            // Insert bookmark at target position
            this.categories[targetCategoryIndex].bookmarks.splice(adjustedTargetPosition, 0, bookmark);
            } else {
            // Moving to different category
            // Insert bookmark at target position
            this.categories[targetCategoryIndex].bookmarks.splice(targetPosition, 0, bookmark);
            }
            
            await this.saveData();
            this.renderDashboard();
        
        if (sourceCategoryIndex === targetCategoryIndex) {
            this.showToast('Bookmark reordered successfully', 'success');
        } else {
            this.showToast('Bookmark moved to another category', 'success');
        }
    }

    // Inbox Management
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('inbox-sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
            toggleBtn.classList.add('active');
            document.body.classList.add('sidebar-open');
        } else {
            sidebar.classList.remove('open');
            toggleBtn.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        }
    }

    renderInbox() {
        const inboxContent = document.getElementById('inbox-content');
        const inboxCount = document.getElementById('inbox-count');
        
        // Update count
        inboxCount.textContent = this.inbox.length;
        
        if (this.inbox.length === 0) {
            inboxContent.innerHTML = `
                <div class="empty-inbox">
                    <div class="empty-inbox-icon">📥</div>
                    <div class="empty-inbox-text">
                        Your inbox is empty.<br>
                        Click the extension icon on any website to add it here.
                    </div>
                </div>
            `;
            return;
        }

        inboxContent.innerHTML = this.inbox.map((item, index) => 
            this.renderInboxItem(item, index)
        ).join('');
        
        this.setupInboxEventListeners();
    }

    renderInboxItem(item, index) {
        const faviconSrc = item.faviconData || this.getFallbackIcon();
        const fallbackIcon = this.getFallbackIcon();
        
        return `
            <div class="inbox-item" data-inbox-index="${index}" draggable="true">
                <a href="${this.escapeHtml(item.url)}" ${this.openLinksInNewTab ? 'target="_blank"' : ''} class="inbox-link">
                    <img class="inbox-favicon" src="${faviconSrc}" alt="Favicon" data-fallback="${fallbackIcon}">
                    <span class="inbox-title">${this.escapeHtml(item.name)}</span>
                </a>
                <div class="inbox-actions">
                    <button class="inbox-action-btn inbox-edit-btn" data-inbox-index="${index}" title="Edit Bookmark">
                        ✏️
                    </button>
                    <button class="inbox-action-btn inbox-delete-btn" data-inbox-index="${index}" title="Delete Bookmark">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    setupInboxEventListeners() {
        // Edit buttons
        document.querySelectorAll('.inbox-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const inboxIndex = parseInt(e.target.dataset.inboxIndex);
                this.editInboxItem(inboxIndex);
            });
        });

        // Delete buttons
        document.querySelectorAll('.inbox-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const inboxIndex = parseInt(e.target.dataset.inboxIndex);
                this.deleteInboxItem(inboxIndex);
            });
        });

        // Drag and drop
        document.querySelectorAll('.inbox-item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleInboxDragStart(e));
            item.addEventListener('dragend', (e) => this.handleInboxDragEnd(e));
        });

        // Favicon error handling
        document.querySelectorAll('.inbox-favicon').forEach(img => {
            img.addEventListener('error', (e) => {
                const fallbackIcon = e.target.dataset.fallback;
                if (fallbackIcon && e.target.src !== fallbackIcon) {
                    e.target.src = fallbackIcon;
                }
            });
        });
    }

    async addToInbox(url, name = null, faviconData = null) {
        // Auto-generate name from URL if not provided
        if (!name) {
            name = new URL(url).hostname;
        }
        
        // Check if item already exists in inbox
        const exists = this.inbox.some(item => item.url === url);
        if (exists) {
            this.showToast('Link already in inbox', 'info');
            return;
        }
        
        const inboxItem = {
            id: this.generateId(),
            name: name,
            url: url,
            faviconData: faviconData
        };
        
        this.inbox.push(inboxItem);
        await this.saveData();
        this.renderInbox();
        this.showToast('Added to inbox', 'success');
    }

    editInboxItem(inboxIndex) {
        const item = this.inbox[inboxIndex];
        this.currentEditingBookmark = inboxIndex;
        this.currentEditingCategory = 'inbox';
        
        document.getElementById('bookmark-modal-title').textContent = 'Edit Inbox Item';
        document.getElementById('bookmark-url').value = item.url;
        document.getElementById('bookmark-name').value = item.name;
        document.getElementById('bookmark-favicon-url').value = '';
        document.getElementById('save-bookmark').textContent = 'Update Item';
        
        // Show preview with cached favicon
        const preview = document.querySelector('.bookmark-preview');
        const favicon = document.getElementById('bookmark-favicon');
        const titlePreview = document.getElementById('bookmark-title-preview');
        
        favicon.src = item.faviconData || this.getFallbackIcon();
        titlePreview.textContent = item.name;
        preview.classList.add('visible');
        
        this.openModal('bookmark-modal');
    }

    deleteInboxItem(inboxIndex) {
        const item = this.inbox[inboxIndex];
        
        this.showConfirmation(
            'Delete Inbox Item',
            `Are you sure you want to delete "${item.name}"?`,
            () => {
                this.inbox.splice(inboxIndex, 1);
                this.saveData();
                this.renderInbox();
                this.showToast('Inbox item deleted successfully', 'success');
            }
        );
    }

    handleInboxDragStart(e) {
        const inboxItem = e.target.closest('.inbox-item');
        this.draggedElement = inboxItem;
        this.draggedType = 'inbox';
        inboxItem.classList.add('dragging');
        document.body.classList.add('dragging-inbox');
    }

    handleInboxDragEnd(e) {
        const inboxItem = e.target.closest('.inbox-item');
        inboxItem.classList.remove('dragging');
        document.body.classList.remove('dragging-inbox');
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up all drag-over visual feedback
        document.querySelectorAll('.bookmark-item.drag-over-top, .bookmark-item.drag-over-bottom').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        document.querySelectorAll('.bookmarks-list.drag-over-empty').forEach(list => {
            list.classList.remove('drag-over-empty');
        });
        document.querySelectorAll('.category-body.drag-over').forEach(body => {
            body.classList.remove('drag-over');
        });
    }

    async moveInboxItemToCategory(inboxIndex, targetCategoryIndex) {
        // Use the more precise positioning version
        const targetPosition = this.categories[targetCategoryIndex].bookmarks.length;
        return this.moveInboxItemToCategoryAtPosition(inboxIndex, targetCategoryIndex, targetPosition);
    }

    async moveInboxItemToCategoryAtPosition(inboxIndex, targetCategoryIndex, targetPosition) {
        const inboxItem = this.inbox[inboxIndex];
        if (!inboxItem) {
            console.error('Inbox item not found at index', inboxIndex);
            return;
        }

        // Create bookmark data from inbox item
        const bookmarkData = {
            id: inboxItem.id,
            name: inboxItem.name,
            url: inboxItem.url,
            faviconData: inboxItem.faviconData
        };

        // Insert at specific position in target category
        this.categories[targetCategoryIndex].bookmarks.splice(targetPosition, 0, bookmarkData);

        // Remove from inbox
        this.inbox.splice(inboxIndex, 1);

        await this.saveData();
        this.renderDashboard();
        this.showToast(`Moved "${inboxItem.name}" to ${this.categories[targetCategoryIndex].name}`, 'success');
    }

    async moveBookmarkToInbox(categoryIndex, bookmarkIndex) {
        console.log(`moveBookmarkToInbox called: categoryIndex=${categoryIndex}, bookmarkIndex=${bookmarkIndex}`);
        console.log(`Category has ${this.categories[categoryIndex].bookmarks.length} bookmarks before removal`);
        
        const bookmark = this.categories[categoryIndex].bookmarks[bookmarkIndex];
        if (!bookmark) {
            console.error('Bookmark not found at position');
            return;
        }

        console.log(`Moving bookmark: "${bookmark.name}" from position ${bookmarkIndex}`);

        // Check if item already exists in inbox
        const exists = this.inbox.some(item => item.url === bookmark.url);
        if (exists) {
            this.showToast('Link already in inbox', 'info');
            return;
        }

        // Create inbox item from bookmark
        const inboxItem = {
            id: bookmark.id,
            name: bookmark.name,
            url: bookmark.url,
            faviconData: bookmark.faviconData
        };

        // Add to inbox
        this.inbox.push(inboxItem);

        // Remove from category - only this specific bookmark
        console.log(`About to splice: removing 1 item at index ${bookmarkIndex}`);
        const removed = this.categories[categoryIndex].bookmarks.splice(bookmarkIndex, 1);
        console.log(`Removed items:`, removed);
        console.log(`Category now has ${this.categories[categoryIndex].bookmarks.length} bookmarks after removal`);

        await this.saveData();
        this.renderDashboard();
        this.showToast(`Moved "${bookmark.name}" to inbox`, 'success');
    }

    setupInboxDropZone() {
        const inboxContent = document.getElementById('inbox-content');
        if (!inboxContent) return;

        // Check if we've already set up listeners to prevent duplicates
        if (inboxContent.hasAttribute('data-inbox-listeners-setup')) {
            return;
        }

        // Mark as having listeners setup
        inboxContent.setAttribute('data-inbox-listeners-setup', 'true');

        // Bind methods to this instance
        this.boundHandleInboxDragOver = this.boundHandleInboxDragOver || ((e) => this.handleInboxDragOver(e));
        this.boundHandleInboxDragLeave = this.boundHandleInboxDragLeave || ((e) => this.handleInboxDragLeave(e));
        this.boundHandleInboxDrop = this.boundHandleInboxDrop || ((e) => this.handleInboxDrop(e));

        // Add the event listeners
        inboxContent.addEventListener('dragover', this.boundHandleInboxDragOver);
        inboxContent.addEventListener('dragleave', this.boundHandleInboxDragLeave);
        inboxContent.addEventListener('drop', this.boundHandleInboxDrop);
    }

    handleInboxDragOver(e) {
        if (this.draggedType !== 'bookmark') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const inboxContent = e.target.closest('#inbox-content');
        if (inboxContent) {
            inboxContent.classList.add('drag-over');
        }
    }

    handleInboxDragLeave(e) {
        const inboxContent = e.target.closest('#inbox-content');
        if (!inboxContent) return;
        
        // Only remove classes if we're leaving the element entirely
        if (!inboxContent.contains(e.relatedTarget)) {
            inboxContent.classList.remove('drag-over');
        }
    }

    handleInboxDrop(e) {
        console.log('handleInboxDrop called');
        if (this.draggedType !== 'bookmark' || !this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const inboxContent = e.target.closest('#inbox-content');
        if (!inboxContent) return;

        inboxContent.classList.remove('drag-over');

        // Get source information
        const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
        const sourceBookmarkIndex = parseInt(this.draggedElement.dataset.bookmarkIndex);
        
        console.log('About to call moveBookmarkToInbox from handleInboxDrop');
        this.moveBookmarkToInbox(sourceCategoryIndex, sourceBookmarkIndex);
    }

    // Favourites Rendering
    renderFavouritesBar() {
        const favouritesBar = document.getElementById('favourites-bar');
        
        if (!this.showFavourites) {
            favouritesBar.classList.add('hidden');
            return;
        }
        
        favouritesBar.classList.remove('hidden');
        
        let favouritesHtml = `
            <div class="favourites-header">
                <h4 class="favourites-title">Favourites</h4>
                <button class="favourites-edit-btn ${this.favouritesEditMode ? 'active' : ''}" title="${this.favouritesEditMode ? 'Exit Edit Mode' : 'Edit Favourites'}">
                    ${this.favouritesEditMode ? 'Done' : 'Edit'}
                </button>
            </div>
            <div class="favourites-container ${this.favouritesEditMode ? 'edit-mode' : ''}">
        `;
        
        // Render favourite items
        this.favourites.forEach((favourite, index) => {
            favouritesHtml += this.renderFavourite(favourite, index);
        });
        
        // Add "Add Favourite" button
        favouritesHtml += `
                <div class="add-favourite-btn" title="Add Favourite">
                    +
                </div>
            </div>
        `;
        
        favouritesBar.innerHTML = favouritesHtml;
        this.setupFavouritesEventListeners();
    }
    
    renderFavourite(favourite, index) {
        const faviconSrc = favourite.faviconData || this.getFallbackIcon();
        const fallbackIcon = this.getFallbackIcon();
        
        return `
            <div class="favourite-item" data-favourite-index="${index}" draggable="true" title="${this.escapeHtml(favourite.url)}">
                <a href="${this.escapeHtml(favourite.url)}" ${this.openLinksInNewTab ? 'target="_blank"' : ''} class="favourite-link">
                    <img class="favourite-favicon" src="${faviconSrc}" alt="Favicon" data-fallback="${fallbackIcon}">
                </a>
                ${this.favouritesEditMode ? `
                    <div class="favourite-actions">
                        <button class="action-btn edit-btn" data-favourite-index="${index}" title="Edit Favourite">
                            ✏️
                        </button>
                        <button class="action-btn delete-btn" data-favourite-index="${index}" title="Delete Favourite">
                            🗑️
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Favourites Event Listeners
    setupFavouritesEventListeners() {
        // Edit button
        const editBtn = document.querySelector('.favourites-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.toggleFavouritesEditMode());
        }
        
        // Add favourite button
        const addFavouriteBtn = document.querySelector('.add-favourite-btn');
        if (addFavouriteBtn) {
            addFavouriteBtn.addEventListener('click', () => this.openAddFavouriteModal());
        }

        // Favourite action buttons (only in edit mode)
        document.querySelectorAll('.favourite-item .edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const favouriteIndex = parseInt(e.target.closest('.favourite-item').dataset.favouriteIndex);
                this.editFavourite(favouriteIndex);
            });
        });

        document.querySelectorAll('.favourite-item .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const favouriteIndex = parseInt(e.target.closest('.favourite-item').dataset.favouriteIndex);
                this.deleteFavourite(favouriteIndex);
            });
        });

        // Favourite drag and drop
        document.querySelectorAll('.favourite-item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleFavouriteDragStart(e));
            item.addEventListener('dragend', (e) => this.handleFavouriteDragEnd(e));
            item.addEventListener('dragover', (e) => this.handleFavouriteDragOver(e));
            item.addEventListener('dragleave', (e) => this.handleFavouriteDragLeave(e));
            item.addEventListener('drop', (e) => this.handleFavouriteDrop(e));
        });

        // Allow clicking on favourite items in edit mode to edit them
        if (this.favouritesEditMode) {
            document.querySelectorAll('.favourite-item .favourite-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const favouriteItem = e.target.closest('.favourite-item');
                    const favouriteIndex = parseInt(favouriteItem.dataset.favouriteIndex);
                    this.editFavourite(favouriteIndex);
                });
            });
        }

        // Favicon error handling for favourites
        document.querySelectorAll('.favourite-favicon').forEach(img => {
            img.addEventListener('error', (e) => {
                const fallbackIcon = e.target.dataset.fallback;
                if (fallbackIcon && e.target.src !== fallbackIcon) {
                    e.target.src = fallbackIcon;
                }
            });
        });
    }

    // Favourites Management
    openAddFavouriteModal() {
        this.currentEditingFavourite = null;
        this.editingFavouriteIndex = null;
        
        document.getElementById('favourite-modal-title').textContent = 'Add Favourite';
        document.getElementById('favourite-url').value = '';
        document.getElementById('favourite-favicon').value = '';
        document.getElementById('save-favourite').textContent = 'Save Favourite';
        
        this.openModal('favourite-modal');
        document.getElementById('favourite-url').focus();
    }

    editFavourite(favouriteIndex) {
        const favourite = this.favourites[favouriteIndex];
        this.currentEditingFavourite = favourite;
        this.editingFavouriteIndex = favouriteIndex;
        
        document.getElementById('favourite-modal-title').textContent = 'Edit Favourite';
        document.getElementById('favourite-url').value = favourite.url;
        document.getElementById('favourite-favicon').value = '';
        document.getElementById('save-favourite').textContent = 'Update Favourite';
        
        this.openModal('favourite-modal');
        document.getElementById('favourite-url').focus();
    }

    deleteFavourite(favouriteIndex) {
        const favourite = this.favourites[favouriteIndex];
        this.showConfirmation(
            'Delete Favourite',
            `Are you sure you want to delete the favourite for "${favourite.url}"?`,
            () => {
                this.favourites.splice(favouriteIndex, 1);
                this.saveData();
                this.renderDashboard();
                this.showToast('Favourite deleted successfully', 'success');
            }
        );
    }

    async handleSaveFavourite(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const url = formData.get('url').trim();
        const customFaviconUrl = formData.get('favicon').trim();
        
        if (!url) {
            this.showToast('URL is required', 'error');
            return;
        }

        const saveBtn = document.getElementById('save-favourite');
        saveBtn.disabled = true;
        
        try {
            // Normalize URL
            const normalizedUrl = this.normalizeUrl(url);
            
            let faviconData = null;
            
            // Use custom favicon if provided, otherwise try to fetch from domain
            if (customFaviconUrl) {
                try {
                    faviconData = await this.fetchFaviconAsDataUrl(customFaviconUrl);
                } catch (error) {
                    console.warn('Could not fetch custom favicon:', error);
                }
            }
            
            // If no custom favicon or it failed, try domain favicon
            if (!faviconData) {
                try {
                    faviconData = await this.fetchFaviconAsDataUrl(normalizedUrl);
                } catch (error) {
                    console.warn('Could not fetch domain favicon:', error);
                }
            }
            
            const favouriteData = {
                id: this.generateId(),
                url: normalizedUrl,
                faviconData: faviconData
            };
            
            if (this.editingFavouriteIndex !== null) {
                // Update existing favourite
                this.favourites[this.editingFavouriteIndex] = { ...this.favourites[this.editingFavouriteIndex], ...favouriteData };
                this.showToast('Favourite updated successfully', 'success');
            } else {
                // Add new favourite
                this.favourites.push(favouriteData);
                this.showToast('Favourite added successfully', 'success');
            }
            
            await this.saveData();
            this.renderDashboard();
            this.closeModal('favourite-modal');
            
        } catch (error) {
            console.error('Error saving favourite:', error);
            this.showToast('Error saving favourite', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = this.editingFavouriteIndex !== null ? 'Update Favourite' : 'Save Favourite';
        }
    }

    handleShowFavouritesChange(e) {
        this.showFavourites = e.target.checked;
        this.saveData();
        this.renderDashboard();
        this.showToast(`Favourites bar ${this.showFavourites ? 'enabled' : 'disabled'}`, 'success');
    }

    handleOpenLinksInNewTabChange(e) {
        this.openLinksInNewTab = e.target.checked;
        this.saveData();
        this.renderDashboard();
        this.showToast(`Links will now open in ${this.openLinksInNewTab ? 'new tab' : 'current tab'}`, 'success');
    }

    toggleFavouritesEditMode() {
        this.favouritesEditMode = !this.favouritesEditMode;
        this.renderDashboard();
        
        if (this.favouritesEditMode) {
            this.showToast('Edit mode enabled - Click on favourites to edit, use action buttons to delete', 'info');
        } else {
            this.showToast('Edit mode disabled', 'info');
        }
    }

    // URL and Favicon Handling
    normalizeUrl(url) {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        return 'https://' + url;
    }

    async fetchFaviconAsDataUrl(url) {
        const domain = new URL(url).origin;
        const faviconUrl = `${domain}/favicon.ico`;
        
        try {
            const response = await fetch(faviconUrl);
            if (!response.ok) throw new Error('Favicon not found');
            
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            } catch (error) {
            throw new Error('Could not fetch favicon');
        }
    }

    handleFavouriteUrlInputDebounced(e) {
        // Debounced URL input handler for favourites
        clearTimeout(this.favouriteUrlTimeout);
        this.favouriteUrlTimeout = setTimeout(() => {
            this.handleFavouriteUrlInput(e);
        }, 500);
    }

    handleFavouriteUrlInputImmediate(e) {
        // Immediate URL input handler for favourites
        clearTimeout(this.favouriteUrlTimeout);
        this.handleFavouriteUrlInput(e);
    }

    async handleFavouriteUrlInput(e) {
        const url = e.target.value.trim();
        const statusDiv = document.getElementById('favourite-url-status');
        
        if (!url) {
            statusDiv.textContent = '';
            statusDiv.className = 'url-status';
            return;
        }

        statusDiv.textContent = 'Checking URL...';
        statusDiv.className = 'url-status checking';

        try {
            const normalizedUrl = this.normalizeUrl(url);
            
            // Just check if URL is accessible, no title fetching needed
            await fetch(normalizedUrl);
            
            statusDiv.textContent = '✓ URL is accessible';
            statusDiv.className = 'url-status success';
        } catch (error) {
            statusDiv.textContent = '⚠ Could not access URL';
            statusDiv.className = 'url-status warning';
        }
    }

    handleFavouriteFaviconUrlInput(e) {
        // Handle custom favicon URL input for favourites
        const faviconUrl = e.target.value.trim();
        if (faviconUrl) {
            // You could add favicon preview functionality here
        }
    }

    // Favourite Drag and Drop
    handleFavouriteDragStart(e) {
        const favouriteItem = e.target.closest('.favourite-item');
        this.draggedElement = favouriteItem;
        this.draggedType = 'favourite';
        
        favouriteItem.classList.add('dragging');
        document.body.classList.add('dragging-favourite');
    }

    handleFavouriteDragEnd(e) {
        const favouriteItem = e.target.closest('.favourite-item');
        
        favouriteItem.classList.remove('dragging');
        document.body.classList.remove('dragging-favourite');
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up any drag-over classes
        document.querySelectorAll('.favourite-item.drag-over-before, .favourite-item.drag-over-after').forEach(item => {
            item.classList.remove('drag-over-before', 'drag-over-after');
        });
    }

    handleFavouriteDragOver(e) {
        if (this.draggedType !== 'favourite') return;
        
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const favouriteItem = e.target.closest('.favourite-item');
        if (!favouriteItem || favouriteItem === this.draggedElement) return;
        
        // Clear drag-over classes from all items
        document.querySelectorAll('.favourite-item.drag-over-before, .favourite-item.drag-over-after').forEach(item => {
            item.classList.remove('drag-over-before', 'drag-over-after');
        });
        
        // Determine if we should insert before or after based on mouse position
        const rect = favouriteItem.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const insertBefore = e.clientX < midX;
        
        if (insertBefore) {
            favouriteItem.classList.add('drag-over-before');
        } else {
            favouriteItem.classList.add('drag-over-after');
        }
    }

    handleFavouriteDragLeave(e) {
        if (this.draggedType !== 'favourite') return;
        
        const favouriteItem = e.target.closest('.favourite-item');
        if (!favouriteItem) return;
        
        // Only remove classes if we're leaving the item entirely
        if (!favouriteItem.contains(e.relatedTarget)) {
            favouriteItem.classList.remove('drag-over-before', 'drag-over-after');
        }
    }

    handleFavouriteDrop(e) {
        if (this.draggedType !== 'favourite' || !this.draggedElement) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const targetItem = e.target.closest('.favourite-item');
        if (!targetItem) return;
        
        const draggedIndex = parseInt(this.draggedElement.dataset.favouriteIndex);
        const targetIndex = parseInt(targetItem.dataset.favouriteIndex);
        
        if (draggedIndex === targetIndex) return;
        
        // Determine insert position
        const insertBefore = targetItem.classList.contains('drag-over-before');
        let newIndex = targetIndex;
        
        if (!insertBefore) {
            newIndex = targetIndex + 1;
        }
        
        // Adjust if dragging from before target
        if (draggedIndex < newIndex) {
            newIndex--;
        }
        
        this.moveFavouriteToPosition(draggedIndex, newIndex);
    }

    moveFavouriteToPosition(fromIndex, toIndex) {
        const favourite = this.favourites[fromIndex];
        this.favourites.splice(fromIndex, 1);
        this.favourites.splice(toIndex, 0, favourite);
        
        this.saveData();
        this.renderDashboard();
        this.showToast('Favourite reordered successfully', 'success');
    }

    // Category Event Listeners
    setupCategoryEventListeners() {
        // Category menu buttons
        document.querySelectorAll('.category-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.toggleCategoryDropdown(categoryIndex);
            });
        });

        // Category dropdown action buttons
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

        // Add bookmark plus buttons
        document.querySelectorAll('.add-bookmark-plus-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.openAddBookmarkModal(categoryIndex);
            });
        });

        // Category drag and drop
        document.querySelectorAll('.category-column').forEach(column => {
            column.addEventListener('dragstart', (e) => this.handleCategoryDragStart(e));
            column.addEventListener('dragend', (e) => this.handleCategoryDragEnd(e));
        });
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

    setupBookmarkDragDrop() {
        // Setup drag and drop for bookmark items and lists
        const bookmarkItems = document.querySelectorAll('.bookmark-item');
        bookmarkItems.forEach(item => {
            item.addEventListener('dragover', (e) => this.handleBookmarkDragOver(e));
            item.addEventListener('dragleave', (e) => this.handleBookmarkDragLeave(e));
            item.addEventListener('drop', (e) => this.handleBookmarkDrop(e));
        });
        
        // Setup drop zones on bookmark lists for empty lists
        const bookmarksLists = document.querySelectorAll('.bookmarks-list');
        bookmarksLists.forEach((list, index) => {
            list.addEventListener('dragover', (e) => this.handleBookmarksListDragOver(e));
            list.addEventListener('dragleave', (e) => this.handleBookmarksListDragLeave(e));
            list.addEventListener('drop', (e) => this.handleBookmarksListDrop(e));
        });
        
        // Also setup drop zones on category bodies as backup
        const categoryBodies = document.querySelectorAll('.category-body');
        categoryBodies.forEach(body => {
            body.addEventListener('dragover', (e) => this.handleCategoryBodyDragOver(e));
            body.addEventListener('dragleave', (e) => this.handleCategoryBodyDragLeave(e));
            body.addEventListener('drop', (e) => this.handleCategoryBodyDrop(e));
        });
    }

    setupEmptyStateEventListeners() {
        // Empty state create category button
        const emptyCreateBtn = document.getElementById('empty-create-category-btn');
        if (emptyCreateBtn) {
            emptyCreateBtn.addEventListener('click', () => this.openCreateCategoryModal());
        }
    }

    // Drag and Drop Event Handlers (basic implementations)
    handleCategoryDragStart(e) {
        const categoryColumn = e.target.closest('.category-column');
        this.draggedElement = categoryColumn;
        this.draggedType = 'category';
        categoryColumn.classList.add('dragging');
        document.body.classList.add('dragging-category');
    }

    handleCategoryDragEnd(e) {
        const categoryColumn = e.target.closest('.category-column');
        categoryColumn.classList.remove('dragging');
        document.body.classList.remove('dragging-category');
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up any remaining drag-over classes
        document.querySelectorAll('.column-drop-zone.drag-over').forEach(zone => {
            zone.classList.remove('drag-over');
        });
    }

    handleColumnDropZoneDragOver(e) {
        if (this.draggedType !== 'category') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.target.classList.add('drag-over');
    }

    handleColumnDropZoneDragLeave(e) {
        e.target.classList.remove('drag-over');
    }

    handleColumnDropZoneDrop(e) {
        if (this.draggedType !== 'category' || !this.draggedElement) return;
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        const dropZone = e.target;
        const targetColumn = parseInt(dropZone.dataset.columnIndex);
        const targetPosition = parseInt(dropZone.dataset.position);
        
        const draggedCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
        const draggedCategory = this.categories[draggedCategoryIndex];
        
        if (!draggedCategory) return;
        
        // Don't do anything if dropping in the same position
        if (draggedCategory.column === targetColumn && draggedCategory.position === targetPosition) {
            return;
        }
        
        this.moveCategoryToPosition(draggedCategoryIndex, targetColumn, targetPosition);
    }

    handleBookmarkDragStart(e) {
        e.stopPropagation(); // Prevent category drag from triggering
        const bookmarkItem = e.target.closest('.bookmark-item');
        this.draggedElement = bookmarkItem;
        this.draggedType = 'bookmark';
        bookmarkItem.classList.add('dragging');
        document.body.classList.add('dragging-bookmark');
    }

    handleBookmarkDragEnd(e) {
        const bookmarkItem = e.target.closest('.bookmark-item');
        bookmarkItem.classList.remove('dragging');
        document.body.classList.remove('dragging-bookmark');
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up all drag-over visual feedback
        document.querySelectorAll('.bookmark-item.drag-over-top, .bookmark-item.drag-over-bottom').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        document.querySelectorAll('.bookmarks-list.drag-over-empty').forEach(list => {
            list.classList.remove('drag-over-empty');
        });
        document.querySelectorAll('.category-body.drag-over').forEach(body => {
            body.classList.remove('drag-over');
        });
        document.querySelectorAll('#inbox-content.drag-over').forEach(inbox => {
            inbox.classList.remove('drag-over');
        });
    }

    handleBookmarkDragOver(e) {
        if (this.draggedType !== 'bookmark' && this.draggedType !== 'inbox') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const targetBookmark = e.target.closest('.bookmark-item');
        if (targetBookmark && targetBookmark !== this.draggedElement) {
            // Clear previous highlights
            document.querySelectorAll('.bookmark-item.drag-over-top, .bookmark-item.drag-over-bottom').forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
            // Determine insert position based on mouse position
            const rect = targetBookmark.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertAfter = e.clientY > midY;
            
            if (insertAfter) {
                targetBookmark.classList.add('drag-over-bottom');
            } else {
                targetBookmark.classList.add('drag-over-top');
            }
        }
    }

    handleBookmarkDragLeave(e) {
        // Handle drag leave for bookmarks
    }

    handleBookmarkDrop(e) {
        if (!this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const targetBookmark = e.target.closest('.bookmark-item');
        if (!targetBookmark || targetBookmark === this.draggedElement) return;
        
        const targetCategoryIndex = parseInt(targetBookmark.dataset.categoryIndex);
        const targetBookmarkIndex = parseInt(targetBookmark.dataset.bookmarkIndex);
        
        // Determine insert position based on mouse position
        const rect = targetBookmark.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertAfter = e.clientY > midY;
        const targetPosition = insertAfter ? targetBookmarkIndex + 1 : targetBookmarkIndex;
        
        if (this.draggedType === 'bookmark') {
            // Get source bookmark information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceBookmarkIndex = parseInt(this.draggedElement.dataset.bookmarkIndex);
            
            this.moveBookmarkToPosition(sourceCategoryIndex, sourceBookmarkIndex, targetCategoryIndex, targetPosition);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop at specific position
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.moveInboxItemToCategoryAtPosition(inboxIndex, targetCategoryIndex, targetPosition);
        }
    }

    handleBookmarksListDragOver(e) {
        if (this.draggedType !== 'bookmark' && this.draggedType !== 'inbox') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const bookmarksList = e.target.closest('.bookmarks-list');
        if (bookmarksList) {
            bookmarksList.classList.add('drag-over-empty');
        }
    }

    handleBookmarksListDragLeave(e) {
        const bookmarksList = e.target.closest('.bookmarks-list');
        if (!bookmarksList) return;
        
        // Only remove classes if we're leaving the element entirely
        if (!bookmarksList.contains(e.relatedTarget)) {
            bookmarksList.classList.remove('drag-over-empty');
        }
    }

    handleBookmarksListDrop(e) {
        if (!this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const bookmarksList = e.target.closest('.bookmarks-list');
        if (!bookmarksList) return;
        
        const targetCategoryIndex = parseInt(bookmarksList.dataset.categoryIndex || 
                                           bookmarksList.closest('.category-column').dataset.categoryIndex);
        
        if (this.draggedType === 'bookmark') {
            // Get source information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceBookmarkIndex = parseInt(this.draggedElement.dataset.bookmarkIndex);
            
            // Drop at the end of the target category
            const targetPosition = this.categories[targetCategoryIndex].bookmarks.length;
            
            this.moveBookmarkToPosition(sourceCategoryIndex, sourceBookmarkIndex, targetCategoryIndex, targetPosition);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.moveInboxItemToCategory(inboxIndex, targetCategoryIndex);
        }
    }

    handleCategoryBodyDragOver(e) {
        if (this.draggedType !== 'bookmark' && this.draggedType !== 'inbox') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const categoryBody = e.target.closest('.category-body');
        if (categoryBody) {
            categoryBody.classList.add('drag-over');
        }
    }

    handleCategoryBodyDragLeave(e) {
        const categoryBody = e.target.closest('.category-body');
        if (!categoryBody) return;
        
        // Only remove classes if we're leaving the element entirely
        if (!categoryBody.contains(e.relatedTarget)) {
            categoryBody.classList.remove('drag-over');
        }
    }

    handleCategoryBodyDrop(e) {
        if (!this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const categoryBody = e.target.closest('.category-body');
        if (!categoryBody) return;
        
        const targetCategoryIndex = parseInt(categoryBody.closest('.category-column').dataset.categoryIndex);
        
        if (this.draggedType === 'bookmark') {
            // Get source information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceBookmarkIndex = parseInt(this.draggedElement.dataset.bookmarkIndex);
            
            // Drop at the end of the target category
            const targetPosition = this.categories[targetCategoryIndex].bookmarks.length;
            
            this.moveBookmarkToPosition(sourceCategoryIndex, sourceBookmarkIndex, targetCategoryIndex, targetPosition);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.moveInboxItemToCategory(inboxIndex, targetCategoryIndex);
        }
    }

    // Settings and Import/Export
    openSettingsModal() {
        document.getElementById('column-count').value = this.columnCount;
        document.getElementById('show-favourites').checked = this.showFavourites;
        document.getElementById('open-links-new-tab').checked = this.openLinksInNewTab;
        this.openModal('settings-modal');
    }

    async handleColumnCountChange(e) {
        const newColumnCount = parseInt(e.target.value);
        if (newColumnCount >= 1 && newColumnCount <= 5) {
            this.columnCount = newColumnCount;
            await this.saveData();
            this.renderDashboard();
            this.showToast(`Layout updated to ${newColumnCount} column${newColumnCount > 1 ? 's' : ''}`, 'success');
        }
    }

    exportBookmarks() {
        const data = {
            categories: this.categories,
            favourites: this.favourites,
            columnCount: this.columnCount,
            showFavourites: this.showFavourites,
            openLinksInNewTab: this.openLinksInNewTab,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linkshelf-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Bookmarks exported successfully', 'success');
    }

    triggerImport() {
        document.getElementById('import-file').click();
    }

    async importBookmarks(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.categories || !Array.isArray(data.categories)) {
                throw new Error('Invalid export file format');
            }

            // Import the data
            this.categories = data.categories;
            this.favourites = data.favourites || [];
            this.columnCount = data.columnCount || 3;
            this.showFavourites = data.showFavourites !== false;
            this.openLinksInNewTab = data.openLinksInNewTab !== false;
            
            await this.saveData();
            this.renderDashboard();
            this.closeModal('settings-modal');
            
            this.showToast(`Successfully imported ${data.categories.length} categories`, 'success');
        } catch (error) {
            console.error('Error importing bookmarks:', error);
            this.showToast('Error importing bookmarks: Invalid file format', 'error');
        }

            // Reset file input
            e.target.value = '';
    }

    // UI helper methods
    escapeHtml(text) {
        if (text == null || text === undefined) {
            return '';
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    
    getFallbackIcon() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMzY0NTU0IiByeD0iMiIvPgo8cGF0aCBkPSJNNCA2SDEyVjEwSDRWNloiIGZpbGw9IiM4Qjk1QTEiLz4KPC9zdmc+Cg==';
    }

    // Modal Management
    openModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        document.body.style.overflow = '';
    }

    closeAnyOpenModal() {
        // Find any open modal and close it
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
            this.closeModal(openModal.id);
        }
    }

    showConfirmation(title, message, onConfirm) {
        document.getElementById('confirmation-title').textContent = title;
        document.getElementById('confirmation-message').textContent = message;
        
        // Remove any existing event listeners
        const confirmBtn = document.getElementById('confirmation-confirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Add new event listener
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.closeModal('confirmation-modal');
        });
        
        this.openModal('confirmation-modal');
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove toast after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // Utility methods for grid positioning
    moveCategoryToPosition(categoryIndex, targetColumn, targetPosition) {
        const category = this.categories[categoryIndex];
        if (!category) return;
        
        const oldColumn = category.column;
        const oldPosition = category.position;
        
        // Update the category's position
        category.column = targetColumn;
        category.position = targetPosition;
        
        // Shift other categories in the target column to make room
        this.categories.forEach((otherCategory, index) => {
            if (index !== categoryIndex && 
                otherCategory.column === targetColumn && 
                otherCategory.position >= targetPosition) {
                otherCategory.position++;
            }
        });
        
        // Compact the old column by moving categories up to fill the gap
        this.categories.forEach(otherCategory => {
            if (otherCategory.column === oldColumn && 
                otherCategory.position > oldPosition) {
                otherCategory.position--;
            }
        });
        
        this.saveData();
        this.renderDashboard();
        this.showToast('Category moved successfully', 'success');
    }

    findFirstAvailableSlot() {
        // Create a map of occupied slots
        const occupiedSlots = new Map();
        this.categories.forEach(category => {
            const key = `${category.column}-${category.position}`;
            occupiedSlots.set(key, true);
        });

        // Find first available slot, column by column, position by position
        for (let column = 0; column < this.columnCount; column++) {
            for (let position = 0; position < 100; position++) { // Arbitrary high limit
                const key = `${column}-${position}`;
                if (!occupiedSlots.has(key)) {
                    return { column, position };
                }
            }
        }
        
        // Fallback: last column, next available position
        return { column: this.columnCount - 1, position: 0 };
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new LinkShelfDashboard();
    dashboard.init();
    
    // Make dashboard globally available for any remaining onclick handlers
    window.dashboard = dashboard;
    
    console.log('Dashboard initialized successfully.');
});
