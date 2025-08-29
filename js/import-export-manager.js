// Import/Export Manager - Handles bookmark import/export functionality
class ImportExportManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    // Export current shelf data to JSON
    exportBookmarks() {
        const currentShelf = this.dashboard.getCurrentShelf();
        const data = {
            shelfName: currentShelf.name,
            categories: this.dashboard.categories,
            favourites: this.dashboard.favourites,
            columnCount: this.dashboard.columnCount,
            showFavourites: this.dashboard.showFavourites,
            openLinksInNewTab: this.dashboard.openLinksInNewTab,
            exportDate: new Date().toISOString(),
            version: '2.0',
            isShelfExport: true
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const shelfName = currentShelf.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        a.download = `linkshelf-${shelfName}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.dashboard.showToast(`Shelf "${currentShelf.name}" exported successfully`, 'success');
    }

    // Export to Netscape bookmark format
    exportToNetscape() {
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
        this.dashboard.categories.forEach(category => {
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
        
        this.dashboard.showToast('Bookmarks exported to Netscape format successfully', 'success');
    }

    // Trigger import file dialog
    triggerImport() {
        document.getElementById('import-file').click();
    }

    // Trigger Papaly import file dialog
    triggerPapalyImport() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.html';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.importPapalyFile(file);
            document.body.removeChild(fileInput);
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    // Import Papaly format file
    async importPapalyFile(file) {
        try {
            const text = await file.text();
            console.log('Force-importing as Papaly format...');
            
            const importedData = this.parsePapalyBookmarks(text);
            
            // Create new shelf with imported data
            await this.createShelfFromImport(importedData, `Imported from ${file.name.replace(/\.[^/.]+$/, "")}`);
            
            this.dashboard.showToast(`Successfully imported ${importedData.categories.length} categories from Papaly`, 'success');
            
            // Fetch favicons for imported links
            setTimeout(() => this.fetchFaviconsForImportedData(), 1000);
        } catch (error) {
            console.error('Error importing Papaly file:', error);
            this.dashboard.showToast('Error importing Papaly file: ' + error.message, 'error');
        }
    }

    // Main import handler
    async importBookmarks(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            
            let importedData;
            let shelfName = null;
            
            if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<HTML') || text.trim().startsWith('<html')) {
                // HTML format - auto-detect Papaly vs standard Netscape
                importedData = this.parseHtmlBookmarks(text);
                shelfName = `Imported from ${file.name.replace(/\.[^/.]+$/, "")}`;
            } else {
                // JSON format (LinkShelf export)
                const data = JSON.parse(text);
                if (!data.categories || !Array.isArray(data.categories)) {
                    throw new Error('Invalid export file format');
                }
                
                shelfName = data.shelfName || `Imported from ${file.name.replace(/\.[^/.]+$/, "")}`;
                
                importedData = {
                    categories: data.categories,
                    favourites: data.favourites || [],
                    columnCount: data.columnCount || 3,
                    showFavourites: data.showFavourites !== false,
                    openLinksInNewTab: data.openLinksInNewTab !== false
                };
            }

            // Create new shelf with imported data
            await this.createShelfFromImport(importedData, shelfName);
            
            this.dashboard.showToast(`Successfully imported ${importedData.categories.length} categories as "${shelfName}"`, 'success');
            
            // Fetch favicons for imported links
            setTimeout(() => this.fetchFaviconsForImportedData(), 1000);
        } catch (error) {
            console.error('Error importing bookmarks:', error);
            this.dashboard.showToast('Error importing bookmarks: ' + error.message, 'error');
        }

        // Reset file input
        e.target.value = '';
    }

    // Create a new shelf from imported data
    async createShelfFromImport(importedData, shelfName) {
        const newShelf = {
            id: this.dashboard.generateId(),
            name: shelfName,
            categories: importedData.categories,
            favourites: importedData.favourites,
            columnCount: importedData.columnCount,
            showFavourites: importedData.showFavourites,
            openLinksInNewTab: importedData.openLinksInNewTab,
            createdAt: Date.now()
        };
        
        // Add the new shelf
        this.dashboard.shelves.push(newShelf);
        
        // Switch to the new shelf
        this.dashboard.currentShelfId = newShelf.id;
        this.dashboard.loadCurrentShelf();
        
        await this.dashboard.saveData();
        this.dashboard.renderDashboard();
        this.dashboard.closeModal('settings-modal');
    }

    // Parse HTML bookmarks (auto-detect format)
    parseHtmlBookmarks(htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        // Check for Papaly-style structure
        const allH3Elements = doc.querySelectorAll('H3');
        const rootDl = doc.querySelector('DL');
        
        if (rootDl) {
            const rootDtElements = Array.from(rootDl.children).filter(child => child.tagName === 'DT');
            
            // Papaly typically has one main container with everything nested inside
            if (rootDtElements.length === 1 && rootDtElements[0].querySelector('H3')?.textContent.includes('Board')) {
                console.log('Detected Papaly format - using Papaly parser');
                return this.parsePapalyBookmarks(htmlText);
            }
        }
        
        // Default to standard Netscape format
        console.log('Detected standard Netscape format - using Netscape parser');
        return this.parseNetscapeBookmarks(htmlText);
    }

    // Parse Papaly bookmark format
    parsePapalyBookmarks(htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        const categories = [];
        let linkCount = 0;
        
        const rootDl = doc.querySelector('DL');
        if (!rootDl) {
            return { categories: [], favourites: [], columnCount: 3, showFavourites: false, openLinksInNewTab: true };
        }
        
        const rootDtElements = Array.from(rootDl.children).filter(child => child.tagName === 'DT');
        
        rootDtElements.forEach((rootDt, index) => {
            const h3Element = rootDt.querySelector('H3');
            if (!h3Element) return;
            
            const containerName = h3Element.textContent.trim();
            const containerDl = rootDt.querySelector('DL');
            if (!containerDl) return;
            
            const containerChildren = Array.from(containerDl.children).filter(child => child.tagName === 'DT');
            
            containerChildren.forEach((childDt) => {
                const childH3 = childDt.querySelector('H3');
                const childA = childDt.querySelector('A');
                
                if (childH3) {
                    // This is a subcategory
                    const subcategoryName = childH3.textContent.trim();
                    let subcategoryDl = childDt.querySelector('DL');
                    
                    if (!subcategoryDl) {
                        subcategoryDl = childDt.nextElementSibling;
                        while (subcategoryDl && subcategoryDl.tagName !== 'DL') {
                            subcategoryDl = subcategoryDl.nextElementSibling;
                        }
                    }
                    
                    const subcategoryLinks = [];
                    const nestedSubcategories = [];
                    
                    if (subcategoryDl) {
                        const linkDts = Array.from(subcategoryDl.children).filter(child => child.tagName === 'DT');
                        
                        linkDts.forEach((linkDt) => {
                            const linkA = linkDt.querySelector('A');
                            const nestedH3 = linkDt.querySelector('H3');
                            
                            if (nestedH3 && !linkA) {
                                // Nested subcategory
                                const nestedSubcategoryName = nestedH3.textContent.trim();
                                let nestedDl = linkDt.querySelector('DL');
                                if (!nestedDl) {
                                    nestedDl = linkDt.nextElementSibling;
                                    while (nestedDl && nestedDl.tagName !== 'DL') {
                                        nestedDl = nestedDl.nextElementSibling;
                                    }
                                }
                                
                                const nestedLinks = [];
                                if (nestedDl) {
                                    const nestedLinkDts = Array.from(nestedDl.children).filter(child => child.tagName === 'DT');
                                    nestedLinkDts.forEach(nestedLinkDt => {
                                        const nestedLinkA = nestedLinkDt.querySelector('A');
                                        if (nestedLinkA) {
                                            const nestedLink = this.parseLink(nestedLinkA);
                                            if (nestedLink) {
                                                nestedLinks.push(nestedLink);
                                                linkCount++;
                                            }
                                        }
                                    });
                                }
                                
                                nestedSubcategories.push({
                                    id: `subcategory_${Date.now()}_${Math.random()}`,
                                    name: nestedSubcategoryName,
                                    links: nestedLinks,
                                    collapsed: false
                                });
                                
                            } else if (linkA && !nestedH3) {
                                // Direct link in subcategory
                                const link = this.parseLink(linkA);
                                if (link) {
                                    subcategoryLinks.push(link);
                                    linkCount++;
                                }
                            }
                        });
                    }
                    
                    // Create category for each subcategory
                    categories.push({
                        id: `category_${Date.now()}_${Math.random()}`,
                        name: subcategoryName,
                        links: subcategoryLinks,
                        subcategories: nestedSubcategories,
                        bookmarks: []
                    });
                    
                } else if (childA) {
                    // Direct link under container
                    const link = this.parseLink(childA);
                    if (link) {
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
        
        return {
            categories: categories,
            favourites: [],
            columnCount: 3,
            showFavourites: false,
            openLinksInNewTab: true
        };
    }

    // Parse standard Netscape bookmark format
    parseNetscapeBookmarks(htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        const categories = [];
        let linkCount = 0;
        
        const rootDl = doc.querySelector('DL');
        if (!rootDl) {
            return { categories: [], favourites: [], columnCount: 3, showFavourites: false, openLinksInNewTab: true };
        }
        
        const processFolder = (dlElement, folderName = null, isTopLevel = true) => {
            const folderLinks = [];
            const folderSubcategories = [];
            
            const dtElements = Array.from(dlElement.children).filter(child => child.tagName === 'DT');
            
            dtElements.forEach((dt) => {
                const h3Element = dt.querySelector('H3');
                const aElement = dt.querySelector('A');
                
                if (h3Element && !aElement) {
                    // This is a subfolder
                    const subfolderName = h3Element.textContent.trim();
                    if (!subfolderName) return;
                    
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
        
        return {
            categories: categories,
            favourites: [],
            columnCount: 3,
            showFavourites: false,
            openLinksInNewTab: true
        };
    }

    // Parse individual link element
    parseLink(aElement) {
        const url = aElement.getAttribute('HREF') || aElement.getAttribute('href');
        const name = aElement.textContent.trim();
        
        if (!url || !name) return null;
        
        return {
            id: `link_${Date.now()}_${Math.random()}`,
            name: name,
            url: url,
            customFaviconUrl: ''
        };
    }

    // Fetch favicons for imported data
    async fetchFaviconsForImportedData() {
        const linksToFetch = [];
        
        // Collect all links that don't have faviconData
        this.dashboard.categories.forEach((category, categoryIndex) => {
            // Category top-level links
            if (category.links) {
                category.links.forEach((link, linkIndex) => {
                    if (!link.faviconData) {
                        linksToFetch.push({
                            link: link,
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
        
        if (linksToFetch.length === 0) return;
        
        console.log(`Fetching favicons for ${linksToFetch.length} imported links...`);
        this.dashboard.showToast(`Fetching favicons for ${linksToFetch.length} links...`, 'info');
        
        let fetchedCount = 0;
        let errorCount = 0;
        
        // Process links in batches to avoid overwhelming the server
        const batchSize = 5;
        for (let i = 0; i < linksToFetch.length; i += batchSize) {
            const batch = linksToFetch.slice(i, i + batchSize);
            
            await Promise.allSettled(batch.map(async (item) => {
                try {
                    const faviconData = await this.dashboard.fetchFaviconAsDataUrl(item.link.url);
                    
                    // Update the link with the fetched favicon
                    if (item.location === 'category') {
                        const linksArray = this.dashboard.categories[item.categoryIndex].links || this.dashboard.categories[item.categoryIndex].bookmarks;
                        linksArray[item.linkIndex].faviconData = faviconData;
                    } else if (item.location === 'subcategory') {
                        this.dashboard.categories[item.categoryIndex].subcategories[item.subcategoryIndex].links[item.linkIndex].faviconData = faviconData;
                    }
                    
                    fetchedCount++;
                } catch (error) {
                    errorCount++;
                    console.warn(`Failed to fetch favicon for ${item.link.name}:`, error.message);
                }
            }));
            
            // Small delay between batches
            if (i + batchSize < linksToFetch.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Update progress every batch
            const progress = Math.round(((i + batchSize) / linksToFetch.length) * 100);
            this.dashboard.showToast(`Fetching favicons... ${Math.min(progress, 100)}% complete`, 'info');
        }
        
        // Save the updated data
        await this.dashboard.saveData();
        this.dashboard.renderDashboard();
        
        // Show completion message
        if (errorCount > 0) {
            this.dashboard.showToast(`Favicon fetching complete! ✓ ${fetchedCount} succeeded, ✗ ${errorCount} failed`, 'success');
        } else {
            this.dashboard.showToast(`Successfully fetched ${fetchedCount} favicons! 🎉`, 'success');
        }
    }

    // HTML escape helper
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
}