// components/OrderDetails/TrackingNumberDisplay.tsx
import React, { useState, useEffect } from 'react';
import { Text, Box, TextButton } from '@wix/design-system';
import { settingsStore } from '../../stores/SettingsStore';
import { orderFulfillments } from '@wix/ecom';

interface TrackingInfo {
    trackingNumber?: string;
    trackingLink?: string;
    shippingProvider?: string;
}

interface TrackingNumberDisplayProps {
    orderId: string;
    refreshTrigger?: number; // Add refreshTrigger prop
}

export const TrackingNumberDisplay: React.FC<TrackingNumberDisplayProps> = ({
    orderId,
    refreshTrigger = 0 // Default to 0 so it runs on first render
}) => {
    const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        setTrackingInfo(null);

        if (!orderId) {
            return;
        }

        const fetchTrackingInfo = async () => {
            try {
                setLoading(true);

                const response = await orderFulfillments.listFulfillmentsForSingleOrder(orderId);
                const fulfillments = response.orderWithFulfillments?.fulfillments || [];

                const withTracking = fulfillments
                    .filter(f => f.trackingInfo?.trackingNumber)
                    .sort((a, b) => new Date(b._createdDate).getTime() - new Date(a._createdDate).getTime())[0];
                setTrackingInfo(withTracking?.trackingInfo || null);
            } catch (error) {
                console.error('Error fetching tracking info:', error);
                setTrackingInfo(null);
            } finally {
                setLoading(false);
            }
        };

        fetchTrackingInfo();
    }, [orderId, refreshTrigger]);

    if (!trackingInfo?.trackingNumber) {
        return null;
    }

    const handleTrackingClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!settingsStore.clickToCopyEnabled) return;

        if (trackingInfo?.trackingLink) {
            window.open(trackingInfo.trackingLink, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <Box direction="horizontal" align="left" gap="4px">
            <Text size="small">Tracking: </Text>
            <TextButton
                size="small"
                underline={settingsStore.clickToCopyEnabled ? 'onHover' : 'none'}
                onClick={handleTrackingClick}
                style={{
                    cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                    color: settingsStore.clickToCopyEnabled ? 'var(--text-button-color, #2B7FF2)' : 'var(--text-color, #2B2B2B)'
                }}
            >
                {trackingInfo.trackingNumber}
            </TextButton>
        </Box>
    );
};