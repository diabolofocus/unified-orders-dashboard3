// src/backend/app-instance.web.ts - App instance and premium plan checking

import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';

// The appDefId is not returned by the Wix API, so we need to hardcode it from wix.config.json
// This is your app's unique identifier from the Wix App Dashboard
const APP_DEF_ID = 'aeb5e016-2505-4705-b39f-7724f4845fbd';

// Free trial duration in days (must match what you configured in Wix Dev Center)
const FREE_TRIAL_DURATION_DAYS = 14;

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
  Permissions.Admin,
  async (): Promise<AppInstanceInfo> => {
    try {
      // Elevate permissions to access app instance data
      const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
      const response = await elevatedGetAppInstance();

      const instance = response.instance;
      const billing = instance?.billing;

      const instanceAny = instance as any;

      // Check if user is in free trial (according to Wix docs, users on free trial have isFree: false)
      const isInFreeTrial = billing?.freeTrialInfo?.status === 'IN_PROGRESS';

      // So we use billing.timeStamp (trial start date) + trial duration to calculate end date
      let freeTrialDaysRemaining: number | undefined;
      if (isInFreeTrial && billing?.timeStamp) {
        const trialStartDate = new Date(billing.timeStamp);
        const trialEndDate = new Date(trialStartDate);
        trialEndDate.setDate(trialEndDate.getDate() + FREE_TRIAL_DURATION_DAYS);

        const now = new Date();
        const remainingTime = trialEndDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
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
  Permissions.Admin,
  async (): Promise<string> => {
    try {
      const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
      const response = await elevatedGetAppInstance();

      // Try to find appDefId in different locations
      const instanceAny = response.instance as any;


      // Try to find appDefId in API response (usually not there)
      const appDefIdFromApi = instanceAny?.appDefId || instanceAny?.appId || instanceAny?.app?.appDefId || instanceAny?.app?.id;

      // Use the hardcoded APP_DEF_ID if not found in API response
      const appDefId = appDefIdFromApi || APP_DEF_ID;
      const instanceId = response.instance?.instanceId;
      const appName = response.instance?.appName;

      if (appDefId && instanceId) {
        const upgradeUrl = `https://www.wix.com/apps/upgrade/${appDefId}?appInstanceId=${instanceId}`;
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
