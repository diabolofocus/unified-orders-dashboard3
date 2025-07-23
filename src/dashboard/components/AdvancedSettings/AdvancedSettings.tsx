// components/AdvancedSettings/AdvancedSettings.tsx - UPDATED with Advanced Search + Print & Archive

import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Card,
  FormField,
  Input,
  Text,
  Heading,
  Divider,
  Dropdown,
  NumberInput,
  ToggleSwitch,
  Button,
  Badge,
  ColorInput
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { SHIPPING_CARRIERS } from '../../utils/constants';

export const AdvancedSettings: React.FC = observer(() => {
  const { settingsStore, orderStore } = useStores();

  // Helper function to clear cache and show toast
  const clearCacheAndNotify = (reason: string) => {
    try {
      orderStore.clearCustomerOrderCountCache();
      // Also clear the processed customers ref
      if ((window as any).clearProcessedCustomersRef) {
        (window as any).clearProcessedCustomersRef();
      }

      // Show success toast
      if (typeof window !== 'undefined' && (window as any).dashboard) {
        (window as any).dashboard.showToast({
          message: `${reason} Cache cleared - badges will recalculate with new thresholds.`,
          type: 'success',
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Error clearing badge cache:', error);
      if (typeof window !== 'undefined' && (window as any).dashboard) {
        (window as any).dashboard.showToast({
          message: 'Failed to clear badge cache. Please try again.',
          type: 'error',
          duration: 3000
        });
      }
    }
  };
  const [localOrderLimit, setLocalOrderLimit] = React.useState(settingsStore.initialOrderLimit);
  const [cacheStatus, setCacheStatus] = React.useState<string>('Unknown');
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    setLocalOrderLimit(settingsStore.initialOrderLimit);
  }, [settingsStore.initialOrderLimit]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    settingsStore.setProductHighlightFilter(e.target.value);
  };

  const handleColorChange = (color: string | object) => {
    if (typeof color === 'string') {
      settingsStore.setProductHighlightColor(color);
    } else if (color && typeof color === 'object' && 'hex' in color) {
      // Wix ColorInput may provide an object with hex/rgb properties
      const hex = (color as any).hex;
      if (typeof hex === 'string') {
        settingsStore.setProductHighlightColor(hex);
      }
    }
  };

  const handleOrderLimitChange = (value: number | null, _stringValue: string) => {
    if (value !== null && value !== undefined) {
      setLocalOrderLimit(value);
    }
  };

  const handleOrderLimitBlur = () => {
    if (localOrderLimit >= 20 && localOrderLimit <= 100) {
      settingsStore.setInitialOrderLimit(localOrderLimit);
    } else {
      const clampedValue = Math.max(20, Math.min(100, localOrderLimit));
      setLocalOrderLimit(clampedValue);
      settingsStore.setInitialOrderLimit(clampedValue);
    }
  };

  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    const loadInvoiceSettings = async () => {
      try {
        console.log('Loading current invoice settings...');
        setIsLoading(true);
        await settingsStore.fetchOrderSettings();
      } catch (error) {
        console.error('Failed to load invoice settings:', error);

        if (typeof window !== 'undefined' && (window as any).dashboard) {
          (window as any).dashboard.showToast({
            message: 'Failed to load invoice settings. Please refresh the page.',
            type: 'error',
            duration: 5000
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadInvoiceSettings();
  }, [settingsStore]);

  // Load cache status
  useEffect(() => {
    const loadCacheStatus = async () => {
      try {
        const { getCustomerRankingsCacheStatus } = await import('../../../backend/customer-rankings.web');
        const status = await getCustomerRankingsCacheStatus();
        setCacheStatus(status.success ? 'Active (2-hour TTL)' : 'Error');
      } catch (error) {
        setCacheStatus('Error loading status');
      }
    };
    loadCacheStatus();
  }, []);

  return (
    <Card stretchVertically className="advanced-settings-card">
      <Card.Header
        title={
          <Box direction="horizontal" align="left" gap="8px">
            <Icons.Settings />
            <Heading size="medium">Advanced Settings</Heading>
          </Box>
        }
        subtitle="Configure default presets"
      />
      <Card.Divider />

      <Card.Content>
        <Box direction="vertical" gap="24px">
          {/* Performance Settings */}
          <Box direction="vertical" gap="12px">
            <Text weight="normal" size="medium">Performance Settings</Text>
            <Box direction="vertical" gap="8px">
              <Text secondary size="small">
                Set the number of orders to load initially. Lower values improve loading performance.
              </Text>
              <Box direction="horizontal" gap="16px" align="left">
                <FormField label="Order Batch Size (20-100)">
                  <div style={{ width: '180px' }}>
                    <NumberInput
                      value={localOrderLimit}
                      onChange={handleOrderLimitChange}
                      onBlur={handleOrderLimitBlur}
                      min={20}
                      max={100}
                    />
                  </div>
                </FormField>
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box direction="vertical" gap="12px">
            <Text weight="normal" size="medium">Default Shipping Carrier</Text>
            <Box direction="vertical" gap="8px">
              <Text secondary size="small">
                Select the default shipping carrier that will be pre-selected in the tracking modal.
              </Text>
              <Box direction="horizontal" gap="24px" align="left">
                <div style={{ width: '180px', position: 'relative' }}>
                  <Dropdown
                    maxHeightPixels="300px"
                    options={[
                      ...SHIPPING_CARRIERS,
                      ...(settingsStore.customCarriers || []).map(customCarrier => ({
                        id: customCarrier.id,
                        value: customCarrier.value,
                        label: customCarrier.value
                      }))
                    ]}
                    selectedId={settingsStore.defaultShippingCarrier}
                    onSelect={(option) => {
                      if (option && option.id) {
                        settingsStore.setDefaultShippingCarrier(String(option.id));
                      }
                    }}
                    size="medium"
                  />
                </div>
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box direction="vertical" gap="16px">
            <Box direction="horizontal" align="space-between" verticalAlign="middle" paddingBottom="8px">
              <Box direction="vertical" gap="4px" flex="1">
                <Text weight="normal" size="medium">Auto-Create Invoices</Text>
                <Text secondary size="small">
                  Automatically generate invoices for new orders (NOT YET SUPPORTED BY WIX)
                </Text>
              </Box>
              <ToggleSwitch
                checked={false}
                onChange={() => {
                  console.log('Toggle is disabled - auto-invoice is always enabled');
                }}
                disabled={true}
                size="large"
              />
            </Box>

            <Divider />

            <Box direction="horizontal" align="space-between" paddingTop="8px" verticalAlign="middle">
              <Box direction="vertical" gap="4px" flex="1">
                <Text weight="normal" size="medium">Click to Copy</Text>
                <Text secondary size="small">
                  Enable click-to-copy functionality for order details
                </Text>
              </Box>
              <ToggleSwitch
                checked={settingsStore.clickToCopyEnabled}
                onChange={(e) => settingsStore.setEnableClickToCopy(e.target.checked)}
                size="large"
              />
            </Box>

          </Box>

          <Divider />

          <Box direction="vertical" gap="8px">
            <Text weight="normal" size="medium">Order Highlight Filter</Text>
            <Text secondary size="small">
              Visually highlight the edge of an order row to know which orders contain products with names matching this filter
            </Text>
            <Box direction="horizontal" gap="16px">
              <Box flex="1" paddingTop="12px">
                <FormField label="Product Name">
                  <Input
                    placeholder="e.g., Flower"
                    value={settingsStore.productHighlightFilter}
                    onChange={handleFilterChange}
                    clearButton
                  />
                </FormField>
              </Box>

              <Box>
                <FormField label="Highlight Color">
                  <ColorInput
                    value={settingsStore.productHighlightColor}
                    onChange={handleColorChange}
                  />
                </FormField>
              </Box>
            </Box>
            <Text size="tiny" secondary>
              This filter is not case-sensitive. Orders containing products with names matching this filter will be highlighted with the selected color border.
            </Text>
          </Box>

          <Divider />

          <Box direction="vertical" gap="12px">
            <Text weight="normal" size="medium">Frequent Customer Badges</Text>

            {/* Toggle for enabling/disabling customer badges */}
            <Box direction="horizontal" align="space-between" verticalAlign="middle">
              <Box direction="vertical" gap="4px" flex="1">
                <Text secondary size="small">
                  Display badges for customers based on order Count:
                </Text>
                <Text secondary size="tiny">
                  Only counts from loaded orders (batch size: {settingsStore.initialOrderLimit}). Initially, it may take a few seconds to load and can affect the performance. Data is then cached for 7 days.
                </Text>
              </Box>
              <ToggleSwitch
                checked={settingsStore.settings.showCustomerBadges}
                onChange={(e) => settingsStore.setShowCustomerBadges(e.target.checked)}
                size="large"
              />
            </Box>
            {/* Show clear cache option when badges are enabled */}
            {settingsStore.settings.showCustomerBadges && (
              <>
                <Box direction="horizontal" gap="16px" align="left" paddingTop="12px">
                  <Button
                    size="small"
                    priority="secondary"
                    onClick={() => {
                      try {
                        orderStore.clearCustomerOrderCountCache();
                        // Also clear the processed customers ref
                        if ((window as any).clearProcessedCustomersRef) {
                          (window as any).clearProcessedCustomersRef();
                        }

                        // Show success toast
                        if (typeof window !== 'undefined' && (window as any).dashboard) {
                          (window as any).dashboard.showToast({
                            message: 'Badge cache cleared successfully! Badges will recalculate on next load.',
                            type: 'success',
                            duration: 3000
                          });
                        }
                      } catch (error) {
                        console.error('Error clearing badge cache:', error);
                        if (typeof window !== 'undefined' && (window as any).dashboard) {
                          (window as any).dashboard.showToast({
                            message: 'Failed to clear badge cache. Please try again.',
                            type: 'error',
                            duration: 3000
                          });
                        }
                      }
                    }}
                  >
                    Clear Badge Cache
                  </Button>
                </Box>

                {/* Customer Tier Configuration */}
                <Box direction="vertical" gap="16px" paddingTop="16px">
                  <Text weight="normal" size="medium">Configure Badge Tiers</Text>
                  <Text secondary size="small">
                    Customize the order count thresholds for customer loyalty badges.
                  </Text>

                  {/* VIP Customer */}
                  <Box direction="horizontal" gap="16px" align="left" style={{ alignItems: 'center' }}>
                    <Box style={{ minWidth: '150px' }}>
                      <Badge
                        uppercase={false}
                        skin={settingsStore.settings.customerTiers.vipCustomer.skin}
                        size="tiny"
                        type="outlined"
                      >
                        {settingsStore.settings.customerTiers.vipCustomer.name}
                      </Badge>
                    </Box>
                    <Box direction="horizontal" gap="8px" style={{ alignItems: 'center' }}>
                      <Text size="small">for</Text>
                      <div style={{ width: '80px' }}>
                        <NumberInput
                          value={settingsStore.settings.customerTiers.vipCustomer.threshold}
                          onChange={(value) => {
                            if (value && value >= 1) {
                              settingsStore.setCustomerTierThreshold('vipCustomer', value);
                              clearCacheAndNotify('VIP threshold updated.');
                            }
                          }}
                          min={1}
                          max={50}
                          size="small"
                        />
                      </div>
                      <Text size="small">+ orders</Text>
                    </Box>
                  </Box>

                  {/* Loyal Customer */}
                  <Box direction="horizontal" gap="16px" align="left" style={{ alignItems: 'center' }}>
                    <Box style={{ minWidth: '150px' }}>
                      <Badge
                        uppercase={false} q
                        skin={settingsStore.settings.customerTiers.loyalCustomer.skin}
                        size="tiny"
                        type="outlined"
                      >
                        {settingsStore.settings.customerTiers.loyalCustomer.name}
                      </Badge>
                    </Box>
                    <Box direction="horizontal" gap="8px" style={{ alignItems: 'center' }}>
                      <Text size="small">for</Text>
                      <div style={{ width: '80px' }}>
                        <NumberInput
                          value={settingsStore.settings.customerTiers.loyalCustomer.threshold}
                          onChange={(value) => {
                            if (value && value >= 1) {
                              settingsStore.setCustomerTierThreshold('loyalCustomer', value);
                              clearCacheAndNotify('Loyal Customer threshold updated.');
                            }
                          }}
                          min={1}
                          max={50}
                          size="small"
                        />
                      </div>
                      <Text size="small">+ orders</Text>
                    </Box>
                  </Box>

                  {/* Returning Customer */}
                  <Box direction="horizontal" gap="16px" align="left" style={{ alignItems: 'center' }}>
                    <Box style={{ minWidth: '150px' }}>
                      <Badge
                        uppercase={false}
                        skin={settingsStore.settings.customerTiers.returningCustomer.skin}
                        size="tiny"
                        type="outlined"
                      >
                        {settingsStore.settings.customerTiers.returningCustomer.name}
                      </Badge>
                    </Box>
                    <Box direction="horizontal" gap="8px" style={{ alignItems: 'center' }}>
                      <Text size="small">for</Text>
                      <div style={{ width: '80px' }}>
                        <NumberInput
                          value={settingsStore.settings.customerTiers.returningCustomer.threshold}
                          onChange={(value) => {
                            if (value && value >= 1) {
                              settingsStore.setCustomerTierThreshold('returningCustomer', value);
                              clearCacheAndNotify('Returning Customer threshold updated.');
                            }
                          }}
                          min={1}
                          max={50}
                          size="small"
                        />
                      </div>
                      <Text size="small">+ orders</Text>
                    </Box>
                  </Box>
                  <Text size="tiny" secondary>
                    Thresholds are saved automatically. Cache is cleared automatically when thresholds change - badges will recalculate on next page interaction.
                  </Text>
                </Box>
              </>
            )}

          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
});
