// ============================================
// UNIFIED APP INSTANCE EVENT HANDLER
// Place this in your portfolio site: backend/http-functions.js
// ============================================

import { ok, badRequest, serverError } from 'wix-http-functions';
import wixData from 'wix-data';

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Source',
    'Content-Type': 'application/json'
};

// Debug mode - set to false to disable verbose logging
const DEBUG_MODE = true;

// Helper function for conditional logging
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

/**
 * Unified App Instance Event Handler
 * Captures ALL app lifecycle events from ALL your apps
 */
export async function post_appInstanceEvent(request) {
    try {
        const eventData = await request.body.json();

        debugLog('=== APP INSTANCE EVENT RECEIVED ===');
        debugLog('Event Type:', eventData.eventType);
        debugLog('Instance ID:', eventData.instanceId);
        debugLog('App Name:', eventData.appName);

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

        // Create a comprehensive log message
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

        debugLog('Inserting into AppInstallations collection...');

        // Save to database
        const result = await wixData.insert('AppInstallations', installData);

        console.log(`✓ ${logMessage}`);
        debugLog('Database record ID:', result._id);

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

        return serverError({
            body: JSON.stringify({
                success: false,
                error: error.message
            }),
            headers: corsHeaders
        });
    }
}

/**
 * OPTIONS handler for CORS
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
