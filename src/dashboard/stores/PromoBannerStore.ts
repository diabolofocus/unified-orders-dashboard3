// stores/PromoBannerStore.ts
import { makeAutoObservable, runInAction } from 'mobx';

export interface AppInstanceInfo {
  instanceId: string;
  isFree: boolean;
  hasPremiumPlan: boolean;
  isInFreeTrial: boolean;
  freeTrialDaysRemaining?: number;
  packageName?: string;
  appDefId?: string;
}

export class PromoBannerStore {
  appInstanceInfo: AppInstanceInfo | null = null;
  upgradeUrl: string = '';
  isLoading: boolean = true;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Checks if the free trial banner should be shown
   * Banner is shown if:
   * 1. User is on a free plan (not premium)
   * 2. User is in free trial (to encourage conversion)
   */
  get shouldShowFreeTrialBanner(): boolean {
    if (!this.appInstanceInfo) return false;

    // Show banner if user doesn't have a premium plan OR is in free trial
    return !this.appInstanceInfo.hasPremiumPlan || this.appInstanceInfo.isInFreeTrial;
  }

  /**
   * Gets the banner message based on the user's plan status
   */
  get bannerMessage(): string {
    if (!this.appInstanceInfo) return '';

    if (this.appInstanceInfo.isInFreeTrial && this.appInstanceInfo.freeTrialDaysRemaining !== undefined) {
      const days = this.appInstanceInfo.freeTrialDaysRemaining;
      if (days === 0) {
        return 'Your free trial ends today! Upgrade now to continue enjoying all premium features.';
      } else if (days === 1) {
        return 'Your free trial ends tomorrow! Upgrade now to continue enjoying all premium features.';
      } else {
        return `${days} days left in your free trial!`;
      }
    }

    return 'Start your 14-day free trial today! Unlock all premium features and supercharge your order management.';
  }

  /**
   * Gets the CTA button text based on the user's plan status
   */
  get ctaButtonText(): string {
    if (!this.appInstanceInfo) return 'Upgrade Now';

    if (this.appInstanceInfo.isInFreeTrial) {
      return 'Upgrade to Premium';
    }

    return 'Start Free Trial';
  }

  /**
   * Fetches app instance information from the backend
   */
  async fetchAppInstanceInfo(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      // Import the backend method
      const { getAppInstanceInfo } = await import('../../backend/app-instance.web');
      const instanceInfo = await getAppInstanceInfo();

      runInAction(() => {
        this.appInstanceInfo = instanceInfo;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = 'Failed to load app information';
        this.isLoading = false;
        // Default to showing banner on error (fail-safe to encourage upgrades)
        this.appInstanceInfo = {
          instanceId: '',
          isFree: true,
          hasPremiumPlan: false,
          isInFreeTrial: false
        };
      });
    }
  }

  /**
   * Fetches the upgrade URL from the backend
   */
  async fetchUpgradeUrl(): Promise<void> {
    try {
      const { getUpgradeUrl } = await import('../../backend/app-instance.web');
      const url = await getUpgradeUrl();

      runInAction(() => {
        this.upgradeUrl = url;
      });
    } catch (error) {
      runInAction(() => {
        this.upgradeUrl = '';
      });
    }
  }

  /**
   * Initializes the store by fetching all required data
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.fetchAppInstanceInfo(),
      this.fetchUpgradeUrl()
    ]);
  }

  /**
   * Opens the upgrade page in a new tab
   */
  openUpgradePage(): void {
    if (this.upgradeUrl) {
      window.open(this.upgradeUrl, '_blank');
    } else {
      // Fallback: Show a message to the user
      if (typeof window !== 'undefined' && (window as any).dashboard) {
        (window as any).dashboard.showToast({
          message: 'Upgrade URL is not available yet. The app needs to be published to the Wix App Market first.',
          type: 'warning',
          duration: 5000
        });
      }
    }
  }
}
