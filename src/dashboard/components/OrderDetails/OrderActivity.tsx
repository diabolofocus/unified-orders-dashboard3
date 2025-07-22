// components/OrderDetails/OrderActivity.tsx
import React from 'react';
import { Box, Text } from '@wix/design-system';
import type { Order } from '../../types/Order';

interface OrderActivityProps {
    order: Order;
}

// Activity type to human-readable mapping
const getActivityDescription = (activity: any): string => {
    const customerName = activity.order?.customer?.firstName || 'Customer';

    switch (activity.type) {
        case 'ORDER_PLACED':
            return `${customerName} placed an order`;
        case 'ORDER_PAID':
            return 'Order marked as Paid';
        case 'INVOICE_ADDED':
        case 'INVOICE_SENT':
            return 'Invoice created';
        case 'SHIPPING_CONFIRMATION_EMAIL_SENT':
            return `Shipping confirmation email sent to ${customerName}`;
        case 'ORDER_FULFILLED':
            return 'Order fulfilled';
        case 'TRACKING_NUMBER_ADDED':
            return 'Tracking number added';
        case 'TRACKING_NUMBER_EDITED':
            return 'Tracking number updated';
        case 'TRACKING_LINK_ADDED':
            return 'Tracking link added';
        case 'ORDER_CANCELED':
            return 'Order canceled';
        case 'ORDER_REFUNDED':
            return 'Order refunded';
        case 'MERCHANT_COMMENT':
            return 'Note added';
        case 'CUSTOM_ACTIVITY':
            return activity.customActivity?.type || 'Custom activity';
        default:
            return activity.type?.replace(/_/g, ' ').toLowerCase() || 'Activity';
    }
};

// Format activity date and time
const formatActivityDateTime = (dateString: string): { date: string; time: string } => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    if (date.toDateString() === today.toDateString()) {
        return { date: 'Today', time: timeStr };
    } else if (date.toDateString() === yesterday.toDateString()) {
        return { date: 'Yesterday', time: timeStr };
    } else {
        return {
            date: date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }),
            time: timeStr
        };
    }
};

export const OrderActivity: React.FC<OrderActivityProps> = ({ order }) => {
    // Get activities from the raw order
    const activities = order.rawOrder?.activities || [];

    // Sort activities by date (newest first)
    const sortedActivities = [...activities].sort((a, b) =>
        new Date(b._createdDate).getTime() - new Date(a._createdDate).getTime()
    );

    return (
        <Box gap="24px" direction="vertical" style={{
            paddingTop: '16px',
        }}>
            <Text size="medium" weight="bold">Order activity</Text>

            {/* Activity Timeline */}
            <Box gap="0px" direction="vertical" style={{ position: 'relative' }}>
                {sortedActivities.length === 0 ? (
                    <Text size="small" secondary>No activity recorded</Text>
                ) : (
                    sortedActivities.map((activity, index) => {
                        const { date, time } = formatActivityDateTime(activity._createdDate);
                        const description = getActivityDescription(activity);
                        const isLast = index === sortedActivities.length - 1;
                        const isNewDate = index === 0 || formatActivityDateTime(sortedActivities[index - 1]._createdDate).date !== date;

                        return (
                            <div key={activity._id} style={{ position: 'relative' }}>
                                {/* Date header with proper spacing */}
                                {isNewDate && (
                                    <div style={{
                                        marginTop: index === 0 ? '0px' : '12px',
                                        marginBottom: '8px'
                                    }}>
                                        <Text size="tiny" secondary weight="normal">
                                            {date}
                                        </Text>
                                    </div>
                                )}

                                {/* Timeline item */}
                                <div style={{
                                    display: 'flex',
                                    position: 'relative',
                                    paddingBottom: '10px'
                                }}>
                                    {/* Timeline dot and line container */}
                                    <div style={{
                                        position: 'relative',
                                        width: '10px',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {/* Timeline dot */}
                                        <div style={{
                                            width: '5px',
                                            height: '5px',
                                            borderRadius: '50%',
                                            backgroundColor: '#333333',
                                            position: 'relative',
                                            zIndex: 2,
                                            marginTop: '6px'
                                        }} />

                                        {/* Timeline line */}
                                        {!isLast && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '14px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: '1px',
                                                height: '20px',
                                                backgroundColor: '#e0e0e0',
                                                zIndex: 1
                                            }} />
                                        )}
                                    </div>

                                    {/* Activity content */}
                                    <div style={{
                                        flex: 1,
                                        paddingLeft: '12px',
                                        paddingTop: '2px'
                                    }}>
                                        {/* Activity description and time */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start'
                                        }}>
                                            <Text size="tiny" style={{ flex: 1 }}>
                                                {description}
                                            </Text>
                                            <Text size="tiny" secondary style={{ marginLeft: '12px' }}>
                                                {time}
                                            </Text>
                                        </div>

                                        {/* Additional details for specific activity types */}
                                        {activity.type === 'MERCHANT_COMMENT' && activity.merchantComment?.message && (
                                            <div style={{
                                                backgroundColor: '#f5f5f5',
                                                padding: '8px 12px',
                                                borderRadius: '4px',
                                                marginTop: '8px'
                                            }}>
                                                <Text size="tiny">{activity.merchantComment.message}</Text>
                                            </div>
                                        )}

                                        {activity.type === 'ORDER_REFUNDED' && activity.orderRefunded && (
                                            <div style={{ marginTop: '8px' }}>
                                                <Text size="small" secondary>
                                                    Amount: {activity.orderRefunded.amount?.formattedAmount}
                                                </Text>
                                                {activity.orderRefunded.reason && (
                                                    <Text size="tiny" secondary>
                                                        Reason: {activity.orderRefunded.reason}
                                                    </Text>
                                                )}
                                            </div>
                                        )}

                                        {activity.type === 'CUSTOM_ACTIVITY' && activity.customActivity?.additionalData && (
                                            <div style={{ marginTop: '8px' }}>
                                                {Object.entries(activity.customActivity.additionalData).map(([key, value]) => (
                                                    <Text key={key} size="tiny" secondary>
                                                        {key}: {value}
                                                    </Text>
                                                ))}
                                            </div>
                                        )}

                                        {/* Author email if available */}
                                        {activity.authorEmail && (
                                            <Text size="tiny" secondary style={{ marginTop: '4px' }}>
                                                by {activity.authorEmail}
                                            </Text>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </Box>
        </Box>
    );
};