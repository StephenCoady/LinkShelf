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
        this.setupStorageListener();
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
            this.columnCount = result.linkshelf_column_count || 5;
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
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.linkshelf_inbox) {
                // Update local inbox data with the new value
                this.inbox = changes.linkshelf_inbox.newValue || [];
                // Re-render the inbox to show updated content
                this.renderInbox();
                console.log('Inbox auto-refreshed with new data');
            }
        });
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
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                const linkIndex = parseInt(e.target.dataset.linkIndex || e.target.dataset.bookmarkIndex);
                const subcategoryIndex = e.target.dataset.subcategoryIndex ? parseInt(e.target.dataset.subcategoryIndex) : null;
                this.editLink(categoryIndex, linkIndex, subcategoryIndex);
            });
        });

        document.querySelectorAll('.link-delete-btn, .bookmark-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const categoryIndex = parseInt(e.target.dataset.categoryIndex);
                const linkIndex = parseInt(e.target.dataset.linkIndex || e.target.dataset.bookmarkIndex);
                const subcategoryIndex = e.target.dataset.subcategoryIndex ? parseInt(e.target.dataset.subcategoryIndex) : null;
                this.deleteLink(categoryIndex, linkIndex, subcategoryIndex);
            });
        });

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
                        ✏️
                    </button>
                    <button class="link-action-btn link-delete-btn" ${dataAttributes} title="Delete Link">
                        🗑️
                    </button>
                </div>
            </li>
        `;
    }

    renderSubcategory(subcategory, categoryIndex, subcategoryIndex) {
        const isCollapsed = subcategory.collapsed || false;
        const caretIcon = isCollapsed ? '▶' : '▼';
        
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

            this.categories.push(newCategory);
            await this.saveData();
            this.renderDashboard();
            this.closeModal('create-category-modal');
            this.showToast('Category created successfully', 'success');
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

        this.categories[categoryIndex].subcategories.push(newSubcategory);
        await this.saveData();
        this.renderDashboard();
        this.showToast('Subcategory created successfully', 'success');
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
        if (subcategoryIndex !== null) {
            link = this.categories[categoryIndex].subcategories[subcategoryIndex].links[linkIndex];
        } else {
            link = this.categories[categoryIndex].links[linkIndex];
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
                faviconData: faviconData,
                customFaviconUrl: rawFaviconUrl || null
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
                    // Update existing category link
                    this.categories[this.currentEditingCategory].links[this.currentEditingBookmark] = bookmarkData;
                    this.showToast('Link updated successfully', 'success');
                }
            } else {
                if (this.currentEditingSubcategory !== null) {
                    // Add new subcategory link
                    this.categories[this.currentEditingCategory].subcategories[this.currentEditingSubcategory].links.push(bookmarkData);
                    this.showToast('Link added to subcategory successfully', 'success');
                } else {
                    // Add new category link
                    this.categories[this.currentEditingCategory].links.push(bookmarkData);
                    this.showToast('Link added to category successfully', 'success');
                }
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

    deleteLink(categoryIndex, linkIndex, subcategoryIndex = null) {
        let link, linksArray;
        if (subcategoryIndex !== null) {
            linksArray = this.categories[categoryIndex].subcategories[subcategoryIndex].links;
            link = linksArray[linkIndex];
        } else {
            linksArray = this.categories[categoryIndex].links;
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
                this.showToast('Link deleted successfully', 'success');
            }
        );
    }

    // Backward compatibility
    deleteBookmark(categoryIndex, bookmarkIndex) {
        this.deleteLink(categoryIndex, bookmarkIndex);
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
            sourceLinksArray = this.categories[sourceCategoryIndex].links;
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
            targetLinksArray = this.categories[targetCategoryIndex].links;
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
            targetLinksArray = this.categories[targetCategoryIndex].links;
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
        // Use faviconData if available, otherwise try customFaviconUrl, finally fall back to default
        let faviconSrc = item.faviconData;
        if (!faviconSrc && item.customFaviconUrl) {
            faviconSrc = item.customFaviconUrl;
        }
        if (!faviconSrc) {
            faviconSrc = this.getFallbackIcon();
        }
        
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
            faviconData: faviconData,
            customFaviconUrl: null
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
        const bookmark = this.categories[categoryIndex].bookmarks[bookmarkIndex];
        if (!bookmark) {
            console.error('Bookmark not found at position');
            return;
        }

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

        // Remove from category
        this.categories[categoryIndex].bookmarks.splice(bookmarkIndex, 1);

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
        if (this.draggedType !== 'bookmark' || !this.draggedElement) return;
        e.preventDefault();
        e.stopPropagation();
        
        const inboxContent = e.target.closest('#inbox-content');
        if (!inboxContent) return;

        inboxContent.classList.remove('drag-over');

        // Get source information
        const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
        const sourceBookmarkIndex = parseInt(this.draggedElement.dataset.bookmarkIndex);
        
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
                            ✏️
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
                faviconData: faviconData,
                customFaviconUrl: customFaviconUrl || null
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
        const parsedUrl = new URL(url);
        
        // If the URL has a specific path/filename, treat it as a direct favicon URL
        if (parsedUrl.pathname !== '/' && (parsedUrl.pathname.endsWith('.ico') || 
                                          parsedUrl.pathname.endsWith('.png') || 
                                          parsedUrl.pathname.endsWith('.jpg') || 
                                          parsedUrl.pathname.endsWith('.jpeg') || 
                                          parsedUrl.pathname.endsWith('.gif') || 
                                          parsedUrl.pathname.endsWith('.svg'))) {
            // Direct favicon URL provided
            return await this.tryFetchFavicon(url);
        }
        
        // Check for special Google services and provide specific favicons
        const googleFaviconUrl = this.getGoogleServiceFavicon(parsedUrl);
        if (googleFaviconUrl) {
            try {
                return await this.tryFetchFavicon(googleFaviconUrl);
            } catch (error) {
                console.warn('Google service favicon failed, falling back to domain favicon:', error.message);
            }
        }
        
        // Try domain favicon with fallback to parent domain
        const domains = this.getDomainFallbackChain(parsedUrl);
        
        for (const domain of domains) {
            try {
                const faviconUrl = `${domain}/favicon.ico`;
                return await this.tryFetchFavicon(faviconUrl);
            } catch (error) {
                console.warn(`Failed to fetch favicon from ${domain}:`, error.message);
                // Continue to next domain in fallback chain
            }
        }
        
        // If all attempts failed, throw error
        throw new Error(`Could not fetch favicon from any domain in chain: ${domains.join(', ')}`);
    }

    getGoogleServiceFavicon(parsedUrl) {
        const hostname = parsedUrl.hostname.toLowerCase();
        
        // Google service specific favicons
        const googleFavicons = {
            'docs.google.com': 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
            'sheets.google.com': 'https://ssl.gstatic.com/docs/spreadsheets/favicon_jfk2.png',
            'slides.google.com': 'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico',
            'drive.google.com': 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png',
            'forms.google.com': 'https://ssl.gstatic.com/docs/spreadsheets/forms/favicon_qp2.png',
            'calendar.google.com': 'https://ssl.gstatic.com/calendar/images/favicon_v2014_30.ico',
            'mail.google.com': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
            'gmail.com': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
            'maps.google.com': 'https://maps.gstatic.com/favicon.ico',
            'photos.google.com': 'https://www.gstatic.com/photos/favicon.ico',
            'youtube.com': 'https://www.youtube.com/s/desktop/7bb16b9b/img/favicon_32x32.png',
            'www.youtube.com': 'https://www.youtube.com/s/desktop/7bb16b9b/img/favicon_32x32.png',
            'meet.google.com': 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-32dp/logo_meet_2020q4_color_2x_web_32dp.png',
            'classroom.google.com': 'https://ssl.gstatic.com/classroom/favicon.png'
        };
        
        return googleFavicons[hostname] || null;
    }

    getDomainFallbackChain(parsedUrl) {
        const domains = [];
        const parts = parsedUrl.hostname.split('.');
        
        // Start with the full domain
        domains.push(parsedUrl.origin);
        
        // If it's a subdomain, try parent domains
        // e.g., source.redhat.com -> redhat.com, sub.example.co.uk -> example.co.uk
        if (parts.length > 2) {
            // For each subdomain level, try removing one level
            for (let i = 1; i < parts.length - 1; i++) {
                const parentDomain = parts.slice(i).join('.');
                domains.push(`${parsedUrl.protocol}//${parentDomain}`);
            }
        }
        
        return domains;
    }

    async tryFetchFavicon(faviconUrl) {
        const response = await fetch(faviconUrl);
        if (!response.ok) {
            throw new Error(`Favicon fetch failed: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
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
        // Setup drag and drop for link/bookmark items
        const linkItems = document.querySelectorAll('.link-item, .bookmark-item');
        linkItems.forEach(item => {
            item.addEventListener('dragover', (e) => this.handleLinkDragOver(e));
            item.addEventListener('dragleave', (e) => this.handleLinkDragLeave(e));
            item.addEventListener('drop', (e) => this.handleLinkDrop(e));
        });
        
        // Setup drop zones on all link lists
        const linkLists = document.querySelectorAll('.links-list, .bookmarks-list, .subcategory-links-list');
        linkLists.forEach(list => {
            list.addEventListener('dragover', (e) => this.handleLinksListDragOver(e));
            list.addEventListener('dragleave', (e) => this.handleLinksListDragLeave(e));
            list.addEventListener('drop', (e) => this.handleLinksListDrop(e));
        });
        
        // Setup drop zones on category and subcategory bodies
        const categoryBodies = document.querySelectorAll('.category-body');
        categoryBodies.forEach(body => {
            body.addEventListener('dragover', (e) => this.handleCategoryBodyDragOver(e));
            body.addEventListener('dragleave', (e) => this.handleCategoryBodyDragLeave(e));
            body.addEventListener('drop', (e) => this.handleCategoryBodyDrop(e));
        });
        
        // Setup drop zones on subcategory bodies
        const subcategoryBodies = document.querySelectorAll('.subcategory-body');
        subcategoryBodies.forEach(body => {
            body.addEventListener('dragover', (e) => this.handleSubcategoryBodyDragOver(e));
            body.addEventListener('dragleave', (e) => this.handleSubcategoryBodyDragLeave(e));
            body.addEventListener('drop', (e) => this.handleSubcategoryBodyDrop(e));
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

    exportToNetscape() {
        // Generate Netscape bookmark format HTML
        const formatDate = (date) => {
            return Math.floor(date.getTime() / 1000).toString();
        };
        
        const now = new Date();
        const dateStr = formatDate(now);
        
        let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>LinkShelf Bookmarks</TITLE>
<H1>LinkShelf Bookmarks</H1>

<DL><p>`;

        // Export each category as a folder
        this.categories.forEach(category => {
            if (category.links.length === 0 && category.subcategories.length === 0) {
                return; // Skip empty categories
            }
            
            html += `
    <DT><H3 ADD_DATE="${dateStr}" LAST_MODIFIED="${dateStr}">${this.escapeHtml(category.name)}</H3>
    <DL><p>`;
            
            // Export top-level category links
            if (category.links) {
                category.links.forEach(link => {
                    html += `
        <DT><A HREF="${this.escapeHtml(link.url)}" ADD_DATE="${dateStr}" LAST_MODIFIED="${dateStr}">${this.escapeHtml(link.name)}</A>`;
                });
            }
            
            // Export subcategories as nested folders
            if (category.subcategories) {
                category.subcategories.forEach(subcategory => {
                    if (subcategory.links.length === 0) return; // Skip empty subcategories
                    
                    html += `
        <DT><H3 ADD_DATE="${dateStr}" LAST_MODIFIED="${dateStr}">${this.escapeHtml(subcategory.name)}</H3>
        <DL><p>`;
                    
                    subcategory.links.forEach(link => {
                        html += `
            <DT><A HREF="${this.escapeHtml(link.url)}" ADD_DATE="${dateStr}" LAST_MODIFIED="${dateStr}">${this.escapeHtml(link.name)}</A>`;
                    });
                    
                    html += `
        </DL><p>`;
                });
            }
            
            html += `
    </DL><p>`;
        });

        html += `
</DL>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linkshelf-bookmarks-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Bookmarks exported to Netscape format successfully', 'success');
    }

    triggerImport() {
        document.getElementById('import-file').click();
    }

    triggerPapalyImport() {
        // Create a temporary file input for Papaly imports
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.html';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.importPapalyFile(file);
            document.body.removeChild(fileInput); // Clean up
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    async importPapalyFile(file) {
        try {
            const text = await file.text();
            console.log('Force-importing as Papaly format...');
            
            const importedData = this.parsePapalyBookmarks(text);
            
            // Import the data
            this.categories = importedData.categories;
            this.favourites = importedData.favourites || [];
            this.columnCount = importedData.columnCount || this.columnCount || 3;
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
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            
            // Detect file format - HTML (Papaly/Netscape) vs JSON (LinkShelf)
            let importedData;
            if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<HTML') || text.trim().startsWith('<html')) {
                // HTML format - auto-detect Papaly vs standard Netscape
                importedData = this.parseHtmlBookmarks(text);
            } else {
                // JSON format (LinkShelf export)
                const data = JSON.parse(text);
                if (!data.categories || !Array.isArray(data.categories)) {
                    throw new Error('Invalid export file format');
                }
                importedData = {
                    categories: data.categories,
                    favourites: data.favourites || [],
                    columnCount: data.columnCount || 3,
                    showFavourites: data.showFavourites !== false,
                    openLinksInNewTab: data.openLinksInNewTab !== false
                };
            }

            // Import the data
            this.categories = importedData.categories;
            this.favourites = importedData.favourites || [];
            this.columnCount = importedData.columnCount || this.columnCount || 3;
            this.showFavourites = importedData.showFavourites !== false;
            this.openLinksInNewTab = importedData.openLinksInNewTab !== false;
            
            await this.saveData();
            this.renderDashboard();
            this.closeModal('settings-modal');
            
            this.showToast(`Successfully imported ${importedData.categories.length} categories`, 'success');
            
            // Automatically fetch favicons for imported links
            setTimeout(() => {
                this.fetchFaviconsForImportedData();
            }, 1000); // Small delay to let the success message show
        } catch (error) {
            console.error('Error importing bookmarks:', error);
            this.showToast('Error importing bookmarks: ' + error.message, 'error');
        }

        // Reset file input
        e.target.value = '';
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
            return { categories: [], favourites: [], columnCount: 3, showFavourites: false, openLinksInNewTab: true };
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
            columnCount: 3,
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
            return { categories: [], favourites: [], columnCount: 3, showFavourites: false, openLinksInNewTab: true };
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
            columnCount: 3,
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
        // Collect all links that don't have faviconData
        const linksToFetch = [];
        
        // Collect from categories and subcategories
        this.categories.forEach((category, categoryIndex) => {
            // Category top-level links
            if (category.links) {
                category.links.forEach((link, linkIndex) => {
                    if (!link.faviconData) {
                        linksToFetch.push({
                            link: link,
                            path: `category-${categoryIndex}-link-${linkIndex}`,
                            location: 'category',
                            categoryIndex,
                            linkIndex
                        });
                    }
                });
            }
            
            // Subcategory links
            if (category.subcategories) {
                category.subcategories.forEach((subcategory, subcategoryIndex) => {
                    if (subcategory.links) {
                        subcategory.links.forEach((link, linkIndex) => {
                            if (!link.faviconData) {
                                linksToFetch.push({
                                    link: link,
                                    path: `category-${categoryIndex}-subcategory-${subcategoryIndex}-link-${linkIndex}`,
                                    location: 'subcategory',
                                    categoryIndex,
                                    subcategoryIndex,
                                    linkIndex
                                });
                            }
                        });
                    }
                });
            }
        });
        
        if (linksToFetch.length === 0) {
            return; // No links need favicons
        }
        
        console.log(`Fetching favicons for ${linksToFetch.length} imported links...`);
        this.showToast(`Fetching favicons for ${linksToFetch.length} links...`, 'info');
        
        let fetchedCount = 0;
        let errorCount = 0;
        
        // Process links in batches to avoid overwhelming the server
        const batchSize = 5;
        for (let i = 0; i < linksToFetch.length; i += batchSize) {
            const batch = linksToFetch.slice(i, i + batchSize);
            
            await Promise.allSettled(batch.map(async (item) => {
                try {
                    const faviconData = await this.fetchFaviconAsDataUrl(item.link.url);
                    
                    // Update the link with the fetched favicon
                    if (item.location === 'category') {
                        this.categories[item.categoryIndex].links[item.linkIndex].faviconData = faviconData;
                    } else if (item.location === 'subcategory') {
                        this.categories[item.categoryIndex].subcategories[item.subcategoryIndex].links[item.linkIndex].faviconData = faviconData;
                    }
                    
                    fetchedCount++;
                    console.log(`Fetched favicon for: ${item.link.name} (${fetchedCount}/${linksToFetch.length})`);
                } catch (error) {
                    errorCount++;
                    console.warn(`Failed to fetch favicon for ${item.link.name}:`, error.message);
                }
            }));
            
            // Small delay between batches to be respectful
            if (i + batchSize < linksToFetch.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Update progress every batch
            const progress = Math.round(((i + batchSize) / linksToFetch.length) * 100);
            this.showToast(`Fetching favicons... ${Math.min(progress, 100)}% complete`, 'info');
        }
        
        // Save the updated data
        await this.saveData();
        
        // Re-render to show the new favicons
        this.renderDashboard();
        
        // Show completion message
        if (errorCount > 0) {
            this.showToast(`Favicon fetching complete! ✓ ${fetchedCount} succeeded, ✗ ${errorCount} failed`, 'success');
        } else {
            this.showToast(`Successfully fetched ${fetchedCount} favicons! 🎉`, 'success');
        }
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

