// components/TrackingNumberModal/FulfilledItemsTrackingDisplay.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, TextButton, Button } from '@wix/design-system';
import { orderFulfillments } from '@wix/ecom';

interface FulfillmentInfo {
    fulfillmentId: string;
    trackingNumber: string;
    trackingUrl?: string;
    carrier?: string;
    quantity: number;
    fulfillmentDate?: string;
}

interface FulfilledItemsTrackingDisplayProps {
    orderId: string;
    itemId: string;
    onEditTracking?: (fulfillmentId: string) => void;
}

export const FulfilledItemsTrackingDisplay: React.FC<FulfilledItemsTrackingDisplayProps> = ({
    orderId,
    itemId,
    onEditTracking
}) => {
    const [fulfillments, setFulfillments] = useState<FulfillmentInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!orderId || !itemId) {
            setFulfillments([]);
            return;
        }

        const fetchFulfillments = async () => {
            try {
                setLoading(true);

                const response = await orderFulfillments.listFulfillmentsForSingleOrder(orderId);
                const fulfillmentsList = response.orderWithFulfillments?.fulfillments || [];

                const itemFulfillments: FulfillmentInfo[] = [];

                fulfillmentsList.forEach((fulfillment: any) => {
                    if (!fulfillment.trackingInfo?.trackingNumber) return;

                    const itemLineItem = fulfillment.lineItems?.find((li: any) => {
                        const possibleIds = [
                            li._id,
                            li.id,
                            li.lineItemId,
                            li.itemId
                        ].filter(Boolean);
                        return possibleIds.includes(itemId);
                    });

                    if (itemLineItem) {
                        itemFulfillments.push({
                            fulfillmentId: fulfillment._id,
                            trackingNumber: fulfillment.trackingInfo.trackingNumber,
                            trackingUrl: fulfillment.trackingInfo.trackingLink || fulfillment.trackingInfo.trackingUrl,
                            carrier: fulfillment.trackingInfo.shippingProvider,
                            quantity: itemLineItem.quantity || 1,
                            fulfillmentDate: fulfillment._createdDate
                        });
                    }
                });

                setFulfillments(itemFulfillments);
            } catch (error) {
                console.error('Error fetching fulfilled items:', error);
                setFulfillments([]);
            } finally {
                setLoading(false);
            }
        };

        fetchFulfillments();
    }, [orderId, itemId]);

    // Don't show loading or "no tracking" messages - just return null
    if (loading || fulfillments.length === 0) {
        return null;
    }

    return (
        <Box direction="vertical" gap="6px">
            {fulfillments.map((fulfillment, idx) => {
                const hasTrackingUrl = fulfillment.trackingUrl && fulfillment.trackingUrl.trim() !== '';
                const carrierName = fulfillment.carrier === 'other' ? 'Other' : fulfillment.carrier;

                return (
                    <Box key={idx} direction="horizontal" gap="8px" align="center" style={{ width: '100%' }}>
                        <Box direction="horizontal" gap="4px" align="center" flex="1">
                            <Text size="tiny">Tracking:</Text>
                            {hasTrackingUrl ? (
                                <TextButton
                                    size="tiny"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(fulfillment.trackingUrl, '_blank');
                                    }}
                                >
                                    {fulfillment.trackingNumber}
                                </TextButton>
                            ) : (
                                <Text size="tiny" weight="normal">
                                    {fulfillment.trackingNumber}
                                </Text>
                            )}
                            {carrierName && (
                                <Text size="tiny" secondary>
                                    ({carrierName})
                                </Text>
                            )}
                            <Text size="tiny" secondary>
                                ×{fulfillment.quantity}
                            </Text>
                        </Box>

                        {/* Edit button for this specific fulfillment */}
                        {onEditTracking && (
                            <Button
                                size="tiny"
                                priority="secondary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditTracking(fulfillment.fulfillmentId);
                                }}
                                style={{ fontSize: '9px', padding: '2px 6px' }}
                            >
                                Edit
                            </Button>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};