// components/OrderDetails/TrackingNumberDisplay.tsx
import React, { useState, useEffect } from 'react';
import { Text, Box, TextButton } from '@wix/design-system';
import { settingsStore } from '../../stores/SettingsStore';
import { orderFulfillments } from '@wix/ecom';

interface TrackingInfo {
    trackingNumber?: string | null;  // Updated to match FulfillmentTrackingInfo
    trackingLink?: string | null;    // Updated to match FulfillmentTrackingInfo  
    shippingProvider?: string | null; // Updated to match FulfillmentTrackingInfo
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
    const [loading, setLoading] = useState(false);

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
                    .sort((a, b) => {
                        // Safe handling of potentially null/undefined dates
                        const dateA = a._createdDate ? new Date(a._createdDate).getTime() : 0;
                        const dateB = b._createdDate ? new Date(b._createdDate).getTime() : 0;
                        return dateB - dateA;
                    })[0];

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
        <Box>
            <Text>Tracking: </Text>
            <TextButton onClick={handleTrackingClick}>
                {trackingInfo.trackingNumber}
            </TextButton>
        </Box>
    );
};