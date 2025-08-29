// Favicon Manager - Handles favicon fetching and caching
class FaviconManager {
    constructor() {
        this.cache = new Map();
    }

    // Main favicon fetching method
    async fetchFaviconAsDataUrl(url) {
        const parsedUrl = new URL(url);
        
        // Check cache first
        const cacheKey = this.getCacheKey(parsedUrl);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // If the URL has a specific path/filename, treat it as a direct favicon URL
        if (parsedUrl.pathname !== '/' && (parsedUrl.pathname.endsWith('.ico') || 
                                          parsedUrl.pathname.endsWith('.png') || 
                                          parsedUrl.pathname.endsWith('.jpg') || 
                                          parsedUrl.pathname.endsWith('.jpeg') || 
                                          parsedUrl.pathname.endsWith('.gif') || 
                                          parsedUrl.pathname.endsWith('.svg'))) {
            // Direct favicon URL provided
            const result = await this.tryFetchFavicon(url);
            this.cache.set(cacheKey, result);
            return result;
        }
        
        // Check for special Google services and provide specific favicons
        const googleFaviconUrl = this.getGoogleServiceFavicon(parsedUrl);
        if (googleFaviconUrl) {
            try {
                const result = await this.tryFetchFavicon(googleFaviconUrl);
                this.cache.set(cacheKey, result);
                return result;
            } catch (error) {
                console.warn('Google service favicon failed, falling back to domain favicon:', error.message);
            }
        }
        
        // Try domain favicon with fallback to parent domain
        const domains = this.getDomainFallbackChain(parsedUrl);
        
        for (const domain of domains) {
            try {
                const faviconUrl = `${domain}/favicon.ico`;
                const result = await this.tryFetchFavicon(faviconUrl);
                this.cache.set(cacheKey, result);
                return result;
            } catch (error) {
                console.warn(`Failed to fetch favicon from ${domain}:`, error.message);
                // Continue to next domain in fallback chain
            }
        }
        
        // If all attempts failed, throw error
        throw new Error(`Could not fetch favicon from any domain in chain: ${domains.join(', ')}`);
    }

    // Get cache key for URL
    getCacheKey(parsedUrl) {
        return parsedUrl.hostname;
    }

    // Get Google service specific favicon
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

    // Get domain fallback chain
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

    // Try to fetch favicon from URL
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

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Get cache size
    getCacheSize() {
        return this.cache.size;
    }

    // Remove specific item from cache
    removeFromCache(url) {
        try {
            const parsedUrl = new URL(url);
            const cacheKey = this.getCacheKey(parsedUrl);
            return this.cache.delete(cacheKey);
        } catch (error) {
            console.warn('Failed to remove from cache:', error);
            return false;
        }
    }

    // Get all cached domains
    getCachedDomains() {
        return Array.from(this.cache.keys());
    }
}