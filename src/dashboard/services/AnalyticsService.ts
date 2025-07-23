// services/AnalyticsService.ts - Enhanced with multi-period support
import { analyticsData } from '@wix/analytics-data';

export class AnalyticsService {

    // Get analytics data for a specific period
    async getAnalyticsData(measurementTypes: string[], startDate: string, endDate?: string) {
        try {
            const response = await analyticsData.getAnalyticsData(
                measurementTypes as any[],
                {
                    dateRange: {
                        startDate: startDate,
                        endDate: endDate || new Date().toISOString().split('T')[0]
                    }
                }
            );

            return {
                success: true,
                data: response.data,
                measurementTypes: measurementTypes
            };

        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                measurementTypes: measurementTypes
            };
        }
    }

    // Get analytics with comparison to previous period
    async getAnalyticsWithComparison(period: 'today' | 'yesterday' | '7days' | '30days' | 'thisweek' | 'thismonth' | '365days' | 'thisyear') {
        const measurementTypes = ['TOTAL_SALES', 'TOTAL_ORDERS', 'TOTAL_UNIQUE_VISITORS'];
        const dailyMeasurementTypes = ['TOTAL_UNIQUE_VISITORS'];

        try {
            const { current, previous } = this.getComparisonDateRanges(period);

            // Get current period data
            const currentResult = await this.getAnalyticsData(
                measurementTypes,
                current.startDate,
                current.endDate
            );

            // Get previous period data
            const previousResult = await this.getAnalyticsData(
                measurementTypes,
                previous.startDate,
                previous.endDate
            );

            // Get daily data for unique visitors
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const todayStr = today.toISOString().split('T')[0];
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const todayResult = await this.getAnalyticsData(
                dailyMeasurementTypes,
                todayStr,
                todayStr
            );

            const yesterdayResult = await this.getAnalyticsData(
                dailyMeasurementTypes,
                yesterdayStr,
                yesterdayStr
            );

            if (currentResult.success && previousResult.success) {
                const analytics = this.formatAnalyticsWithComparison(
                    currentResult.data || [],
                    previousResult.data || [],
                    {
                        todayUniqueVisitors: todayResult.success ? todayResult.data?.[0]?.values?.[0]?.value || 0 : 0,
                        yesterdayUniqueVisitors: yesterdayResult.success ? yesterdayResult.data?.[0]?.values?.[0]?.value || 0 : 0
                    }
                );

                return {
                    success: true,
                    data: analytics,
                    period
                };
            } else {
                throw new Error('Failed to get analytics data for comparison');
            }

        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                period
            };
        }
    }

    // Format analytics data with percentage comparisons
    private formatAnalyticsWithComparison(
        currentData: any[],
        previousData: any[],
        additionalData: {
            todayUniqueVisitors?: number;
            yesterdayUniqueVisitors?: number;
        } = {}
    ) {
        const current = this.transformAnalyticsData(currentData);
        const previous = this.transformAnalyticsData(previousData);

        const calculateChange = (currentVal: number, previousVal: number): number => {
            if (previousVal === 0) return currentVal > 0 ? 100 : 0;
            return Math.round(((currentVal - previousVal) / previousVal) * 100);
        };

        const todayUniqueVisitors = additionalData.todayUniqueVisitors || 0;
        const yesterdayUniqueVisitors = additionalData.yesterdayUniqueVisitors || 0;

        return {
            totalSales: current.TOTAL_SALES?.total || 0,
            totalOrders: current.TOTAL_ORDERS?.total || 0,
            totalSessions: current.TOTAL_SESSIONS?.total || 0,
            totalUniqueVisitors: current.TOTAL_UNIQUE_VISITORS?.total || 0,
            todayUniqueVisitors,
            yesterdayUniqueVisitors,
            averageOrderValue: current.TOTAL_ORDERS?.total > 0
                ? (current.TOTAL_SALES?.total || 0) / current.TOTAL_ORDERS.total
                : 0,
            currency: '€', // Default currency

            // Percentage changes
            salesChange: calculateChange(
                current.TOTAL_SALES?.total || 0,
                previous.TOTAL_SALES?.total || 0
            ),
            ordersChange: calculateChange(
                current.TOTAL_ORDERS?.total || 0,
                previous.TOTAL_ORDERS?.total || 0
            ),
            sessionsChange: calculateChange(
                current.TOTAL_SESSIONS?.total || 0,
                previous.TOTAL_SESSIONS?.total || 0
            ),
            uniqueVisitorsChange: calculateChange(
                current.TOTAL_UNIQUE_VISITORS?.total || 0,
                previous.TOTAL_UNIQUE_VISITORS?.total || 0
            ),
            aovChange: calculateChange(
                current.TOTAL_ORDERS?.total > 0
                    ? (current.TOTAL_SALES?.total || 0) / current.TOTAL_ORDERS.total
                    : 0,
                previous.TOTAL_ORDERS?.total > 0
                    ? (previous.TOTAL_SALES?.total || 0) / previous.TOTAL_ORDERS.total
                    : 0
            )
        };
    }

    // Transform API response to expected format
    private transformAnalyticsData(data: any[]) {
        const analytics: { [key: string]: any } = {};

        data.forEach((item: any) => {
            analytics[item.type] = {
                total: item.total,
                values: item.values || []
            };
        });

        return analytics;
    }

    // Get date ranges for current and previous periods for comparison
    private getComparisonDateRanges(period: string) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (period) {
            case 'today':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const dayBefore = new Date(today);
                dayBefore.setDate(dayBefore.getDate() - 2);
                return {
                    current: {
                        startDate: today.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: yesterday.toISOString().split('T')[0],
                        endDate: yesterday.toISOString().split('T')[0]
                    }
                };

            case 'yesterday':
                const yesterdayStart = new Date(today);
                yesterdayStart.setDate(yesterdayStart.getDate() - 1);
                const twoDaysAgo = new Date(today);
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                return {
                    current: {
                        startDate: yesterdayStart.toISOString().split('T')[0],
                        endDate: yesterdayStart.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: twoDaysAgo.toISOString().split('T')[0],
                        endDate: twoDaysAgo.toISOString().split('T')[0]
                    }
                };

            case '7days':
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const fourteenDaysAgo = new Date(today);
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                return {
                    current: {
                        startDate: sevenDaysAgo.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: fourteenDaysAgo.toISOString().split('T')[0],
                        endDate: sevenDaysAgo.toISOString().split('T')[0]
                    }
                };

            case '30days':
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const sixtyDaysAgo = new Date(today);
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                return {
                    current: {
                        startDate: thirtyDaysAgo.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: sixtyDaysAgo.toISOString().split('T')[0],
                        endDate: thirtyDaysAgo.toISOString().split('T')[0]
                    }
                };

            case 'thisweek':
                // FIXED: Monday-based weeks (Monday = start, Sunday = end)
                const startOfWeek = new Date(today);
                const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday=6 days back, others=dayOfWeek-1
                startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);

                // Previous week: 7 days before current week start
                const startOfLastWeek = new Date(startOfWeek);
                startOfLastWeek.setDate(startOfWeek.getDate() - 7);
                const endOfLastWeek = new Date(startOfWeek);
                endOfLastWeek.setDate(startOfWeek.getDate() - 1); // Day before current week starts (Sunday)

                return {
                    current: {
                        startDate: startOfWeek.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: startOfLastWeek.toISOString().split('T')[0],
                        endDate: endOfLastWeek.toISOString().split('T')[0]
                    }
                };

            case 'thismonth':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                return {
                    current: {
                        startDate: startOfMonth.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: startOfLastMonth.toISOString().split('T')[0],
                        endDate: endOfLastMonth.toISOString().split('T')[0]
                    }
                };

            case 'thisyear':
                const startOfThisYear = new Date(now.getFullYear(), 0, 1);
                const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
                const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
                return {
                    current: {
                        startDate: startOfThisYear.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: startOfLastYear.toISOString().split('T')[0],
                        endDate: endOfLastYear.toISOString().split('T')[0]
                    }
                };

            case '365days':
                const oneYearAgo = new Date(today);
                oneYearAgo.setDate(oneYearAgo.getDate() - 365);
                const twoYearsAgo = new Date(today);
                twoYearsAgo.setDate(twoYearsAgo.getDate() - 730);
                return {
                    current: {
                        startDate: oneYearAgo.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: twoYearsAgo.toISOString().split('T')[0],
                        endDate: oneYearAgo.toISOString().split('T')[0]
                    }
                };

            default:
                // Default to 30 days
                const defaultThirtyDaysAgo = new Date(today);
                defaultThirtyDaysAgo.setDate(defaultThirtyDaysAgo.getDate() - 30);
                const defaultSixtyDaysAgo = new Date(today);
                defaultSixtyDaysAgo.setDate(defaultSixtyDaysAgo.getDate() - 60);
                return {
                    current: {
                        startDate: defaultThirtyDaysAgo.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0]
                    },
                    previous: {
                        startDate: defaultSixtyDaysAgo.toISOString().split('T')[0],
                        endDate: defaultThirtyDaysAgo.toISOString().split('T')[0]
                    }
                };
        }
    }

    // Legacy method for backwards compatibility (simplified)
    getDateRange(period: string): { startDate: string; endDate: string } {
        const { current } = this.getComparisonDateRanges(period);
        return current;
    }
}