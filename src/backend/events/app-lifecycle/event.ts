import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';

// Unified webhook URL for your portfolio site
const PORTFOLIO_WEBHOOK_URL = 'https://karpo.studio/_functions/appInstanceEvent';

/**
 * Helper function to send event data to portfolio site
 */
async function sendToPortfolio(eventType: string, event: any, metadata: any): Promise<void> {
  try {
    // Extract data from event
    const eventData = event.data || {};

    let appInstanceData = null;

    // Try to fetch app instance details with elevated permissions
    // This will fail for APP_REMOVED (already uninstalled)
    if (eventType !== 'APP_REMOVED') {
      try {
        const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
        appInstanceData = await elevatedGetAppInstance();
      } catch (error) {
        // If we can't get app instance, continue with event data only
      }
    }

    const payload = {
      eventType,
      instanceId: metadata.instanceId,
      appId: eventData.appId || 'aeb5e016-2505-4705-b39f-7724f4845fbd',
      appName: 'Unified Orders Dashboard',
      timestamp: new Date().toISOString(),

      // Site information (only available when we can fetch app instance)
      siteId: appInstanceData?.site?.siteId || null,
      siteUrl: appInstanceData?.site?.url || null,
      siteName: appInstanceData?.site?.siteDisplayName || null,

      // Owner information (only available when we can fetch app instance)
      ownerEmail: appInstanceData?.site?.ownerInfo?.email || null,
      ownerId: appInstanceData?.site?.siteId || null,

      // Plan event specific fields
      vendorProductId: eventData.vendorProductId || null,
      cycle: eventData.cycle || null,
      operationTimestamp: eventData.operationTimeStamp || null,
      expiresOn: eventData.expiresOn || null,

      // Purchase/Change specific fields
      couponName: eventData.couponName || null,
      invoiceId: eventData.invoiceId || null,
      previousVendorProductId: eventData.previousVendorProductId || null,
      previousCycle: eventData.previousCycle || null,

      // Cancellation specific fields
      cancelReason: eventData.cancelReason || null,
      userReason: eventData.userReason || null,
      subscriptionCancellationType: eventData.subscriptionCancellationType || null,
      cancelledDuringFreeTrial: eventData.cancelledDuringFreeTrial || null,

      // Reactivation specific fields
      reason: eventData.reason || null,

      // Origin instance (for APP_INSTALLED)
      originInstanceId: eventData.originInstanceId || null,

      // Identity information from metadata
      identityType: metadata.identity?.identityType || null,
      wixUserId: metadata.identity?.wixUserId || null,
      memberId: metadata.identity?.memberId || null,

      // Full event data for debugging
      rawEventData: JSON.stringify(eventData),
      rawMetadata: JSON.stringify(metadata)
    };

    const response = await fetch(PORTFOLIO_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Source': 'Unified-Orders-Dashboard'
      },
      body: JSON.stringify(payload)
    });

    // Optionally handle response errors silently
    if (!response.ok) {
      // Portfolio webhook failed - could log to monitoring service
    }
  } catch (error: any) {
    // Event handler error - could log to monitoring service
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
