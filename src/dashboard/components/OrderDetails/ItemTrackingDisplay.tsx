// components/OrderDetails/ItemTrackingDisplay.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, TextButton } from '@wix/design-system';
import { settingsStore } from '../../stores/SettingsStore';
import { orderFulfillments } from '@wix/ecom';

interface TrackingInfo {
    trackingNumber: string;
    trackingUrl?: string;
    carrier?: string;
    quantity: number;
    fulfillmentDate?: string;
}

interface ItemTrackingDisplayProps {
    orderId: string;
    itemId: string;
    refreshTrigger?: number;
}

export const ItemTrackingDisplay: React.FC<ItemTrackingDisplayProps> = ({
    orderId,
    itemId,
    refreshTrigger = 0
}) => {
    const [trackingInfos, setTrackingInfos] = useState<TrackingInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!orderId || !itemId) {
            setTrackingInfos([]);
            return;
        }

        let isCancelled = false;

        const fetchItemTrackingInfo = async () => {
            try {
                if (!isCancelled) {
                    setLoading(true);
                }

                // Fetch all fulfillments for this order
                const response = await orderFulfillments.listFulfillmentsForSingleOrder(orderId);
                
                if (isCancelled) return;
                
                const fulfillments = response.orderWithFulfillments?.fulfillments || [];

                // Find tracking info for this specific item
                const itemTrackingInfos: TrackingInfo[] = [];

                fulfillments.forEach((fulfillment) => {
                    if (!fulfillment.trackingInfo?.trackingNumber) return;

                    // Check if this fulfillment contains our specific item
                    // Use the correct property names based on the actual API response
                    const itemLineItem = fulfillment.lineItems?.find(li => {
                        // Try different possible property names that might exist
                        const lineItemId = (li as any).lineItemId || (li as any).id || li._id;
                        return lineItemId === itemId || li._id === itemId;
                    });

                    if (itemLineItem) {
                        itemTrackingInfos.push({
                            trackingNumber: fulfillment.trackingInfo.trackingNumber,
                            trackingUrl: fulfillment.trackingInfo.trackingLink || undefined,
                            carrier: fulfillment.trackingInfo.shippingProvider || undefined,
                            quantity: itemLineItem.quantity || 1,
                            fulfillmentDate: typeof fulfillment._createdDate === 'string'
                                ? fulfillment._createdDate
                                : new Date(fulfillment._createdDate || '').toISOString()
                        });
                    }
                });

                if (!isCancelled) {
                    setTrackingInfos(itemTrackingInfos);
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Error fetching item tracking info:', error);
                    setTrackingInfos([]);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchItemTrackingInfo();

        return () => {
            isCancelled = true;
        };
    }, [orderId, itemId, refreshTrigger]);

    // Don't show loading state for tracking - just show nothing until we have data
    if (loading || trackingInfos.length === 0) {
        return null;
    }

    return (
        <Box direction="vertical" gap="2px">
            {trackingInfos.map((tracking, idx) => {
                const hasTrackingUrl = tracking.trackingUrl && tracking.trackingUrl.trim() !== '';
                const carrierName = tracking.carrier === 'other' ? 'Other' : tracking.carrier;

                return (
                    <Box key={idx} direction="horizontal" gap="4px" align="left">
                        <Text size="tiny" secondary>Tracking:</Text>
                        {hasTrackingUrl ? (
                            <TextButton
                                size="tiny"
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    if (!settingsStore.clickToCopyEnabled) return;
                                    window.open(tracking.trackingUrl, '_blank');
                                }}
                                underline={settingsStore.clickToCopyEnabled ? 'onHover' : 'none'}
                                style={{
                                    cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                    color: settingsStore.clickToCopyEnabled ? 'var(--text-button-color, #2B7FF2)' : 'var(--text-color, #2B2B2B)'
                                }}
                            >
                                {tracking.trackingNumber}
                            </TextButton>
                        ) : (
                            <Text size="tiny" weight="normal">
                                {tracking.trackingNumber}
                            </Text>
                        )}
                        {carrierName && (
                            <Text size="tiny" secondary>
                                ({carrierName})
                            </Text>
                        )}
                        {tracking.quantity > 1 && (
                            <Text size="tiny" secondary>
                                ×{tracking.quantity}
                            </Text>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};