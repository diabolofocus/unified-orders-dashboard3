import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Card, Text, DropdownBase, TextButton, Box, Divider, IconButton } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { dashboard } from '@wix/dashboard';
import { PeriodAnalyticsCard } from './PeriodAnalyticsCard';
import TopSellingItems from '../TopSellingItems/TopSellingItems';
import LowInventoryItems from '../LowInventoryItems/LowInventoryItems';
import { LiveVisitors } from '../LiveVisitors/LiveVisitors';
import { settingsStore } from '../../stores/SettingsStore';

type TimePeriod = 'today' | 'yesterday' | '7days' | '30days' | 'thisweek' | 'thismonth';

interface TimePeriodOption {
    id: TimePeriod;
    value: string;
}

export const CompactAnalytics: React.FC = observer(() => {
    const { orderStore } = useStores();

    const timePeriodOptions: TimePeriodOption[] = [
        { id: 'today', value: 'Today' },
        { id: 'yesterday', value: 'Yesterday' },
        { id: '7days', value: 'Last 7 days' },
        { id: '30days', value: 'Last 30 days' },
        { id: 'thisweek', value: 'This week' },
        { id: 'thismonth', value: 'This month' }
    ];

    const API_SUPPORTED_PERIODS = ['today', 'yesterday', '7days', '30days', 'thismonth', 'thisweek'];

    useEffect(() => {
        if (orderStore.connectionStatus === 'connected') {
            loadAnalyticsForPeriod(orderStore.selectedAnalyticsPeriod as TimePeriod);
        }
    }, [orderStore.connectionStatus]);

    const loadAnalyticsForPeriod = async (period: TimePeriod) => {
        try {
            orderStore.setAnalyticsLoading(true);
            orderStore.setAnalyticsError(null);
            orderStore.setSelectedAnalyticsPeriod(period);

            // For Today and Yesterday, ALWAYS use API and don't fall back to local data
            if (period === 'today' || period === 'yesterday') {
                try {
                    const analyticsResult = await loadAnalyticsFromAPI(period);
                    if (analyticsResult.success) {
                        return;
                    } else {
                        // For Today/Yesterday, if API fails, show error instead of using incomplete local data
                        throw new Error(analyticsResult.error || 'Analytics API failed for short period');
                    }
                } catch (apiError) {
                    console.error('Analytics API failed for short period:', apiError);
                    orderStore.setAnalyticsError('Unable to load analytics for this period. Analytics API is required for Today/Yesterday views.');
                    return;
                }
            }

            // For other periods, try API first, then fall back to local data
            try {
                const analyticsResult = await loadAnalyticsFromAPI(period);
                if (analyticsResult.success) {
                    return;
                }
                // If API call was not successful, continue to fallback
            } catch (apiError) {
                console.warn('API call failed, falling back to local data:', apiError);
            }

            // Fall back to local orders data if API fails (but not for today/yesterday)
            await loadAnalyticsFromOrders(period);

        } catch (error) {
            console.error('Failed to load analytics:', error);
            orderStore.setAnalyticsError('Failed to load analytics. Please check your connection and try again.');
        } finally {
            orderStore.setAnalyticsLoading(false);
        }
    };

    // Define the analytics data type to include the detailed values
    interface AnalyticsData {
        totalSales: number;
        totalOrders: number;
        totalSessions: number;
        totalUniqueVisitors: number;
        todayUniqueVisitors: number;
        yesterdayUniqueVisitors: number;
        averageOrderValue: number;
        currency: string;
        salesChange: number;
        ordersChange: number;
        sessionsChange: number;
        uniqueVisitorsChange: number;
        aovChange: number;
        detailedUniqueVisitors?: Array<{ date: string; value: number }>;
    }

    const loadAnalyticsFromAPI = async (period: TimePeriod): Promise<{ success: boolean; error?: string }> => {
        try {
            const { AnalyticsService } = await import('../../services/AnalyticsService');
            const analyticsService = new AnalyticsService();

            const { getSiteIdFromContext } = await import('../../utils/get-siteId');
            const siteId = getSiteIdFromContext();

            if (!siteId) {
                throw new Error('Site ID not found');
            }


            // Get analytics data with comparison to previous period
            const result = await analyticsService.getAnalyticsWithComparison(period);

            if (result.success && result.data) {
                // Cast the data to our AnalyticsData type and extract values
                const analyticsData = result.data as AnalyticsData;

                // Extract the visitor data from the result
                let {
                    totalUniqueVisitors = 0,
                    todayUniqueVisitors = 0,
                    yesterdayUniqueVisitors = 0,
                    totalSales = 0,
                    totalOrders = 0,
                    totalSessions = 0,
                    averageOrderValue = 0,
                    salesChange = 0,
                    ordersChange = 0,
                    sessionsChange = 0,
                    uniqueVisitorsChange = 0,
                    aovChange = 0,
                    detailedUniqueVisitors
                } = analyticsData;

                // For Today/Yesterday periods, if API returns zeros, fall back to local calculation
                if ((period === 'today' || period === 'yesterday') && totalSales === 0 && totalOrders === 0) {
                    console.log(`[loadAnalyticsFromAPI] API returned zeros for ${period}, falling back to local calculation`);

                    // Calculate from local orders for the specific period
                    const selectedPeriodOrders = orderStore.getOrdersForSelectedPeriod();
                    const currentMetrics = calculateOrderMetrics(selectedPeriodOrders);

                    // Still use API for unique visitors if available, otherwise use 0
                    totalSales = currentMetrics.totalSales;
                    totalOrders = currentMetrics.totalOrders;
                    averageOrderValue = currentMetrics.averageOrderValue;

                    console.log(`[loadAnalyticsFromAPI] Local calculation for ${period}: sales=${totalSales}, orders=${totalOrders}, aov=${averageOrderValue}`);
                }

                // If unique visitors is still 0 for Today/Yesterday, try to get recent visitor data
                if ((period === 'today' || period === 'yesterday') && totalUniqueVisitors === 0 && todayUniqueVisitors === 0 && yesterdayUniqueVisitors === 0) {
                    console.log(`[loadAnalyticsFromAPI] No visitor data for ${period}, attempting to get recent visitor data`);

                    try {
                        // Try to get visitor data from last 7 days as a fallback
                        const recentVisitorResult = await analyticsService.getAnalyticsWithComparison('7days');
                        if (recentVisitorResult.success && recentVisitorResult.data) {
                            const recentData = recentVisitorResult.data as AnalyticsData;
                            todayUniqueVisitors = recentData.todayUniqueVisitors || 0;
                            yesterdayUniqueVisitors = recentData.yesterdayUniqueVisitors || 0;
                            console.log(`[loadAnalyticsFromAPI] Got recent visitor data: today=${todayUniqueVisitors}, yesterday=${yesterdayUniqueVisitors}`);
                        }
                    } catch (visitorError) {
                        console.warn(`[loadAnalyticsFromAPI] Failed to get recent visitor data:`, visitorError);
                    }
                }

                console.log(`[loadAnalyticsFromAPI] Extracted visitor data:`, {
                    totalUniqueVisitors,
                    todayUniqueVisitors,
                    yesterdayUniqueVisitors
                });

                // If we don't have today/yesterday data from the API response, try to extract from detailed values
                if (todayUniqueVisitors === 0 && detailedUniqueVisitors?.length) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

                    const todayData = detailedUniqueVisitors.find((item: any) => item.date === todayStr);
                    const yesterdayData = detailedUniqueVisitors.find((item: any) => item.date === yesterdayStr);

                    if (todayData) todayUniqueVisitors = todayData.value || 0;
                    if (yesterdayData) yesterdayUniqueVisitors = yesterdayData.value || 0;
                }

                // For all periods, use the total unique visitors as the main display value
                let displayUniqueVisitors = totalUniqueVisitors;

                console.log(`[loadAnalyticsFromAPI] Final visitor counts for ${period}:`, {
                    displayUniqueVisitors,
                    todayUniqueVisitors,
                    yesterdayUniqueVisitors,
                    detailedCount: detailedUniqueVisitors?.length || 0
                });

                // Update the analytics data in the store
                const analyticsPayload: any = {
                    TOTAL_SALES: { total: totalSales },
                    TOTAL_ORDERS: { total: totalOrders },
                    TOTAL_SESSIONS: { total: totalSessions },
                    TOTAL_UNIQUE_VISITORS: {
                        total: displayUniqueVisitors
                    }
                };

                // Add detailed values if available
                if (detailedUniqueVisitors?.values) {
                    analyticsPayload.TOTAL_UNIQUE_VISITORS.values = detailedUniqueVisitors.values;
                }

                orderStore.setAnalyticsData(analyticsPayload);

                // Format and set the analytics data for display
                orderStore.setFormattedAnalytics({
                    totalSales,
                    totalOrders,
                    totalSessions,
                    totalUniqueVisitors: displayUniqueVisitors,
                    todayUniqueVisitors,
                    yesterdayUniqueVisitors,
                    averageOrderValue,
                    currency: '€',
                    salesChange,
                    ordersChange,
                    sessionsChange,
                    uniqueVisitorsChange,
                    aovChange,
                    period
                });

                console.log('[loadAnalyticsFromAPI] Successfully updated analytics data');
                return { success: true };
            } else {
                const errorMsg = result.error || 'Failed to load analytics data';
                console.error('[loadAnalyticsFromAPI] API Error:', errorMsg);
                return { success: false, error: errorMsg };
            }

        } catch (error: any) {
            console.error('[loadAnalyticsFromAPI] Error:', error);
            return {
                success: false,
                error: error.message || 'An unexpected error occurred while loading analytics'
            };
        }
    };

    const loadAnalyticsFromOrders = async (period: TimePeriod) => {
        const selectedPeriodOrders = orderStore.getOrdersForSelectedPeriod();

        const currentMetrics = calculateOrderMetrics(selectedPeriodOrders);

        const previousPeriodOrders = getPreviousPeriodOrders(period);
        const previousMetrics = calculateOrderMetrics(previousPeriodOrders);

        const salesChange = calculatePercentageChange(currentMetrics.totalSales, previousMetrics.totalSales);
        const ordersChange = calculatePercentageChange(currentMetrics.totalOrders, previousMetrics.totalOrders);
        const aovChange = calculatePercentageChange(currentMetrics.averageOrderValue, previousMetrics.averageOrderValue);
        orderStore.setFormattedAnalytics({
            totalSales: currentMetrics.totalSales,
            totalOrders: currentMetrics.totalOrders,
            totalSessions: 0,
            totalUniqueVisitors: 0,
            todayUniqueVisitors: 0,
            yesterdayUniqueVisitors: 0,
            averageOrderValue: currentMetrics.averageOrderValue,
            currency: currentMetrics.currency,
            salesChange,
            ordersChange,
            sessionsChange: 0,
            uniqueVisitorsChange: 0,
            aovChange,
            period: period
        });
    };

    const calculateOrderMetrics = (orders: any[]) => {
        let totalSales = 0;
        let currency = '€';

        orders.forEach(order => {
            const parsedPrice = parsePrice(order.total);
            totalSales += parsedPrice;
            const orderCurrency = extractCurrency(order.total);
            if (orderCurrency !== '€') {
                currency = orderCurrency;
            }
        });

        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        return {
            totalSales,
            totalOrders,
            averageOrderValue,
            currency
        };
    };

    const getPreviousPeriodOrders = (period: TimePeriod) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let previousStartDate: Date;
        let previousEndDate: Date;

        switch (period) {
            case 'today':
                previousStartDate = new Date(today);
                previousStartDate.setDate(previousStartDate.getDate() - 1);
                previousEndDate = new Date(previousStartDate);
                break;
            case 'yesterday':
                previousStartDate = new Date(today);
                previousStartDate.setDate(previousStartDate.getDate() - 2);
                previousEndDate = new Date(previousStartDate);
                break;
            case '7days':
                previousStartDate = new Date(today);
                previousStartDate.setDate(previousStartDate.getDate() - 14);
                previousEndDate = new Date(today);
                previousEndDate.setDate(previousEndDate.getDate() - 7);
                break;
            case '30days':
                previousStartDate = new Date(today);
                previousStartDate.setDate(previousStartDate.getDate() - 60);
                previousEndDate = new Date(today);
                previousEndDate.setDate(previousEndDate.getDate() - 30);
                break;
            case 'thisweek':
                const currentWeekStart = new Date(today);
                const dayOfWeek = currentWeekStart.getDay();
                const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                currentWeekStart.setDate(currentWeekStart.getDate() - daysFromMonday);

                previousStartDate = new Date(currentWeekStart);
                previousStartDate = new Date(currentWeekStart);
                previousStartDate.setDate(previousStartDate.getDate() - 7);

                previousEndDate = new Date(currentWeekStart);
                previousEndDate.setDate(previousEndDate.getDate() - 1);
                break;
            case 'thismonth':
                previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            default:
                previousStartDate = new Date(today);
                previousStartDate.setDate(previousStartDate.getDate() - 60);
                previousEndDate = new Date(today);
                previousEndDate.setDate(previousEndDate.getDate() - 30);
        }

        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setHours(23, 59, 59, 999);

        return orderStore.orders.filter(order => {
            const orderDate = new Date(order._createdDate);
            return orderDate >= previousStartDate && orderDate <= previousEndDate;
        });
    };

    const parsePrice = (priceString: string): number => {
        if (!priceString || typeof priceString !== 'string') return 0;

        let cleanPrice = priceString.replace(/[^\d,.-]/g, '');

        if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
            const lastComma = cleanPrice.lastIndexOf(',');
            const lastDot = cleanPrice.lastIndexOf('.');

            if (lastComma > lastDot) {
                cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
            } else {
                cleanPrice = cleanPrice.replace(/,/g, '');
            }
        } else if (cleanPrice.includes(',') && !cleanPrice.includes('.')) {
            const parts = cleanPrice.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                cleanPrice = cleanPrice.replace(',', '.');
            } else {
                cleanPrice = cleanPrice.replace(/,/g, '');
            }
        }

        const parsed = parseFloat(cleanPrice);
        // Ensure we never return NaN or negative values
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
    };

    const extractCurrency = (priceString: string): string => {
        if (!priceString) return '€';

        const currencyMatch = priceString.match(/[€$£¥₹₽¢]/);
        if (currencyMatch) return currencyMatch[0];

        const codeMatch = priceString.match(/[A-Z]{3}/);
        if (codeMatch) return codeMatch[0];

        return '€';
    };

    const calculatePercentageChange = (current: number, previous: number): number => {
        // Ensure inputs are valid numbers
        const safeCurrent = isNaN(current) ? 0 : Math.max(0, current);
        const safePrevious = isNaN(previous) ? 0 : Math.max(0, previous);
        
        if (safePrevious === 0) return safeCurrent > 0 ? 100 : 0;
        const change = ((safeCurrent - safePrevious) / safePrevious) * 100;
        return isNaN(change) ? 0 : Math.round(change);
    };

    const getMetrics = () => {
        if (orderStore.formattedAnalytics && !orderStore.analyticsError) {
            const data = orderStore.formattedAnalytics;
            const selectedPeriod = orderStore.selectedAnalyticsPeriod;

            // For Today/Yesterday periods, use a hybrid approach
            if (selectedPeriod === 'today' || selectedPeriod === 'yesterday') {
                // Get today/yesterday data from local orders for tiny analytics
                const last30DaysOrders = orderStore.getLast30DaysOrders();
                let todaySales = 0;
                let yesterdaySales = 0;
                let todayOrders = 0;
                let yesterdayOrders = 0;
                let todayOrderCount = 0;
                let yesterdayOrderCount = 0;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                last30DaysOrders.forEach(order => {
                    const orderDate = new Date(order._createdDate);
                    orderDate.setHours(0, 0, 0, 0);
                    const parsedPrice = parsePrice(order.total);

                    if (orderDate.getTime() === today.getTime()) {
                        todaySales += parsedPrice;
                        todayOrders++;
                        todayOrderCount++;
                    } else if (orderDate.getTime() === yesterday.getTime()) {
                        yesterdaySales += parsedPrice;
                        yesterdayOrders++;
                        yesterdayOrderCount++;
                    }
                });

                // For Today period: show today's API data as main, yesterday as tiny
                if (selectedPeriod === 'today') {
                    return {
                        sales: `€${data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        salesValue: data.totalSales,
                        todaySales: data.totalSales, // Use API data for main value
                        yesterdaySales, // Use local calculation for tiny analytics
                        currency: data.currency || '€',
                        orders: data.totalOrders,
                        ordersValue: data.totalOrders,
                        todayOrders: data.totalOrders, // Use API data for main value
                        yesterdayOrders, // Use local calculation for tiny analytics
                        aovValue: data.averageOrderValue,
                        todayAOV: data.averageOrderValue, // Use API data for main value
                        yesterdayAOV: yesterdayOrderCount > 0 ? yesterdaySales / yesterdayOrderCount : 0,
                        avgOrderValue: `€${data.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        salesChange: data.salesChange || 0,
                        ordersChange: data.ordersChange || 0,
                        aovChange: data.aovChange || 0,
                        uniqueVisitorsValue: data.todayUniqueVisitors || 0, // Use today's count as main value
                        todayUniqueVisitors: data.todayUniqueVisitors || 0,
                        yesterdayUniqueVisitors: data.yesterdayUniqueVisitors || 0,
                        uniqueVisitorsChange: data.uniqueVisitorsChange || 0,
                        isLoading: orderStore.analyticsLoading
                    };
                }

                // For Yesterday period: show yesterday's API data as main, today as tiny
                if (selectedPeriod === 'yesterday') {
                    return {
                        sales: `€${data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        salesValue: data.totalSales,
                        todaySales, // Use local calculation for tiny analytics
                        yesterdaySales: data.totalSales, // Use API data for main value
                        currency: data.currency || '€',
                        orders: data.totalOrders,
                        ordersValue: data.totalOrders,
                        todayOrders, // Use local calculation for tiny analytics
                        yesterdayOrders: data.totalOrders, // Use API data for main value
                        aovValue: data.averageOrderValue,
                        todayAOV: todayOrderCount > 0 ? todaySales / todayOrderCount : 0,
                        yesterdayAOV: data.averageOrderValue, // Use API data for main value
                        avgOrderValue: `€${data.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        salesChange: data.salesChange || 0,
                        ordersChange: data.ordersChange || 0,
                        aovChange: data.aovChange || 0,
                        uniqueVisitorsValue: data.yesterdayUniqueVisitors || 0, // Use yesterday's count as main value
                        todayUniqueVisitors: data.todayUniqueVisitors || 0,
                        yesterdayUniqueVisitors: data.yesterdayUniqueVisitors || 0,
                        uniqueVisitorsChange: data.uniqueVisitorsChange || 0,
                        isLoading: orderStore.analyticsLoading
                    };
                }
            }

            // For other periods (7days, 30days, etc.), use the existing logic
            const last30DaysOrders = orderStore.getLast30DaysOrders();
            let todaySales = 0;
            let yesterdaySales = 0;
            let todayOrders = 0;
            let yesterdayOrders = 0;
            let todayAOV = 0;
            let yesterdayAOV = 0;
            let todayOrderCount = 0;
            let yesterdayOrderCount = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            last30DaysOrders.forEach(order => {
                const orderDate = new Date(order._createdDate);
                orderDate.setHours(0, 0, 0, 0);
                const parsedPrice = parsePrice(order.total);

                if (orderDate.getTime() === today.getTime()) {
                    todaySales += parsedPrice;
                    todayOrders++;
                    todayAOV += parsedPrice;
                    todayOrderCount++;
                } else if (orderDate.getTime() === yesterday.getTime()) {
                    yesterdaySales += parsedPrice;
                    yesterdayOrders++;
                    yesterdayAOV += parsedPrice;
                    yesterdayOrderCount++;
                }
            });

            return {
                sales: `€${data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                salesValue: data.totalSales,
                todaySales,
                yesterdaySales,
                currency: data.currency || '€',
                orders: data.totalOrders,
                ordersValue: data.totalOrders,
                todayOrders,
                yesterdayOrders,
                aovValue: data.averageOrderValue,
                todayAOV: todayOrderCount > 0 ? todayAOV / todayOrderCount : 0,
                yesterdayAOV: yesterdayOrderCount > 0 ? yesterdayAOV / yesterdayOrderCount : 0,
                avgOrderValue: `€${data.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                salesChange: data.salesChange || 0,
                ordersChange: data.ordersChange || 0,
                aovChange: data.aovChange || 0,
                uniqueVisitorsValue: data.totalUniqueVisitors || 0,
                todayUniqueVisitors: data.todayUniqueVisitors || 0,
                yesterdayUniqueVisitors: data.yesterdayUniqueVisitors || 0,
                uniqueVisitorsChange: data.uniqueVisitorsChange || 0,
                isLoading: orderStore.analyticsLoading
            };
        }

        return {
            sales: '€0.00',
            orders: 0,
            avgOrderValue: '€0.00',
            salesChange: 0,
            ordersChange: 0,
            aovChange: 0,
            uniqueVisitorsValue: 0,
            todayUniqueVisitors: 0,
            yesterdayUniqueVisitors: 0,
            uniqueVisitorsChange: 0,
            isLoading: orderStore.analyticsLoading
        };
    };

    const metrics = getMetrics();

    const formatPercentageChange = (change: number): { text: string; color: string; icon: React.ReactNode } => {
        if (change === 0) return { text: '0%', color: '#6b7280', icon: null };
        const color = change > 0 ? '#15803d' : '#6b7280';
        const icon = change > 0 ? <Icons.ChevronUp /> : <Icons.ChevronDown />;
        return {
            text: `${Math.abs(change)}%`,
            color: color,
            icon: icon
        };
    };

    const handlePeriodChange = (selectedOption: any) => {
        console.log('Period changed to:', selectedOption.id);

        if (orderStore.connectionStatus === 'connected') {
            loadAnalyticsForPeriod(selectedOption.id as TimePeriod);
        }
    };

    const MetricItem: React.FC<{
        title: string;
        value: string | number;
        change?: number;
        isSalesMetric?: boolean
    }> = ({
        title,
        value,
        change,
    }) => {
            const percentageData = change !== undefined ? formatPercentageChange(change) : null;

            return (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <Text size="medium" secondary>{title}</Text>
                    <Text
                        size="medium"
                        weight="normal"
                    >
                        {metrics.isLoading ? 'Loading...' : value}
                    </Text>
                    {percentageData && !metrics.isLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {percentageData.icon && (
                                <span style={{ color: percentageData.color, display: 'flex', alignItems: 'center' }}>
                                    {React.cloneElement(percentageData.icon as React.ReactElement, {
                                        size: "8px",
                                        style: { color: percentageData.color }
                                    })}
                                </span>
                            )}
                            <span
                                style={{
                                    color: percentageData.color,
                                    fontWeight: '700',
                                    fontSize: '10px',
                                    lineHeight: '1',
                                    fontFamily: 'HelveticaNeueW01-45Ligh, HelveticaNeueW02-45Ligh, HelveticaNeueW10-45Ligh, Helvetica Neue, Helvetica, Arial, sans-serif',
                                    letterSpacing: '1.3px'
                                }}
                            >
                                {percentageData.text}
                            </span>
                        </div>
                    )}
                </div>
            );
        };

    return (
        <Card>
            <Card.Content>
                <div style={{
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'left',
                    width: '100%',
                    justifyContent: 'space-between',
                    padding: '0px',
                    marginBottom: '16px'
                }}>
                    {/* Left side - Analytics metrics */}
                    <div style={{ display: 'flex', gap: '48px', alignItems: 'center' }}>
                        {orderStore.connectionStatus === 'connected' ? (
                            <>
                                <PeriodAnalyticsCard
                                    thirtyDaysValue={metrics.salesValue || 0}
                                    todayValue={metrics.todaySales || 0}
                                    yesterdayValue={metrics.yesterdaySales || 0}
                                    percentageChange={metrics.salesChange || 0}
                                    title="Sales"
                                    currencySymbol={metrics.currency || '€'}
                                />

                                <PeriodAnalyticsCard
                                    thirtyDaysValue={metrics.ordersValue || 0}
                                    todayValue={metrics.todayOrders || 0}
                                    yesterdayValue={metrics.yesterdayOrders || 0}
                                    percentageChange={metrics.ordersChange || 0}
                                    title="Orders"
                                    isCurrency={false}
                                />

                                <>
                                    <PeriodAnalyticsCard
                                        thirtyDaysValue={metrics.aovValue || 0}
                                        todayValue={metrics.todayAOV || 0}
                                        yesterdayValue={metrics.yesterdayAOV || 0}
                                        percentageChange={metrics.aovChange || 0}
                                        title="Avg. Order Value"
                                        currencySymbol={metrics.currency || '€'}
                                    />
                                    {(orderStore.selectedAnalyticsPeriod === 'today' || orderStore.selectedAnalyticsPeriod === 'yesterday') &&
                                        (metrics.uniqueVisitorsValue === 0 && metrics.todayUniqueVisitors === 0 && metrics.yesterdayUniqueVisitors === 0) ? (
                                        // For Today/Yesterday with no visitor data, show a placeholder or get data from 7 days
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            padding: '20px',
                                            minWidth: '120px'
                                        }}>
                                            <Text size="medium" secondary>Unique Visitors</Text>
                                            <Text size="medium" weight="normal" style={{ fontSize: '24px', lineHeight: 1, color: '#999' }}>
                                                N/A
                                            </Text>
                                            <Text size="tiny" secondary style={{ textAlign: 'center', marginTop: '4px' }}>
                                                Data not available for short periods
                                            </Text>
                                        </div>
                                    ) : (
                                        <PeriodAnalyticsCard
                                            thirtyDaysValue={metrics.uniqueVisitorsValue || 0}
                                            todayValue={metrics.todayUniqueVisitors || 0}
                                            yesterdayValue={metrics.yesterdayUniqueVisitors || 0}
                                            percentageChange={metrics.uniqueVisitorsChange || 0}
                                            title="Unique Visitors"
                                            isCurrency={false}
                                        />
                                    )}
                                </>
                            </>
                        ) : (
                            <Text size="small" secondary>
                                {orderStore.connectionStatus === 'connecting' ? 'Loading orders...' : 'Failed to load orders.'}
                            </Text>
                        )}
                    </div>

                    {/* Right side - Time Period Selector and Settings */}
                    {orderStore.connectionStatus === 'connected' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DropdownBase
                                selectedId={orderStore.selectedAnalyticsPeriod as TimePeriod}
                                options={timePeriodOptions.map(option => ({
                                    id: option.id,
                                    value: option.value
                                }))}
                                onSelect={handlePeriodChange}
                                placement="bottom-end"
                                zIndex={9999}
                            >
                                {({ toggle, selectedOption = {} }) => (
                                    <TextButton
                                        skin="standard"
                                        suffixIcon={<Icons.ChevronDown />}
                                        onClick={toggle}
                                        disabled={metrics.isLoading}
                                    >
                                        {selectedOption.value || 'Last 30 days'}
                                    </TextButton>
                                )}
                            </DropdownBase>

                            <div style={{
                                width: '1px',
                                height: '24px',
                                backgroundColor: '#E0E0E0',
                                margin: '0 8px',
                                alignSelf: 'center'
                            }} />

                            <IconButton
                                onClick={() => dashboard.navigate({
                                    pageId: '7570b9fe-ebe2-4486-9380-e5e4c41fc62d',
                                    relativeUrl: '/settings',
                                })}
                                size="medium"
                                skin="light"
                                priority="secondary"
                                aria-label="Settings"
                            >
                                <Icons.Settings color="#2B7FF5" />
                            </IconButton>
                        </div>
                    )}
                </div>

                {/* Analytics Cards Section - Only show if at least one component is visible */}
                {(settingsStore.settings.showTopSellingItems || settingsStore.settings.showLowInventoryItems) && (
                    <Box direction="horizontal" gap="24px" style={{ width: '100%', borderTop: '1px solid #e0e0e0' }}>
                        {/* Top Selling Items Card */}
                        {settingsStore.settings.showTopSellingItems && (
                            <Box>
                                <TopSellingItems />
                            </Box>
                        )}

                        {/* Low Inventory Items Card */}
                        {settingsStore.settings.showLowInventoryItems && (
                            <Box>
                                <LowInventoryItems />
                            </Box>
                        )}
                    </Box>
                )}

            </Card.Content>
        </Card>
    );
});