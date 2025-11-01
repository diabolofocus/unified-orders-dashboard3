// src/backend/app-instance.web.ts - App instance and premium plan checking

import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';

// The appDefId is not returned by the Wix API, so we need to hardcode it from wix.config.json
// This is your app's unique identifier from the Wix App Dashboard
const APP_DEF_ID = 'aeb5e016-2505-4705-b39f-7724f4845fbd';

/**
 * Response interface for app instance information
 */
export interface AppInstanceInfo {
  instanceId: string;
  isFree: boolean;
  hasPremiumPlan: boolean;
  isInFreeTrial: boolean;
  freeTrialDaysRemaining?: number;
  packageName?: string;
  appDefId?: string;
}

/**
 * Gets the current app instance information and checks if the user has a premium plan
 * Returns information about free trial status and premium plan status
 */
export const getAppInstanceInfo = webMethod(
  Permissions.Anyone,
  async (): Promise<AppInstanceInfo> => {
    try {
      // Elevate permissions to access app instance data
      const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
      const response = await elevatedGetAppInstance();

      const instance = response.instance;
      const billing = instance?.billing;

      // Debug: Log what we received
      console.log('=== APP INSTANCE INFO (getAppInstanceInfo) ===');
      console.log('Instance ID:', instance?.instanceId);
      console.log('Is Free:', instance?.isFree);
      console.log('Instance keys:', instance ? Object.keys(instance) : 'No instance');
      const instanceAny = instance as any;
      console.log('appDefId candidates:', {
        appDefId: instanceAny?.appDefId,
        appId: instanceAny?.appId,
        'app.appDefId': instanceAny?.app?.appDefId,
        'app.id': instanceAny?.app?.id
      });
      console.log('===========================================');

      // Check if user is in free trial
      const isInFreeTrial = billing?.freeTrialInfo?.status === 'IN_PROGRESS';

      // Calculate days remaining in free trial
      let freeTrialDaysRemaining: number | undefined;
      if (isInFreeTrial && billing?.expirationDate) {
        const expirationDate = new Date(billing.expirationDate);
        const now = new Date();
        const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        freeTrialDaysRemaining = Math.max(0, daysRemaining);
      }

      // User has a premium plan if:
      // 1. They are NOT on a free plan (isFree === false)
      // 2. OR they are in an active free trial (Wix considers free trial users as paid users)
      const hasPremiumPlan = !instance?.isFree || isInFreeTrial;

      // Try to find appDefId in different possible locations (though it's usually not in the response)
      const appDefIdFromApi = instanceAny?.appDefId || instanceAny?.appId || instanceAny?.app?.appDefId || instanceAny?.app?.id;

      // Use the hardcoded APP_DEF_ID if not found in API response
      const appDefId = appDefIdFromApi || APP_DEF_ID;

      console.log('appDefId resolution:', { appDefIdFromApi, usingHardcoded: !appDefIdFromApi, finalAppDefId: appDefId });

      return {
        instanceId: instance?.instanceId || '',
        isFree: instance?.isFree ?? true,
        hasPremiumPlan,
        isInFreeTrial,
        freeTrialDaysRemaining,
        packageName: billing?.packageName,
        appDefId
      };
    } catch (error) {
      console.error('Error fetching app instance:', error);
      // Default to free plan if there's an error
      return {
        instanceId: '',
        isFree: true,
        hasPremiumPlan: false,
        isInFreeTrial: false
      };
    }
  }
);

/**
 * Gets the upgrade URL for the app
 * This URL directs users to the Wix pricing page where they can upgrade to a premium plan
 */
export const getUpgradeUrl = webMethod(
  Permissions.Anyone,
  async (): Promise<string> => {
    try {
      const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
      const response = await elevatedGetAppInstance();

      // Debug: Log the full response to see what's available
      console.log('=== APP INSTANCE FULL RESPONSE (getUpgradeUrl) ===');
      console.log('Full response:', JSON.stringify(response, null, 2));
      console.log('Instance keys:', response.instance ? Object.keys(response.instance) : 'No instance');

      // Try to find appDefId in different locations
      const instanceAny = response.instance as any;
      console.log('Checking for appDefId in different locations:');
      console.log('  - instance.appDefId:', instanceAny?.appDefId);
      console.log('  - instance.appId:', instanceAny?.appId);
      console.log('  - instance.app?.appDefId:', instanceAny?.app?.appDefId);
      console.log('  - instance.app?.id:', instanceAny?.app?.id);
      console.log('  - response.appDefId:', (response as any)?.appDefId);
      console.log('===================================');

      // Try to find appDefId in API response (usually not there)
      const appDefIdFromApi = instanceAny?.appDefId || instanceAny?.appId || instanceAny?.app?.appDefId || instanceAny?.app?.id;

      // Use the hardcoded APP_DEF_ID if not found in API response
      const appDefId = appDefIdFromApi || APP_DEF_ID;
      const instanceId = response.instance?.instanceId;
      const appName = response.instance?.appName;

      console.log('Getting upgrade URL - appDefId:', appDefId, 'instanceId:', instanceId, 'appName:', appName);
      console.log('appDefId source:', appDefIdFromApi ? 'API response' : 'hardcoded constant');

      if (appDefId && instanceId) {
        const upgradeUrl = `https://www.wix.com/apps/upgrade/${appDefId}?appInstanceId=${instanceId}`;
        console.log('✅ Generated upgrade URL:', upgradeUrl);
        return upgradeUrl;
      }

      console.warn('❌ Missing appDefId or instanceId - cannot generate upgrade URL');
      console.warn('Available fields:', { appDefId, instanceId, appName });
      return '';
    } catch (error) {
      console.error('Error generating upgrade URL:', error);
      return '';
    }
  }
);
