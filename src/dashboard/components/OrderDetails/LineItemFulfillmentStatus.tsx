// components/OrderDetails/LineItemFulfillmentStatus.tsx - ENHANCED with per-item tracking

import React from 'react';
import { Box, Text, Button } from '@wix/design-system';
import { settingsStore } from '../../stores/SettingsStore';
import { StatusBadge } from '../shared/StatusBadge';

type FulfillmentStatus = 'FULFILLED' | 'PARTIALLY_FULFILLED' | 'NOT_FULFILLED';

interface TrackingInfo {
    trackingNumber: string;
    trackingUrl?: string;
    carrier?: string;
    quantity: number;
    fulfillmentId?: string;
    fulfillmentDate?: string;
}

interface FulfillmentDetails {
    lineItemFulfillment?: Array<{
        quantity: number;
        fulfillmentId: string;
        trackingNumber?: string;
        trackingUrl?: string;
        carrier?: string;
        fulfillmentDate?: string;
    }>;
    trackingInfo?: TrackingInfo[];
}

interface LineItemFulfillmentStatusProps {
    item: {
        quantity?: number;
        fulfilledQuantity?: number;
        remainingQuantity?: number;
        fulfillmentStatus?: FulfillmentStatus;
        fulfillmentDetails?: FulfillmentDetails;
        _id?: string;
        name?: string;
    };
    compact?: boolean;
    onEditTracking?: (itemId: string, fulfillmentId?: string) => void;
    showEditButtons?: boolean;
}

// Enhanced carrier display names with icons
const getCarrierDisplayInfo = (carrier: string): { name: string; icon: string } => {
    const carrierInfo: Record<string, { name: string; icon: string }> = {
        'dhl': { name: 'DHL', icon: '🚚' },
        'ups': { name: 'UPS', icon: '📦' },
        'fedex': { name: 'FedEx', icon: '✈️' },
        'usps': { name: 'USPS', icon: '📮' },
        'canadaPost': { name: 'Canada Post', icon: '🇨🇦' },
        'royalMail': { name: 'Royal Mail', icon: '🇬🇧' },
        'australiaPost': { name: 'Australia Post', icon: '🇦🇺' },
        'deutschePost': { name: 'Deutsche Post', icon: '🇩🇪' },
        'laPoste': { name: 'La Poste', icon: '🇫🇷' },
        'japanPost': { name: 'Japan Post', icon: '🇯🇵' },
        'chinaPost': { name: 'China Post', icon: '🇨🇳' },
        'tnt': { name: 'TNT', icon: '🚛' },
        'aramex': { name: 'Aramex', icon: '📫' },
        'other': { name: 'Other', icon: '📦' }
    };

    return carrierInfo[carrier] || carrierInfo['other'];
};

const formatTrackingNumber = (trackingNumber: string): string => {
    // Truncate very long tracking numbers for display
    if (trackingNumber.length > 20) {
        return trackingNumber.substring(0, 17) + '...';
    }
    return trackingNumber;
};

const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    } catch {
        return '';
    }
};

export const LineItemFulfillmentStatus: React.FC<LineItemFulfillmentStatusProps> = ({
    item,
    compact = false,
    onEditTracking,
    showEditButtons = false
}) => {
    const {
        quantity = 1,
        fulfilledQuantity = 0,
        remainingQuantity = quantity - fulfilledQuantity,
        fulfillmentStatus = 'NOT_FULFILLED',
        fulfillmentDetails,
        _id: itemId = ''
    } = item;

    // Always render the component if showEditButtons is true, regardless of fulfillment status
    if (!fulfillmentStatus && !showEditButtons) {
        return null;
    }

    // Combine tracking info from both sources, preserving individual fulfillment records
    const allTrackingInfo: TrackingInfo[] = [];

    // Add from trackingInfo array
    if (fulfillmentDetails?.trackingInfo) {
        allTrackingInfo.push(...fulfillmentDetails.trackingInfo);
    }

    // Add from lineItemFulfillment array - keep separate records for same tracking numbers
    if (fulfillmentDetails?.lineItemFulfillment) {
        fulfillmentDetails.lineItemFulfillment.forEach(fulfillment => {
            if (fulfillment.trackingNumber) {
                allTrackingInfo.push({
                    trackingNumber: fulfillment.trackingNumber,
                    trackingUrl: fulfillment.trackingUrl,
                    carrier: fulfillment.carrier || 'other',
                    quantity: fulfillment.quantity,
                    fulfillmentId: fulfillment.fulfillmentId,
                    fulfillmentDate: fulfillment.fulfillmentDate
                });
            }
        });
    }

    // Calculate quantities properly
    const fulfilledQuantityWithTracking = allTrackingInfo.reduce((total, tracking) => total + tracking.quantity, 0);
    const remainingUnfulfilledQuantity = Math.max(0, quantity - fulfilledQuantity);

    // Check if there are any tracking entries with quantity > 0
    const hasAnyTracking = allTrackingInfo.some(t => t.quantity > 0);

    // Show add tracking if:
    // 1. There are unfulfilled items, OR
    // 2. The item is fulfilled but has no tracking info
    const showAddTracking = remainingUnfulfilledQuantity > 0 ||
        (fulfilledQuantity > 0 && !hasAnyTracking);

    // Show edit tracking only if there are actual tracking numbers
    const showEditTracking = hasAnyTracking;

    // Show status message only if all items are fulfilled with tracking
    const showAllFulfilledMessage = fulfilledQuantity === quantity && hasAnyTracking;

    // Compact view for table/list displays
    if (compact) {
        return (
            <Box direction="horizontal" gap="6px" align="center">
                <StatusBadge status={fulfillmentStatus} type="order" />
                {fulfilledQuantity > 0 && (
                    <Text size="tiny" secondary>
                        {fulfilledQuantity}/{quantity}
                    </Text>
                )}
                {showEditTracking && allTrackingInfo[0] && (
                    <Box direction="horizontal" gap="4px" align="center">
                        <Text size="tiny" secondary>
                            {getCarrierDisplayInfo(allTrackingInfo[0].carrier || '').icon}
                        </Text>
                        <Text
                            size="tiny"
                            secondary
                            style={{
                                cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                color: settingsStore.clickToCopyEnabled ? 'var(--text-button-color, #2B7FF2)' : 'var(--text-color-secondary, #6F7785)'
                            }}
                            onClick={(e) => {
                                if (!settingsStore.clickToCopyEnabled) return;
                                e.stopPropagation();
                                navigator.clipboard.writeText(allTrackingInfo[0].trackingNumber);
                            }}
                        >
                            {formatTrackingNumber(allTrackingInfo[0].trackingNumber)}
                        </Text>
                    </Box>
                )}
            </Box>
        );
    }

    // Detailed view for order details
    return (
        <Box direction="vertical" gap="6px" marginTop="4px">
            {/* Status Badge and Summary */}
            <Box direction="horizontal" gap="8px" align="center">
                <StatusBadge status={fulfillmentStatus} type="order" />
                <Text size="tiny" secondary>
                    {fulfillmentStatus === 'PARTIALLY_FULFILLED'
                        ? 'Partially Fulfilled'
                        : fulfillmentStatus === 'FULFILLED'
                            ? 'Fulfilled'
                            : 'Not Fulfilled'
                    }
                </Text>
            </Box>

            {/* Quantity Summary */}
            {fulfilledQuantity > 0 && (
                <Text size="tiny" secondary>
                    {fulfilledQuantity} of {quantity} fulfilled
                    {remainingQuantity > 0 && (
                        <Text size="tiny" secondary> • {remainingQuantity} remaining</Text>
                    )}
                </Text>
            )}

            {/* Detailed Tracking Information */}
            {showEditTracking && (
                <Box direction="vertical" gap="6px" marginTop="6px" paddingLeft="8px">
                    <Text size="tiny" weight="bold" secondary>
                        Tracking Information ({fulfilledQuantityWithTracking} of {quantity} items):
                    </Text>

                    {allTrackingInfo.map((tracking, index) => {
                        const carrierInfo = getCarrierDisplayInfo(tracking.carrier || '');

                        return (
                            <Box key={index} direction="vertical" gap="3px" padding="6px" style={{
                                backgroundColor: '#f0f8ff',
                                borderRadius: '4px',
                                border: '1px solid #b3d9ff'
                            }}>
                                {/* Main tracking info line */}
                                <Box direction="horizontal" gap="6px" align="center" style={{ flexWrap: 'wrap' }}>
                                    <Text size="tiny" secondary>
                                        {carrierInfo.icon} {carrierInfo.name}:
                                    </Text>

                                    <Text
                                        size="tiny"
                                        secondary
                                        style={{
                                            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                            color: settingsStore.clickToCopyEnabled ? 'var(--text-button-color, #2B7FF2)' : 'var(--text-color-secondary, #6F7785)'
                                        }}
                                        onClick={(e) => {
                                            if (!settingsStore.clickToCopyEnabled) return;
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(tracking.trackingNumber);
                                        }}
                                    >
                                        {formatTrackingNumber(tracking.trackingNumber)}
                                    </Text>

                                    {tracking.quantity && tracking.quantity !== quantity && (
                                        <Text size="tiny" secondary>
                                            (×{tracking.quantity})
                                        </Text>
                                    )}

                                    {/* Edit button for individual tracking */}
                                    {showEditButtons && onEditTracking && (
                                        <Button
                                            size="tiny"
                                            priority="secondary"
                                            onClick={() => onEditTracking(itemId, tracking.fulfillmentId)}
                                            style={{
                                                fontSize: '9px',
                                                padding: '1px 4px',
                                                marginLeft: 'auto'
                                            }}
                                        >
                                            Edit
                                        </Button>
                                    )}
                                </Box>

                                {/* Additional details line */}
                                <Box direction="horizontal" gap="8px" align="center">
                                    {tracking.fulfillmentDate && (
                                        <Text size="tiny" secondary>
                                            📅 {formatDate(tracking.fulfillmentDate)}
                                        </Text>
                                    )}

                                    {tracking.trackingUrl && (
                                        <a
                                            href={tracking.trackingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: '#2196f3',
                                                fontSize: '10px',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            🔗 Track Package
                                        </a>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}

                    {/* Show remaining unfulfilled quantity */}
                    {remainingUnfulfilledQuantity > 0 && (
                        <Box direction="horizontal" gap="6px" align="center" marginTop="4px" padding="4px" style={{
                            backgroundColor: '#fff3cd',
                            borderRadius: '4px',
                            border: '1px solid #ffeaa7'
                        }}>
                            <Text size="tiny" secondary>
                                ⏳ {remainingUnfulfilledQuantity} item{remainingUnfulfilledQuantity !== 1 ? 's' : ''} still need tracking
                            </Text>
                        </Box>
                    )}

                    {/* Action Buttons */}
                    {showEditButtons && onEditTracking && (
                        <Box direction="horizontal" gap="6px" align="center" marginTop="8px">
                            {showAddTracking && (
                                <Button
                                    size="tiny"
                                    priority="primary"
                                    onClick={() => onEditTracking(itemId)}
                                    style={{ fontSize: '10px', padding: '2px 8px' }}
                                >
                                    {hasAnyTracking ? 'Add More Tracking' : 'Add Tracking'}
                                    {remainingUnfulfilledQuantity > 0 && ` (${remainingUnfulfilledQuantity} remaining)`}
                                </Button>
                            )}
                            {showEditTracking && (
                                <Button
                                    size="tiny"
                                    priority="secondary"
                                    onClick={() => onEditTracking(itemId)}
                                    style={{ fontSize: '10px', padding: '2px 8px' }}
                                >
                                    Edit Tracking ({fulfilledQuantityWithTracking} items)
                                </Button>
                            )}
                        </Box>
                    )}

                    {/* Show message only if all items are fulfilled with tracking */}
                    {showAllFulfilledMessage && (
                        <Text size="tiny" secondary>
                            All items fulfilled with tracking
                        </Text>
                    )}
                </Box>
            )}
        </Box>
    );
};