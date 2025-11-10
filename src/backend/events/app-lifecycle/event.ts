import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';

// Unified webhook URL for your portfolio site
const PORTFOLIO_WEBHOOK_URL = 'https://karpo.studio/_functions/appInstanceEvent';

/**
 * Helper function to send event data to portfolio site
 */
async function sendToPortfolio(eventType: string, event: any, metadata: any): Promise<void> {
  try {
    console.log(`=== ${eventType} EVENT ===`);
    console.log('Event data:', JSON.stringify(event, null, 2));
    console.log('Metadata:', JSON.stringify(metadata, null, 2));

    // Get app instance details with owner email using elevated permissions
    const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
    const appInstanceData = await elevatedGetAppInstance();

    const payload = {
      eventType,
      instanceId: metadata.instanceId || event.instanceId,
      appId: 'aeb5e016-2505-4705-b39f-7724f4845fbd',
      appName: 'Unified Orders Dashboard',
      timestamp: new Date().toISOString(),

      // Site information
      siteId: appInstanceData.site?.siteId || 'N/A',
      siteUrl: appInstanceData.site?.url || 'N/A',
      siteName: appInstanceData.site?.siteDisplayName || 'N/A',

      // Owner information
      ownerEmail: appInstanceData.site?.ownerInfo?.email || 'N/A',
      ownerId: appInstanceData.site?.siteId || 'N/A', // Using siteId as owner identifier

      // Plan information (if available)
      planId: event.plan?.planId || null,
      planName: event.plan?.planName || null,
      planVendorId: event.plan?.planVendorId || null,
      isFree: event.plan?.isFree !== undefined ? event.plan.isFree : null,

      // Additional event data
      eventData: event,
      eventMetadata: metadata
    };

    console.log('Sending to portfolio:', JSON.stringify(payload, null, 2));

    const response = await fetch(PORTFOLIO_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Source': 'Unified-Orders-Dashboard'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(`Portfolio response (${response.status}):`, JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error(`Portfolio webhook failed with status ${response.status}`);
    }
  } catch (error: any) {
    console.error(`=== ERROR IN ${eventType} HANDLER ===`);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

// ============================================
// APP INSTANCE LIFECYCLE EVENTS
// ============================================

/**
 * Triggered when app is installed on a site
 */
appInstances.onAppInstanceInstalled(async (event) => {
  await sendToPortfolio('APP_INSTALLED', event, event.metadata);
});

/**
 * Triggered when app is removed/uninstalled from a site
 */
appInstances.onAppInstanceRemoved(async (event) => {
  await sendToPortfolio('APP_REMOVED', event, event.metadata);
});

// ============================================
// PLAN LIFECYCLE EVENTS
// ============================================

/**
 * Triggered when user purchases a paid plan
 */
appInstances.onAppInstancePaidPlanPurchased(async (event) => {
  await sendToPortfolio('PAID_PLAN_PURCHASED', event, event.metadata);
});

/**
 * Triggered when user upgrades or downgrades their plan
 */
appInstances.onAppInstancePaidPlanChanged(async (event) => {
  await sendToPortfolio('PAID_PLAN_CHANGED', event, event.metadata);
});

/**
 * Triggered when free trial ends and user is charged
 */
appInstances.onAppInstancePlanConvertedToPaid(async (event) => {
  await sendToPortfolio('PLAN_CONVERTED_TO_PAID', event, event.metadata);
});

/**
 * Triggered when auto-renewal is turned on
 */
appInstances.onAppInstancePlanReactivated(async (event) => {
  await sendToPortfolio('PLAN_REACTIVATED', event, event.metadata);
});

/**
 * Triggered when auto-renewal is cancelled
 */
appInstances.onAppInstancePaidPlanAutoRenewalCancelled(async (event) => {
  await sendToPortfolio('PAID_PLAN_AUTO_RENEWAL_CANCELLED', event, event.metadata);
});

/**
 * Triggered when plan is transferred to different Wix account
 */
appInstances.onAppInstancePlanTransferred(async (event) => {
  await sendToPortfolio('PLAN_TRANSFERRED', event, event.metadata);
});
