// services/AnalyticsService.ts - Enhanced with multi-period support
import { analyticsData } from '@wix/analytics-data';

export class AnalyticsService {

    // Get analytics data for a specific period
    async getAnalyticsData(measurementTypes: string[], startDate: string, endDate?: string) {
        const endDateToUse = endDate || new Date().toISOString().split('T')[0];

        try {
            const response = await analyticsData.getAnalyticsData(
                measurementTypes as any[],
                {
                    dateRange: {
                        startDate: startDate,
                        endDate: endDateToUse
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

        try {
            const { current, previous } = this.getComparisonDateRanges(period);

            // First, get the main analytics data
            const currentResult = await this.getAnalyticsData(measurementTypes, current.startDate, current.endDate);

            const previousResult = await this.getAnalyticsData(measurementTypes, previous.startDate, previous.endDate);

            // Get today's and yesterday's dates
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const todayStr = today.toISOString().split('T')[0];
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // Extract today's and yesterday's visitor counts from the detailed data if available
            let todayVisitors = 0;
            let yesterdayVisitors = 0;

            if (currentResult.success && currentResult.data) {
                // Find the unique visitors data in the current result
                const uniqueVisitorsData = currentResult.data.find((item: any) => item.type === 'TOTAL_UNIQUE_VISITORS');

                if (uniqueVisitorsData?.values?.length) {
                    // Try to find today's and yesterday's data in the detailed values
                    const todayData = uniqueVisitorsData.values.find((item: any) => item.date === todayStr);
                    const yesterdayData = uniqueVisitorsData.values.find((item: any) => item.date === yesterdayStr);

                    if (todayData) {
                        todayVisitors = todayData.value || 0;
                    }

                    if (yesterdayData) {
                        yesterdayVisitors = yesterdayData.value || 0;
                    }
                }
            }

            if (currentResult.success && previousResult.success) {
                const analytics = this.formatAnalyticsWithComparison(
                    currentResult.data || [],
                    previousResult.data || [],
                    {
                        todayUniqueVisitors: todayVisitors,
                        yesterdayUniqueVisitors: yesterdayVisitors,
                        // Pass the detailed values if available
                        detailedUniqueVisitors: currentResult.data?.find((item: any) => item.type === 'TOTAL_UNIQUE_VISITORS')?.values || []
                    }
                );

                return {
                    success: true,
                    data: {
                        ...analytics,
                        // Ensure we include the detailed values in the response
                        detailedUniqueVisitors: currentResult.data?.find((item: any) => item.type === 'TOTAL_UNIQUE_VISITORS')?.values || []
                    },
                    period
                };
            } else {
                const errorMsg = 'Failed to get analytics data for comparison';
                throw new Error(errorMsg);
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
            detailedUniqueVisitors?: Array<{ date?: string; value?: number }>;
        } = {}
    ) {
        console.log('Raw currentData in formatAnalyticsWithComparison:', currentData);
        console.log('Raw previousData in formatAnalyticsWithComparison:', previousData);

        const current = this.transformAnalyticsData(currentData);
        const previous = this.transformAnalyticsData(previousData);

        console.log('Transformed current data:', current);
        console.log('Transformed previous data:', previous);

        const calculateChange = (currentVal: number, previousVal: number): number => {
            if (previousVal === 0) return currentVal > 0 ? 100 : 0;
            return Math.round(((currentVal - previousVal) / previousVal) * 100);
        };

        // Get today's and yesterday's unique visitors from the detailed data
        // For periods other than 'today'/'yesterday', use the most recent available data
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Try to get today's and yesterday's visitors from the detailed data if available
        let todayUniqueVisitors = additionalData.todayUniqueVisitors || 0;
        let yesterdayUniqueVisitors = additionalData.yesterdayUniqueVisitors || 0;

        // If we have detailed data for unique visitors, try to extract the values
        if (current.TOTAL_UNIQUE_VISITORS?.values?.length > 0) {
            const values = current.TOTAL_UNIQUE_VISITORS.values;

            // First try to find exact today/yesterday dates
            const todayData = values.find((item: any) => item.date === today);
            const yesterdayData = values.find((item: any) => item.date === yesterdayStr);

            if (todayData) {
                todayUniqueVisitors = todayData.value || 0;
            }
            if (yesterdayData) {
                yesterdayUniqueVisitors = yesterdayData.value || 0;
            }

            // If today/yesterday dates are not in the range, use the most recent available data
            if (!todayData || !yesterdayData) {
                // Sort values by date descending to get most recent first
                const sortedValues = [...values].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (!todayData && sortedValues.length > 0) {
                    todayUniqueVisitors = sortedValues[0].value || 0;
                }
                if (!yesterdayData && sortedValues.length > 1) {
                    yesterdayUniqueVisitors = sortedValues[1].value || 0;
                }
            }
        }

        console.log('Visitor data in formatAnalyticsWithComparison:', {
            today: today,
            yesterday: yesterdayStr,
            todayUniqueVisitors,
            yesterdayUniqueVisitors,
            hasCurrentData: !!current.TOTAL_UNIQUE_VISITORS,
            hasCurrentValues: current.TOTAL_UNIQUE_VISITORS?.values?.length > 0,
            additionalData
        });

        return {
            totalSales: current.TOTAL_SALES?.total || 0,
            totalOrders: current.TOTAL_ORDERS?.total || 0,
            totalSessions: current.TOTAL_SESSIONS?.total || 0,
            // For total unique visitors, use the sum of values if available, otherwise use the total
            totalUniqueVisitors: current.TOTAL_UNIQUE_VISITORS?.total ||
                (current.TOTAL_UNIQUE_VISITORS?.values?.reduce((sum: number, item: any) => sum + (item?.value || 0), 0) || 0),
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

                console.log(`[getComparisonDateRanges] TODAY: current=${today.toISOString().split('T')[0]}, previous=${yesterday.toISOString().split('T')[0]}`);

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

                console.log(`[getComparisonDateRanges] YESTERDAY: current=${yesterdayStart.toISOString().split('T')[0]}, previous=${twoDaysAgo.toISOString().split('T')[0]}`);

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