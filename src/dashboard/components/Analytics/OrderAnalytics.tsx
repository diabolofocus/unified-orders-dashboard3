// Final OrderAnalytics.tsx - Clean implementation with enhanced features
import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Text, Card, Loader } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { PeriodAnalyticsCard } from './PeriodAnalyticsCard';

interface AnalyticsData {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    currency: string;
    fulfilledOrders: number;
    pendingOrders: number;
    isLoading: boolean;
    todaySales: number;
    yesterdaySales: number;
    todayOrders: number;
    yesterdayOrders: number;
    ordersChange?: number;
}

export const OrderAnalytics: React.FC = observer(() => {
    const { orderStore } = useStores();

    const calculateAnalytics = (): AnalyticsData => {
        const isLoading = orderStore.analyticsLoading;

        // Use Analytics API data if available
        if (orderStore.formattedAnalytics && !orderStore.analyticsError && !isLoading) {
            const apiAnalytics = orderStore.formattedAnalytics;

            // Calculate fulfillment stats from orders (API doesn't provide this)
            const last30DaysOrders = getLast30DaysOrders();
            const fulfilledOrders = last30DaysOrders.filter(order => order.status === 'FULFILLED').length;
            const pendingOrders = last30DaysOrders.filter(order =>
                order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED'
            ).length;

            // Calculate today's and yesterday's orders and sales from orders data
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let todaySales = 0;
            let yesterdaySales = 0;
            let todayOrders = 0;
            let yesterdayOrders = 0;

            last30DaysOrders.forEach(order => {
                const orderDate = new Date(order._createdDate);
                orderDate.setHours(0, 0, 0, 0);

                if (orderDate.getTime() === today.getTime()) {
                    todaySales += parsePrice(order.total);
                    todayOrders++;
                } else if (orderDate.getTime() === yesterday.getTime()) {
                    yesterdaySales += parsePrice(order.total);
                    yesterdayOrders++;
                }
            });

            return {
                totalSales: apiAnalytics.totalSales,
                totalOrders: apiAnalytics.totalOrders,
                averageOrderValue: apiAnalytics.averageOrderValue,
                currency: apiAnalytics.currency,
                fulfilledOrders,
                pendingOrders,
                isLoading: false,
                todaySales,
                yesterdaySales,
                todayOrders,
                yesterdayOrders,
                ordersChange: apiAnalytics.ordersChange || 0
            };
        }

        if (isLoading) {
            return {
                totalSales: 0,
                totalOrders: 0,
                averageOrderValue: 0,
                currency: '€',
                fulfilledOrders: 0,
                pendingOrders: 0,
                isLoading: true,
                todaySales: 0,
                yesterdaySales: 0,
                todayOrders: 0,
                yesterdayOrders: 0
            };
        }

        // Fallback to order-based calculation
        return calculateFromOrders();
    };

    // Helper to get last 30 days orders
    const getLast30DaysOrders = () => {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        return orderStore.orders.filter(order => {
            const orderDate = new Date(order._createdDate);
            return orderDate >= thirtyDaysAgo;
        });
    };

    // Helper to parse price string
    const parsePrice = (price: string): number => {
        const cleaned = price.replace(/[^0-9.,-]/g, '');
        const normalized = cleaned.replace(',', '.');
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Helper to extract currency symbol
    const extractCurrency = (price: string): string => {
        const match = price.match(/[^0-9.,-]+/);
        return match ? match[0] : '€';
    };

    // Fallback calculation from orders
    const calculateFromOrders = (): AnalyticsData => {
        const last30DaysOrders = getLast30DaysOrders();

        let totalSales = 0;
        let currency = '€';
        let todaySales = 0;
        let yesterdaySales = 0;
        let todayOrders = 0;
        let yesterdayOrders = 0;

        // Get today's and yesterday's dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        last30DaysOrders.forEach(order => {
            const parsedPrice = parsePrice(order.total);
            totalSales += parsedPrice;
            const orderCurrency = extractCurrency(order.total);
            if (orderCurrency !== '€') {
                currency = orderCurrency;
            }

            // Calculate today's and yesterday's stats
            const orderDate = new Date(order._createdDate);
            orderDate.setHours(0, 0, 0, 0);

            if (orderDate.getTime() === today.getTime()) {
                todaySales += parsedPrice;
                todayOrders++;
            } else if (orderDate.getTime() === yesterday.getTime()) {
                yesterdaySales += parsedPrice;
                yesterdayOrders++;
            }
        });

        const totalOrders = last30DaysOrders.length;
        const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
        const fulfilledOrders = last30DaysOrders.filter(order => order.status === 'FULFILLED').length;
        const pendingOrders = last30DaysOrders.filter(order =>
            order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED'
        ).length;

        return {
            totalSales,
            totalOrders,
            averageOrderValue,
            currency,
            fulfilledOrders,
            pendingOrders,
            isLoading: false,
            todaySales,
            yesterdaySales,
            todayOrders,
            yesterdayOrders,
            ordersChange: yesterdayOrders > 0 ?
                Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100) :
                (todayOrders > 0 ? 100 : 0)
        };
    };

    const analytics = calculateAnalytics();

    const formatCurrency = (amount: number, currency: string): string => {
        return `${currency}${amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    const MetricCard: React.FC<{
        icon: React.ReactNode;
        title: string;
        value: string;
        bgColor: string;
        iconColor: string;
        isLoading?: boolean;
    }> = ({ icon, title, value, bgColor, iconColor, isLoading }) => (
        <Card>
            <Card.Content>
                <Box
                    direction="horizontal"
                    align="center"
                    gap="12px"
                    paddingTop="12px"
                    paddingBottom="12px"
                    paddingLeft="16px"
                    paddingRight="16px"
                >
                    <Box
                        width="40px"
                        height="40px"
                        borderRadius="50%"
                        backgroundColor={bgColor}
                        align="center"
                        verticalAlign="middle"
                    >
                        {isLoading ? (
                            <Loader size="tiny" />
                        ) : (
                            React.cloneElement(icon as React.ReactElement, {
                                size: "20px",
                                style: { color: iconColor }
                            })
                        )}
                    </Box>
                    <Box direction="vertical" gap="2px">
                        <Text size="tiny" secondary>{title}</Text>
                        <Text size="medium" weight="bold">
                            {isLoading ? 'Loading...' : value}
                        </Text>
                    </Box>
                </Box>
            </Card.Content>
        </Card>
    );

    const { todaySales, yesterdaySales } = analytics;

    return (
        <Box gap="40px" direction="horizontal" align="center">
            {/* Sales Metric */}
            <PeriodAnalyticsCard
                thirtyDaysValue={analytics.totalSales}
                todayValue={analytics.todaySales}
                yesterdayValue={analytics.yesterdaySales}
                title="Sales (30 days)"
                currencySymbol={analytics.currency}
            />

            {/* Orders Metric */}
            <PeriodAnalyticsCard
                thirtyDaysValue={analytics.totalOrders}
                todayValue={analytics.todayOrders}
                yesterdayValue={analytics.yesterdayOrders}
                percentageChange={analytics.ordersChange || 0}
                title="Orders (30 days)"
                isCurrency={false}
            />

            {/* Average Order Value */}
            <MetricCard
                icon={<Icons.ArrowUp />}
                title="Average Order Value"
                value={formatCurrency(analytics.averageOrderValue, analytics.currency)}
                bgColor="#fef3c7"
                iconColor="#f59e0b"
                isLoading={analytics.isLoading}
            />

            {/* Order Status Summary */}
            <Card>
                <Card.Content>
                    <Box
                        direction="horizontal"
                        align="center"
                        gap="12px"
                        paddingTop="12px"
                        paddingBottom="12px"
                        paddingLeft="16px"
                        paddingRight="16px"
                    >
                        <Box
                            width="40px"
                            height="40px"
                            borderRadius="50%"
                            backgroundColor="#f3e8ff"
                            align="center"
                            verticalAlign="middle"
                        >
                            {analytics.isLoading ? (
                                <Loader size="tiny" />
                            ) : (
                                <Icons.StatusComplete size="20px" style={{ color: '#8b5cf6' }} />
                            )}
                        </Box>
                        <Box direction="vertical" gap="2px">
                            <Text size="tiny" secondary>Fulfillment Rate</Text>
                            <Text size="medium" weight="bold">
                                {analytics.isLoading
                                    ? 'Loading...'
                                    : analytics.totalOrders > 0
                                        ? `${Math.round((analytics.fulfilledOrders / analytics.totalOrders) * 100)}%`
                                        : '0%'
                                }
                            </Text>
                            {!analytics.isLoading && (
                                <Text size="tiny" secondary>
                                    {analytics.fulfilledOrders} of {analytics.totalOrders} fulfilled
                                </Text>
                            )}
                        </Box>
                    </Box>
                </Card.Content>
            </Card>
        </Box>
    );
});