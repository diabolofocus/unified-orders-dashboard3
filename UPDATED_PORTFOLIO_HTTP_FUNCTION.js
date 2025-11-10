// backend/http-functions.js
// UPDATED Portfolio Site HTTP Function - Handles ALL app lifecycle events

import { ok, badRequest, serverError } from 'wix-http-functions';
import wixData from 'wix-data';

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Source',
    'Content-Type': 'application/json'
};

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

            // Site Information (null for APP_REMOVED)
            siteId: eventData.siteId || null,
            siteUrl: eventData.siteUrl || null,
            siteName: eventData.siteName || null,

            // Owner Information (null for APP_REMOVED)
            userEmail: eventData.ownerEmail || null,
            ownerId: eventData.ownerId || null,

            // Plan Information (for plan-related events)
            vendorProductId: eventData.vendorProductId || null,
            cycle: eventData.cycle || null,
            operationTimestamp: eventData.operationTimestamp ? new Date(eventData.operationTimestamp) : null,
            expiresOn: eventData.expiresOn ? new Date(eventData.expiresOn) : null,

            // Purchase/Change Information
            couponName: eventData.couponName || null,
            invoiceId: eventData.invoiceId || null,
            previousVendorProductId: eventData.previousVendorProductId || null,
            previousCycle: eventData.previousCycle || null,

            // Cancellation Information
            cancelReason: eventData.cancelReason || null,
            userReason: eventData.userReason || null,
            subscriptionCancellationType: eventData.subscriptionCancellationType || null,
            cancelledDuringFreeTrial: eventData.cancelledDuringFreeTrial || null,

            // Reactivation Information
            reactivationReason: eventData.reason || null,

            // Install Information
            originInstanceId: eventData.originInstanceId || null,

            // Identity Information
            identityType: eventData.identityType || null,
            wixUserId: eventData.wixUserId || null,
            memberId: eventData.memberId || null,

            // Log message for display
            installMessage: logMessage,

            // Full event data for debugging
            rawEventData: eventData.rawEventData || null,
            rawMetadata: eventData.rawMetadata || null
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
