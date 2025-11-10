// /dashboard/stores/SettingsStore.ts
import { makeAutoObservable, runInAction } from 'mobx';
import { SHIPPING_CARRIERS } from '../utils/constants';
import { ordersSettings } from '@wix/ecom';


type InventoryUpdateTrigger = 'ON_ORDER_PAID' | 'ON_ORDER_PLACED' | 'UNKNOWN_INVENTORY_UPDATE_TRIGGER';

interface OrdersSettings {
  inventoryUpdateTrigger?: InventoryUpdateTrigger;
  _createdDate?: Date;
  _updatedDate?: Date;
  // Other fields that might be present in the response
  [key: string]: any;
}

interface OrdersSettingsResponse {
  ordersSettings: {
    inventoryUpdateTrigger?: string;
    _createdDate?: string;
    _updatedDate?: string;
  };
}

type Settings = {
  automaticDetection: boolean;
  soundAlert: boolean;
  showCustomerBadges: boolean;
  showSKU: boolean;
  showTotalWeight: boolean;
  showIndividualWeights: boolean;
  showChannelInfo: boolean;
  showAnalyticsCard: boolean;
  showTinyAnalytics: boolean;
  showTopSellingItems: boolean;
  showLowInventoryItems: boolean;
  showTimeInDates: boolean;
  defaultShippingCarrier: string;
  customCarriers: Array<{ id: string, value: string, trackingUrl: string }>;
  productHighlightFilter: string;
  productHighlightColor: string;
  initialOrderLimit: number;
  enableClickToCopy: boolean;
  showCustomerRankings: boolean;
  packingListFirst: boolean; // Deprecated: kept for backward compatibility
  tabOrder: string[]; // New: array of tab IDs in order ['order-list', 'packing-list']
  customerTiers: {
    returningCustomer: { threshold: number; name: string; skin: 'general' | 'standard' | 'premium' };
    loyalCustomer: { threshold: number; name: string; skin: 'general' | 'standard' | 'premium' };
    vipCustomer: { threshold: number; name: string; skin: 'general' | 'standard' | 'premium' };
  };
  planType: 'trial' | 'premium';
  trialEndDate: string | null; // ISO date string
};


const DEFAULT_SETTINGS: Settings = {
  automaticDetection: true,
  soundAlert: true,
  showSKU: true,
  showTotalWeight: true,
  showIndividualWeights: false,
  showChannelInfo: true,
  showAnalyticsCard: true,
  showTinyAnalytics: true,
  showTopSellingItems: true,
  showLowInventoryItems: true,
  showTimeInDates: true,
  defaultShippingCarrier: 'dhl',
  customCarriers: [],
  productHighlightFilter: '',
  productHighlightColor: '#ff0000',
  initialOrderLimit: 30,
  enableClickToCopy: true,
  showCustomerBadges: true,
  showCustomerRankings: true,
  packingListFirst: false,
  tabOrder: ['order-list', 'packing-list'], // Default order
  customerTiers: {
    returningCustomer: { threshold: 2, name: 'RETURNING CUSTOMER', skin: 'general' },
    loyalCustomer: { threshold: 3, name: 'LOYAL CUSTOMER', skin: 'standard' },
    vipCustomer: { threshold: 4, name: 'VIP CUSTOMER', skin: 'premium' },
  },
  planType: 'trial',
  trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
};


const STORAGE_KEY = 'order_notification_settings';

export class SettingsStore {
  public settings: Settings = { ...DEFAULT_SETTINGS };

  SHIPPING_CARRIERS = SHIPPING_CARRIERS;
  private initialized = false;
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
    this.initialize();
  }

  getSettings(): Settings {
    return this.settings;
  }

  private initialize = async () => {
    try {
      this.isLoading = true;
      await this.loadSettings();

    } catch (error) {
      console.error('Failed to initialize settings:', error);
    } finally {
      this.isLoading = false;
      this.initialized = true;
    }
  }

  private loadSettings() {
    runInAction(() => {
      try {
        const savedSettings = localStorage.getItem(STORAGE_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          this.settings = { ...DEFAULT_SETTINGS, ...parsed };
        } else {
          this.settings = { ...DEFAULT_SETTINGS };
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        this.settings = { ...DEFAULT_SETTINGS };
      } finally {
        this.initialized = true;
      }
    });
  }

  private saveSettings() {
    runInAction(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    });
  }


  setAutomaticDetection(enabled: boolean) {
    runInAction(() => {
      this.settings.automaticDetection = enabled;

      // If disabling automatic detection, also disable sound alerts
      if (!enabled && this.settings.soundAlert) {
        this.settings.soundAlert = false;
      }

      this.saveSettings();
    });
  }

  setSoundAlert(enabled: boolean) {
    runInAction(() => {
      // Only allow enabling sound alerts if automatic detection is enabled
      if (enabled && !this.settings.automaticDetection) {
        console.warn('Cannot enable sound alerts when automatic detection is disabled');
        return;
      }

      this.settings.soundAlert = enabled;
      this.saveSettings();
    });
  }

  setShowSKU(enabled: boolean) {
    runInAction(() => {
      this.settings.showSKU = enabled;
      this.saveSettings();
    });
  }

  get automaticDetection() {
    return this.settings.automaticDetection;
  }

  get soundAlert() {
    return this.settings.soundAlert;
  }

  get showSKU() {
    return this.settings.showSKU;
  }

  setShowTotalWeight(enabled: boolean) {
    runInAction(() => {
      this.settings.showTotalWeight = enabled;
      this.saveSettings();
    });
  }

  get showTotalWeight() {
    return this.settings.showTotalWeight;
  }

  setShowIndividualWeights(enabled: boolean) {
    runInAction(() => {
      this.settings.showIndividualWeights = enabled;
      this.saveSettings();
    });
  }

  get showIndividualWeights() {
    return this.settings.showIndividualWeights;
  }

  setShowChannelInfo(enabled: boolean) {
    runInAction(() => {
      this.settings.showChannelInfo = enabled;
      this.saveSettings();
    });
  }

  get showChannelInfo() {
    return this.settings.showChannelInfo;
  }

  setDefaultShippingCarrier(carrierId: string) {
    runInAction(() => {
      this.settings.defaultShippingCarrier = carrierId;
      this.saveSettings();
    });
  }

  get defaultShippingCarrier() {
    return this.settings.defaultShippingCarrier;
  }

  setShowAnalyticsCard(enabled: boolean) {
    runInAction(() => {
      this.settings.showAnalyticsCard = enabled;
      this.saveSettings();
    });
  }

  get showAnalyticsCard() {
    return this.settings.showAnalyticsCard;
  }

  setProductHighlightFilter(filter: string) {
    runInAction(() => {
      this.settings.productHighlightFilter = filter;
      this.saveSettings();
    });
  }

  get productHighlightFilter() {
    return this.settings.productHighlightFilter;
  }

  setProductHighlightColor(color: string) {
    runInAction(() => {
      this.settings.productHighlightColor = color;
      this.saveSettings();
    });
  }

  get productHighlightColor() {
    return this.settings.productHighlightColor;
  }

  get showTinyAnalytics() {
    return this.settings.showTinyAnalytics;
  }

  setShowTinyAnalytics(show: boolean) {
    runInAction(() => {
      this.settings.showTinyAnalytics = show;
      this.saveSettings();
    });
  }

  setCustomerTierThreshold(tier: 'returningCustomer' | 'loyalCustomer' | 'vipCustomer', threshold: number) {
    this.settings.customerTiers[tier].threshold = threshold;
    this.saveSettings();
  }

  setCustomerTierName(tier: 'returningCustomer' | 'loyalCustomer' | 'vipCustomer', name: string) {
    this.settings.customerTiers[tier].name = name;
    this.saveSettings();
  }


  // Only return settings after they're loaded
  get isReady() {
    return this.initialized;
  }

  /**
   * Reset all settings to their default values
   */
  resetToDefaults() {
    runInAction(() => {
      // Create a new settings object to ensure MobX detects the change
      this.settings = { ...DEFAULT_SETTINGS };
      // Explicitly trigger saveSettings within the action
      this.saveSettings();
    });
  }

  get customCarriers() {
    return this.settings.customCarriers;
  }

  addCustomCarrier(carrier: { id: string, value: string, trackingUrl: string }) {
    runInAction(() => {
      this.settings.customCarriers.push(carrier);
      this.saveSettings();
    });
  }

  removeCustomCarrier(carrierId: string) {
    runInAction(() => {
      this.settings.customCarriers = this.settings.customCarriers.filter(c => c.id !== carrierId);
      this.saveSettings();
    });
  }

  updateCustomCarrier(carrierId: string, updates: Partial<{ value: string, trackingUrl: string }>) {
    runInAction(() => {
      const carrierIndex = this.settings.customCarriers.findIndex(c => c.id === carrierId);
      if (carrierIndex !== -1) {
        this.settings.customCarriers[carrierIndex] = {
          ...this.settings.customCarriers[carrierIndex],
          ...updates
        };
        this.saveSettings();
      }
    });
  }

  get initialOrderLimit() {
    return this.settings.initialOrderLimit;
  }

  setInitialOrderLimit(limit: number) {
    runInAction(() => {
      // Store the value as-is, validation is handled in the UI
      this.settings.initialOrderLimit = limit;
      this.saveSettings();
    });
  }



  // Enable/disable click-to-copy functionality
  setEnableClickToCopy = (enabled: boolean) => {
    this.settings.enableClickToCopy = enabled;
    this.saveSettings();
  };

  setShowTopSellingItems = (show: boolean) => {
    this.settings.showTopSellingItems = show;
    this.saveSettings();
  };

  setShowLowInventoryItems = (show: boolean) => {
    this.settings.showLowInventoryItems = show;
    this.saveSettings();
  }

  setShowTimeInDates = (show: boolean) => {
    this.settings.showTimeInDates = show;
    this.saveSettings();
  }

  get showTimeInDates() {
    return this.settings.showTimeInDates;
  };

  setShowCustomerBadges = (enabled: boolean) => {
    this.settings.showCustomerBadges = enabled;
    this.saveSettings();
  };

  get clickToCopyEnabled() {
    return this.settings.enableClickToCopy;
  }

  setPackingListFirst = (enabled: boolean) => {
    this.settings.packingListFirst = enabled;
    // Update tabOrder for backward compatibility
    this.settings.tabOrder = enabled
      ? ['packing-list', 'order-list']
      : ['order-list', 'packing-list'];
    this.saveSettings();
  };

  get packingListFirst() {
    // Check both old and new property for backward compatibility
    return this.settings.packingListFirst || this.settings.tabOrder[0] === 'packing-list';
  }

  setTabOrder = (tabOrder: string[]) => {
    this.settings.tabOrder = tabOrder;
    // Update packingListFirst for backward compatibility
    this.settings.packingListFirst = tabOrder[0] === 'packing-list';
    this.saveSettings();
  };

  get tabOrder() {
    return this.settings.tabOrder;
  }

  async fetchOrderSettings() {
    try {
// Debug log removed

      // Try different approaches to get the settings
      let actualSettings;

      try {
        // Method 1: Direct call
        const response = await ordersSettings.getOrdersSettings() as any;
// Debug log removed
        actualSettings = response;
      } catch (directError) {
// Debug log removed

        try {
          // Method 2: Check if it's a different API structure
          const ecomModule = await import('@wix/ecom');
          const response = await ecomModule.ordersSettings.getOrdersSettings() as any;
// Debug log removed
          actualSettings = response;
        } catch (moduleError) {
          console.error('Module import also failed:', moduleError);
          throw moduleError;
        }
      }

// Debug log removed

      // Extract the settings
      const settings = actualSettings?.ordersSettings || actualSettings;

      return settings;
    } catch (error) {
      console.error('Failed to fetch order settings:', error);


      throw error;
    }
  }

  // Plan Management
  get planType() {
    return this.settings.planType;
  }

  get trialEndDate() {
    return this.settings.trialEndDate;
  }

  get trialDaysLeft(): number | null {
    if (!this.settings.trialEndDate || this.settings.planType === 'premium') {
      return null;
    }

    const endDate = new Date(this.settings.trialEndDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  setPlanType(planType: 'trial' | 'premium') {
    runInAction(() => {
      this.settings.planType = planType;
      this.saveSettings();
    });
  }

  setTrialEndDate(endDate: string | null) {
    runInAction(() => {
      this.settings.trialEndDate = endDate;
      this.saveSettings();
    });
  }

  upgradeToPremium() {
    runInAction(() => {
      this.settings.planType = 'premium';
      this.settings.trialEndDate = null;
      this.saveSettings();
    });
  }


}

export const settingsStore = new SettingsStore();