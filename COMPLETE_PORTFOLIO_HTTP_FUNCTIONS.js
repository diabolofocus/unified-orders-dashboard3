// backend/http-functions.js
// Complete Portfolio Site HTTP Functions
// This file contains ALL endpoints for your portfolio site

import { ok, badRequest, serverError } from 'wix-http-functions';
import wixData from 'wix-data';

// ============================================
// SHARED CONFIGURATION
// ============================================

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Source',
    'Content-Type': 'application/json'
};

// Debug mode - set to true to enable verbose logging
const DEBUG_MODE = true;

// Helper function for conditional logging
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

// ============================================
// APP INSTANCE EVENT HANDLER
// Endpoint: /_functions/appInstanceEvent
// ============================================

/**
 * Unified App Instance Event Handler
 * Captures ALL app lifecycle events from ALL your apps
 */
export async function post_appInstanceEvent(request) {
    console.log('=== APP INSTANCE EVENT HANDLER CALLED ===');

    try {
        const eventData = await request.body.json();

        console.log('=== APP INSTANCE EVENT RECEIVED ===');
        console.log('Event Type:', eventData.eventType);
        console.log('Instance ID:', eventData.instanceId);
        console.log('App Name:', eventData.appName);
        console.log('Owner Email:', eventData.ownerEmail);

        // Validate required fields
        if (!eventData.eventType || !eventData.instanceId) {
            console.error('Missing required fields');
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields: eventType or instanceId'
                }),
                headers: corsHeaders
            });
        }

        // Map event type to human-readable description
        const eventDescriptions = {
            'APP_INSTALLED': 'App Installed',
            'APP_REMOVED': 'App Removed/Uninstalled',
            'PAID_PLAN_PURCHASED': 'Paid Plan Purchased',
            'PAID_PLAN_CHANGED': 'Paid Plan Changed (Upgrade/Downgrade)',
            'PLAN_CONVERTED_TO_PAID': 'Free Trial Converted to Paid',
            'PLAN_REACTIVATED': 'Plan Reactivated (Auto-renewal turned on)',
            'PAID_PLAN_AUTO_RENEWAL_CANCELLED': 'Auto-renewal Cancelled',
            'PLAN_TRANSFERRED': 'Plan Transferred to Different Account'
        };

        const eventDescription = eventDescriptions[eventData.eventType] || eventData.eventType;
        const logMessage = `${eventDescription} - ${eventData.appName} (Instance: ${eventData.instanceId})`;

        // Prepare data for AppInstallations collection
        const installData = {
            // Event Information
            eventType: eventData.eventType,
            eventDescription: eventDescription,
            eventTimestamp: new Date(eventData.timestamp),

            // App Information
            appDefId: eventData.appId,
            appName: eventData.appName,
            instanceId: eventData.instanceId,

            // Site Information
            siteId: eventData.siteId || 'N/A',
            siteUrl: eventData.siteUrl || 'N/A',
            siteName: eventData.siteName || 'N/A',

            // Owner Information
            userEmail: eventData.ownerEmail || 'N/A',
            ownerId: eventData.ownerId || 'N/A',

            // Plan Information (if applicable)
            planId: eventData.planId || null,
            planName: eventData.planName || null,
            planVendorId: eventData.planVendorId || null,
            isFree: eventData.isFree !== null ? eventData.isFree : null,

            // Log message for display
            installMessage: logMessage,

            // Full event data for debugging
            rawPayload: JSON.stringify(eventData)
        };

        console.log('=== ATTEMPTING TO INSERT INTO DATABASE ===');
        console.log('Data to insert:', JSON.stringify(installData, null, 2));

        // Save to database
        const result = await wixData.insert('AppInstallations', installData);

        console.log('=== SUCCESS! ===');
        console.log(`✓ ${logMessage}`);
        console.log('Database record ID:', result._id);

        return ok({
            body: JSON.stringify({
                success: true,
                message: 'Event recorded successfully',
                itemId: result._id,
                eventType: eventData.eventType
            }),
            headers: corsHeaders
        });

    } catch (error) {
        console.error('=== ERROR HANDLING APP INSTANCE EVENT ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);

        return serverError({
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            }),
            headers: corsHeaders
        });
    }
}

/**
 * OPTIONS handler for CORS preflight
 */
export function options_appInstanceEvent(request) {
    console.log('OPTIONS request for CORS preflight');
    return ok({
        headers: corsHeaders
    });
}

/**
 * GET handler for testing endpoint
 */
export function get_appInstanceEvent(request) {
    console.log('GET request - testing endpoint');
    return ok({
        body: JSON.stringify({
            success: true,
            message: 'App Instance Event endpoint is working!',
            timestamp: new Date().toISOString(),
            supportedEvents: [
                'APP_INSTALLED',
                'APP_REMOVED',
                'PAID_PLAN_PURCHASED',
                'PAID_PLAN_CHANGED',
                'PLAN_CONVERTED_TO_PAID',
                'PLAN_REACTIVATED',
                'PAID_PLAN_AUTO_RENEWAL_CANCELLED',
                'PLAN_TRANSFERRED'
            ]
        }),
        headers: corsHeaders
    });
}

// ============================================
// SUPPORT SUBMISSION HANDLER (Bug Reports & Feature Requests)
// Endpoint: /_functions/supportSubmission
// ============================================

/**
 * Extract reproduction steps from bug report description
 */
function extractReproductionSteps(description) {
    if (!description || typeof description !== 'string') return '';

    const startMarker = 'Steps to reproduce:';
    const endMarker = 'Expected behavior:';

    const startIndex = description.indexOf(startMarker);
    const endIndex = description.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        return '';
    }

    return description
        .substring(startIndex + startMarker.length, endIndex)
        .trim()
        .replace(/^\d+\.\s*/gm, '')
        .replace(/\n\s*\n/g, '\n');
}

/**
 * Extract error log from bug report description
 */
function extractErrorLog(description) {
    if (!description || typeof description !== 'string') return '';

    const startMarker = 'Error messages (if any):';
    const endMarker = '--- DESCRIPTION ---';

    const startIndex = description.indexOf(startMarker);
    const endIndex = description.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        return '';
    }

    return description
        .substring(startIndex + startMarker.length, endIndex)
        .trim();
}

/**
 * Format browser/system information
 */
function formatBrowserInfo(systemInfo, userInfo) {
    if (!systemInfo) return '';

    return `App Name: ${userInfo?.appName || 'Not available'}
App Version: ${userInfo?.appVersion || 'Unknown'}
App Plan: ${userInfo?.isFree !== undefined ? (userInfo.isFree ? 'Free' : 'Paid') : 'Unknown'}
Instance ID: ${userInfo?.instanceId || 'Not available'}

Site Name: ${userInfo?.name || 'Not available'}
Site ID: ${userInfo?.siteId || 'Not available'}
Site URL: ${userInfo?.siteUrl || 'Not available'}
User Email: ${userInfo?.email || 'Not available'}

Timestamp: ${systemInfo.timestamp || ''}
User Agent: ${systemInfo.userAgent || ''}
Language: ${systemInfo.language || ''}
Platform: ${systemInfo.platform || ''}
Screen: ${systemInfo.screenResolution || ''}
Time Zone: ${systemInfo.timeZone || ''}
Online: ${systemInfo.onLine ? 'Yes' : 'No'}
Cookies: ${systemInfo.cookieEnabled ? 'Enabled' : 'Disabled'}

Referrer: ${systemInfo.referrer || ''}`;
}

/**
 * Handle support submissions (bug reports and feature requests)
 */
export async function post_supportSubmission(request) {
    console.log('=== SUPPORT SUBMISSION RECEIVED ===');

    try {
        const data = await request.body.json();
        console.log('Data received - Type:', data.type, '- Title:', data.title);

        // Validate
        if (!data.title || !data.description || !data.type) {
            console.log('Missing required fields');
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields: title, description, or type'
                }),
                headers: corsHeaders
            });
        }

        // Choose collection
        const collectionId = data.type === 'bug-report' ? 'bug-reports' : 'feature-requests';
        console.log('Using collection:', collectionId);

        // Prepare item
        const itemToInsert = {
            title: data.title,
            description: data.description,
            userEmail: data.userInfo?.email || data.userEmail || 'Not provided',
            userName: data.userName || 'Not provided',
            siteId: data.userInfo?.siteId || 'Not available',
            siteUrl: data.userInfo?.siteUrl || 'Not available',
            appVersion: data.userInfo?.appVersion || 'Unknown',
            browserInfo: formatBrowserInfo(data.systemInfo, data.userInfo),
            status: data.type === 'bug-report' ? 'open' : 'pending',
            submittedAt: new Date().toISOString()
        };

        // Add type-specific fields
        if (data.type === 'bug-report') {
            itemToInsert.severity = 'medium';
            itemToInsert.currentPage = data.systemInfo?.currentUrl || '';
            itemToInsert.reproductionSteps = extractReproductionSteps(data.description);
            itemToInsert.errorLog = extractErrorLog(data.description);
        } else {
            itemToInsert.priority = 'medium';
        }

        console.log('Inserting into collection:', collectionId);

        // Insert data
        const result = await wixData.insert(collectionId, itemToInsert);

        console.log('=== SUCCESS! ===');
        console.log('Item ID:', result._id);

        return ok({
            body: JSON.stringify({
                success: true,
                message: 'Submission received successfully!',
                itemId: result._id,
                collection: collectionId
            }),
            headers: corsHeaders
        });

    } catch (error) {
        console.error('=== ERROR PROCESSING SUPPORT SUBMISSION ===');
        console.error('Error:', error.message);

        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Server error: ' + error.message
            }),
            headers: corsHeaders
        });
    }
}

/**
 * OPTIONS handler for CORS
 */
export function options_supportSubmission(request) {
    console.log('OPTIONS request for CORS preflight - supportSubmission');
    return ok({
        headers: corsHeaders
    });
}

/**
 * GET handler for testing endpoint
 */
export function get_supportSubmission(request) {
    console.log('GET request - testing supportSubmission endpoint');
    return ok({
        body: JSON.stringify({
            success: true,
            message: 'Support submission endpoint is working!',
            timestamp: new Date().toISOString(),
            supportedTypes: ['bug-report', 'feature-request']
        }),
        headers: corsHeaders
    });
}
