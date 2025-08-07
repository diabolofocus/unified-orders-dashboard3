// utils/get-siteId.ts - Improved version with better URL detection
export const getCurrentSiteId = (): string | null => {
    const url = window.location.href;

    const patterns = [
        /dashboard\/([a-f0-9-]{36})/i,
        /siteId[=:]([a-f0-9-]{36})/i,
        /metasiteId[=:]([a-f0-9-]{36})/i,
        /sites\/([a-f0-9-]{36})/i,
        /apps\/([a-f0-9-]{36})/i,
        /[?&](?:siteId|metasiteId|site)[=]([a-f0-9-]{36})/i,
        /#.*(?:siteId|metasiteId|site)[=:]([a-f0-9-]{36})/i
    ];

    for (let i = 0; i < patterns.length; i++) {
        const match = url.match(patterns[i]);
        if (match && match[1]) {
            return match[1];
        }
    }

    const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const uuidMatch = url.match(uuidPattern);

    if (uuidMatch && uuidMatch[1]) {
        return uuidMatch[1];
    }

    return null;
};

export const getSiteIdFromContext = (): string | null => {
    let siteId = getCurrentSiteId();
    if (siteId) return siteId;

    const storedSiteId = localStorage.getItem('wix-site-id') ||
        localStorage.getItem('siteId') ||
        localStorage.getItem('metasiteId');
    if (storedSiteId) {
        return storedSiteId;
    }

    const sessionSiteId = sessionStorage.getItem('wix-site-id') ||
        sessionStorage.getItem('siteId') ||
        sessionStorage.getItem('metasiteId');
    if (sessionSiteId) {
        return sessionSiteId;
    }

    if (typeof window !== 'undefined') {
        const wixGlobals = (window as any);
        const globalSiteId = wixGlobals.siteId ||
            wixGlobals.metasiteId ||
            wixGlobals.SITE_ID ||
            wixGlobals.META_SITE_ID;
        if (globalSiteId) {
// Debug log removed
            return globalSiteId;
        }
    }

    return null;
};
