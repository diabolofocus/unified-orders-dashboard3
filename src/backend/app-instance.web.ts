// src/backend/app-instance.web.ts - App instance and premium plan checking

import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';

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

      return {
        instanceId: instance?.instanceId || '',
        isFree: instance?.isFree ?? true,
        hasPremiumPlan,
        isInFreeTrial,
        freeTrialDaysRemaining,
        packageName: billing?.packageName,
        appDefId: (instance as any)?.appDefId // appDefId exists but not in TypeScript types
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

      const appDefId = (response.instance as any)?.appDefId; // appDefId exists but not in TypeScript types
      const instanceId = response.instance?.instanceId;

      if (appDefId && instanceId) {
        return `https://www.wix.com/apps/upgrade/${appDefId}?appInstanceId=${instanceId}`;
      }

      return '';
    } catch (error) {
      console.error('Error generating upgrade URL:', error);
      return '';
    }
  }
);
