import React, { type FC, useEffect } from 'react';
import {
  Page,
  WixDesignSystemProvider,
  Box,
  Card,
  Text,
  Button,
  Heading,
  Divider,
  Breadcrumbs
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { dashboard } from '@wix/dashboard';
import { favoriteList } from '@wix/dashboard-management';

interface UserFavorite {
  id: string;
  pageId: string;
  relativeUrl: string;
  title: string;
  type: 'page' | 'app' | 'custom';
  created: string;
  [key: string]: unknown; // For any additional properties
}
import '@wix/design-system/styles.global.css';
import { rootStore, settingsStore } from '../../hooks/useStores';
import { StoreProvider } from '../../hooks/useStores';
import { OrderController } from '../../controllers/OrderController';
import { OrderService } from '../../services/OrderService';
import { OrderControllerProvider } from '../../contexts/OrderControllerContext';
import { NotificationSettings } from '../../components/NotificationSettings/NotificationSettings';
import { ComponentsVisibility } from '../../components/ComponentsVisibility/ComponentsVisibility';
import { AdvancedSettings } from '../../components/AdvancedSettings/AdvancedSettings';

const DashboardPage: FC = () => {
  // Component rendering
  const [isSaving, setIsSaving] = React.useState(false);

  const handleBackToOrders = () => {
    // Navigation to orders page
    dashboard.navigate({ pageId: '8dbd275e-3b05-4a4a-aa2c-a19f82c4a712' });
  };

  const handleSaveSettings = async () => {
    // Settings save initiated
    setIsSaving(true);

    try {
      // Simulate API call or any async operation
      await new Promise(resolve => setTimeout(resolve, 1500));

      dashboard.showToast({
        message: 'Settings saved successfully!',
        type: 'success'
      });
    } catch (error: unknown) {
      console.error('Failed to save settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dashboard.showToast({
        message: `Failed to save settings: ${errorMessage}`,
        type: 'error' as const
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
// Debug log removed
    try {
      settingsStore.resetToDefaults();
      dashboard.showToast({
        message: 'Settings reset to defaults',
        type: 'standard'
      });

      // Add a small delay to allow the toast to be seen before refreshing
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Failed to reset settings:', error);
      dashboard.showToast({
        message: 'Failed to reset settings',
        type: 'error'
      });
    }
  };

  const handleAddToFavorites = async () => {
// Debug log removed

    try {
      // Check if the favoriteList API is available
      if (!favoriteList || typeof favoriteList.addUserFavorite !== 'function') {
        throw new Error('Dashboard management API is not available. Please ensure the @wix/dashboard-management package is properly installed.');
      }

      // Get current page ID from dashboard context if available
      const currentPageId = '8dbd275e-3b05-4a4a-aa2c-a19f82c4a712';

      const favorite: UserFavorite = {
        id: currentPageId,
        pageId: currentPageId,
        relativeUrl: "/dashboard", // More specific relative URL
        title: "Orders Dashboard", // Updated title to match the page
        type: 'page',
        created: new Date().toISOString()
      } as const;

// Debug log removed

      const response = await favoriteList.addUserFavorite(favorite);
// Debug log removed

      dashboard.showToast({
        message: 'Orders Dashboard added to favorites!',
        type: 'success'
      });

    } catch (error: unknown) {
      console.error('Error adding to favorites:', error);

      // Type guard for error object
      const isApiError = (err: unknown): err is { details?: { applicationError?: { code?: string } } } => {
        return typeof err === 'object' && err !== null;
      };

      // Handle specific error types
      if (isApiError(error) && error.details?.applicationError?.code === 'DUPLICATE_FAVORITE_PAGE_ID_AND_RELATIVE_URL') {
        dashboard.showToast({
          message: 'This page is already in your favorites!',
          type: 'standard'
        });
      } else if (
        (typeof error === 'object' && error !== null && 'status' in error && error.status === 403) ||
        (error instanceof Error && (
          error.message.includes('Permission denied') ||
          error.message.includes('permission')
        ))
      ) {
        dashboard.showToast({
          message: 'Permission denied. Please contact your admin to enable dashboard management permissions for this app.',
          type: 'error'
        });
      } else if (error instanceof Error && error.message.includes('not available')) {
        dashboard.showToast({
          message: 'Dashboard management features are not available in this environment.',
          type: 'error'
        });
      } else {
        dashboard.showToast({
          message: `Failed to add to favorites: ${error || 'Unknown error'}`,
          type: 'error'
        });
      }
    }
  };

  // Initialize OrderController with required dependencies
  const orderController = React.useMemo(() => {
// Debug log removed
    try {
      const { orderStore, uiStore } = rootStore;
      const orderService = new OrderService();
      const controller = new OrderController(orderStore, uiStore, orderService);
// Debug log removed
      return controller;
    } catch (error: unknown) {
      console.error('DashboardPage: Error initializing OrderController:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error initializing OrderController';
      throw new Error(errorMessage);
    }
  }, []);

  // Check if we're in a browser environment
  useEffect(() => {
// Debug log removed
    return () => {
// Debug log removed
    };
  }, []);

  try {
    return (
      <WixDesignSystemProvider features={{ newColorsBranding: true }}>
        <StoreProvider value={rootStore}>
          <OrderControllerProvider orderController={orderController}>
            <Page height="100vh">
              <Page.Header
                title="Settings"
                subtitle="Configure your order preferences"
                breadcrumbs={
                  <Breadcrumbs
                    activeId="2"
                    items={[
                      { id: '1', value: 'Orders' },
                      { id: '2', value: 'Settings' },
                    ]}
                    onClick={(item) => {
                      if (item.id === '1') {
                        dashboard.navigate({ pageId: '8dbd275e-3b05-4a4a-aa2c-a19f82c4a712' });
                      }
                    }}
                  />
                }
                onBackClicked={handleBackToOrders}
                showBackButton={true}
                actionsBar={
                  <Button
                    priority="primary"
                    prefixIcon={<Icons.Help />}
                    onClick={() => dashboard.navigate({ pageId: '558b65a2-a92d-4c61-a6a6-267bfa06289b' })}
                  >
                    Support
                  </Button>
                }
              />
              <Page.Content>
                <Box
                  direction="vertical"
                  padding="0px"
                  gap="24px"
                >
                  <Card>
                    <Box padding="0px">
                      <NotificationSettings />
                    </Box>
                  </Card>

                  <Card>
                    <Box padding="0px">
                      <ComponentsVisibility />
                    </Box>
                  </Card>

                  <AdvancedSettings />
                </Box>
              </Page.Content>
              <style>{`
                .advanced-settings-card {
                  border-radius: 8px 8px 0px 0px !important;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                .spinner {
                  display: inline-block;
                  vertical-align: middle;
                }
              `}</style>
              <Page.FixedFooter>
                <Box
                  direction="horizontal"
                  gap="12px"
                  padding="20px 24px"
                  // marginTop="24px"
                  // backgroundColor="white"
                  borderTop="1px solid #e5e5e5"
                  borderRadius="0px 0px 12px 12px"
                // boxShadow="0px -2px 8px rgba(0, 0, 0, 0.1)"
                >
                  <Button
                    prefixIcon={isSaving ? <Icons.Confirm /> : undefined}
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Box gap="4px" verticalAlign="middle" direction="horizontal">
                        <div className="spinner" style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(0,0,0,0.1)',
                          borderTop: '2px solid #000',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          marginRight: '8px'
                        }} />
                        <span>Saving...</span>
                      </Box>
                    ) : 'Save Settings'}
                  </Button>
                  <Button
                    priority="secondary"
                    prefixIcon={<Icons.Revert />}
                    onClick={handleResetSettings}
                  >
                    Reset to Defaults
                  </Button>
                  <Button
                    priority="secondary"
                    prefixIcon={<Icons.Star />}
                    onClick={handleAddToFavorites}
                  >
                    Add to Favorites
                  </Button>
                </Box>
              </Page.FixedFooter>
            </Page>
          </OrderControllerProvider>
        </StoreProvider>
      </WixDesignSystemProvider>
    );
  } catch (error) {
    console.error('DashboardPage: Error in render:', error);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Error loading settings</h2>
        <p>{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
        <p>Check the browser console for more details.</p>
      </div>
    );
  }
};

export default DashboardPage;