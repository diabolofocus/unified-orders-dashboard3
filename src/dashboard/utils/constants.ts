// utils/constants.ts
import type { ShippingCarrier } from '../types/UI';
import type { CSSProperties } from 'react';
// At the top of utils/constants.ts, add this import:
import type { SystemInfo, UserInfo, ValidationResult } from '../types/Support';
import type { SupportUIState, ToastConfig } from '../types/UI';



// Then your existing constants...


export const SHIPPING_CARRIERS: ShippingCarrier[] = [
    { id: 'dhl', value: 'DHL' },
    { id: 'ups', value: 'UPS' },
    { id: 'fedex', value: 'FedEx' },
    { id: 'usps', value: 'USPS' },
];

// App Configuration
export const APP_CONFIG = {
    // App Information
    APP_VERSION: '0.0',
    APP_NAME: 'Express Orders Management',
    APP_ID: 'orders-dashboard-app',
    DEVELOPER_EMAIL: 'info@karpo.studio',
    DEVELOPER_WEBSITE: 'https://karpo.studio',

    COLLECTIONS: {
        FEATURE_REQUESTS: 'featureRequests',
        BUG_REPORTS: 'bugReports'
    },

    // Dashboard Page IDs
    PAGES: {
        ORDERS: '1702fa3a-de5c-44c4-8e64-27737b4d8c2f',
        SETTINGS: 'd9440702-f4b0-4ee4-93e5-734bc6f6e9d1',
        SUPPORT: 'ad6c9a26-e543-4546-9065-76ae53911cd5'
    },

    // API Endpoints
    API: {
        WIX_DATA_BASE: 'https://www.wixapis.com/wix-data/v1',
        WIX_COLLECTIONS_BASE: 'https://www.wixapis.com/wix-data/v2/collections',
        SITE_PROPERTIES: 'https://www.wixapis.com/site-properties/v4/properties'
    },

    // Validation Rules
    VALIDATION: {
        MIN_TITLE_LENGTH: 5,
        MAX_TITLE_LENGTH: 100,
        MIN_DESCRIPTION_LENGTH: 20,
        MAX_DESCRIPTION_LENGTH: 5000
    },

    // Toast Messages
    MESSAGES: {
        SUCCESS: {
            FEATURE_SUBMITTED: 'Feature request submitted successfully!',
            BUG_SUBMITTED: 'Bug report submitted successfully!'
        },
        ERROR: {
            FEATURE_FAILED: 'Failed to submit feature request. Please try again.',
            BUG_FAILED: 'Failed to submit bug report. Please try again.',
            NETWORK_ERROR: 'Network error. Please check your connection and try again.',
            VALIDATION_ERROR: 'Please fill in all required fields.'
        }
    }
} as const;

// Support Form Templates
export const SUPPORT_TEMPLATES = {
    BUG_REPORT_SECTIONS: {
        SYSTEM_INFO: '--- SYSTEM INFORMATION ---',
        BUG_DETAILS: '--- BUG DETAILS ---',
        USER_DESCRIPTION: '--- DESCRIPTION ---'
    },
    FEATURE_REQUEST_SECTIONS: {
        SYSTEM_INFO: '--- SYSTEM INFORMATION ---',
        FEATURE_REQUEST: '--- FEATURE REQUEST ---',
        USER_DESCRIPTION: '--- DESCRIPTION ---'
    }
} as const;

// Product Image Styles
export const IMAGE_CONTAINER_STYLE: CSSProperties = {
    width: '80px',
    height: '60px',
    borderRadius: '4px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 0.2s ease-in-out',
} as const;

export const PLACEHOLDER_STYLE: CSSProperties = {
    ...IMAGE_CONTAINER_STYLE,
    backgroundColor: '#e5e7eb',
    border: '1px solid #d1d5db',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
} as const;

export const IMAGE_STYLE: CSSProperties = {
    width: '80px',
    height: '60px',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
} as const;

export const DEMO_ORDERS = [
    {
        _id: "demo_10003",
        number: "10003",
        _createdDate: "2025-05-27T21:44:00.000Z",
        customer: {
            firstName: "Demo",
            lastName: "Customer",
            email: "demo@example.com",
            phone: "+1-555-0123",
            company: "Demo Company LLC"
        },
        items: [{ name: "Test Product", quantity: 1, price: "$16.00", image: "", weight: 0, options: {} }],
        totalWeight: 0,
        total: "$16.00",
        status: "NOT_FULFILLED" as const,
        paymentStatus: "PAID" as const,
        shippingInfo: {
            carrierId: "dhl",
            title: "DHL Express",
            cost: "$12.50"
        },
        weightUnit: "KG",
        shippingAddress: null,
        rawOrder: {}
    }
];

// Utility Functions for Support System
export function collectSystemInfo(): SystemInfo {
    return {
        appVersion: APP_CONFIG.APP_VERSION,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrer: document.referrer || 'Direct',
        currentUrl: window.location.href
    };
}

export function generateBugReportTemplate(systemInfo: SystemInfo, userInfo?: UserInfo): string {
    return `${SUPPORT_TEMPLATES.BUG_REPORT_SECTIONS.SYSTEM_INFO}
App: ${APP_CONFIG.APP_NAME} v${systemInfo.appVersion}
Timestamp: ${systemInfo.timestamp}
User Agent: ${systemInfo.userAgent}
Language: ${systemInfo.language}
Platform: ${systemInfo.platform}
Screen: ${systemInfo.screenResolution}
Time Zone: ${systemInfo.timeZone}
Online: ${systemInfo.onLine ? 'Yes' : 'No'}
Cookies: ${systemInfo.cookieEnabled ? 'Enabled' : 'Disabled'}

Site ID: ${userInfo?.siteId || 'Not available'}
User Email: ${userInfo?.email || 'Not available'}
Current URL: ${systemInfo.currentUrl}
Referrer: ${systemInfo.referrer}

${SUPPORT_TEMPLATES.BUG_REPORT_SECTIONS.BUG_DETAILS}
Steps to reproduce:
1. 
2. 
3. 

Expected behavior:


Actual behavior:


Error messages (if any):


Additional context:


${SUPPORT_TEMPLATES.BUG_REPORT_SECTIONS.USER_DESCRIPTION}
`;
}

export function generateFeatureRequestTemplate(systemInfo: SystemInfo, userInfo?: UserInfo): string {
    return `${SUPPORT_TEMPLATES.FEATURE_REQUEST_SECTIONS.SYSTEM_INFO}
App: ${APP_CONFIG.APP_NAME} v${systemInfo.appVersion}
Timestamp: ${systemInfo.timestamp}
Site ID: ${userInfo?.siteId || 'Not available'}
User Email: ${userInfo?.email || 'Not available'}

${SUPPORT_TEMPLATES.FEATURE_REQUEST_SECTIONS.FEATURE_REQUEST}
Use case:


Expected functionality:


Why is this important:


Similar features in other tools:


Priority level (Low/Medium/High):


${SUPPORT_TEMPLATES.FEATURE_REQUEST_SECTIONS.USER_DESCRIPTION}
`;
}

export function validateSubmission(title: string, description: string): string[] {
    const errors: string[] = [];

    if (!title.trim()) {
        errors.push('Title is required');
    } else if (title.length < APP_CONFIG.VALIDATION.MIN_TITLE_LENGTH) {
        errors.push(`Title must be at least ${APP_CONFIG.VALIDATION.MIN_TITLE_LENGTH} characters`);
    } else if (title.length > APP_CONFIG.VALIDATION.MAX_TITLE_LENGTH) {
        errors.push(`Title must be less than ${APP_CONFIG.VALIDATION.MAX_TITLE_LENGTH} characters`);
    }

    if (!description.trim()) {
        errors.push('Description is required');
    } else if (description.length < APP_CONFIG.VALIDATION.MIN_DESCRIPTION_LENGTH) {
        errors.push(`Description must be at least ${APP_CONFIG.VALIDATION.MIN_DESCRIPTION_LENGTH} characters`);
    } else if (description.length > APP_CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH) {
        errors.push(`Description must be less than ${APP_CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH} characters`);
    }

    return errors;
}