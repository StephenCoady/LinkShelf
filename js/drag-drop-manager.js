// Drag and Drop Manager - Handles all drag and drop functionality
class DragDropManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.draggedElement = null;
        this.draggedType = null;
    }

    // Setup drag and drop for various elements
    setupDragAndDrop() {
        this.setupCategoryDragDrop();
        this.setupSubcategoryDragDrop();
        this.setupLinkDragDrop();
        this.setupInboxDragDrop();
        this.setupFavouriteDragDrop();
        this.setupColumnDropZones();
    }

    // Category drag and drop
    setupCategoryDragDrop() {
        document.querySelectorAll('.category-column').forEach(column => {
            // Avoid duplicate listeners by checking if already set up
            if (!column.hasAttribute('data-drag-listeners-setup')) {
                column.setAttribute('data-drag-listeners-setup', 'true');
                column.addEventListener('dragstart', (e) => this.handleCategoryDragStart(e));
                column.addEventListener('dragend', (e) => this.handleCategoryDragEnd(e));
            }
        });
    }

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

    // Subcategory drag and drop
    setupSubcategoryDragDrop() {
        document.querySelectorAll('.subcategory').forEach(subcategory => {
            // Avoid duplicate listeners by checking if already set up
            if (!subcategory.hasAttribute('data-drag-listeners-setup')) {
                subcategory.setAttribute('data-drag-listeners-setup', 'true');
                subcategory.addEventListener('dragstart', (e) => this.handleSubcategoryDragStart(e));
                subcategory.addEventListener('dragend', (e) => this.handleSubcategoryDragEnd(e));
                subcategory.addEventListener('dragover', (e) => this.handleSubcategoryDragOver(e));
                subcategory.addEventListener('dragleave', (e) => this.handleSubcategoryDragLeave(e));
                subcategory.addEventListener('drop', (e) => this.handleSubcategoryDrop(e));
            }
        });
    }

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
        
        this.dashboard.moveSubcategoryToPosition(draggedCategoryIndex, draggedSubcategoryIndex, targetCategoryIndex, targetPosition);
    }

    // Link/Bookmark drag and drop
    setupLinkDragDrop() {
        document.querySelectorAll('.link-item, .bookmark-item').forEach(item => {
            // Avoid duplicate listeners by checking if already set up
            if (!item.hasAttribute('data-drag-listeners-setup')) {
                item.setAttribute('data-drag-listeners-setup', 'true');
                item.addEventListener('dragstart', (e) => this.handleLinkDragStart(e));
                item.addEventListener('dragend', (e) => this.handleLinkDragEnd(e));
                item.addEventListener('dragover', (e) => this.handleLinkDragOver(e));
                item.addEventListener('dragleave', (e) => this.handleLinkDragLeave(e));
                item.addEventListener('drop', (e) => this.handleLinkDrop(e));
            }
        });

        // Setup drop zones on link lists
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
        
        const subcategoryBodies = document.querySelectorAll('.subcategory-body');
        subcategoryBodies.forEach(body => {
            body.addEventListener('dragover', (e) => this.handleSubcategoryBodyDragOver(e));
            body.addEventListener('dragleave', (e) => this.handleSubcategoryBodyDragLeave(e));
            body.addEventListener('drop', (e) => this.handleSubcategoryBodyDrop(e));
        });
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
        this.cleanupDragVisualFeedback();
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
        
        // Get target information
        const targetCategoryIndex = parseInt(targetLink.dataset.categoryIndex);
        const targetLinkIndex = parseInt(targetLink.dataset.linkIndex || targetLink.dataset.bookmarkIndex);
        const targetSubcategoryIndex = targetLink.dataset.subcategoryIndex ? parseInt(targetLink.dataset.subcategoryIndex) : null;
        
        const targetPosition = insertAfter ? targetLinkIndex + 1 : targetLinkIndex;
        
        if (this.draggedType === 'link' || this.draggedType === 'bookmark') {
            // Get source link information
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceLinkIndex = parseInt(this.draggedElement.dataset.linkIndex || this.draggedElement.dataset.bookmarkIndex);
            const sourceSubcategoryIndex = this.draggedElement.dataset.subcategoryIndex ? parseInt(this.draggedElement.dataset.subcategoryIndex) : null;
            
            this.dashboard.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop at specific position
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.dashboard.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        }
    }

    // Links list drag handlers
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
        
        // Determine target location
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
                targetPosition = this.dashboard.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].links.length;
            } else {
                targetPosition = this.dashboard.categories[targetCategoryIndex].links.length;
            }
            
            this.dashboard.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.dashboard.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, -1, targetSubcategoryIndex);
        }
    }

    // Category body drag handlers
    handleCategoryBodyDragOver(e) {
        if (this.draggedType !== 'link' && this.draggedType !== 'bookmark' && this.draggedType !== 'inbox' && this.draggedType !== 'subcategory') return;
        
        // Only handle this if we're not inside a subcategory
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
            const targetPosition = this.dashboard.categories[targetCategoryIndex].links.length;
            
            this.dashboard.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, null);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.dashboard.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, -1, null);
        } else if (this.draggedType === 'subcategory') {
            // Handle subcategory drop
            const sourceCategoryIndex = parseInt(this.draggedElement.dataset.categoryIndex);
            const sourceSubcategoryIndex = parseInt(this.draggedElement.dataset.subcategoryIndex);
            
            // Drop at the end of the target category's subcategories
            const targetPosition = this.dashboard.categories[targetCategoryIndex].subcategories.length;
            
            this.dashboard.moveSubcategoryToPosition(sourceCategoryIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition);
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
            const targetPosition = this.dashboard.categories[targetCategoryIndex].subcategories[targetSubcategoryIndex].links.length;
            
            this.dashboard.moveLinkToPosition(sourceCategoryIndex, sourceLinkIndex, sourceSubcategoryIndex, targetCategoryIndex, targetPosition, targetSubcategoryIndex);
        } else if (this.draggedType === 'inbox') {
            // Handle inbox item drop
            const inboxIndex = parseInt(this.draggedElement.dataset.inboxIndex);
            this.dashboard.moveInboxItemToLinkPosition(inboxIndex, targetCategoryIndex, -1, targetSubcategoryIndex);
        }
    }

    // Inbox drag and drop
    setupInboxDragDrop() {
        const inboxContent = document.getElementById('inbox-content');
        if (!inboxContent) {
            return;
        }

        // Setup inbox content drop zone (only once)
        if (!inboxContent.hasAttribute('data-inbox-listeners-setup')) {
            inboxContent.setAttribute('data-inbox-listeners-setup', 'true');
            inboxContent.addEventListener('dragover', (e) => this.handleInboxDragOver(e));
            inboxContent.addEventListener('dragleave', (e) => this.handleInboxDragLeave(e));
            inboxContent.addEventListener('drop', (e) => this.handleInboxDrop(e));
        }

        // Always setup inbox item drag listeners (for newly created items)
        document.querySelectorAll('.inbox-item').forEach(item => {
            // Avoid duplicate listeners by checking if already set up
            if (!item.hasAttribute('data-drag-listeners-setup')) {
                item.setAttribute('data-drag-listeners-setup', 'true');
                item.addEventListener('dragstart', (e) => this.handleInboxItemDragStart(e));
                item.addEventListener('dragend', (e) => this.handleInboxItemDragEnd(e));
            }
        });
    }

    handleInboxItemDragStart(e) {
        const inboxItem = e.target.closest('.inbox-item');
        this.draggedElement = inboxItem;
        this.draggedType = 'inbox';
        inboxItem.classList.add('dragging');
        document.body.classList.add('dragging-inbox');
    }

    handleInboxItemDragEnd(e) {
        const inboxItem = e.target.closest('.inbox-item');
        inboxItem.classList.remove('dragging');
        document.body.classList.remove('dragging-inbox');
        this.draggedElement = null;
        this.draggedType = null;
        
        // Clean up all drag-over visual feedback
        this.cleanupDragVisualFeedback();
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
            this.dashboard.moveLinkFromSubcategoryToInbox(sourceCategoryIndex, sourceSubcategoryIndex, sourceLinkIndex);
        } else {
            // Moving from main category to inbox
            this.dashboard.moveBookmarkToInbox(sourceCategoryIndex, sourceLinkIndex);
        }
    }

    // Favourite drag and drop
    setupFavouriteDragDrop() {
        document.querySelectorAll('.favourite-item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleFavouriteDragStart(e));
            item.addEventListener('dragend', (e) => this.handleFavouriteDragEnd(e));
            item.addEventListener('dragover', (e) => this.handleFavouriteDragOver(e));
            item.addEventListener('dragleave', (e) => this.handleFavouriteDragLeave(e));
            item.addEventListener('drop', (e) => this.handleFavouriteDrop(e));
        });
    }

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
        
        this.dashboard.moveFavouriteToPosition(draggedIndex, newIndex);
    }

    // Column drop zones
    setupColumnDropZones() {
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
        const draggedCategory = this.dashboard.categories[draggedCategoryIndex];
        
        if (!draggedCategory) return;
        
        // Don't do anything if dropping in the same position
        if (draggedCategory.column === targetColumn && draggedCategory.position === targetPosition) {
            return;
        }
        
        this.dashboard.moveCategoryToPosition(draggedCategoryIndex, targetColumn, targetPosition);
    }

    // Utility method to clean up drag visual feedback
    cleanupDragVisualFeedback() {
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
}