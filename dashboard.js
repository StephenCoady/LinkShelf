// LinkShelf Dashboard - Main JavaScript
class LinkShelfDashboard {
    constructor() {
        // Multi-shelf support
        this.shelves = [];
        this.currentShelfId = null;
        this.shelfModalMode = 'create'; // 'create' or 'edit'
        this.editingShelfIndex = null;
        
        // Current shelf data (backwards compatibility)
        this.categories = [];
        this.favourites = [];
        this.inbox = [];
        this.columnCount = 5;
        this.showFavourites = true;
        this.favouritesEditMode = false;
        this.openLinksInNewTab = true; // Default to opening in new tab
        this.categoryModalMode = 'create'; // 'create' or 'edit'
        this.editingCategoryIndex = null;
        this.currentEditingBookmark = null;
        this.currentEditingCategory = null;
        this.currentEditingFavourite = null;
        this.editingFavouriteIndex = null;
        this.searchQuery = '';
        this.searchTimeout = null;
        
        // Initialize manager classes
        this.storageManager = new StorageManager();
        this.faviconManager = new FaviconManager();
        this.dragDropManager = new DragDropManager(this);
        this.importExportManager = new ImportExportManager(this);
        
        // Load sidebar state
        this.sidebarOpen = this.storageManager.loadSidebarState();
        
        // Deprecated properties (now handled by dragDropManager)
        this.draggedElement = null;
        this.draggedType = null;
    }

    // Initialize the dashboard
    async init() {
        await this.loadData();
        this.setupStorageListener();
        this.setupEventListeners();
        this.renderDashboard();
        this.initializeSidebar();
        
        // Hide loading state after everything is rendered
        await this.finishLoading();
    }
    
    // Remove loading state with smooth transition
    async finishLoading() {
        // Small delay to ensure DOM is fully updated
        setTimeout(() => {
            document.body.classList.remove('loading');
        }, 100);
    }

    // Data Management
    async loadData() {
        try {
            const result = await this.storageManager.loadData();
            
            // Load shelves data or migrate from old format
            this.shelves = result.linkshelf_shelves || [];
            this.currentShelfId = result.linkshelf_current_shelf_id || null;
            
            // Migration logic: If no shelves exist but old data exists, create default shelf
            if (this.shelves.length === 0 && (result.linkshelf_categories || result.linkshelf_favourites)) {
                console.log('Migrating existing data to shelves format...');
                const defaultShelf = {
                    id: this.generateId(),
                    name: 'My Bookmarks',
                    categories: result.linkshelf_categories || [],
                    favourites: result.linkshelf_favourites || [],
                    columnCount: result.linkshelf_column_count || 5,
                    showFavourites: result.linkshelf_show_favourites !== false,
                    openLinksInNewTab: result.linkshelf_open_links_new_tab !== false,
                    createdAt: Date.now()
                };
                this.shelves = [defaultShelf];
                this.currentShelfId = defaultShelf.id;
                
                // Clear old storage keys after migration
                await this.storageManager.removeStorageKeys([
                    'linkshelf_categories',
                    'linkshelf_column_count', 
                    'linkshelf_favourites',
                    'linkshelf_show_favourites',
                    'linkshelf_open_links_new_tab'
                ]);
            }
            
            // If no shelves exist at all, create a default shelf
            if (this.shelves.length === 0) {
                const defaultShelf = {
                    id: this.generateId(),
                    name: 'My Bookmarks',
                    categories: [],
                    favourites: [],
                    columnCount: 5,
                    showFavourites: true,
                    openLinksInNewTab: true,
                    createdAt: Date.now()
                };
                this.shelves = [defaultShelf];
                this.currentShelfId = defaultShelf.id;
            }
            
            // Load current shelf data
            this.loadCurrentShelf();
            
            // Load global inbox (shared across all shelves)
            this.inbox = result.linkshelf_inbox || [];
            
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
            
                // Migration: Convert old bookmarks array to new structure with links and subcategories
                if (category.bookmarks && !category.links) {
                    // Move existing bookmarks to top-level links
                    category.links = category.bookmarks;
                    delete category.bookmarks;
                    needsSave = true;
                }
                
                // Initialize empty links array if it doesn't exist
                if (!category.links) {
                    category.links = [];
                    needsSave = true;
                }
                
                // Initialize empty subcategories array if it doesn't exist
                if (!category.subcategories) {
                    category.subcategories = [];
                    needsSave = true;
                }
                
                // Migration for links - add customFaviconUrl field if missing
                if (category.links) {
                    category.links.forEach(link => {
                        if (link.customFaviconUrl === undefined) {
                            link.customFaviconUrl = null;
                            needsSave = true;
                        }
                    });
                }
                
                // Migration for subcategories - ensure they have proper structure
                if (category.subcategories) {
                    category.subcategories.forEach(subcategory => {
                        // Ensure subcategory has required properties
                        if (!subcategory.id) {
                            subcategory.id = this.generateId();
                            needsSave = true;
                        }
                        if (subcategory.collapsed === undefined) {
                            subcategory.collapsed = false;
                            needsSave = true;
                        }
                        if (!subcategory.links) {
                            subcategory.links = [];
                            needsSave = true;
                        }
                        
                        // Migration for subcategory links - add customFaviconUrl field if missing
                        subcategory.links.forEach(link => {
                            if (link.customFaviconUrl === undefined) {
                                link.customFaviconUrl = null;
                                needsSave = true;
                            }
                        });
                    });
                }
        });
        
        // Migration for favourites - add customFaviconUrl field if missing
        this.favourites.forEach(favourite => {
            if (favourite.customFaviconUrl === undefined) {
                favourite.customFaviconUrl = null;
                needsSave = true;
            }
        });
        
        // Migration for inbox items - add customFaviconUrl field if missing
        this.inbox.forEach(inboxItem => {
            if (inboxItem.customFaviconUrl === undefined) {
                inboxItem.customFaviconUrl = null;
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

    // Set up listener for storage changes to auto-refresh inbox
    setupStorageListener() {
        this.storageManager.setupStorageListener((newInboxData) => {
            this.inbox = newInboxData;
            this.renderInbox();
            console.log('Inbox auto-refreshed with new data');
        });
    }

    // Load current shelf data into working variables
    loadCurrentShelf() {
        const currentShelf = this.getCurrentShelf();
        if (currentShelf) {
            this.categories = currentShelf.categories || [];
            this.favourites = currentShelf.favourites || [];
            this.columnCount = currentShelf.columnCount || 5;
            this.showFavourites = currentShelf.showFavourites !== false;
            this.openLinksInNewTab = currentShelf.openLinksInNewTab !== false;
        }
    }
    
    // Get current shelf object
    getCurrentShelf() {
        return this.shelves.find(shelf => shelf.id === this.currentShelfId) || this.shelves[0];
    }
    
    // Save current working data back to current shelf
    saveCurrentShelfData() {
        const currentShelf = this.getCurrentShelf();
        if (currentShelf) {
            currentShelf.categories = this.categories;
            currentShelf.favourites = this.favourites;
            currentShelf.columnCount = this.columnCount;
            currentShelf.showFavourites = this.showFavourites;
            currentShelf.openLinksInNewTab = this.openLinksInNewTab;
        }
    }

    async saveData() {
        try {
            // Save current working data to current shelf
            this.saveCurrentShelfData();
            
            // Save all shelves and global data
            await this.storageManager.saveData({ 
                'linkshelf_shelves': this.shelves,
                'linkshelf_current_shelf_id': this.currentShelfId,
                'linkshelf_inbox': this.inbox
            });
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    generateId() {
        return UIUtils.generateId();
    }

    // Visual Effects
    flashNewItem(selector, delay = 100) {
        UIUtils.flashNewItem(selector, delay);
    }

    flashNewItemByElement(element, delay = 100) {
        UIUtils.flashNewItemByElement(element, delay);
    }

    // Event Listeners
    setupEventListeners() {
        // Header buttons
        document.getElementById('create-category-btn').addEventListener('click', () => this.openCreateCategoryModal());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
        
        // Search functionality
        document.getElementById('global-search').addEventListener('input', (e) => this.handleSearchInput(e));
        document.getElementById('search-clear').addEventListener('click', () => this.clearSearch());
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));

        // Category modal
        document.getElementById('create-category-form').addEventListener('submit', (e) => this.handleCategoryFormSubmit(e));
        document.getElementById('cancel-category').addEventListener('click', () => this.closeModal('create-category-modal'));

        // Bookmark modal
        document.getElementById('bookmark-form').addEventListener('submit', (e) => this.handleSaveBookmark(e));
        document.getElementById('cancel-bookmark').addEventListener('click', () => this.closeModal('bookmark-modal'));
        document.getElementById('delete-bookmark').addEventListener('click', () => this.handleDeleteBookmarkFromModal());
        document.getElementById('bookmark-url').addEventListener('input', (e) => this.handleUrlInputDebounced(e));
        document.getElementById('bookmark-url').addEventListener('blur', (e) => this.handleUrlInputImmediate(e));
        document.getElementById('bookmark-favicon-url').addEventListener('input', (e) => this.handleFaviconUrlInput(e));
        document.getElementById('bookmark-favicon-url').addEventListener('blur', (e) => this.handleFaviconUrlInput(e));

        // Settings modal
        document.getElementById('export-bookmarks').addEventListener('click', () => this.exportBookmarks());
        document.getElementById('export-netscape').addEventListener('click', () => this.exportToNetscape());
        document.getElementById('import-bookmarks').addEventListener('click', () => this.triggerImport());
        document.getElementById('import-papaly').addEventListener('click', () => this.triggerPapalyImport());
        document.getElementById('import-file').addEventListener('change', (e) => this.importBookmarks(e));
        document.getElementById('column-count').addEventListener('change', (e) => this.handleColumnCountChange(e));
        document.getElementById('show-favourites').addEventListener('change', (e) => this.handleShowFavouritesChange(e));
        document.getElementById('open-links-new-tab').addEventListener('change', (e) => this.handleOpenLinksInNewTabChange(e));

        // Favourite modal
        document.getElementById('favourite-form').addEventListener('submit', (e) => this.handleSaveFavourite(e));
        document.getElementById('cancel-favourite').addEventListener('click', () => this.closeModal('favourite-modal'));
        document.getElementById('delete-favourite').addEventListener('click', () => this.handleDeleteFavouriteFromModal());
        document.getElementById('favourite-url').addEventListener('input', (e) => this.handleFavouriteUrlInputDebounced(e));
        document.getElementById('favourite-url').addEventListener('blur', (e) => this.handleFavouriteUrlInputImmediate(e));
        document.getElementById('favourite-favicon').addEventListener('input', (e) => this.handleFavouriteFaviconUrlInput(e));
        document.getElementById('favourite-favicon').addEventListener('blur', (e) => this.handleFavouriteFaviconUrlInput(e));

        // Shelf modal
        document.getElementById('shelf-form').addEventListener('submit', (e) => this.handleShelfFormSubmit(e));
        document.getElementById('cancel-shelf').addEventListener('click', () => this.closeModal('shelf-modal'));
        document.getElementById('delete-shelf').addEventListener('click', () => this.handleDeleteShelfFromModal());
        
        // Shelf tabs

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
                if (!e.target.closest('.category-actions') && !e.target.closest('.subcategory-actions')) {
                    this.closeCategoryDropdowns();
                    this.closeSubcategoryDropdowns();
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
        
        // Link drag and drop (includes both new link-item and legacy bookmark-item)
        document.querySelectorAll('.link-item, .bookmark-item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleLinkDragStart(e));
            item.addEventListener('dragend', (e) => this.handleLinkDragEnd(e));
        });

        // Link action buttons
        document.querySelectorAll('.link-edit-btn, .bookmark-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Use currentTarget to get the button element, not the clicked image inside
                const button = e.currentTarget;
                const categoryIndex = parseInt(button.dataset.categoryIndex);
                const linkIndex = parseInt(button.dataset.linkIndex || button.dataset.bookmarkIndex);
                const subcategoryIndex = button.dataset.subcategoryIndex ? parseInt(button.dataset.subcategoryIndex) : null;
                
                this.editLink(categoryIndex, linkIndex, subcategoryIndex);
            });
        });

        // Delete buttons removed from UI - delete functionality moved to edit modal

        // Favicon error handling for links
        document.querySelectorAll('.link-favicon, .bookmark-favicon').forEach(img => {
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
        
        // Render shelves tabs
        this.renderShelfSelector();
        
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
        this.dragDropManager.setupDragAndDrop();
        this.attachDynamicEventListeners();
    }

    // Shelves Management
    renderShelfSelector() {
        const currentShelfNameEl = document.getElementById('current-shelf-name');
        const dropdownEl = document.getElementById('shelf-selector-dropdown');
        
        if (!currentShelfNameEl || !dropdownEl) return;
        
        // Update current shelf name
        const currentShelf = this.getCurrentShelf();
        currentShelfNameEl.textContent = currentShelf ? currentShelf.name : 'Main';
        
        // Clear dropdown first
        dropdownEl.innerHTML = '';
        
        // Build dropdown options using DOM manipulation
        this.shelves.forEach((shelf, index) => {
            const isActive = shelf.id === this.currentShelfId;
            
            // Create main button
            const shelfOption = document.createElement('button');
            shelfOption.className = `dropdown-item shelf-option ${isActive ? 'active' : ''}`;
            shelfOption.dataset.shelfId = shelf.id;
            shelfOption.dataset.shelfIndex = index;
            
            // Create shelf name span
            const shelfName = document.createElement('span');
            shelfName.className = 'shelf-name';
            shelfName.textContent = shelf.name;
            
            // Create actions container
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'shelf-item-actions';
            
            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'shelf-action-btn edit-shelf-btn';
            editBtn.dataset.shelfIndex = index;
            editBtn.title = 'Rename';
            actionsDiv.appendChild(editBtn);
            
            // Add delete button if more than one shelf exists
            if (this.shelves.length > 1) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'shelf-action-btn delete-shelf-btn';
                deleteBtn.dataset.shelfIndex = index;
                deleteBtn.title = 'Delete';
                deleteBtn.innerHTML = '<img src="icons/app_icons/trash_white.png" alt="Delete" style="width: 12px; height: 12px;">';
                actionsDiv.appendChild(deleteBtn);
            }
            shelfOption.appendChild(shelfName);
            shelfOption.appendChild(actionsDiv);
            dropdownEl.appendChild(shelfOption);
        });
        
        // Add "Create New Shelf" option
        const addShelfBtn = document.createElement('button');
        addShelfBtn.className = 'dropdown-item add-shelf';
        addShelfBtn.textContent = '+ Create New Shelf';
        dropdownEl.appendChild(addShelfBtn);
        this.setupShelfSelectorEventListeners();
    }
    
    setupShelfSelectorEventListeners() {
        // Remove any existing shelf selector event listeners to prevent duplicates
        this.removeShelfSelectorEventListeners();
        
        // Shelf selector button click
        const selectorBtn = document.getElementById('shelf-selector-btn');
        if (selectorBtn) {
            this.boundToggleShelfSelector = this.boundToggleShelfSelector || ((e) => {
                e.stopPropagation();
                this.toggleShelfSelectorDropdown();
            });
            selectorBtn.addEventListener('click', this.boundToggleShelfSelector);
        }
        
        // Use event delegation for dropdown items to avoid adding/removing listeners repeatedly
        const dropdownEl = document.getElementById('shelf-selector-dropdown');
        if (dropdownEl) {
            this.boundHandleDropdownClick = this.boundHandleDropdownClick || ((e) => {
                const target = e.target;
                const option = target.closest('.shelf-option');
                const editBtn = target.closest('.edit-shelf-btn');
                const deleteBtn = target.closest('.delete-shelf-btn');
                const addBtn = target.closest('.add-shelf');
                
                if (editBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const shelfIndex = parseInt(editBtn.dataset.shelfIndex);
                    this.openEditShelfModal(shelfIndex);
                    this.closeShelfSelectorDropdown();
                } else if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const shelfIndex = parseInt(deleteBtn.dataset.shelfIndex);
                    this.deleteShelf(shelfIndex);
                    this.closeShelfSelectorDropdown();
                } else if (addBtn) {
                    e.stopPropagation();
                    this.openCreateShelfModal();
                    this.closeShelfSelectorDropdown();
                } else if (option && !target.closest('.shelf-item-actions')) {
                    // Switch shelf if clicking on the option but not on action buttons
                    const shelfId = option.dataset.shelfId;
                    this.switchToShelf(shelfId);
                    this.closeShelfSelectorDropdown();
                }
            });
            dropdownEl.addEventListener('click', this.boundHandleDropdownClick);
        }
        
        // Add global click handler only once
        if (!this.boundGlobalShelfClickHandler) {
            this.boundGlobalShelfClickHandler = (e) => {
                if (!e.target.closest('.shelf-selector')) {
                    this.closeShelfSelectorDropdown();
                }
            };
            document.addEventListener('click', this.boundGlobalShelfClickHandler);
        }
    }
    
    removeShelfSelectorEventListeners() {
        // Remove shelf selector button event listener
        const selectorBtn = document.getElementById('shelf-selector-btn');
        if (selectorBtn && this.boundToggleShelfSelector) {
            selectorBtn.removeEventListener('click', this.boundToggleShelfSelector);
        }
        
        // Remove dropdown event listener
        const dropdownEl = document.getElementById('shelf-selector-dropdown');
        if (dropdownEl && this.boundHandleDropdownClick) {
            dropdownEl.removeEventListener('click', this.boundHandleDropdownClick);
        }
    }
    
    toggleShelfSelectorDropdown() {
        const dropdown = document.getElementById('shelf-selector-dropdown');
        if (!dropdown) return;
        
        const isOpen = dropdown.classList.contains('show');
        if (isOpen) {
            this.closeShelfSelectorDropdown();
        } else {
            dropdown.classList.add('show');
        }
    }
    
    closeShelfSelectorDropdown() {
        const dropdown = document.getElementById('shelf-selector-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }
    
    async switchToShelf(shelfId) {
        if (shelfId === this.currentShelfId) return;
        
        // Save current shelf data before switching
        this.saveCurrentShelfData();
        
        // Switch to new shelf
        this.currentShelfId = shelfId;
        this.loadCurrentShelf();
        
        // Save the current shelf ID
        await this.saveData();
        
        // Re-render dashboard with new shelf data
        this.renderShelfSelector();
        this.renderDashboard();
        
        this.showToast(`Switched to "${this.getCurrentShelf().name}"`, 'success');
    }
    
    openCreateShelfModal() {
        this.shelfModalMode = 'create';
        this.editingShelfIndex = null;
        
        document.getElementById('shelf-modal-title').textContent = 'Create New Shelf';
        document.getElementById('shelf-name').value = '';
        document.getElementById('save-shelf').textContent = 'Create Shelf';
        document.getElementById('delete-shelf').classList.add('hidden');
        
        this.openModal('shelf-modal');
        document.getElementById('shelf-name').focus();
    }
    
    openEditShelfModal(shelfIndex) {
        this.shelfModalMode = 'edit';
        this.editingShelfIndex = shelfIndex;
        
        const shelf = this.shelves[shelfIndex];
        
        document.getElementById('shelf-modal-title').textContent = 'Rename Shelf';
        document.getElementById('shelf-name').value = shelf.name;
        document.getElementById('save-shelf').textContent = 'Update Shelf';
        document.getElementById('delete-shelf').classList.remove('hidden');
        
        this.openModal('shelf-modal');
        document.getElementById('shelf-name').focus();
        document.getElementById('shelf-name').select();
    }
    
    async handleShelfFormSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('shelf-name').value.trim();
        
        if (!name) {
            this.showToast('Shelf name is required', 'error');
            return;
        }
        
        if (this.shelfModalMode === 'create') {
            const newShelf = {
                id: this.generateId(),
                name: name,
                categories: [],
                favourites: [],
                columnCount: 5,
                showFavourites: true,
                openLinksInNewTab: true,
                createdAt: Date.now()
            };
            
            this.shelves.push(newShelf);
            
            // Switch to the newly created shelf automatically
            this.saveCurrentShelfData(); // Save current shelf data before switching
            this.currentShelfId = newShelf.id;
            this.loadCurrentShelf();
            
            await this.saveData();
            this.renderShelfSelector();
            this.renderDashboard();
            this.closeModal('shelf-modal');
            this.showToast(`Shelf "${name}" created and switched to successfully`, 'success');
        } else if (this.shelfModalMode === 'edit') {
            if (this.editingShelfIndex !== null) {
                this.shelves[this.editingShelfIndex].name = name;
                await this.saveData();
                this.renderShelfSelector();
                this.renderDashboard();
                this.closeModal('shelf-modal');
                this.showToast('Shelf renamed successfully', 'success');
            }
        }
    }
    
    deleteShelf(shelfIndex) {
        const shelf = this.shelves[shelfIndex];
        
        if (this.shelves.length <= 1) {
            this.showToast('Cannot delete the last shelf', 'error');
            return;
        }
        
        const categoryCount = shelf.categories.length;
        const favouriteCount = shelf.favourites.length;
        
        let message = `Are you sure you want to delete the shelf "${shelf.name}"?`;
        if (categoryCount > 0 || favouriteCount > 0) {
            message += `\n\nThis will permanently delete ${categoryCount} categories and ${favouriteCount} favourites.`;
        }
        
        this.showConfirmation(
            'Delete Shelf',
            message,
            async () => {
                // If deleting current shelf, switch to another shelf first
                if (shelf.id === this.currentShelfId) {
                    const remainingShelf = this.shelves.find(s => s.id !== shelf.id);
                    if (remainingShelf) {
                        this.currentShelfId = remainingShelf.id;
                        this.loadCurrentShelf();
                    }
                }
                
                this.shelves.splice(shelfIndex, 1);
                await this.saveData();
                this.renderShelfSelector();
                this.renderDashboard();
                this.showToast('Shelf deleted successfully', 'success');
            }
        );
    }
    
    handleDeleteShelfFromModal() {
        if (this.editingShelfIndex !== null) {
            this.deleteShelf(this.editingShelfIndex);
            this.closeModal('shelf-modal');
        }
    }

    // Show shelf options for moving categories
    showMoveToShelfOptions(categoryIndex, buttonElement) {
        const category = this.categories[categoryIndex];
        if (!category) return;
        
        // Close category dropdown first
        this.closeCategoryDropdowns();
        
        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'category-dropdown-menu show';
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = '99999';
        
        // Position dropdown relative to button
        const rect = buttonElement.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 5) + 'px';
        dropdown.style.left = rect.left + 'px';
        
        // Add shelf options (exclude current shelf)
        this.shelves.forEach((shelf, shelfIndex) => {
            if (shelf.id === this.currentShelfId) return; // Skip current shelf
            
            const option = document.createElement('button');
            option.className = 'dropdown-item';
            option.textContent = `Move to "${shelf.name}"`;
            option.addEventListener('click', () => {
                this.moveCategoryToShelf(categoryIndex, shelf.id);
                dropdown.remove();
            });
            dropdown.appendChild(option);
        });
        
        // Add close handler
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };
        
        document.body.appendChild(dropdown);
        setTimeout(() => document.addEventListener('click', closeDropdown), 100);
    }
    
    async moveCategoryToShelf(categoryIndex, targetShelfId) {
        const category = this.categories[categoryIndex];
        if (!category) return;
        
        const targetShelf = this.shelves.find(shelf => shelf.id === targetShelfId);
        if (!targetShelf) return;
        
        // Save current shelf data before making changes
        this.saveCurrentShelfData();
        
        // Remove category from current shelf
        this.categories.splice(categoryIndex, 1);
        
        // Add category to target shelf
        targetShelf.categories.push(category);
        
        // Save and re-render
        await this.saveData();
        this.renderDashboard();
        
        this.showToast(`Category "${category.name}" moved to "${targetShelf.name}"`, 'success');
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
        const isEmpty = columnCategories.length === 0;
        const emptyClass = isEmpty ? ' empty-column' : '';
        
        return `
            <div class="grid-column${emptyClass}" data-column-index="${columnIndex}">
                <div class="column-drop-zone" data-column-index="${columnIndex}" data-position="0">
                    Drop categories here
                </div>
                ${columnCategories.map(({ category, originalIndex }, index) => 
                    `${this.renderCategory(category, originalIndex)}
                     <div class="column-drop-zone" data-column-index="${columnIndex}" data-position="${category.position + 1}">
                        Drop categories here
                     </div>`
                ).join('')}
            </div>
        `;
    }

    renderCategory(category, categoryIndex) {
        let bodyContent = '';
        
        // Render top-level links first
        if (category.links && category.links.length > 0) {
            bodyContent += `
                <ul class="links-list" data-category-index="${categoryIndex}">
                    ${category.links.map((link, linkIndex) => 
                        this.renderLink(link, categoryIndex, linkIndex, 'category')
                    ).join('')}
                </ul>
            `;
        }
        
        // Render subcategories
        if (category.subcategories && category.subcategories.length > 0) {
            bodyContent += category.subcategories.map((subcategory, subcategoryIndex) => 
                this.renderSubcategory(subcategory, categoryIndex, subcategoryIndex)
            ).join('');
        }
        
        return `
            <div class="category-column" data-category-index="${categoryIndex}" draggable="true">
                <div class="category-header">
                    <h3 class="category-title">${this.escapeHtml(category.name)}</h3>
                    <button class="add-link-plus-btn" data-category-index="${categoryIndex}" title="Add Link to Category">
                        +
                    </button>
                    <div class="category-actions">
                        <button class="category-menu-btn" data-category-index="${categoryIndex}" title="Category Actions">
                            ⋯
                        </button>
                        <div class="category-dropdown-menu" data-category-index="${categoryIndex}">
                            <button class="dropdown-item category-edit-btn" data-category-index="${categoryIndex}">Edit Category</button>
                            <button class="dropdown-item add-subcategory-btn" data-category-index="${categoryIndex}">Add Subcategory</button>
                            ${this.shelves.length > 1 ? `<button class="dropdown-item category-move-to-shelf-btn" data-category-index="${categoryIndex}">Move to Shelf</button>` : ''}
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

    renderLink(link, categoryIndex, linkIndex, containerType, subcategoryIndex = null) {
        // Use faviconData if available, otherwise try customFaviconUrl, finally fall back to default
        let faviconSrc = link.faviconData;
        if (!faviconSrc && link.customFaviconUrl) {
            faviconSrc = link.customFaviconUrl;
        }
        if (!faviconSrc) {
            faviconSrc = this.getFallbackIcon();
        }
        
        const fallbackIcon = this.getFallbackIcon();
        
        // Create data attributes based on container type
        let dataAttributes = '';
        if (containerType === 'category') {
            dataAttributes = `data-category-index="${categoryIndex}" data-link-index="${linkIndex}"`;
        } else if (containerType === 'subcategory') {
            dataAttributes = `data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}" data-link-index="${linkIndex}"`;
        }
        
        return `
            <li class="link-item" ${dataAttributes} draggable="true">
                <a href="${this.escapeHtml(link.url)}" ${this.openLinksInNewTab ? 'target="_blank"' : ''} class="link-link">
                    <img class="link-favicon" src="${faviconSrc}" alt="Favicon" data-fallback="${fallbackIcon}">
                    <span class="link-title">${this.escapeHtml(link.name)}</span>
                </a>
                <div class="link-actions">
                    <button class="link-action-btn link-edit-btn" ${dataAttributes} title="Edit Link">
                        <img src="icons/app_icons/pencil_white.png" alt="Edit" style="width: 16px; height: 16px;">
                    </button>
                </div>
            </li>
        `;
    }

    renderSubcategory(subcategory, categoryIndex, subcategoryIndex) {
        const isCollapsed = subcategory.collapsed || false;
        const caretIcon = isCollapsed ? '<img src="icons/app_icons/down-white.png" alt="Expand" class="caret-icon caret-right">' : '<img src="icons/app_icons/down-white.png" alt="Collapse" class="caret-icon">';
        
        let subcategoryContent = '';
        if (!isCollapsed) {
            // Always render the subcategory-links-list, even if empty (for drag/drop target)
            const linkItems = (subcategory.links && subcategory.links.length > 0) ?
                subcategory.links.map((link, linkIndex) => 
                    this.renderLink(link, categoryIndex, linkIndex, 'subcategory', subcategoryIndex)
                ).join('') : '';
                
            // CRITICAL: No whitespace between tags for truly empty lists
            if (linkItems) {
                subcategoryContent = `<ul class="subcategory-links-list" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}">
                    ${linkItems}
                </ul>`;
            } else {
                // Truly empty - no whitespace at all
                subcategoryContent = `<ul class="subcategory-links-list" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}"></ul>`;
            }
        }
        
        return `
            <div class="subcategory" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}" draggable="true">
                <div class="subcategory-header">
                    <button class="subcategory-toggle-btn" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}" title="Toggle Subcategory">
                        <span class="subcategory-caret">${caretIcon}</span>
                    </button>
                    <h4 class="subcategory-title">${this.escapeHtml(subcategory.name)}</h4>
                    <button class="add-subcategory-link-btn" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}" title="Add Link to Subcategory">
                        +
                    </button>
                    <div class="subcategory-actions">
                        <button class="subcategory-menu-btn" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}" title="Subcategory Actions">
                            ⋯
                        </button>
                        <div class="subcategory-dropdown-menu" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}">
                            <button class="dropdown-item subcategory-edit-btn" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}">Edit Subcategory</button>
                            <button class="dropdown-item subcategory-delete-btn" data-category-index="${categoryIndex}" data-subcategory-index="${subcategoryIndex}">Delete Subcategory</button>
                        </div>
                    </div>
                </div>
                <div class="subcategory-body ${isCollapsed ? 'collapsed' : ''}">
                    ${subcategoryContent}
                </div>
            </div>
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
            this.showToast('Name is required', 'error');
            return;
        }

        if (this.categoryModalMode === 'create') {
            // Find first available slot in grid
            const slot = this.findFirstAvailableSlot();
            
            const newCategory = {
                id: this.generateId(),
                name: name,
                links: [],
                subcategories: [],
                column: slot.column,
                position: slot.position
            };

            this.categories.unshift(newCategory);
            await this.saveData();
            this.renderDashboard();
            this.closeModal('create-category-modal');
            this.showToast('Category created successfully', 'success');
            
            // Flash the new category (it will be at index 0 since we used unshift)
            this.flashNewItem(`[data-category-index="0"]`);
        } else if (this.categoryModalMode === 'edit') {
            // Update existing category
            if (this.editingCategoryIndex !== null) {
                this.categories[this.editingCategoryIndex].name = name;
                await this.saveData();
                this.renderDashboard();
                this.closeModal('create-category-modal');
                this.showToast('Category updated successfully', 'success');
            }
        } else if (this.categoryModalMode === 'create-subcategory') {
            // Create new subcategory
            if (this.currentEditingCategory !== null) {
                await this.createSubcategory(this.currentEditingCategory, name);
                this.closeModal('create-category-modal');
            }
        } else if (this.categoryModalMode === 'edit-subcategory') {
            // Update existing subcategory
            if (this.currentEditingCategory !== null && this.currentEditingSubcategory !== null) {
                await this.editSubcategory(this.currentEditingCategory, this.currentEditingSubcategory, name);
                this.closeModal('create-category-modal');
            }
        }
    }

    editCategory(categoryIndex) {
        this.openEditCategoryModal(categoryIndex);
    }

    deleteCategory(categoryIndex) {
        const category = this.categories[categoryIndex];
        const linkCount = category.links ? category.links.length : 0;
        
        // Count links in subcategories
        let subcategoryLinkCount = 0;
        if (category.subcategories) {
            category.subcategories.forEach(subcategory => {
                subcategoryLinkCount += subcategory.links ? subcategory.links.length : 0;
            });
        }
        
        const totalLinkCount = linkCount + subcategoryLinkCount;
        const subcategoryCount = category.subcategories ? category.subcategories.length : 0;
        
        let message = `Are you sure you want to delete the category "${category.name}"?`;
        if (subcategoryCount > 0) {
            message += `\n\nThis will also delete ${subcategoryCount} ${subcategoryCount > 1 ? 'subcategories' : 'subcategory'}`;
        }
        if (totalLinkCount > 0) {
            message += subcategoryCount > 0 ? ' and ' : '\n\nThis will also delete ';
            message += `${totalLinkCount} link${totalLinkCount > 1 ? 's' : ''}.`;
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

    // Subcategory Management
    openAddSubcategoryModal(categoryIndex) {
        this.currentEditingCategory = categoryIndex;
        this.currentEditingSubcategory = null;
        
        document.getElementById('create-category-modal-title').textContent = 'Add Subcategory';
        document.getElementById('category-name').value = '';
        document.getElementById('save-category').textContent = 'Add Subcategory';
        
        this.categoryModalMode = 'create-subcategory';
        this.openModal('create-category-modal');
        document.getElementById('category-name').focus();
    }

    openEditSubcategoryModal(categoryIndex, subcategoryIndex) {
        this.currentEditingCategory = categoryIndex;
        this.currentEditingSubcategory = subcategoryIndex;
        
        const subcategory = this.categories[categoryIndex].subcategories[subcategoryIndex];
        
        document.getElementById('create-category-modal-title').textContent = 'Edit Subcategory';
        document.getElementById('category-name').value = subcategory.name;
        document.getElementById('save-category').textContent = 'Update Subcategory';
        
        this.categoryModalMode = 'edit-subcategory';
        this.openModal('create-category-modal');
        document.getElementById('category-name').focus();
        document.getElementById('category-name').select();
    }

    async createSubcategory(categoryIndex, name) {
        const newSubcategory = {
            id: this.generateId(),
            name: name,
            links: [],
            collapsed: false
        };

        this.categories[categoryIndex].subcategories.unshift(newSubcategory);
        await this.saveData();
        this.renderDashboard();
        this.showToast('Subcategory created successfully', 'success');
        
        // Flash the new subcategory (it will be at index 0 since we used unshift)
        this.flashNewItem(`[data-category-index="${categoryIndex}"] [data-subcategory-index="0"]`);
    }

    async editSubcategory(categoryIndex, subcategoryIndex, newName) {
        this.categories[categoryIndex].subcategories[subcategoryIndex].name = newName;
        await this.saveData();
        this.renderDashboard();
        this.showToast('Subcategory updated successfully', 'success');
    }

    deleteSubcategory(categoryIndex, subcategoryIndex) {
        const subcategory = this.categories[categoryIndex].subcategories[subcategoryIndex];
        const linkCount = subcategory.links.length;
        
        let message = `Are you sure you want to delete the subcategory "${subcategory.name}"?`;
        if (linkCount > 0) {
            message += `\n\nThis will also delete ${linkCount} link${linkCount > 1 ? 's' : ''}.`;
        }

        this.showConfirmation(
            'Delete Subcategory',
            message,
            () => {
                this.categories[categoryIndex].subcategories.splice(subcategoryIndex, 1);
                this.saveData();
                this.renderDashboard();
                this.showToast('Subcategory deleted successfully', 'success');
            }
        );
    }

    async toggleSubcategoryCollapsed(categoryIndex, subcategoryIndex) {
        // Validate categoryIndex
        if (categoryIndex < 0 || categoryIndex >= this.categories.length) {
            console.error('Invalid categoryIndex:', categoryIndex);
            return;
        }
        
        const category = this.categories[categoryIndex];
        
        // Validate category has subcategories
        if (!category.subcategories || !Array.isArray(category.subcategories)) {
            console.error('Category does not have subcategories array:', category);
            return;
        }
        
        // Validate subcategoryIndex
        if (subcategoryIndex < 0 || subcategoryIndex >= category.subcategories.length) {
            console.error('Invalid subcategoryIndex:', subcategoryIndex, 'for category with', category.subcategories.length, 'subcategories');
            return;
        }
        
        const subcategory = category.subcategories[subcategoryIndex];
        subcategory.collapsed = !subcategory.collapsed;
        await this.saveData();
        this.renderDashboard();
    }

    // Link Management
    openAddLinkModal(categoryIndex, subcategoryIndex = null) {
        this.currentEditingBookmark = null;
        this.currentEditingCategory = categoryIndex;
        this.currentEditingSubcategory = subcategoryIndex;
        
        const isSubcategory = subcategoryIndex !== null;
        const modalTitle = isSubcategory ? 'Add New Link to Subcategory' : 'Add New Link to Category';
        
        document.getElementById('bookmark-modal-title').textContent = modalTitle;
        document.getElementById('bookmark-url').value = '';
        document.getElementById('bookmark-name').value = '';
        document.getElementById('bookmark-favicon-url').value = '';
        document.getElementById('save-bookmark').textContent = 'Save Link';
        document.getElementById('delete-bookmark').classList.add('hidden'); // Hide delete button for new items
        this.hideBookmarkPreview();
        
        this.openModal('bookmark-modal');
        document.getElementById('bookmark-url').focus();
    }

    // Backward compatibility
    openAddBookmarkModal(categoryIndex) {
        this.openAddLinkModal(categoryIndex);
    }

    editLink(categoryIndex, linkIndex, subcategoryIndex = null) {
        let link;
        
        // Defensive checks for data integrity
        if (!this.categories[categoryIndex]) {
            console.error('Category not found:', categoryIndex);
            return;
        }
        
        if (subcategoryIndex !== null) {
            const subcategory = this.categories[categoryIndex].subcategories?.[subcategoryIndex];
            if (!subcategory || !subcategory.links) {
                console.error('Subcategory or links not found:', categoryIndex, subcategoryIndex);
                return;
            }
            link = subcategory.links[linkIndex];
        } else {
            // Handle backward compatibility - categories use 'bookmarks' not 'links'
            const linksArray = this.categories[categoryIndex].links || this.categories[categoryIndex].bookmarks;
            if (!linksArray) {
                console.error('No links or bookmarks array found in category:', categoryIndex);
                return;
            }
            link = linksArray[linkIndex];
        }
        
        if (!link) {
            console.error('Link not found at index:', linkIndex);
            return;
        }
        
        this.currentEditingBookmark = linkIndex;
        this.currentEditingCategory = categoryIndex;
        this.currentEditingSubcategory = subcategoryIndex;
        
        const isSubcategory = subcategoryIndex !== null;
        const modalTitle = isSubcategory ? 'Edit Subcategory Link' : 'Edit Category Link';
        
        document.getElementById('bookmark-modal-title').textContent = modalTitle;
        document.getElementById('bookmark-url').value = link.url;
        document.getElementById('bookmark-name').value = link.name;
        document.getElementById('bookmark-favicon-url').value = link.customFaviconUrl || '';
        document.getElementById('save-bookmark').textContent = 'Update Link';
        document.getElementById('delete-bookmark').classList.remove('hidden'); // Show delete button for editing
        
        // Show preview with cached favicon
        const preview = document.querySelector('.bookmark-preview');
        const favicon = document.getElementById('bookmark-favicon');
        const titlePreview = document.getElementById('bookmark-title-preview');
        
        // Use faviconData if available, otherwise try customFaviconUrl, finally fall back to default
        let faviconSrc = link.faviconData;
        if (!faviconSrc && link.customFaviconUrl) {
            faviconSrc = link.customFaviconUrl;
        }
        if (!faviconSrc) {
            faviconSrc = this.getFallbackIcon();
        }
        
        favicon.src = faviconSrc;
        titlePreview.textContent = link.name;
        preview.classList.add('visible');
        
        this.openModal('bookmark-modal');
    }

    // Backward compatibility
    editBookmark(categoryIndex, bookmarkIndex) {
        this.editLink(categoryIndex, bookmarkIndex);
    }

    async handleSaveBookmark(e) {
        e.preventDefault();
        
        const rawUrl = document.getElementById('bookmark-url').value.trim();
        const name = document.getElementById('bookmark-name').value.trim();
        const rawFaviconUrl = document.getElementById('bookmark-favicon-url').value.trim();
        
        // Normalize URL first
        const normalizedUrl = this.normalizeUrl(rawUrl);
        
        if (!normalizedUrl) {
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
            
            let faviconData = null;
            
            // Use custom favicon if provided, otherwise try to fetch from domain
            if (rawFaviconUrl) {
                try {
                    const normalizedFaviconUrl = this.normalizeUrl(rawFaviconUrl);
                    faviconData = await this.fetchFaviconAsDataUrl(normalizedFaviconUrl);
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
                faviconData: faviconData,
                customFaviconUrl: rawFaviconUrl ? this.normalizeUrl(rawFaviconUrl) : null
            };
            
            if (this.currentEditingBookmark !== null) {
                if (this.currentEditingCategory === 'inbox') {
                    // Update existing inbox item
                    this.inbox[this.currentEditingBookmark] = bookmarkData;
                    this.showToast('Inbox item updated successfully', 'success');
                } else if (this.currentEditingSubcategory !== null) {
                    // Update existing subcategory link
                    this.categories[this.currentEditingCategory].subcategories[this.currentEditingSubcategory].links[this.currentEditingBookmark] = bookmarkData;
                    this.showToast('Link updated successfully', 'success');
                } else {
                    // Update existing category link (backward compatibility)
                    const linksArray = this.categories[this.currentEditingCategory].links || this.categories[this.currentEditingCategory].bookmarks;
                    linksArray[this.currentEditingBookmark] = bookmarkData;
                    this.showToast('Link updated successfully', 'success');
                }
            } else {
                if (this.currentEditingSubcategory !== null) {
                    // Add new subcategory link to top
                    this.categories[this.currentEditingCategory].subcategories[this.currentEditingSubcategory].links.unshift(bookmarkData);
                    this.showToast('Link added to subcategory successfully', 'success');
                } else {
                    // Add new category link to top (backward compatibility)
                    const linksArray = this.categories[this.currentEditingCategory].links || this.categories[this.currentEditingCategory].bookmarks;
                    linksArray.unshift(bookmarkData);
                    this.showToast('Link added to category successfully', 'success');
                }
            }

            await this.saveData();
            this.renderDashboard();
            this.closeModal('bookmark-modal');
            
            // Flash the new link if it was just created
            if (!this.currentEditingBookmark) {
                // Find and flash the new link (first link in the target location)
                if (this.currentEditingSubcategory !== null) {
                    // New subcategory link
                    this.flashNewItem(`[data-category-index="${this.currentEditingCategory}"] [data-subcategory-index="${this.currentEditingSubcategory}"] .link-item:first-child`);
                } else {
                    // New category link  
                    this.flashNewItem(`[data-category-index="${this.currentEditingCategory}"] .links-list .link-item:first-child`);
                }
            }
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

    deleteLink(categoryIndex, linkIndex, subcategoryIndex = null) {
        let link, linksArray;
        
        // Defensive checks for data integrity
        if (!this.categories[categoryIndex]) {
            console.error('Category not found:', categoryIndex);
            return;
        }
        
        if (subcategoryIndex !== null) {
            const subcategory = this.categories[categoryIndex].subcategories?.[subcategoryIndex];
            if (!subcategory || !subcategory.links) {
                console.error('Subcategory or links not found:', categoryIndex, subcategoryIndex);
                return;
            }
            linksArray = subcategory.links;
            link = linksArray[linkIndex];
        } else {
            // Handle backward compatibility - categories use 'bookmarks' not 'links'
            linksArray = this.categories[categoryIndex].links || this.categories[categoryIndex].bookmarks;
            if (!linksArray) {
                console.error('No links or bookmarks array found in category:', categoryIndex);
                return;
            }
            link = linksArray[linkIndex];
        }
        
        if (!link) {
            console.error('Link not found at index:', linkIndex);
            return;
        }
        
        const isSubcategory = subcategoryIndex !== null;
        const confirmTitle = isSubcategory ? 'Delete Subcategory Link' : 'Delete Category Link';
        
        this.showConfirmation(
            confirmTitle,
            `Are you sure you want to delete "${link.name}"?`,
            () => {
                linksArray.splice(linkIndex, 1);
                this.saveData();
                this.renderDashboard();
                this.showToast('Link deleted successfully', 'success');
            }
        );
    }

    // Backward compatibility
    deleteBookmark(categoryIndex, bookmarkIndex) {
        this.deleteLink(categoryIndex, bookmarkIndex);
    }

    handleDeleteBookmarkFromModal() {
        if (this.currentEditingBookmark !== null && this.currentEditingCategory !== null) {
            const categoryIndex = this.currentEditingCategory;
            const linkIndex = this.currentEditingBookmark;
            const subcategoryIndex = this.currentEditingSubcategory;
            
            let link, linksArray;
            if (subcategoryIndex !== null) {
                linksArray = this.categories[categoryIndex].subcategories[subcategoryIndex].links;
                link = linksArray[linkIndex];
            } else {
                // Handle backward compatibility - categories use 'bookmarks' not 'links'
                linksArray = this.categories[categoryIndex].links || this.categories[categoryIndex].bookmarks;
                link = linksArray[linkIndex];
            }
            
            const isSubcategory = subcategoryIndex !== null;
            const confirmTitle = isSubcategory ? 'Delete Subcategory Link' : 'Delete Category Link';
            
            this.showConfirmation(
                confirmTitle,
                `Are you sure you want to delete "${link.name}"?`,
                () => {
                    linksArray.splice(linkIndex, 1);
                    this.saveData();
                    this.renderDashboard();
                    this.closeModal('bookmark-modal');
                    this.showToast('Link deleted successfully', 'success');
                }
            );
        }
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

    async moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex) {
        // Get the link being moved from source location
        let link, sourceLinksArray;
        if (sourceSubcategoryIndex !== null) {
            sourceLinksArray = this.categories[sourceCategoryIndex].subcategories[sourceSubcategoryIndex].links;
            link = sourceLinksArray[sourceLinkIndex];
        } else {
            // Handle backward compatibility - categories use 'bookmarks' not 'links'
            sourceLinksArray = this.categories[sourceCategoryIndex].links || this.categories[sourceCategoryIndex].bookmarks;
            link = sourceLinksArray[sourceLinkIndex];
        }
        
        if (!link) {
            console.error('Link not found at source position');
            return;
        }
        
        // Remove link from source location
        sourceLinksArray.splice(sourceLinkIndex, 1);
        
        // Get target links array
        let targetLinksArray;
        if (targetSubcategoryIndex !== null) {
            targetLinksArray = this.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].links;
        } else {
            // Handle backward compatibility - categories use 'bookmarks' not 'links'
            targetLinksArray = this.categories[targetCategoryIndex].links || this.categories[targetCategoryIndex].bookmarks;
        }
        
        // Handle position adjustment for same list moves
        let insertPosition = targetPosition;
        if (targetPosition === -1) {
            insertPosition = targetLinksArray.length; // Append to end
        } else if (sourceCategoryIndex === targetCategoryIndex && 
                   sourceSubcategoryIndex === targetSubcategoryIndex && 
                   sourceLinkIndex < targetPosition) {
            insertPosition = targetPosition - 1; // Adjust for same list
        }
        
        // Insert link at target position
        targetLinksArray.splice(insertPosition, 0, link);
        
        await this.saveData();
        this.renderDashboard();
        
        // Show appropriate toast message
        if (sourceCategoryIndex === targetCategoryIndex && sourceSubcategoryIndex === targetSubcategoryIndex) {
            this.showToast('Link reordered successfully', 'success');
        } else {
            const targetName = targetSubcategoryIndex !== null ? 
                `subcategory "${this.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].name}"` :
                `category "${this.categories[targetCategoryIndex].name}"`;
            this.showToast(`Link moved to ${targetName}`, 'success');
        }
    }

    async moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex) {
        const inboxItem = this.inbox[inboxIndex];
        if (!inboxItem) {
            console.error('Inbox item not found at index', inboxIndex);
            return;
        }

        // Create link data from inbox item
        const linkData = {
            id: inboxItem.id,
            name: inboxItem.name,
            url: inboxItem.url,
            faviconData: inboxItem.faviconData,
            customFaviconUrl: inboxItem.customFaviconUrl
        };

        // Get target links array
        let targetLinksArray;
        if (targetSubcategoryIndex !== null) {
            targetLinksArray = this.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].links;
        } else {
            // Handle backward compatibility - categories use 'bookmarks' not 'links'
            targetLinksArray = this.categories[targetCategoryIndex].links || this.categories[targetCategoryIndex].bookmarks;
        }

        // Handle position
        const insertPosition = targetPosition === -1 ? targetLinksArray.length : targetPosition;

        // Insert at specific position in target location
        targetLinksArray.splice(insertPosition, 0, linkData);

        // Remove from inbox
        this.inbox.splice(inboxIndex, 1);

        await this.saveData();
        this.renderDashboard();
        
        const targetName = targetSubcategoryIndex !== null ? 
            `subcategory "${this.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].name}"` :
            `category "${this.categories[targetCategoryIndex].name}"`;
        this.showToast(`Moved "${inboxItem.name}" to ${targetName}`, 'success');
    }

    async moveSubcategoryToPosition(sourceCategoryIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition) {
        // Get the subcategory being moved
        const subcategory = this.categories[sourceCategoryIndex].subcategories[sourceSubcategoryIndex];
        if (!subcategory) {
            console.error('Subcategory not found at source position');
            return;
        }

        // Remove subcategory from source category
        this.categories[sourceCategoryIndex].subcategories.splice(sourceSubcategoryIndex, 1);

        // Adjust target position if moving within same category
        let insertPosition = targetPosition;
        if (sourceCategoryIndex === targetCategoryIndex && sourceSubcategoryIndex < targetPosition) {
            insertPosition = targetPosition - 1;
        }

        // Insert subcategory at target position
        this.categories[targetCategoryIndex].subcategories.splice(insertPosition, 0, subcategory);

        await this.saveData();
        this.renderDashboard();

        // Show appropriate toast message
        if (sourceCategoryIndex === targetCategoryIndex) {
            this.showToast('Subcategory reordered successfully', 'success');
        } else {
            this.showToast(`Subcategory moved to "${this.categories[targetCategoryIndex].name}"`, 'success');
        }
    }

    // Sidebar State Management
    loadSidebarState() {
        return this.storageManager.loadSidebarState();
    }

    saveSidebarState() {
        this.storageManager.saveSidebarState(this.sidebarOpen);
    }

    initializeSidebar() {
        const sidebar = document.getElementById('inbox-sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        
        // Disable transitions during initial setup
        document.body.classList.add('no-transitions');
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
            document.body.classList.add('sidebar-open');
        } else {
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        }
        
        // Re-enable transitions after a brief delay
        setTimeout(() => {
            document.body.classList.remove('no-transitions');
        }, 50);
    }

    // Inbox Management
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('inbox-sidebar');
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
            document.body.classList.add('sidebar-open');
        } else {
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        }
        
        // Save the state
        this.storageManager.saveSidebarState(this.sidebarOpen);
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
        this.dragDropManager.setupInboxDragDrop();
    }

    renderInboxItem(item, index) {
        // Use faviconData if available, otherwise try customFaviconUrl, finally fall back to default
        let faviconSrc = item.faviconData;
        if (!faviconSrc && item.customFaviconUrl) {
            faviconSrc = item.customFaviconUrl;
        }
        if (!faviconSrc) {
            faviconSrc = this.getFallbackIcon();
        }
        
        const fallbackIcon = this.getFallbackIcon();
        
        // Add timestamp display if available
        const timeDisplay = item.addedAt ? 
            `<div class="inbox-timestamp" title="Added ${new Date(item.addedAt).toLocaleString()}">
                ${this.getRelativeTime(item.addedAt)}
            </div>` : '';
        
        return `
            <div class="inbox-item" data-inbox-index="${index}" draggable="true">
                <div class="inbox-item-content">
                    <div class="inbox-main-row">
                        <a href="${this.escapeHtml(item.url)}" ${this.openLinksInNewTab ? 'target="_blank"' : ''} class="inbox-link">
                            <img class="inbox-favicon" src="${faviconSrc}" alt="Favicon" data-fallback="${fallbackIcon}">
                            <span class="inbox-title">${this.escapeHtml(item.name)}</span>
                        </a>
                        <div class="inbox-main-actions">
                            <button class="inbox-action-btn inbox-edit-btn" data-inbox-index="${index}" title="Edit Inbox Item">
                                <img src="icons/app_icons/pencil_white.png" alt="Edit" style="width: 16px; height: 16px;">
                            </button>
                            <button class="inbox-action-btn inbox-delete-btn" data-inbox-index="${index}" title="Delete Inbox Item">
                                <img src="icons/app_icons/trash_white.png" alt="Delete" style="width: 16px; height: 16px;">
                            </button>
                        </div>
                    </div>
                    <div class="inbox-item-meta">
                        ${timeDisplay}
                        ${this.categories.length > 0 ? `
                        <button class="inbox-action-btn inbox-send-to-btn" data-inbox-index="${index}" title="Send to category">
                            →
                        </button>
                        ` : ''}
                    </div>
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
                // Use currentTarget to get the button element, not the clicked image inside
                const button = e.currentTarget;
                const inboxIndex = parseInt(button.dataset.inboxIndex);
                this.editInboxItem(inboxIndex);
            });
        });

        // Delete buttons
        document.querySelectorAll('.inbox-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Use currentTarget to get the button element, not the clicked image inside
                const button = e.currentTarget;
                const inboxIndex = parseInt(button.dataset.inboxIndex);
                this.deleteInboxItem(inboxIndex);
            });
        });

        // Send to category button
        document.querySelectorAll('.inbox-send-to-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const inboxIndex = parseInt(btn.dataset.inboxIndex);
                this.showCategorizeOptions(inboxIndex, btn);
            });
        });

        // Drag and drop is handled by dragDropManager.setupInboxDragDrop()

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
            faviconData: faviconData,
            customFaviconUrl: null
        };
        
        this.inbox.unshift(inboxItem);
        await this.saveData();
        this.renderInbox();
        this.showToast('Added to inbox', 'success');
    }

    editInboxItem(inboxIndex) {
        const item = this.inbox[inboxIndex];
        
        if (!item) {
            console.error('Inbox item not found at index:', inboxIndex);
            return;
        }
        
        this.currentEditingBookmark = inboxIndex;
        this.currentEditingCategory = 'inbox';
        
        document.getElementById('bookmark-modal-title').textContent = 'Edit Inbox Item';
        document.getElementById('bookmark-url').value = item.url || '';
        document.getElementById('bookmark-name').value = item.name || '';
        document.getElementById('bookmark-favicon-url').value = item.customFaviconUrl || '';
        document.getElementById('save-bookmark').textContent = 'Update Item';
        
        // Show preview with cached favicon
        const preview = document.querySelector('.bookmark-preview');
        const favicon = document.getElementById('bookmark-favicon');
        const titlePreview = document.getElementById('bookmark-title-preview');
        
        // Use faviconData if available, otherwise try customFaviconUrl, finally fall back to default
        let faviconSrc = item.faviconData;
        if (!faviconSrc && item.customFaviconUrl) {
            faviconSrc = item.customFaviconUrl;
        }
        if (!faviconSrc) {
            faviconSrc = this.getFallbackIcon();
        }
        
        favicon.src = faviconSrc;
        titlePreview.textContent = item.name;
        preview.classList.add('visible');
        
        this.openModal('bookmark-modal');
    }

    deleteInboxItem(inboxIndex) {
        const item = this.inbox[inboxIndex];
        
        if (!item) {
            console.error('Inbox item not found at index:', inboxIndex);
            return;
        }
        
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

    // Quick categorize inbox item
    quickCategorizeInboxItem(inboxIndex, categoryIndex) {
        const item = this.inbox[inboxIndex];
        if (!item || !this.categories[categoryIndex]) {
            console.error('Invalid inbox item or category');
            return;
        }

        // Create link object
        const link = {
            id: item.id,
            name: item.name,
            url: item.url,
            faviconData: item.faviconData,
            customFaviconUrl: item.customFaviconUrl
        };

        // Add to category
        if (!this.categories[categoryIndex].links) {
            this.categories[categoryIndex].links = [];
        }
        this.categories[categoryIndex].links.push(link);

        // Remove from inbox
        this.inbox.splice(inboxIndex, 1);

        // Save and re-render
        this.saveData();
        this.renderDashboard();
        this.showToast(`Added to "${this.categories[categoryIndex].name}"`, 'success');
    }

    // Show categorize options in a dropdown
    showCategorizeOptions(inboxIndex, buttonElement) {
        const item = this.inbox[inboxIndex];
        if (!item) return;

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'category-dropdown-menu show';
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = '99999';

        // Position dropdown relative to button
        const rect = buttonElement.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 5) + 'px';
        dropdown.style.left = rect.left + 'px';

        // Add category options
        this.categories.forEach((category, categoryIndex) => {
            const option = document.createElement('button');
            option.className = 'dropdown-item';
            option.textContent = category.name;
            option.addEventListener('click', () => {
                this.quickCategorizeInboxItem(inboxIndex, categoryIndex);
                dropdown.remove();
            });
            dropdown.appendChild(option);

            // Add subcategories if they exist
            if (category.subcategories) {
                category.subcategories.forEach((subcategory, subIndex) => {
                    const subOption = document.createElement('button');
                    subOption.className = 'dropdown-item';
                    subOption.style.paddingLeft = '24px';
                    subOption.textContent = `↳ ${subcategory.name}`;
                    subOption.addEventListener('click', () => {
                        this.quickCategorizeToSubcategory(inboxIndex, categoryIndex, subIndex);
                        dropdown.remove();
                    });
                    dropdown.appendChild(subOption);
                });
            }
        });

        // Add close handler
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };

        document.body.appendChild(dropdown);
        setTimeout(() => document.addEventListener('click', closeDropdown), 100);
    }

    // Quick categorize to subcategory
    quickCategorizeToSubcategory(inboxIndex, categoryIndex, subcategoryIndex) {
        const item = this.inbox[inboxIndex];
        if (!item || !this.categories[categoryIndex]?.subcategories?.[subcategoryIndex]) {
            console.error('Invalid inbox item, category, or subcategory');
            return;
        }

        // Create link object
        const link = {
            id: item.id,
            name: item.name,
            url: item.url,
            faviconData: item.faviconData,
            customFaviconUrl: item.customFaviconUrl
        };

        // Add to subcategory
        if (!this.categories[categoryIndex].subcategories[subcategoryIndex].links) {
            this.categories[categoryIndex].subcategories[subcategoryIndex].links = [];
        }
        this.categories[categoryIndex].subcategories[subcategoryIndex].links.push(link);

        // Remove from inbox
        this.inbox.splice(inboxIndex, 1);

        // Save and re-render
        this.saveData();
        this.renderDashboard();
        this.showToast(`Added to "${this.categories[categoryIndex].name} → ${this.categories[categoryIndex].subcategories[subcategoryIndex].name}"`, 'success');
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

    async moveBookmarkToInbox(categoryIndex, linkIndex) {
        const link = this.categories[categoryIndex].links?.[linkIndex] || this.categories[categoryIndex].bookmarks?.[linkIndex];
        if (!link) {
            console.error('Link not found at position');
            return;
        }

        // Check if item already exists in inbox
        const exists = this.inbox.some(item => item.url === link.url);
        if (exists) {
            this.showToast('Link already in inbox', 'info');
            return;
        }

        // Create inbox item from link
        const inboxItem = {
            id: link.id,
            name: link.name,
            url: link.url,
            faviconData: link.faviconData,
            customFaviconUrl: link.customFaviconUrl,
            addedAt: Date.now()
        };

        // Add to inbox (at beginning for newest first)
        this.inbox.unshift(inboxItem);

        // Remove from category (support both new 'links' and legacy 'bookmarks' structure)
        if (this.categories[categoryIndex].links) {
            this.categories[categoryIndex].links.splice(linkIndex, 1);
        } else if (this.categories[categoryIndex].bookmarks) {
            this.categories[categoryIndex].bookmarks.splice(linkIndex, 1);
        }

        await this.saveData();
        this.renderDashboard();
        this.showToast(`Moved "${link.name}" to inbox`, 'success');
    }

    async moveLinkFromSubcategoryToInbox(categoryIndex, subcategoryIndex, linkIndex) {
        const subcategory = this.categories[categoryIndex]?.subcategories?.[subcategoryIndex];
        if (!subcategory) {
            console.error('Subcategory not found');
            return;
        }

        const link = subcategory.links?.[linkIndex];
        if (!link) {
            console.error('Link not found in subcategory');
            return;
        }

        // Check if item already exists in inbox
        const exists = this.inbox.some(item => item.url === link.url);
        if (exists) {
            this.showToast('Link already in inbox', 'info');
            return;
        }

        // Create inbox item from link
        const inboxItem = {
            id: link.id,
            name: link.name,
            url: link.url,
            faviconData: link.faviconData,
            customFaviconUrl: link.customFaviconUrl,
            addedAt: Date.now()
        };

        // Add to inbox (at beginning for newest first)
        this.inbox.unshift(inboxItem);

        // Remove from subcategory
        subcategory.links.splice(linkIndex, 1);

        await this.saveData();
        this.renderDashboard();
        this.showToast(`Moved "${link.name}" to inbox`, 'success');
    }

    setupInboxDropZone() {
        this.dragDropManager.setupInboxDragDrop();
    }

    handleInboxDragOver(e) {
        if (this.draggedType !== 'link' && this.draggedType !== 'bookmark') return;
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
        if ((this.draggedType !== 'link' && this.draggedType !== 'bookmark') || !this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const inboxContent = e.target.closest('#inbox-content');
        if (!inboxContent) return;

        inboxContent.classList.remove('drag-over');

        // Get source information
        const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
        const sourceSubcategoryIndex = this.draggedElement.dataset.subcategoryIndex ? 
            parseInt(this.draggedElement.dataset.subcategoryIndex) : null;
        const sourceLinkIndex = parseInt(this.draggedElement.dataset.linkIndex || this.draggedElement.dataset.bookmarkIndex);
        
        // Handle different source types
        if (sourceSubcategoryIndex !== null) {
            // Moving from subcategory to inbox
            this.moveLinkFromSubcategoryToInbox(sourceCategoryIndex, sourceSubcategoryIndex, sourceLinkIndex);
        } else {
            // Moving from main category to inbox
            this.moveBookmarkToInbox(sourceCategoryIndex, sourceLinkIndex);
        }
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
        // Use faviconData if available, otherwise try customFaviconUrl, finally fall back to default
        let faviconSrc = favourite.faviconData;
        if (!faviconSrc && favourite.customFaviconUrl) {
            faviconSrc = favourite.customFaviconUrl;
        }
        if (!faviconSrc) {
            faviconSrc = this.getFallbackIcon();
        }
        
        const fallbackIcon = this.getFallbackIcon();
        
        return `
            <div class="favourite-item" data-favourite-index="${index}" draggable="true" title="${this.escapeHtml(favourite.url)}">
                <a href="${this.escapeHtml(favourite.url)}" ${this.openLinksInNewTab ? 'target="_blank"' : ''} class="favourite-link">
                    <img class="favourite-favicon" src="${faviconSrc}" alt="Favicon" data-fallback="${fallbackIcon}">
                </a>
                ${this.favouritesEditMode ? `
                    <div class="favourite-actions">
                        <button class="action-btn edit-btn" data-favourite-index="${index}" title="Edit Favourite">
                            <img src="icons/app_icons/pencil_white.png" alt="Edit" style="width: 16px; height: 16px;">
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
                // Use currentTarget to get the button, then find the favourite item
                const button = e.currentTarget;
                const favouriteItem = button.closest('.favourite-item');
                const favouriteIndex = parseInt(favouriteItem.dataset.favouriteIndex);
                this.editFavourite(favouriteIndex);
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
        document.getElementById('delete-favourite').classList.add('hidden'); // Hide delete button for new favourites
        
        this.openModal('favourite-modal');
        document.getElementById('favourite-url').focus();
    }

    editFavourite(favouriteIndex) {
        const favourite = this.favourites[favouriteIndex];
        
        if (!favourite) {
            console.error('Favourite not found at index:', favouriteIndex);
            return;
        }
        
        this.currentEditingFavourite = favourite;
        this.editingFavouriteIndex = favouriteIndex;
        
        document.getElementById('favourite-modal-title').textContent = 'Edit Favourite';
        document.getElementById('favourite-url').value = favourite.url;
        document.getElementById('favourite-favicon').value = favourite.customFaviconUrl || '';
        document.getElementById('save-favourite').textContent = 'Update Favourite';
        document.getElementById('delete-favourite').classList.remove('hidden'); // Show delete button for editing
        
        this.openModal('favourite-modal');
        document.getElementById('favourite-url').focus();
    }

    handleDeleteFavouriteFromModal() {
        if (this.editingFavouriteIndex !== null) {
            const favourite = this.favourites[this.editingFavouriteIndex];
            this.showConfirmation(
                'Delete Favourite',
                `Are you sure you want to delete the favourite for "${favourite.url}"?`,
                () => {
                    this.favourites.splice(this.editingFavouriteIndex, 1);
                    this.saveData();
                    this.renderDashboard();
                    this.closeModal('favourite-modal');
                    this.showToast('Favourite deleted successfully', 'success');
                }
            );
        }
    }

    async handleSaveFavourite(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const rawUrl = formData.get('url').trim();
        const rawCustomFaviconUrl = formData.get('favicon').trim();
        
        // Normalize URL first
        const normalizedUrl = this.normalizeUrl(rawUrl);
        
        if (!normalizedUrl) {
            this.showToast('URL is required', 'error');
            return;
        }

        const saveBtn = document.getElementById('save-favourite');
        saveBtn.disabled = true;
        
        try {
            let faviconData = null;
            
            // Use custom favicon if provided, otherwise try to fetch from domain
            if (rawCustomFaviconUrl) {
                try {
                    const normalizedFaviconUrl = this.normalizeUrl(rawCustomFaviconUrl);
                    faviconData = await this.fetchFaviconAsDataUrl(normalizedFaviconUrl);
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
                faviconData: faviconData,
                customFaviconUrl: rawCustomFaviconUrl ? this.normalizeUrl(rawCustomFaviconUrl) : null
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

    // Search Functionality
    handleSearchInput(e) {
        const query = e.target.value.trim();
        
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search to avoid excessive filtering
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300);
        
        // Show/hide clear button
        const clearBtn = document.getElementById('search-clear');
        if (query.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    
    performSearch(query) {
        this.searchQuery = query.toLowerCase();
        
        if (this.searchQuery.length === 0) {
            this.clearSearchResults();
            return;
        }
        
        // Add search-active class to body for styling
        document.body.classList.add('search-active');
        
        // Search through all locations
        this.searchCategories();
        this.searchFavourites();
        this.searchInbox();
    }
    
    searchCategories() {
        // Search through categories, subcategories, and their links
        this.categories.forEach((category, categoryIndex) => {
            const categoryElement = document.querySelector(`[data-category-index="${categoryIndex}"]`);
            if (!categoryElement) return;
            
            let categoryHasMatch = false;
            
            // Check if category name matches
            if (category.name.toLowerCase().includes(this.searchQuery)) {
                categoryHasMatch = true;
                this.highlightText(categoryElement.querySelector('.category-title'), category.name, this.searchQuery);
            }
            
            // Check top-level links
            if (category.links) {
                category.links.forEach((link, linkIndex) => {
                    const linkElement = categoryElement.querySelector(`[data-link-index="${linkIndex}"]`);
                    if (linkElement && this.linkMatchesSearch(link)) {
                        categoryHasMatch = true;
                        linkElement.classList.add('search-match');
                        this.highlightLinkText(linkElement, link, this.searchQuery);
                    } else if (linkElement) {
                        linkElement.classList.remove('search-match');
                        this.removeHighlights(linkElement);
                    }
                });
            }
            
            // Check subcategories and their links
            if (category.subcategories) {
                category.subcategories.forEach((subcategory, subcategoryIndex) => {
                    let subcategoryHasMatch = false;
                    
                    // Check subcategory name
                    if (subcategory.name.toLowerCase().includes(this.searchQuery)) {
                        subcategoryHasMatch = true;
                        categoryHasMatch = true;
                        const subcategoryElement = categoryElement.querySelector(`[data-subcategory-index="${subcategoryIndex}"]`);
                        if (subcategoryElement) {
                            this.highlightText(subcategoryElement.querySelector('.subcategory-title'), subcategory.name, this.searchQuery);
                        }
                    }
                    
                    // Check subcategory links
                    if (subcategory.links) {
                        subcategory.links.forEach((link, linkIndex) => {
                            const linkElement = categoryElement.querySelector(`[data-subcategory-index="${subcategoryIndex}"] [data-link-index="${linkIndex}"]`);
                            if (linkElement && this.linkMatchesSearch(link)) {
                                subcategoryHasMatch = true;
                                categoryHasMatch = true;
                                linkElement.classList.add('search-match');
                                this.highlightLinkText(linkElement, link, this.searchQuery);
                            } else if (linkElement) {
                                linkElement.classList.remove('search-match');
                                this.removeHighlights(linkElement);
                            }
                        });
                    }
                });
            }
            
            // Apply match class to category
            if (categoryHasMatch) {
                categoryElement.classList.add('search-match');
            } else {
                categoryElement.classList.remove('search-match');
                this.removeHighlights(categoryElement);
            }
        });
    }
    
    searchFavourites() {
        this.favourites.forEach((favourite, index) => {
            const favouriteElement = document.querySelector(`[data-favourite-index="${index}"]`);
            if (!favouriteElement) return;
            
            if (this.linkMatchesSearch(favourite)) {
                favouriteElement.classList.add('search-match');
                // Note: favourites only show favicon, so no text highlighting needed
            } else {
                favouriteElement.classList.remove('search-match');
            }
        });
    }
    
    searchInbox() {
        this.inbox.forEach((item, index) => {
            const inboxElement = document.querySelector(`[data-inbox-index="${index}"]`);
            if (!inboxElement) return;
            
            if (this.linkMatchesSearch(item)) {
                inboxElement.classList.add('search-match');
                this.highlightLinkText(inboxElement, item, this.searchQuery);
            } else {
                inboxElement.classList.remove('search-match');
                this.removeHighlights(inboxElement);
            }
        });
    }
    
    linkMatchesSearch(link) {
        const query = this.searchQuery;
        return (
            link.name.toLowerCase().includes(query) ||
            link.url.toLowerCase().includes(query) ||
            this.extractDomain(link.url).toLowerCase().includes(query)
        );
    }
    
    extractDomain(url) {
        return UIUtils.extractDomain(url);
    }
    
    highlightText(element, text, query) {
        UIUtils.highlightText(element, text, query);
    }
    
    highlightLinkText(linkElement, link, query) {
        const titleElement = linkElement.querySelector('.link-title, .bookmark-title, .inbox-title');
        if (titleElement) {
            this.highlightText(titleElement, link.name, query);
        }
    }
    
    removeHighlights(element) {
        UIUtils.removeHighlights(element);
        
        // Also restore original text for category and subcategory titles
        const categoryTitle = element.querySelector('.category-title');
        if (categoryTitle) {
            const categoryIndex = parseInt(element.dataset.categoryIndex);
            if (this.categories[categoryIndex]) {
                categoryTitle.textContent = this.categories[categoryIndex].name;
            }
        }
        
        const subcategoryTitle = element.querySelector('.subcategory-title');
        if (subcategoryTitle) {
            const categoryIndex = parseInt(element.dataset.categoryIndex);
            const subcategoryIndex = parseInt(element.dataset.subcategoryIndex);
            if (this.categories[categoryIndex]?.subcategories?.[subcategoryIndex]) {
                subcategoryTitle.textContent = this.categories[categoryIndex].subcategories[subcategoryIndex].name;
            }
        }
        
        const linkTitles = element.querySelectorAll('.link-title, .bookmark-title, .inbox-title');
        linkTitles.forEach(titleElement => {
            const linkElement = titleElement.closest('[data-link-index], [data-inbox-index]');
            if (linkElement) {
                const categoryIndex = linkElement.dataset.categoryIndex;
                const subcategoryIndex = linkElement.dataset.subcategoryIndex;
                const linkIndex = linkElement.dataset.linkIndex;
                const inboxIndex = linkElement.dataset.inboxIndex;
                
                let linkData = null;
                if (inboxIndex !== undefined) {
                    linkData = this.inbox[parseInt(inboxIndex)];
                } else if (subcategoryIndex !== undefined) {
                    linkData = this.categories[parseInt(categoryIndex)]?.subcategories?.[parseInt(subcategoryIndex)]?.links?.[parseInt(linkIndex)];
                } else {
                    linkData = this.categories[parseInt(categoryIndex)]?.links?.[parseInt(linkIndex)];
                }
                
                if (linkData) {
                    titleElement.textContent = linkData.name;
                }
            }
        });
    }
    
    clearSearch() {
        // Clear input
        document.getElementById('global-search').value = '';
        document.getElementById('search-clear').classList.add('hidden');
        
        // Clear search state
        this.clearSearchResults();
    }
    
    clearSearchResults() {
        this.searchQuery = '';
        
        // Remove search-active class
        document.body.classList.remove('search-active');
        
        // Remove all search-related classes
        document.querySelectorAll('.search-match').forEach(element => {
            element.classList.remove('search-match');
        });
        
        // Remove all highlights
        document.querySelectorAll('.search-highlight').forEach(highlight => {
            highlight.outerHTML = highlight.innerHTML;
        });
        
        // Re-render to restore original text
        this.renderDashboard();
    }
    
    escapeRegex(string) {
        return UIUtils.escapeRegex(string);
    }
    
    // Helper method for relative time display
    getRelativeTime(timestamp) {
        return UIUtils.getRelativeTime(timestamp);
    }
    
    // Global Keyboard Shortcuts
    handleGlobalKeyDown(e) {
        // Don't trigger shortcuts when user is typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            // Allow Escape to clear search when in search input
            if (e.key === 'Escape' && e.target.id === 'global-search') {
                this.clearSearch();
                e.target.blur(); // Remove focus from search input
            }
            return;
        }
        
        // Handle "/" key to focus search
        if (e.key === '/') {
            e.preventDefault(); // Prevent the "/" from being typed
            const searchInput = document.getElementById('global-search');
            searchInput.focus();
            searchInput.select(); // Select any existing text
        }
        
        // Handle Escape to clear search and remove focus
        if (e.key === 'Escape') {
            this.clearSearch();
            document.activeElement.blur(); // Remove focus from any focused element
        }
    }

    // URL and Favicon Handling
    normalizeUrl(url) {
        return UIUtils.normalizeUrl(url);
    }

    async fetchFaviconAsDataUrl(url) {
        return await this.faviconManager.fetchFaviconAsDataUrl(url);
    }

    // These methods are now handled by faviconManager
    // Kept for backwards compatibility
    getGoogleServiceFavicon(parsedUrl) {
        return this.faviconManager.getGoogleServiceFavicon(parsedUrl);
    }

    getDomainFallbackChain(parsedUrl) {
        return this.faviconManager.getDomainFallbackChain(parsedUrl);
    }

    async tryFetchFavicon(faviconUrl) {
        return await this.faviconManager.tryFetchFavicon(faviconUrl);
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

        document.querySelectorAll('.add-subcategory-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.openAddSubcategoryModal(categoryIndex);
            });
        });

        document.querySelectorAll('.category-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.deleteCategory(categoryIndex);
            });
        });

        document.querySelectorAll('.category-move-to-shelf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.showMoveToShelfOptions(categoryIndex, btn);
            });
        });

        // Add link plus buttons
        document.querySelectorAll('.add-link-plus-btn, .add-bookmark-plus-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                this.openAddLinkModal(categoryIndex);
            });
        });

        // Subcategory toggle buttons
        document.querySelectorAll('.subcategory-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Use currentTarget (the button) instead of target (which might be the span inside)
                const button = e.currentTarget;
                
                const categoryIndex = parseInt(button.dataset.categoryIndex);
                const subcategoryIndex = parseInt(button.dataset.subcategoryIndex);
                
                // Check for NaN values
                if (isNaN(categoryIndex) || isNaN(subcategoryIndex)) {
                    console.error('Invalid indices - NaN detected:', { categoryIndex, subcategoryIndex });
                    return;
                }
                
                this.toggleSubcategoryCollapsed(categoryIndex, subcategoryIndex);
            });
        });

        // Subcategory menu buttons
        document.querySelectorAll('.subcategory-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.currentTarget.dataset.categoryIndex);
                const subcategoryIndex = parseInt(e.currentTarget.dataset.subcategoryIndex);
                this.toggleSubcategoryDropdown(categoryIndex, subcategoryIndex);
            });
        });

        // Subcategory dropdown action buttons
        document.querySelectorAll('.subcategory-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.currentTarget.dataset.categoryIndex);
                const subcategoryIndex = parseInt(e.currentTarget.dataset.subcategoryIndex);
                this.openEditSubcategoryModal(categoryIndex, subcategoryIndex);
            });
        });

        document.querySelectorAll('.subcategory-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.currentTarget.dataset.categoryIndex);
                const subcategoryIndex = parseInt(e.currentTarget.dataset.subcategoryIndex);
                this.deleteSubcategory(categoryIndex, subcategoryIndex);
            });
        });

        // Add subcategory link buttons
        document.querySelectorAll('.add-subcategory-link-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryIndex = parseInt(e.currentTarget.dataset.categoryIndex);
                const subcategoryIndex = parseInt(e.currentTarget.dataset.subcategoryIndex);
                this.openAddLinkModal(categoryIndex, subcategoryIndex);
            });
        });

        // Category drag and drop
        document.querySelectorAll('.category-column').forEach(column => {
            column.addEventListener('dragstart', (e) => this.handleCategoryDragStart(e));
            column.addEventListener('dragend', (e) => this.handleCategoryDragEnd(e));
        });

        // Subcategory drag and drop
        document.querySelectorAll('.subcategory').forEach(subcategory => {
            subcategory.addEventListener('dragstart', (e) => this.handleSubcategoryDragStart(e));
            subcategory.addEventListener('dragend', (e) => this.handleSubcategoryDragEnd(e));
            subcategory.addEventListener('dragover', (e) => this.handleSubcategoryDragOver(e));
            subcategory.addEventListener('dragleave', (e) => this.handleSubcategoryDragLeave(e));
            subcategory.addEventListener('drop', (e) => this.handleSubcategoryDrop(e));
        });
    }

    // Subcategory Dropdown Management
    toggleSubcategoryDropdown(categoryIndex, subcategoryIndex) {
        const dropdown = document.querySelector(`.subcategory-dropdown-menu[data-category-index="${categoryIndex}"][data-subcategory-index="${subcategoryIndex}"]`);
        if (!dropdown) return;
        
        const isCurrentlyOpen = dropdown.classList.contains('show');
        
        // Close all subcategory dropdowns first
        this.closeSubcategoryDropdowns();
        
        // If the clicked dropdown wasn't open, open it
        if (!isCurrentlyOpen) {
            dropdown.classList.add('show');
        }
    }

    closeSubcategoryDropdowns() {
        document.querySelectorAll('.subcategory-dropdown-menu').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }

    // Drag and drop setup delegated to dragDropManager
    setupColumnDropZones() {
        this.dragDropManager.setupColumnDropZones();
    }

    setupBookmarkDragDrop() {
        this.dragDropManager.setupLinkDragDrop();
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

    // Subcategory drag handlers
    handleSubcategoryDragStart(e) {
        e.stopPropagation(); // Prevent category drag from triggering
        const subcategory = e.target.closest('.subcategory');
        this.draggedElement = subcategory;
        this.draggedType = 'subcategory';
        subcategory.classList.add('dragging');
        document.body.classList.add('dragging-subcategory');
    }

    handleSubcategoryDragEnd(e) {
        const subcategory = e.target.closest('.subcategory');
        subcategory.classList.remove('dragging');
        document.body.classList.remove('dragging-subcategory');
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up drag-over classes
        document.querySelectorAll('.subcategory.drag-over-top, .subcategory.drag-over-bottom').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    }

    handleSubcategoryDragOver(e) {
        if (this.draggedType !== 'subcategory') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const targetSubcategory = e.target.closest('.subcategory');
        if (targetSubcategory && targetSubcategory !== this.draggedElement) {
            // Clear previous highlights
            document.querySelectorAll('.subcategory.drag-over-top, .subcategory.drag-over-bottom').forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
            // Determine insert position based on mouse position
            const rect = targetSubcategory.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertAfter = e.clientY > midY;
            
            if (insertAfter) {
                targetSubcategory.classList.add('drag-over-bottom');
            } else {
                targetSubcategory.classList.add('drag-over-top');
            }
        }
    }

    handleSubcategoryDragLeave(e) {
        // Handle drag leave for subcategories
    }

    handleSubcategoryDrop(e) {
        if (this.draggedType !== 'subcategory' || !this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const targetSubcategory = e.target.closest('.subcategory');
        if (!targetSubcategory || targetSubcategory === this.draggedElement) return;
        
        const draggedCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
        const draggedSubcategoryIndex = parseInt(this.draggedElement.dataset.subcategoryIndex);
        const targetCategoryIndex = parseInt(targetSubcategory.dataset.categoryIndex);
        const targetSubcategoryIndex = parseInt(targetSubcategory.dataset.subcategoryIndex);
        
        // Determine insert position based on mouse position
        const rect = targetSubcategory.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertAfter = e.clientY > midY;
        const targetPosition = insertAfter ? targetSubcategoryIndex + 1 : targetSubcategoryIndex;
        
        this.moveSubcategoryToPosition(draggedCategoryIndex, draggedSubcategoryIndex, targetCategoryIndex, targetPosition);
    }

    handleLinkDragStart(e) {
        e.stopPropagation(); // Prevent category drag from triggering
        const linkItem = e.target.closest('.link-item, .bookmark-item');
        this.draggedElement = linkItem;
        this.draggedType = linkItem.classList.contains('link-item') ? 'link' : 'bookmark';
        linkItem.classList.add('dragging');
        document.body.classList.add(`dragging-${this.draggedType}`);
    }

    handleLinkDragEnd(e) {
        const linkItem = e.target.closest('.link-item, .bookmark-item');
        const dragType = linkItem.classList.contains('link-item') ? 'link' : 'bookmark';
        linkItem.classList.remove('dragging');
        document.body.classList.remove(`dragging-${dragType}`);
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up all drag-over visual feedback
        document.querySelectorAll('.link-item.drag-over-top, .link-item.drag-over-bottom, .bookmark-item.drag-over-top, .bookmark-item.drag-over-bottom').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        document.querySelectorAll('.links-list.drag-over-empty, .bookmarks-list.drag-over-empty, .subcategory-links-list.drag-over-empty').forEach(list => {
            list.classList.remove('drag-over-empty');
        });
        document.querySelectorAll('.category-body.drag-over, .subcategory-body.drag-over').forEach(body => {
            body.classList.remove('drag-over');
        });
        document.querySelectorAll('#inbox-content.drag-over').forEach(inbox => {
            inbox.classList.remove('drag-over');
        });
    }

    // Backward compatibility
    handleBookmarkDragStart(e) {
        this.handleLinkDragStart(e);
    }

    handleBookmarkDragEnd(e) {
        this.handleLinkDragEnd(e);
    }

    handleLinkDragOver(e) {
        if (this.draggedType !== 'link' && this.draggedType !== 'bookmark' && this.draggedType !== 'inbox') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const targetLink = e.target.closest('.link-item, .bookmark-item');
        if (targetLink && targetLink !== this.draggedElement) {
            // Clear previous highlights
            document.querySelectorAll('.link-item.drag-over-top, .link-item.drag-over-bottom, .bookmark-item.drag-over-top, .bookmark-item.drag-over-bottom').forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
            // Determine insert position based on mouse position
            const rect = targetLink.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertAfter = e.clientY > midY;
            
            if (insertAfter) {
                targetLink.classList.add('drag-over-bottom');
            } else {
                targetLink.classList.add('drag-over-top');
            }
        }
    }

    handleLinkDragLeave(e) {
        // Handle drag leave for links
    }

    handleLinkDrop(e) {
        if (!this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const targetLink = e.target.closest('.link-item, .bookmark-item');
        if (!targetLink || targetLink === this.draggedElement) return;
        
        // Determine insert position based on mouse position
        const rect = targetLink.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertAfter = e.clientY > midY;
        
        // Get target information (could be category link or subcategory link)
        const targetCategoryIndex = parseInt(targetLink.dataset.categoryIndex);
        const targetLinkIndex = parseInt(targetLink.dataset.linkIndex || targetLink.dataset.bookmarkIndex);
        const targetSubcategoryIndex = targetLink.dataset.subcategoryIndex ? parseInt(targetLink.dataset.subcategoryIndex) : null;
        
        const targetPosition = insertAfter ? targetLinkIndex + 1 : targetLinkIndex;
        
        if (this.draggedType === 'link' || this.draggedType === 'bookmark') {
            // Get source link information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceLinkIndex = parseInt(this.draggedElement.dataset.linkIndex || this.draggedElement.dataset.bookmarkIndex);
            const sourceSubcategoryIndex = this.draggedElement.dataset.subcategoryIndex ? parseInt(this.draggedElement.dataset.subcategoryIndex) : null;
            
            this.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop at specific position
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        }
    }

    // Backward compatibility
    handleBookmarkDragOver(e) {
        this.handleLinkDragOver(e);
    }

    handleBookmarkDragLeave(e) {
        this.handleLinkDragLeave(e);
    }

    handleBookmarkDrop(e) {
        this.handleLinkDrop(e);
    }

    handleLinksListDragOver(e) {
        if (this.draggedType !== 'link' && this.draggedType !== 'bookmark' && this.draggedType !== 'inbox') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const linksList = e.target.closest('.links-list, .bookmarks-list, .subcategory-links-list');
        if (linksList) {
            linksList.classList.add('drag-over-empty');
        }
    }

    handleLinksListDragLeave(e) {
        const linksList = e.target.closest('.links-list, .bookmarks-list, .subcategory-links-list');
        if (!linksList) return;
        
        // Only remove classes if we're leaving the element entirely
        if (!linksList.contains(e.relatedTarget)) {
            linksList.classList.remove('drag-over-empty');
        }
    }

    handleLinksListDrop(e) {
        if (!this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const linksList = e.target.closest('.links-list, .bookmarks-list, .subcategory-links-list');
        if (!linksList) return;
        
        // Determine target location (category or subcategory)
        const targetCategoryIndex = parseInt(linksList.dataset.categoryIndex || 
                                           linksList.closest('.category-column').dataset.categoryIndex);
        const targetSubcategoryIndex = linksList.dataset.subcategoryIndex ? parseInt(linksList.dataset.subcategoryIndex) : null;
        
        if (this.draggedType === 'link' || this.draggedType === 'bookmark') {
            // Get source information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceLinkIndex = parseInt(this.draggedElement.dataset.linkIndex || this.draggedElement.dataset.bookmarkIndex);
            const sourceSubcategoryIndex = this.draggedElement.dataset.subcategoryIndex ? parseInt(this.draggedElement.dataset.subcategoryIndex) : null;
            
            // Drop at the end of the target list
            let targetPosition;
            if (targetSubcategoryIndex !== null) {
                targetPosition = this.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].links.length;
            } else {
                targetPosition = this.categories[targetCategoryIndex].links.length;
            }
            
            this.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, -1, targetSubcategoryIndex); // -1 means append to end
        }
    }

    // Backward compatibility
    handleBookmarksListDragOver(e) {
        this.handleLinksListDragOver(e);
    }

    handleBookmarksListDragLeave(e) {
        this.handleLinksListDragLeave(e);
    }

    handleBookmarksListDrop(e) {
        this.handleLinksListDrop(e);
    }

    handleCategoryBodyDragOver(e) {
        if (this.draggedType !== 'link' && this.draggedType !== 'bookmark' && this.draggedType !== 'inbox' && this.draggedType !== 'subcategory') return;
        
        // Only handle this if we're not inside a subcategory or subcategory list
        const subcategoryList = e.target.closest('.subcategory-links-list');
        const subcategoryBody = e.target.closest('.subcategory-body');
        if (subcategoryList || subcategoryBody) {
            return; // Let subcategory handlers deal with this
        }
        
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
        
        if (this.draggedType === 'link' || this.draggedType === 'bookmark') {
            // Get source information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceLinkIndex = parseInt(this.draggedElement.dataset.linkIndex || this.draggedElement.dataset.bookmarkIndex);
            const sourceSubcategoryIndex = this.draggedElement.dataset.subcategoryIndex ? parseInt(this.draggedElement.dataset.subcategoryIndex) : null;
            
            // Drop at the end of the target category's top-level links
            const targetPosition = this.categories[targetCategoryIndex].links.length;
            
            this.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, null);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, -1, null); // -1 means append to end, null means category (not subcategory)
        } else if (this.draggedType === 'subcategory') {
            // Handle subcategory drop - move subcategory to target category
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceSubcategoryIndex = parseInt(this.draggedElement.dataset.subcategoryIndex);
            
            // Drop at the end of the target category's subcategories
            const targetPosition = this.categories[targetCategoryIndex].subcategories.length;
            
            this.moveSubcategoryToPosition(sourceCategoryIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition);
        }
    }

    // Subcategory body drag handlers
    handleSubcategoryBodyDragOver(e) {
        if (this.draggedType !== 'link' && this.draggedType !== 'bookmark' && this.draggedType !== 'inbox') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const subcategoryBody = e.target.closest('.subcategory-body');
        if (subcategoryBody) {
            subcategoryBody.classList.add('drag-over');
        }
    }

    handleSubcategoryBodyDragLeave(e) {
        const subcategoryBody = e.target.closest('.subcategory-body');
        if (!subcategoryBody) return;
        
        // Only remove classes if we're leaving the element entirely
        if (!subcategoryBody.contains(e.relatedTarget)) {
            subcategoryBody.classList.remove('drag-over');
        }
    }

    handleSubcategoryBodyDrop(e) {
        if (!this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const subcategoryBody = e.target.closest('.subcategory-body');
        if (!subcategoryBody) return;
        
        const subcategoryElement = subcategoryBody.closest('.subcategory');
        const targetCategoryIndex = parseInt(subcategoryElement.dataset.categoryIndex);
        const targetSubcategoryIndex = parseInt(subcategoryElement.dataset.subcategoryIndex);
        
        if (this.draggedType === 'link' || this.draggedType === 'bookmark') {
            // Get source information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceLinkIndex = parseInt(this.draggedElement.dataset.linkIndex || this.draggedElement.dataset.bookmarkIndex);
            const sourceSubcategoryIndex = this.draggedElement.dataset.subcategoryIndex ? parseInt(this.draggedElement.dataset.subcategoryIndex) : null;
            
            // Drop at the end of the target subcategory's links
            const targetPosition = this.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].links.length;
            
            this.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, -1, targetSubcategoryIndex); // -1 means append to end
        }
    }

    // Settings and Import/Export
    openSettingsModal() {
        document.getElementById('column-count').value = this.columnCount;
        document.getElementById('show-favourites').checked = this.showFavourites;
        document.getElementById('open-links-new-tab').checked = this.openLinksInNewTab;
        this.openModal('settings-modal');
    }

    relocateOrphanedCategories(newColumnCount) {
        const targetColumn = newColumnCount - 1; // Last visible column
        const orphanedCategories = this.categories.filter(category => category.column >= newColumnCount);
        
        if (orphanedCategories.length === 0) return;
        
        // Find the highest position in the target column
        const categoriesInTargetColumn = this.categories.filter(category => category.column === targetColumn);
        let maxPosition = Math.max(...categoriesInTargetColumn.map(cat => cat.position), -1);
        
        // Move orphaned categories to the target column
        orphanedCategories.forEach(category => {
            category.column = targetColumn;
            category.position = ++maxPosition; // Assign next available position
        });
        
        console.log(`Moved ${orphanedCategories.length} categories to column ${targetColumn}`);
    }

    async handleColumnCountChange(e) {
        const newColumnCount = parseInt(e.target.value);
        if (newColumnCount >= 1 && newColumnCount <= 5) {
            const oldColumnCount = this.columnCount;
            
            // If reducing column count, move orphaned categories to the last visible column
            if (newColumnCount < oldColumnCount) {
                this.relocateOrphanedCategories(newColumnCount);
            }
            
            this.columnCount = newColumnCount;
            await this.saveData();
            this.renderDashboard();
            this.showToast(`Layout updated to ${newColumnCount} column${newColumnCount > 1 ? 's' : ''}`, 'success');
        }
    }

    exportBookmarks() {
        this.importExportManager.exportBookmarks();
    }

    exportToNetscape() {
        this.importExportManager.exportToNetscape();
    }

    triggerImport() {
        this.importExportManager.triggerImport();
    }

    triggerPapalyImport() {
        this.importExportManager.triggerPapalyImport();
    }

    async importPapalyFile(file) {
        try {
            const text = await file.text();
            console.log('Force-importing as Papaly format...');
            
            const importedData = this.parsePapalyBookmarks(text);
            
            // Import the data
            this.categories = importedData.categories;
            this.favourites = importedData.favourites || [];
            this.columnCount = importedData.columnCount || this.columnCount || 5;
            this.showFavourites = importedData.showFavourites !== false;
            this.openLinksInNewTab = importedData.openLinksInNewTab !== false;
            
            await this.saveData();
            this.renderDashboard();
            this.closeModal('settings-modal');
            
            this.showToast(`Successfully imported ${importedData.categories.length} categories from Papaly`, 'success');
            
            // Automatically fetch favicons for imported links
            setTimeout(() => {
                this.fetchFaviconsForImportedData();
            }, 1000); // Small delay to let the success message show
        } catch (error) {
            console.error('Error importing Papaly file:', error);
            this.showToast('Error importing Papaly file: ' + error.message, 'error');
        }
    }

    async importBookmarks(e) {
        await this.importExportManager.importBookmarks(e);
    }

    parseHtmlBookmarks(htmlText) {
        // Auto-detect between Papaly and standard Netscape format
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        // Check for Papaly-style structure (single container with nested subcategories)
        const allH3Elements = doc.querySelectorAll('H3');
        const rootDl = doc.querySelector('DL');
        
        if (rootDl) {
            const rootDtElements = Array.from(rootDl.children).filter(child => child.tagName === 'DT');
            
            // Papaly typically has one main container (like "My Board") with everything nested inside
            if (rootDtElements.length === 1 && rootDtElements[0].querySelector('H3')?.textContent.includes('Board')) {
                console.log('Detected Papaly format - using Papaly parser');
                return this.parsePapalyBookmarks(htmlText);
            }
        }
        
        // Default to standard Netscape format for browser exports
        console.log('Detected standard Netscape format - using Netscape parser');
        return this.parseNetscapeBookmarks(htmlText);
    }

    parsePapalyBookmarks(htmlText) {
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        const categories = [];
        let linkCount = 0;
        

        
        // In Papaly exports, we need to find the main container and process its contents
        // The structure is: <DT><H3>Container</H3> <DL>...subcategories...</DL>
        
        // Find all top-level DT > H3 combinations in the root DL
        const rootDl = doc.querySelector('DL');
        if (!rootDl) {
            return { categories: [], favourites: [], columnCount: 5, showFavourites: false, openLinksInNewTab: true };
        }
        
        // Look for direct DT children of the root DL
        const rootDtElements = Array.from(rootDl.children).filter(child => child.tagName === 'DT');
        
        rootDtElements.forEach((rootDt, index) => {
            const h3Element = rootDt.querySelector('H3');
            if (!h3Element) {
                console.log(`Root DT ${index}: No H3 found, skipping`);
                return;
            }
            
            const containerName = h3Element.textContent.trim();
            console.log(`Root DT ${index}: Found container "${containerName}"`);
            
            // The DL is INSIDE the DT, not after it as a sibling
            const containerDl = rootDt.querySelector('DL');
            
            if (!containerDl) {
                console.log(`  No DL found inside container "${containerName}"`);
                return;
            }
            
            console.log(`  Found DL with ${containerDl.children.length} children`);
            
            // Process the contents of this container DL
            const containerChildren = Array.from(containerDl.children).filter(child => child.tagName === 'DT');
            
            containerChildren.forEach((childDt, childIndex) => {
                const childH3 = childDt.querySelector('H3');
                const childA = childDt.querySelector('A');
                
                if (childH3) {
                    // This is a subcategory
                    const subcategoryName = childH3.textContent.trim();
                    console.log(`    Processing subcategory: "${subcategoryName}"`);
                    
                    // The DL is probably INSIDE the subcategory DT, not after it as a sibling
                    let subcategoryDl = childDt.querySelector('DL');
                    
                    console.log(`      Looking for subcategory DL - found inside: ${!!subcategoryDl}`);
                    
                    if (!subcategoryDl) {
                        // Fallback: try looking for sibling DL
                        console.log(`      Trying sibling approach...`);
                        subcategoryDl = childDt.nextElementSibling;
                        while (subcategoryDl && subcategoryDl.tagName !== 'DL') {
                            console.log(`        Checking sibling: ${subcategoryDl.tagName}`);
                            subcategoryDl = subcategoryDl.nextElementSibling;
                        }
                        if (subcategoryDl) {
                            console.log(`      Found subcategory DL as sibling`);
                        }
                    }
                    
                    const subcategoryLinks = [];
                    const nestedSubcategories = []; // Move this outside the if block
                    
                    if (subcategoryDl) {
                        console.log(`      Found subcategory DL with ${subcategoryDl.children.length} children`);
                        
                        // Process links and nested subcategories within this subcategory
                        const linkDts = Array.from(subcategoryDl.children).filter(child => child.tagName === 'DT');
                        console.log(`        Found ${linkDts.length} DT elements in subcategory`);
                        
                        linkDts.forEach((linkDt, linkIndex) => {
                            const linkA = linkDt.querySelector('A');
                            const nestedH3 = linkDt.querySelector('H3');
                            
                            console.log(`          Item ${linkIndex}: Has A: ${!!linkA}, Has H3: ${!!nestedH3}`);
                            
                            if (nestedH3 && !linkA) {
                                // This is a nested subcategory
                                const nestedSubcategoryName = nestedH3.textContent.trim();
                                console.log(`            Processing nested subcategory: "${nestedSubcategoryName}"`);
                                
                                // Find the DL for this nested subcategory
                                let nestedDl = linkDt.querySelector('DL');
                                if (!nestedDl) {
                                    // Fallback: try sibling approach
                                    nestedDl = linkDt.nextElementSibling;
                                    while (nestedDl && nestedDl.tagName !== 'DL') {
                                        nestedDl = nestedDl.nextElementSibling;
                                    }
                                }
                                
                                const nestedLinks = [];
                                if (nestedDl) {
                                    console.log(`              Found nested DL with ${nestedDl.children.length} children`);
                                    const nestedLinkDts = Array.from(nestedDl.children).filter(child => child.tagName === 'DT');
                                    
                                    nestedLinkDts.forEach(nestedLinkDt => {
                                        const nestedLinkA = nestedLinkDt.querySelector('A');
                                        if (nestedLinkA) {
                                            const nestedLink = this.parseLink(nestedLinkA);
                                            if (nestedLink) {
                                                nestedLinks.push(nestedLink);
                                                linkCount++;
                                                console.log(`                Added nested link: "${nestedLink.name}"`);
                                            }
                                        }
                                    });
                                }
                                
                                console.log(`              Nested subcategory "${nestedSubcategoryName}" has ${nestedLinks.length} links`);
                                
                                nestedSubcategories.push({
                                    id: `subcategory_${Date.now()}_${Math.random()}`,
                                    name: nestedSubcategoryName,
                                    links: nestedLinks,
                                    collapsed: false
                                });
                                
                            } else if (linkA && !nestedH3) {
                                // This is a direct link in the subcategory
                                const link = this.parseLink(linkA);
                                if (link) {
                                    subcategoryLinks.push(link);
                                    linkCount++;

                                }
                            }
                        });
                        
                        // Add nested subcategories to the final result
                    }
                    

                    
                    // Create a category for each subcategory (since Papaly subcategories become our categories)
                    categories.push({
                        id: `category_${Date.now()}_${Math.random()}`,
                        name: subcategoryName,
                        links: subcategoryLinks, // Top-level links in this category
                        subcategories: nestedSubcategories, // Nested subcategories become LinkShelf subcategories
                        bookmarks: [] // Legacy field for compatibility
                    });
                    
                } else if (childA) {
                    // This is a direct link under the container (rare, but handle it)
                    const link = this.parseLink(childA);
                    if (link) {
                        // Create a category for miscellaneous links
                        categories.push({
                            id: `category_${Date.now()}_${Math.random()}`,
                            name: `${containerName} Links`,
                            links: [link],
                            subcategories: [],
                            bookmarks: []
                        });
                        linkCount++;
                    }
                }
            });
        });
        
        console.log(`Parsed ${categories.length} categories with ${linkCount} total links`);
        
        return {
            categories: categories,
            favourites: [], // Papaly doesn't have favourites concept
            columnCount: 5,
            showFavourites: false,
            openLinksInNewTab: true
        };
    }

    parseNetscapeBookmarks(htmlText) {
        // Parse standard Netscape bookmark format (from browsers like Chrome, Firefox)
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        const categories = [];
        let linkCount = 0;
        
        console.log('Starting standard Netscape bookmark import...');
        
        // Find the root DL
        const rootDl = doc.querySelector('DL');
        if (!rootDl) {
            console.log('ERROR: No root DL found');
            return { categories: [], favourites: [], columnCount: 5, showFavourites: false, openLinksInNewTab: true };
        }
        
        console.log('Found root DL, processing bookmark folders...');
        
        // Process direct children of root DL - these become categories
        const processFolder = (dlElement, folderName = null, isTopLevel = true) => {
            const folderLinks = [];
            const folderSubcategories = [];
            
            const dtElements = Array.from(dlElement.children).filter(child => child.tagName === 'DT');
            console.log(`Processing folder "${folderName || 'root'}" with ${dtElements.length} items`);
            
            dtElements.forEach((dt, index) => {
                const h3Element = dt.querySelector('H3');
                const aElement = dt.querySelector('A');
                
                if (h3Element && !aElement) {
                    // This is a subfolder
                    const subfolderName = h3Element.textContent.trim();
                    if (!subfolderName) return;
                    
                    console.log(`  Found subfolder: "${subfolderName}"`);
                    
                    // Find the DL that follows this subfolder
                    let subfolderDl = dt.querySelector('DL');
                    if (!subfolderDl) {
                        subfolderDl = dt.nextElementSibling;
                        while (subfolderDl && subfolderDl.tagName !== 'DL') {
                            subfolderDl = subfolderDl.nextElementSibling;
                        }
                    }
                    
                    if (subfolderDl) {
                        if (isTopLevel) {
                            // Top-level folders become separate categories
                            const subfolderData = processFolder(subfolderDl, subfolderName, false);
                            categories.push({
                                id: `category_${Date.now()}_${Math.random()}`,
                                name: subfolderName,
                                links: subfolderData.links,
                                subcategories: subfolderData.subcategories,
                                bookmarks: []
                            });
                            linkCount += subfolderData.linkCount;
                        } else {
                            // Nested folders become subcategories
                            const subfolderData = processFolder(subfolderDl, subfolderName, false);
                            folderSubcategories.push({
                                id: `subcategory_${Date.now()}_${Math.random()}`,
                                name: subfolderName,
                                links: subfolderData.links,
                                collapsed: false
                            });
                            linkCount += subfolderData.linkCount;
                        }
                    }
                    
                } else if (aElement && !h3Element) {
                    // This is a direct link
                    const link = this.parseLink(aElement);
                    if (link) {
                        folderLinks.push(link);
                        linkCount++;
                        console.log(`    Added link: "${link.name}"`);
                    }
                }
            });
            
            return {
                links: folderLinks,
                subcategories: folderSubcategories,
                linkCount: folderLinks.length
            };
        };
        
        // Process the root DL
        const rootData = processFolder(rootDl, null, true);
        
        // Add any top-level links as an "Unsorted" category if they exist
        if (rootData.links.length > 0) {
            categories.push({
                id: `category_${Date.now()}_${Math.random()}`,
                name: 'Unsorted Bookmarks',
                links: rootData.links,
                subcategories: [],
                bookmarks: []
            });
        }
        
        console.log(`Parsed ${categories.length} categories with ${linkCount} total links from Netscape format`);
        
        return {
            categories: categories,
            favourites: [],
            columnCount: 5,
            showFavourites: false,
            openLinksInNewTab: true
        };
    }
    
    // Helper method to check if a DT element has an ancestor H3 (indicating it's nested)
    hasAncestorH3(element) {
        let current = element.parentElement;
        while (current && current !== document.body) {
            if (current.tagName === 'H3') {
                return true;
            }
            // Check if we've gone up past the main bookmark structure
            if (current.tagName === 'HTML' || current.tagName === 'BODY') {
                break;
            }
            current = current.parentElement;
        }
        return false;
    }

    async fetchFaviconsForImportedData() {
        await this.importExportManager.fetchFaviconsForImportedData();
    }
    
    // Helper method to parse individual links
    parseLink(aElement) {
        const url = aElement.getAttribute('HREF') || aElement.getAttribute('href');
        const name = aElement.textContent.trim();
        
        if (!url || !name) return null;
        
        return {
            id: `link_${Date.now()}_${Math.random()}`,
            name: name,
            url: url,
            customFaviconUrl: '' // Will be auto-detected when displayed
        };
    }

    // UI helper methods
    escapeHtml(text) {
        return UIUtils.escapeHtml(text);
    }
    
    getFallbackIcon() {
        return UIUtils.getFallbackIcon();
    }

    // Modal Management
    openModal(modalId) {
        // Close all dropdowns when opening modals
        this.closeCategoryDropdowns();
        this.closeSubcategoryDropdowns();
        
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
        UIUtils.showToast(message, type);
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
        return UIUtils.findFirstAvailableSlot(this.categories, this.columnCount);
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

