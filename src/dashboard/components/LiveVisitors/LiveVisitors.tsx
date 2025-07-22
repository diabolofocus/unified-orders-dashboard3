import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Card, Text, Box, Loader, Divider } from '@wix/design-system';
import { Visible } from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';

interface SessionData {
    count: number;
    activeSessions: any[]; // Not used anymore, kept for compatibility
}

export const LiveVisitors: React.FC = observer(() => {
    const { settingsStore, orderStore } = useStores();
    const [visitorData, setVisitorData] = useState<SessionData>({ count: 0, activeSessions: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!settingsStore.showAnalyticsCard) {
            return;
        }

        const loadSessionData = () => {
            try {
                setIsLoading(true);
                setError(null);

                // Get analytics data from the store (already fetched by CompactAnalytics)
                const analyticsData = orderStore.formattedAnalytics;

                if (analyticsData) {
                    setVisitorData({
                        count: analyticsData.totalUniqueVisitors || 0,
                        activeSessions: [] // We'll populate this with period breakdown
                    });
                } else {
                    setVisitorData({
                        count: 0,
                        activeSessions: []
                    });
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Error loading session data:', err);
                setError('Failed to load session data');
                setIsLoading(false);
            }
        };

        loadSessionData();

        // Update when analytics data changes
        const interval = setInterval(loadSessionData, 5000); // Refresh every 5 seconds

        return () => clearInterval(interval);
    }, [settingsStore.showAnalyticsCard, orderStore.formattedAnalytics]);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            // This will be handled by the cleanup function returned from initRealtime
        };
    }, []);

    const getPeriodDisplayName = (period: string) => {
        switch (period) {
            case 'today': return 'Today';
            case 'yesterday': return 'Yesterday';
            case '7days': return 'Last 7 days';
            case '30days': return 'Last 30 days';
            case 'thisweek': return 'This week';
            case 'thismonth': return 'This month';
            default: return period;
        }
    };

    if (!settingsStore.showAnalyticsCard) {
        return null;
    }

    return (
        <Card>
            <Divider />

            <Box direction="horizontal" align="left" gap="8px" paddingTop="16px" paddingBottom="12px">
                <Text size="small" weight="normal">Unique Visitors</Text>
            </Box>

            <Box
                border="1px solid #e0e0e0"
                borderRadius="8px"
                height="auto"
                padding="8px"
                width="150px"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    marginTop: '4px'
                }}
            >
                {isLoading ? (
                    <Box align="left" padding="12px">
                        <Loader size="small" />
                    </Box>
                ) : error ? (
                    <Box padding="12px">
                        <Text size="small">{error}</Text>
                    </Box>
                ) : (
                    <Box direction="horizontal" gap="8px" align="center">
                        <Text size="small" weight="normal">{visitorData.count} unique visitors</Text>
                        {orderStore.formattedAnalytics?.uniqueVisitorsChange !== undefined && (
                            <Text
                                size="small"
                                style={{
                                    color: orderStore.formattedAnalytics.uniqueVisitorsChange > 0 ? '#22c55e' :
                                        orderStore.formattedAnalytics.uniqueVisitorsChange < 0 ? '#6b7280' : '#6b7280',
                                    fontWeight: '700'
                                }}
                            >
                                {orderStore.formattedAnalytics.uniqueVisitorsChange > 0 ? '+' : ''}{orderStore.formattedAnalytics.uniqueVisitorsChange}%
                            </Text>
                        )}
                    </Box>
                )}
            </Box>

        </Card>
    );
});
