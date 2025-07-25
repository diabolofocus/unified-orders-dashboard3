// /dashboard/stores/SettingsStore.ts
import { makeAutoObservable, runInAction } from 'mobx';
import { SHIPPING_CARRIERS } from '../utils/constants';
import { ordersSettings } from '@wix/ecom';


type InventoryUpdateTrigger = 'ON_ORDER_PAID' | 'ON_ORDER_PLACED' | 'UNKNOWN_INVENTORY_UPDATE_TRIGGER';

interface OrdersSettings {
  createInvoice?: boolean;
  inventoryUpdateTrigger?: InventoryUpdateTrigger;
  _createdDate?: Date;
  _updatedDate?: Date;
  // Other fields that might be present in the response
  [key: string]: any;
}

interface OrdersSettingsResponse {
  ordersSettings: {
    createInvoice?: boolean;
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
  autoCreateInvoice: boolean;
  enableClickToCopy: boolean;
  showCustomerRankings: boolean;
  customerTiers: {
    returningCustomer: { threshold: number; name: string; skin: 'general' | 'standard' | 'premium' };
    loyalCustomer: { threshold: number; name: string; skin: 'general' | 'standard' | 'premium' };
    vipCustomer: { threshold: number; name: string; skin: 'general' | 'standard' | 'premium' };
  };
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
  autoCreateInvoice: true,
  enableClickToCopy: true,
  showCustomerBadges: true,
  showCustomerRankings: true,
  customerTiers: {
    returningCustomer: { threshold: 2, name: 'RETURNING CUSTOMER', skin: 'general' },
    loyalCustomer: { threshold: 3, name: 'LOYAL CUSTOMER', skin: 'standard' },
    vipCustomer: { threshold: 4, name: 'VIP CUSTOMER', skin: 'premium' },
  },
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

      // FORCE auto-invoice creation to be enabled
      await this.forceEnableAutoInvoice();

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

  /**
 * Force enable auto-invoice creation and set local state to true
 */
  private async forceEnableAutoInvoice() {
    try {

      // Force the Wix setting to true
      await this.updateOrderSettings(true);

      // Force local state to true
      runInAction(() => {
        this.settings.autoCreateInvoice = true;
        this.saveSettings(); // Save to localStorage
      });

    } catch (error) {
      console.error('❌ Failed to force enable auto-invoice:', error);

      // Still set local state to true even if API fails
      runInAction(() => {
        this.settings.autoCreateInvoice = true;
        this.saveSettings();
      });
    }
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

  get autoCreateInvoice() {
    // ALWAYS return true for testing
    return true;
  }

  async setAutoCreateInvoice(enabled: boolean) {
    // FORCE enabled to always be true
    const forcedEnabled = true;


    runInAction(() => {
      this.isLoading = true;
    });

    try {
      // Always send true to Wix API
      const result = await this.updateOrderSettings(forcedEnabled);
      console.log('✅ Forced update result:', result);

      runInAction(() => {
        this.settings.autoCreateInvoice = forcedEnabled; // Always true
        this.saveSettings();
      });

      if (typeof window !== 'undefined' && (window as any).dashboard) {
        (window as any).dashboard.showToast({
          message: 'Auto-create invoices is ALWAYS ENABLED (testing mode)',
          type: 'success',
          duration: 3000
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Error forcing auto-invoice:', error);

      // Even on error, keep it enabled locally
      runInAction(() => {
        this.settings.autoCreateInvoice = true;
        this.saveSettings();
      });

      throw error;
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  // This method is kept for backward compatibility but is no longer used
  updateOrderSettings(createInvoice: boolean) {
    // No-op, kept for backward compatibility
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

  async fetchOrderSettings() {
    try {
      console.log('Fetching current order settings...');

      // Try different approaches to get the settings
      let actualSettings;

      try {
        // Method 1: Direct call
        const response = await ordersSettings.getOrdersSettings() as any;
        console.log('Direct API response:', response);
        actualSettings = response;
      } catch (directError) {
        console.log('Direct call failed:', directError);

        try {
          // Method 2: Check if it's a different API structure
          const ecomModule = await import('@wix/ecom');
          const response = await ecomModule.ordersSettings.getOrdersSettings() as any;
          console.log('Module import response:', response);
          actualSettings = response;
        } catch (moduleError) {
          console.error('Module import also failed:', moduleError);
          throw moduleError;
        }
      }

      console.log('Final settings data:', actualSettings);

      // Extract the settings
      const settings = actualSettings?.ordersSettings || actualSettings;
      const shouldCreateInvoice = settings?.createInvoice ?? false;

      runInAction(() => {
        this.settings.autoCreateInvoice = shouldCreateInvoice;
        console.log('Updated autoCreateInvoice to:', this.settings.autoCreateInvoice);
      });

      return settings;
    } catch (error) {
      console.error('Failed to fetch order settings:', error);

      // Set to false on error
      runInAction(() => {
        this.settings.autoCreateInvoice = false;
      });

      throw error;
    }
  }


}

export const settingsStore = new SettingsStore();