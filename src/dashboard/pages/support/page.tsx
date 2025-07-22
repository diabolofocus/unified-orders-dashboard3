import React, { useState, useEffect } from 'react';
import {
  Page,
  Text,
  Box,
  Card,
  Button,
  Input,
  InputArea,
  FormField,
  Divider,
  WixDesignSystemProvider,
  Tabs,
  TextButton,
  Table
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import '@wix/design-system/styles.global.css';
import { dashboard } from '@wix/dashboard';
import { httpClient } from '@wix/essentials';
import { appInstances } from '@wix/app-management';
import { APP_CONFIG, SUPPORT_TEMPLATES, collectSystemInfo, generateBugReportTemplate, generateFeatureRequestTemplate, validateSubmission } from '../../utils/constants';

// Type assertion to work around incomplete TypeScript definitions
interface ExtendedAppInstanceResponse {
  instance?: {
    site?: {
      ownerInfo?: {
        email?: string;
        emailStatus?: string;
      };
      siteId?: string;
      siteDisplayName?: string;
      ownerEmail?: string;
    };
    instanceId?: string;
    appName?: string;
    appVersion?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

type BoxDirection = 'vertical' | 'horizontal' | 'vertical-reverse' | 'horizontal-reverse';
type BoxAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type BoxJustify = 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly' | 'flex-end';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number;
}

declare global {
  interface Window {
    dashboard?: {
      showToast: (options: ToastOptions) => void;
    };
  }
}

const FlexBox: React.FC<{
  direction?: BoxDirection;
  align?: BoxAlign;
  justify?: BoxJustify;
  gap?: string | number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  [key: string]: any;
}> = ({ direction = 'vertical', align, justify, gap, style, children, ...rest }) => {
  const styles: React.CSSProperties = {
    display: 'flex',
    flexDirection: direction?.includes('vertical') ? 'column' : 'row',
    ...(align && { alignItems: align }),
    ...(justify && {
      justifyContent: justify === 'flex-end' ? 'flex-end' :
        justify === 'start' ? 'flex-start' :
          justify as React.CSSProperties['justifyContent']
    }),
    ...(gap !== undefined && { gap: typeof gap === 'number' ? `${gap}px` : gap }),
    ...style,
  };

  return (
    <Box style={styles} {...rest}>
      {children}
    </Box>
  );
};

const TABS = {
  HELP: 'help',
  ABOUT: 'about',
  FEATURES: 'features'
};

interface UserInfo {
  email?: string;
  name?: string;
  siteId?: string;
  appName?: string;
  appVersion?: string;
  isFree?: boolean;
  instanceId?: string;
  siteUrl?: string;
}

interface SystemInfo {
  appVersion: string;
  timestamp: string;
  userAgent: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  onLine: boolean;
  screenResolution: string;
  timeZone: string;
  referrer: string;
  currentUrl: string;
}

const FAQ_ITEMS = [
  {
    title: "How do I view order details?",
    content: "Click on any order in the orders table to view detailed information including customer details, items, and fulfillment status."
  },
  {
    title: "How do I fulfill an order?",
    content: "Navigate to the Order Details tab in the right column, click on Add tracking Number button next to the Products section"
  },
  {
    title: "Why am I not receiving real-time notification for my Orders list?",
    content: "Make sure you've enabled audio notifications by clicking the audio enable button. Check your browser's notification permissions and ensure the dashboard tab is active.."
  },
  {
    title: "How do I export order data?",
    content: "For now, only the Packing list can be exported. Go to the original Wix Orders list page for more actions."
  },
  {
    title: "What happens if I encounter an error?",
    content: "If you encounter any errors, please check the browser console for details and report the issue using our bug report form. Include as much detail as possible."
  },
  {
    title: "How do I filter orders in the dashboard?",
    content: "You can use the filter buttons at the top of the orders table to filter by order status, date period, or products. You can also use the search bar to find specific orders by order number, customer name, or email."
  },
  {
    title: "How do I mark orders as fulfilled?",
    content: "Click on the checkbox next to an order or multiselect several orders and click on the 'Mark as Fulfilled' button."
  },
  {
    title: "Is there a way to export my Packing List data?",
    content: "Yes, you can print or download your Packing List by clicking the buttons to the right of the Packing tab."
  },
  {
    title: "How do I set up a sound notification for new orders?",
    content: "Go to the Settings page and navigate to the 'Notifications' tab. From the sound notification section, you can configure sound alerts for various order events."
  },
  {
    title: "Can I view the original order details from Wix?",
    content: "Yes, click on any order row to expand and view the complete order details, including customer information, products, and click on the open window button to view the original order details from Wix."
  },
  {
    title: "How do I handle a refund through the dashboard?",
    content: "Navigate to the original Wix order details page to handle refunds. Click on 'View Order' or the window icon to open the original order in Wix."
  },
];

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState(TABS.ABOUT);
  const [featureRequest, setFeatureRequest] = useState({
    title: '',
    description: '',
    userEmail: '',
    userName: ''
  });
  const [bugReport, setBugReport] = useState({
    title: '',
    description: '',
    userEmail: '',
    userName: ''
  });
  const [systemInfoText, setSystemInfoText] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState({ feature: false, bug: false });
  const [isLoading, setIsLoading] = useState({ feature: false, bug: false });
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    const collectInfo = async () => {
      try {
        const sysInfo = collectSystemInfo();
        setSystemInfo(sysInfo);

        // Try multiple approaches to get user email
        try {

          // Try to get app instance data with proper type assertions
          try {
            console.log('🔍 Attempting to get app instance data...');
            const appInstanceResponse = await appInstances.getAppInstance() as ExtendedAppInstanceResponse;
            console.log('📦 Full app instance response:', JSON.stringify(appInstanceResponse, null, 2));

            // Defensive approach - check all possible structures
            let email = null;
            let siteId = null;
            let siteName = null;
            let siteUrl = null;

            if (appInstanceResponse) {
              console.log('🔍 Exploring response structure...');
              console.log('Response keys:', Object.keys(appInstanceResponse));

              // Get instance and site data separately (they're siblings in the response)
              const instance = appInstanceResponse.instance;
              const siteInfo = appInstanceResponse.site;

              if (instance) {
                console.log('📋 Instance keys:', Object.keys(instance));
                console.log('📋 Instance data:', instance);
              }

              if (siteInfo) {
                console.log('🏠 Site info keys:', Object.keys(siteInfo));
                console.log('🏠 Site info data:', siteInfo);
              }

              // Extract data from both instance and site
              let appName = instance?.appName;
              let appVersion = instance?.appVersion;
              let isFree = instance?.isFree;
              let instanceId = instance?.instanceId;

              // Initialize variables for site data
              let email = null;
              let siteId = null;
              let siteName = null;
              let siteUrl = null;

              if (siteInfo) {
                // Get email from the correct location
                email = siteInfo.ownerInfo?.email || siteInfo.ownerEmail;

                // Get siteId from site info (not instance)
                siteId = siteInfo.siteId;

                // Get site name from site info
                siteName = siteInfo.siteDisplayName;

                // Get site URL - this should be directly available
                siteUrl = siteInfo.url;

                console.log('🔍 Found in siteInfo:');
                console.log('  📧 Email:', email);
                console.log('  🆔 Site ID:', siteId);
                console.log('  🏷️ Site Name:', siteName);
                console.log('  🌐 Site URL:', siteUrl);

                // If ownerInfo exists, log its structure
                if (siteInfo.ownerInfo) {
                  console.log('👤 Owner info structure:', siteInfo.ownerInfo);
                  console.log('👤 Owner info keys:', Object.keys(siteInfo.ownerInfo));
                }
              }

              // Update user info with all collected data
              if (email || siteId || siteName || appName || siteUrl) {
                setUserInfo(prev => ({
                  ...prev,
                  email: email || prev.email,
                  siteId: siteId || prev.siteId,
                  name: siteName || prev.name,
                  appName: appName || prev.appName,
                  appVersion: appVersion || prev.appVersion,
                  isFree: isFree !== undefined ? isFree : prev.isFree,
                  instanceId: instanceId || prev.instanceId,
                  siteUrl: siteUrl || prev.siteUrl
                }));
                console.log('✅ User info updated with found data');
                console.log('  📧 Email:', email);
                console.log('  🆔 Site ID:', siteId);
                console.log('  🏷️ Site Name:', siteName);
                console.log('  📱 App Name:', appName);
                console.log('  🔢 App Version:', appVersion);
                console.log('  💰 Is Free:', isFree);
                console.log('  🌐 Site URL:', siteUrl);
              } else {
                console.log('⚠️ No data found. Possible reasons:');
                console.log('  - Missing READ SITE OWNER EMAIL permission');
                console.log('  - Different API structure than expected');
                console.log('  - App not properly authenticated');
              }
            }
          } catch (error) {
            console.error('❌ Error getting app instance info:', error);
            console.error('❌ Error details:', (error as Error).message);
          }

        } catch (error) {
          console.error('Error in user info collection:', error);
        }
        // // Try to get site properties as fallback (only if we don't have data yet)
        // try {
        //   console.log('🔍 Attempting to get site properties as fallback...');
        //   const response = await httpClient.fetchWithAuth(
        //     'https://www.wixapis.com/site-properties/v4/properties',
        //     {
        //       method: 'GET',
        //       headers: {
        //         'Content-Type': 'application/json',
        //       }
        //     }
        //   );

        //   if (response.ok) {
        //     const siteData = await response.json();
        //     console.log('🏠 Site properties data:', siteData);

        //     // Only update if we don't already have better data from app instance
        //     setUserInfo(prev => {
        //       const updatedInfo = {
        //         ...prev,
        //         // Only use site properties if we don't already have siteId
        //         siteId: prev.siteId || siteData.namespace || 'Not available'
        //       };
        //       console.log('🔄 Site properties - only updating missing data:', {
        //         hadSiteId: !!prev.siteId,
        //         newSiteId: updatedInfo.siteId
        //       });
        //       return updatedInfo;
        //     });
        //   }
        // } catch (error) {
        //   console.error('❌ Error collecting site info:', error);
        // }

      } catch (error) {
        console.error('Error collecting system info:', error);
      }
    };

    collectInfo();
  }, []);

  // Initialize system info when available and update when userInfo changes
  useEffect(() => {
    if (systemInfo && userInfo) {
      const sysInfoTemplate = `App Name: ${userInfo.appName || APP_CONFIG.APP_NAME}
App Version: ${userInfo.appVersion || APP_CONFIG.APP_VERSION}
App Plan: ${userInfo.isFree !== undefined ? (userInfo.isFree ? 'Free' : 'Paid') : 'Unknown'}
Instance ID: ${userInfo.instanceId || 'Not available'}

Site Name: ${userInfo.name || 'Not available'}
Site ID: ${userInfo.siteId || 'Not available'}
Site URL: ${userInfo.siteUrl || 'Not available'}
User Email: ${userInfo.email || 'Not available (requires READ SITE OWNER EMAIL permission)'}`;

      setSystemInfoText(sysInfoTemplate);
    }
  }, [systemInfo, userInfo]);

  // Debug: Log user info when it changes
  useEffect(() => {
    console.log('Current userInfo state:', userInfo);
  }, [userInfo]);

  const handleBackToOrders = () => {
    dashboard.navigate({ pageId: '8dbd275e-3b05-4a4a-aa2c-a19f82c4a712' });
  };

  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateSubmission(bugReport.title, bugReport.description);
    if (errors.length > 0) {
      dashboard.showToast({
        message: errors.join(', '),
        type: 'error'
      });
      return;
    }

    setIsLoading(prev => ({ ...prev, bug: true }));

    try {
      const submissionData = {
        type: 'bug-report',
        title: bugReport.title,
        description: bugReport.description,
        userEmail: bugReport.userEmail || 'Not provided',
        userName: bugReport.userName || 'Not provided',
        userInfo: userInfo,
        systemInfo: systemInfo,
        timestamp: new Date().toISOString()
      };

      console.log('🐛 Submitting bug report:', submissionData.title);

      const response = await fetch('https://www.karpo.studio/_functions/supportSubmission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Success:', result);

        setBugReport({ title: '', description: '', userEmail: '', userName: '' });
        setIsSubmitted(prev => ({ ...prev, bug: true }));

        dashboard.showToast({
          message: `Bug report submitted successfully!`,
          type: 'success'
        });

        setTimeout(() => setIsSubmitted(prev => ({ ...prev, bug: false })), 8000);
      } else {
        const errorData = await response.json();
        console.error('❌ Server error:', errorData);
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }
    } catch (error: unknown) {
      console.error('❌ Submission failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dashboard.showToast({
        message: `Failed to submit bug report: ${errorMessage}`,
        type: 'error' as const
      });
    } finally {
      setIsLoading(prev => ({ ...prev, bug: false }));
    }
  };

  const handleFeatureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateSubmission(featureRequest.title, featureRequest.description);
    if (errors.length > 0) {
      dashboard.showToast({
        message: errors.join(', '),
        type: 'error'
      });
      return;
    }

    setIsLoading(prev => ({ ...prev, feature: true }));

    try {
      const submissionData = {
        type: 'feature-request',
        title: featureRequest.title,
        description: featureRequest.description,
        userEmail: featureRequest.userEmail || 'Not provided',
        userName: featureRequest.userName || 'Not provided',
        userInfo: userInfo,
        systemInfo: systemInfo,
        timestamp: new Date().toISOString()
      };

      console.log('💡 Submitting feature request:', submissionData.title);

      const response = await fetch('https://www.karpo.studio/_functions/supportSubmission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Success:', result);

        setFeatureRequest({ title: '', description: '', userEmail: '', userName: '' });
        setIsSubmitted(prev => ({ ...prev, feature: true }));

        dashboard.showToast({
          message: `Feature request submitted successfully! ID: ${result.itemId}`,
          type: 'success'
        });

        setTimeout(() => setIsSubmitted(prev => ({ ...prev, feature: false })), 8000);
      } else {
        const errorData = await response.json();
        console.error('❌ Server error:', errorData);
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }
    } catch (error: unknown) {
      console.error('❌ Submission failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dashboard.showToast({
        message: `Failed to submit feature request: ${errorMessage}`,
        type: 'error' as const
      });
    } finally {
      setIsLoading(prev => ({ ...prev, feature: false }));
    }
  };


  // Simple access token helper (we'll use a simpler approach)
  const getAccessToken = async (): Promise<string> => {
    // For dashboard apps, we can use httpClient.fetchWithAuth instead
    return '';
  };

  // Function to initialize system info (called once when component loads)
  const initializeSystemInfo = (): void => {
    if (systemInfo && userInfo) { // Only proceed if both systemInfo and userInfo are available
      const sysInfoTemplate = `App Name: ${userInfo?.appName || APP_CONFIG.APP_NAME}
App Version: ${userInfo?.appVersion || APP_CONFIG.APP_VERSION}
App Plan: ${userInfo?.isFree !== undefined ? (userInfo.isFree ? 'Free' : 'Paid') : 'Unknown'}
Instance ID: ${userInfo?.instanceId || 'Not available'}

Site Name: ${userInfo?.name || 'Not available'}
Site ID: ${userInfo?.siteId || 'Not available'}
Site URL: ${userInfo?.siteUrl || 'Not available'}
User Email: ${userInfo?.email || 'Not available (requires READ SITE OWNER EMAIL permission)'}

Timestamp: ${systemInfo.timestamp}
User Agent: ${systemInfo.userAgent}
Language: ${systemInfo.language}
Platform: ${systemInfo.platform}
Screen: ${systemInfo.screenResolution}
Time Zone: ${systemInfo.timeZone}
Online: ${systemInfo.onLine ? 'Yes' : 'No'}
Cookies: ${systemInfo.cookieEnabled ? 'Enabled' : 'Disabled'}

Referrer: ${systemInfo.referrer}`;

      setSystemInfoText(sysInfoTemplate);
      console.log('✅ System info template updated');
    }
  };

  // Function to prefill bug report description template
  const handleBugReportFocus = () => {
    if (!bugReport.description) {
      setBugReport(prev => ({
        ...prev,
        description: `${SUPPORT_TEMPLATES.BUG_REPORT_SECTIONS.BUG_DETAILS}
Steps to reproduce:
1. 
2. 
3. 

Expected behavior:


Actual behavior:


Error messages (if any):

${SUPPORT_TEMPLATES.BUG_REPORT_SECTIONS.USER_DESCRIPTION}
Please describe the issue in detail here...`
      }));
    }
  };

  // Function to prefill feature request description template
  const handleFeatureRequestFocus = () => {
    if (!featureRequest.description) {
      setFeatureRequest(prev => ({
        ...prev,
        description: `${SUPPORT_TEMPLATES.FEATURE_REQUEST_SECTIONS.FEATURE_REQUEST}
Expected functionality:


Why is this important:


${SUPPORT_TEMPLATES.FEATURE_REQUEST_SECTIONS.USER_DESCRIPTION}
Please describe your feature request in detail here...`
      }));
    }
  };

  const renderContent = (content: React.ReactNode) => (
    <FlexBox width="100%" align="center">
      <Box style={{ maxWidth: '800px', width: '100%', padding: '0 16px' }}>
        {content}
      </Box>
    </FlexBox>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.HELP:
        return renderContent(
          <div style={{ width: '1248px' }}>
            <Card>
              <Card.Header
                title="Need Help?"
                subtitle="Get support for any issues you're experiencing"
              />
              <Divider />
              <Card.Content>
                <FlexBox direction="vertical" gap="24px">

                  <Box width="100%" direction="vertical" gap="24px" align="left">
                    <Text weight="bold" size="medium">Report a Bug</Text>
                    <div style={{ width: '700px' }}>
                      <form onSubmit={handleBugSubmit}>
                        <FlexBox direction="vertical" gap="12px" paddingTop="0px">
                          <FlexBox direction="horizontal" gap="12px">
                            <FormField label="Your Name">
                              <Input
                                placeholder="Your name (optional)"
                                value={bugReport.userName}
                                onChange={(e) => setBugReport(prev => ({ ...prev, userName: e.target.value }))}
                                size="large"
                              />
                            </FormField>
                          </FlexBox>

                          <FormField label="Bug Title" required>
                            <Input
                              placeholder="Brief title for the bug"
                              value={bugReport.title}
                              onChange={(e) => setBugReport(prev => ({ ...prev, title: e.target.value }))}
                              size="large"
                            />
                          </FormField>

                          <FormField label="Your Description" required>
                            <InputArea
                              placeholder="Please describe the bug in detail..."
                              value={bugReport.description}
                              onChange={(e) => setBugReport(prev => ({ ...prev, description: e.target.value }))}
                              onFocus={handleBugReportFocus}
                              minHeight="200px"
                            />
                          </FormField>

                          <FormField label="System Information">
                            <InputArea
                              value={systemInfoText}
                              readOnly
                              minHeight="200px"
                              placeholder="Small" size="small"
                            />
                          </FormField>

                          <FlexBox direction="horizontal" gap="12px" justify="end">
                            <Button
                              type="submit"
                              priority="primary"
                              disabled={!bugReport.title.trim() || !bugReport.description.trim() || isLoading.bug}
                            >
                              {isLoading.bug ? 'Submitting...' : 'Submit Bug Report'}
                            </Button>
                          </FlexBox>

                          {isSubmitted.bug && (
                            <Text size="small" skin="success">
                              Thank you for your report! We'll look into this issue.
                            </Text>
                          )}
                        </FlexBox>
                      </form>
                    </div>
                  </Box>
                  {/* 
                  <Divider />
                  <Box direction="vertical" gap="12px">
                    <Text weight="bold" size="medium">Contact Support</Text>
                    <Text>Email: info@karpo.studio</Text>
                  </Box> */}
                </FlexBox>
              </Card.Content>
            </Card>
          </div>
        );

      case TABS.ABOUT:
        return renderContent(
          <Card>
            <Card.Header
              title="About & Resources"
              subtitle="Learn more about the app and find helpful resources"
            />
            <Divider />
            <Card.Content>
              <FlexBox direction="vertical" gap="24px" style={{ width: '100%' }}>
                {/* Introduction Text */}
                <Text>
                  I'm Guillaume, creator of the Express Orders Managment app. As a fellow Wix store owner, I've developed this tool to improve efficiency. The app is not meant to replace the Wix Orders dashboard but to extend its capabilities with additional features.
                  {/* You can visit{' '}
                  <TextButton
                    as="a"
                    href="https://karpo.studio"
                    target="_blank"
                    skin="standard"
                  >
                    karpo.studio
                  </TextButton>
                  {' '}to see upcoming apps and to learn more about my work. */}
                </Text>

                <Divider />

                {/* Horizontal Container for Feature Table and FAQ */}
                <FlexBox direction="vertical" gap="32px" style={{ width: '100%', alignItems: 'flex-start' }}>

                  {/* Left Side - Documentation and Feature Table */}
                  <FlexBox direction="vertical" gap="24px" width="700px">
                    <Text weight="bold" size="medium">Features Comparison</Text>

                    {/* Feature Comparison Table */}
                    <Box style={{
                      marginTop: '24px',
                      marginBottom: '24px',
                      display: 'flex',
                      justifyContent: 'left',
                      width: '100%'
                    }}>
                      <Box width="100%" align="left" style={{
                        border: '1px solid #e1e5e9',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff'
                      }}>
                        {/* Table Title */}
                        <Box style={{
                          padding: '24px 24px 16px 24px',
                          borderBottom: '1px solid #e1e5e9',
                          backgroundColor: '#f8f9fa'
                        }}>
                        </Box>

                        {/* Table Content */}
                        <Table
                          skin="neutral"
                          data={[
                            {
                              id: 1,
                              feature: "Add tracking info to custom items",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 2,
                              feature: "Orders list and order details in a single place",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 3,
                              feature: "View and export a packing list",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 4,
                              feature: "Add custom shipping carriers url and set default carrier",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 5,
                              feature: "Additional details : item weight, order weight, SKU, channel info..",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 6,
                              feature: "Filter orders by SKU (local filtering)",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 7,
                              feature: "Control the batch size of loaded orders",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 8,
                              feature: "Highlight orders based on product name",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 8,
                              feature: "Real-time Order Notifications",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 9,
                              feature: "Click on item image to edit product page",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 10,
                              feature: "Click on order details value to copy it",
                              ourApp: true,
                              wixApp: false
                            },
                            {
                              id: 11,
                              feature: "Refund orders",
                              ourApp: false,
                              wixApp: true
                            },
                            {
                              id: 12,
                              feature: "Add internal notes to orders",
                              ourApp: false,
                              wixApp: true
                            }
                          ]}
                          columns={[
                            {
                              title: 'Feature',
                              render: (row) => (
                                <Text size="small" style={{
                                  fontWeight: '400',
                                  color: '#333333',
                                  lineHeight: '1.4'
                                }}>
                                  {row.feature}
                                </Text>
                              ),
                              width: '60%'
                            },
                            {
                              title: 'Our App',
                              render: (row) => (
                                <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                  {row.ourApp ? (
                                    <Icons.Confirm style={{
                                      color: '#00c851',
                                      fontSize: '18px'
                                    }} />
                                  ) : (
                                    <Icons.X style={{
                                      color: '#ff4444',
                                      fontSize: '18px'
                                    }} />
                                  )}
                                </Box>
                              ),
                              width: '20%',
                              align: 'center'
                            },
                            {
                              title: 'Wix App',
                              render: (row) => (
                                <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                  {row.wixApp ? (
                                    <Icons.Confirm style={{
                                      color: '#00c851',
                                      fontSize: '18px'
                                    }} />
                                  ) : (
                                    <Icons.X style={{
                                      color: '#ff4444',
                                      fontSize: '18px'
                                    }} />
                                  )}
                                </Box>
                              ),
                              width: '20%',
                              align: 'center'
                            }
                          ]}
                          rowVerticalPadding="small"
                          width="100%"
                        >
                          <Table.Content />
                        </Table>
                      </Box>
                    </Box>
                  </FlexBox>

                  <Divider />

                  {/* Left Side - FAQ Section */}
                  <FlexBox direction="vertical" gap="24px" width="700px" style={{ flex: '1 1 0%' }}>
                    {/* FAQ Header */}
                    <FlexBox direction="vertical" gap="8px">
                      <Text size="medium" weight="bold">Frequently Asked Questions</Text>
                    </FlexBox>

                    {/* FAQ Items */}
                    <div style={{ width: '100%', maxWidth: '100%' }}>
                      {FAQ_ITEMS.map((item, index) => {
                        const isExpanded = expandedFaq === index;
                        return (
                          <div
                            key={index}
                            style={{
                              width: '100%',
                              maxWidth: '100%',
                              backgroundColor: isExpanded ? '#f0f4ff' : 'transparent',
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              padding: '16px',
                              cursor: 'pointer',
                              border: '1px solid transparent',
                              marginBottom: '2px',
                              boxSizing: 'border-box'
                            }}
                            onClick={() => {
                              console.log('FAQ clicked:', index, 'Current expanded:', expandedFaq);
                              setExpandedFaq(expandedFaq === index ? null : index);
                            }}
                            onMouseEnter={(e) => {
                              if (!isExpanded) {
                                e.currentTarget.style.backgroundColor = '#f0f4ff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isExpanded) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                gap: '12px'
                              }}
                            >
                              <Text

                                style={{
                                  color: '#3899ec',
                                  textDecoration: 'none',
                                  fontSize: '16px',
                                  flex: 1,
                                  textAlign: 'left',
                                  wordWrap: 'break-word',
                                  hyphens: 'auto'
                                }}
                              >
                                {item.title}
                              </Text>
                              <Icons.ChevronDown
                                style={{
                                  transform: isExpanded ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.3s ease',
                                  color: '#666',
                                  minWidth: '24px',
                                  flexShrink: 0
                                }}
                              />
                            </div>

                            {isExpanded && (
                              <div
                                style={{
                                  paddingTop: '16px',
                                  width: '100%',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <Text
                                  size="small"
                                  style={{
                                    lineHeight: '1.5',
                                    color: '#333',
                                    wordWrap: 'break-word',
                                    hyphens: 'auto'
                                  }}
                                >
                                  {item.content}
                                </Text>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </FlexBox>

                </FlexBox>
              </FlexBox>
            </Card.Content>
          </Card>
        );

      case TABS.FEATURES:
        return renderContent(
          <Card>
            <Card.Header
              title="Feature Requests"
              subtitle="Suggest new features or improvements"
            />
            <Divider />
            <Card.Content>
              <Box width="100%" direction="vertical" gap="24px">

                <form onSubmit={handleFeatureSubmit}>

                  <FlexBox direction="vertical" gap="12px" style={{ width: '700px' }}>
                    <Text>
                      Have an idea to improve the Express Orders Management app? I'd love to hear it! Please describe your feature request below. I'm always looking for ways to make your workflow more efficient.
                    </Text>

                    <Box direction="vertical" gap="12px" width="700px">
                      <Text weight="bold" size="medium">Request a Feature</Text>

                      <FlexBox direction="horizontal" gap="12px">
                        <FormField label="Your Name">
                          <Input
                            placeholder="Your name (optional)"
                            value={featureRequest.userName}
                            onChange={(e) => setFeatureRequest(prev => ({ ...prev, userName: e.target.value }))}
                            size="large"
                          />
                        </FormField>
                      </FlexBox>

                      <FormField label="Feature Title" required>
                        <Input
                          placeholder="Brief title for your feature request"
                          value={featureRequest.title}
                          onChange={(e) => setFeatureRequest(prev => ({ ...prev, title: e.target.value }))}
                          size="large"
                        />
                      </FormField>

                      <FormField label="Feature Description" required>
                        <InputArea
                          placeholder="Please describe your feature request in detail..."
                          value={featureRequest.description}
                          onChange={(e) => setFeatureRequest(prev => ({ ...prev, description: e.target.value }))}
                          onFocus={handleFeatureRequestFocus}
                          minHeight="250px"
                        />
                      </FormField>

                      <FlexBox direction="horizontal" gap="12px" justify="end">
                        <Button
                          type="submit"
                          priority="primary"
                          disabled={!featureRequest.title.trim() || !featureRequest.description.trim() || isLoading.feature}
                        >
                          {isLoading.feature ? 'Submitting...' : 'Submit Request'}
                        </Button>
                      </FlexBox>
                    </Box>

                    {isSubmitted.feature && (
                      <Text size="small" skin="success">
                        Thank you for your suggestion! We'll review it soon.
                      </Text>
                    )}
                  </FlexBox>

                </form>


              </Box>
            </Card.Content>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <WixDesignSystemProvider>
      <Page>
        <Page.Header
          title="Support Center"
          subtitle="Get help and support for the Orders Dashboard"
          onBackClicked={handleBackToOrders}
          showBackButton={true}
          actionsBar={
            <Button
              priority="primary"
              prefixIcon={<Icons.Settings />}
              onClick={() => dashboard.navigate({ pageId: '7570b9fe-ebe2-4486-9380-e5e4c41fc62d' })}
            >
              Settings
            </Button>
          }
        />

        <Page.Content>
          <Box paddingBottom="16px" border="bottom">
            <Tabs
              activeId={activeTab}
              onClick={({ id }) => setActiveTab(id as string)}
              type="compactSide"
              items={[
                {
                  id: TABS.ABOUT,
                  title: (
                    <FlexBox direction="horizontal" gap="6px">
                      <Icons.InfoCircle />
                      <span>About & Resources</span>
                    </FlexBox>
                  )
                },
                {
                  id: TABS.HELP,
                  title: (
                    <FlexBox direction="horizontal" gap="6px">
                      <Icons.HelpCircle />
                      <span>Help & Support</span>
                    </FlexBox>
                  )
                },
                {
                  id: TABS.FEATURES,
                  title: (
                    <FlexBox direction="horizontal" gap="6px">
                      <Icons.NewRelease />
                      <span>Feature Requests</span>
                    </FlexBox>
                  )
                }
              ]}
            />
          </Box>
          {renderTabContent()}
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
}