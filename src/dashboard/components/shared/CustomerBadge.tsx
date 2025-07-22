import React from 'react';
import { Badge, Tooltip } from '@wix/design-system';

interface CustomerBadgeProps {
    orderCount: number;
}

export const CustomerBadge: React.FC<CustomerBadgeProps> = ({ orderCount }) => {
    // Define tier thresholds for loaded orders context (adjusted for smaller datasets)
    const getCustomerTier = (count: number) => {
        if (count >= 4) return { name: 'VIP Customer', skin: 'premium' as const, color: '#f59e0b' };
        if (count >= 3) return { name: 'Loyal Customer', skin: 'premium' as const, color: '#3b82f6' };
        if (count >= 2) return { name: 'Frequent Buyer', skin: 'standard' as const, color: '#10b981' };
        return null;
    };

    const tier = getCustomerTier(orderCount);

    if (!tier) return null;

    return (
        <Tooltip content={`${tier.name} (${orderCount} orders)`} placement="top">
            <Badge
                uppercase={false}
                skin={tier.skin}
                size="tiny"
                type="outlined"
                style={{
                    borderColor: tier.color,
                    color: tier.color
                }}
            >
                {tier.name}
            </Badge>
        </Tooltip>
    );
};

// Keep the old component for backward compatibility but mark as deprecated
export const CustomerRating = CustomerBadge;