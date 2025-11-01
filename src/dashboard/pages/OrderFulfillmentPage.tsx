// src/dashboard/pages/OrderFulfillmentPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Page, Box, WixDesignSystemProvider, Badge } from '@wix/design-system';
import { appInstances } from '@wix/app-management';
import { APP_CONFIG } from '../utils/constants';

import '@wix/design-system/styles.global.css';

import { useStores } from '../hooks/useStores';
import { useOrderController } from '../hooks/useOrderController';
import { settingsStore } from '../stores/SettingsStore';
import { ActionsBar } from '../components/shared/ActionsBar';
import { ConnectionStatus } from '../components/shared/ConnectionStatus';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { OrdersTableWithTabs } from '../components/OrdersTable/OrdersTableWithTabs';
import { OrderDetails } from '../components/OrderDetails/OrderDetails';
import { FreeTrialBanner } from '../components/PromoBanner/FreeTrialBanner';

export const OrderFulfillmentPage: React.FC = observer(() => {
  const settings = settingsStore.getSettings();
  const { orderStore, uiStore } = useStores();
  const orderController = useOrderController();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);


  // Load app version immediately and separately - non-blocking
  useEffect(() => {
    appInstances.getAppInstance()
      .then(response => {
        const version = response?.instance?.appVersion;
        if (version) {
          setAppVersion(version);
        }
      })
      .catch(() => {
        // Silently fail - don't show version if fetch fails
      });
  }, []); // Empty dependency array - runs immediately on mount

  useEffect(() => {
    const initializeData = async () => {
      try {
        await orderController.loadOrders();
        await orderController.loadAnalyticsForPeriod('30days');
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();
  }, [orderController]);

  // Get real-time status directly from orderController
  const realtimeStatus = orderController.getRealtimeStatus();

  if (uiStore.loading) {
    return <LoadingScreen />;
  }

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <style>
        {`
          .wix-design-system {
            font-family: HelveticaNeueW01-45Ligh, HelveticaNeueW02-45Ligh, HelveticaNeueW10-45Ligh, Helvetica Neue, Helvetica, Arial, sans-serif;
          }
          .clickable-name {
            color: #3b82f6 !important;
            font-size: 18px;
            cursor: pointer;
          }
          .clickable-info {
            cursor: ${settingsStore.clickToCopyEnabled ? 'pointer' : 'default'};
            position: relative;
          }
          .clickable-info:hover {
            color: ${settingsStore.clickToCopyEnabled ? '#3b82f6' : 'inherit'};
          }
          .clickable-info:hover::after {
            content: "${settingsStore.clickToCopyEnabled ? '❐' : ''}";
            margin-left: 8px;
            font-size: 14px;
          }
          .section-title {
            text-decoration: underline;
            font-weight: normal;
            font-size: 16px;
          }
          .order-number-canceled {
            color: #999999 !important;
          }
          .order-number-normal {
            color: #000000 !important;
          }
          .order-text-canceled {
            color: #999999 !important;
          }
          .order-text-normal {
            color: inherit !important;
          }
          .button-canceled {
            background-color: #ECEEEF !important;
            color: #666666 !important;
            border-color: #CCCCCC !important;
          }

          [style*="max-width: 400pt"] {
  max-width: 380px !important;
}

          .wix-page-header {
            background-color: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            padding: 16px 16px;
          }
          
          .wix-page-content {
            padding: 24px;
            min-height: 100vh;
            background-color: #f8f9fa;
          }

          .sticky-order-details {
            position: sticky !important;
            top: 85px !important;
            max-width: 30% !important;
            height: calc(100vh - 230px) !important;
            max-height: calc(100vh - 230px) !important;
            min-height: calc(100vh - 230px) !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            align-self: flex-start !important;
            border-radius: 8px;
            
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }

          .main-content-container {
            min-height: calc(100vh - 226px) !important;
          }

          .horizontal-container {
            align-items: flex-start !important;
            min-height: calc(100vh - 226px) !important;
          }

          .orders-table-container {
            width: 100%;
            overflow-x: auto;
            min-width: 0;
          }

          .orders-table-container table {
            min-width: max-content;
          }

          /* Simple real-time status indicator */
          .realtime-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            color: white;
            background-color: ${realtimeStatus?.isListening ? '#00C42B' : '#E23B2C'};
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }

          @media (max-width: 1200px) {
            .main-grid-container {
              grid-template-columns: 1fr 350px !important;
            }
          }

          @media (max-width: 900px) {
            .main-grid-container {
              grid-template-columns: 1fr !important;
              grid-template-rows: auto auto !important;
            }
          }
        `}
      </style>

      <Page height="100vh">
        <Page.Header
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Orders</span>
              {appVersion && (
                <Badge
                  size="small"
                  skin="standard"
                  type="outlined"
                  uppercase={false}
                >
                  v{appVersion}
                </Badge>
              )}
            </div>
          }
          actionsBar={<ActionsBar />}
        />
        <Page.Content>
          <div
            ref={containerRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              height: '100%'
            }}
          >
            {/* Free Trial Banner - Only shows if user doesn't have premium plan */}
            <FreeTrialBanner />

            {/* Connection Status Row - Only show if enabled in settings */}
            {settings.showAnalyticsCard && <ConnectionStatus />}

            {/* Two-thirds layout with sidebar */}
            <div className="main-grid-container" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 400px',
              gap: '24px',
              flex: 1,
              minHeight: 0,
              alignItems: 'start'
            }}>
              <div style={{
                minWidth: 0,
                overflow: 'hidden'
              }}>
                <Page.Sticky>
                  <OrdersTableWithTabs />
                </Page.Sticky>
              </div>

              <div style={{
                minWidth: '400px',
                maxWidth: '400px',
                overflow: 'hidden'
              }}>
                <Page.Sticky>
                  <OrderDetails />
                </Page.Sticky>
              </div>
            </div>
          </div>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
});
