
// components/shared/CustomerRating.tsx

import React from 'react';
import { Badge, Box, Text, Tooltip } from '@wix/design-system';

interface CustomerRatingProps {
    rank: number;
    totalCustomers: number;
    totalSpent?: number;
    orderCount?: number;
    currency?: string;
    type?: 'spending' | 'orders';
}

export const CustomerRating: React.FC<CustomerRatingProps> = ({
    rank,
    totalCustomers,
    totalSpent,
    orderCount,
    currency = '€',
    type = 'spending'
}) => {
    const percentage = Math.round((rank / totalCustomers) * 100);
    const isTopTier = rank <= Math.ceil(totalCustomers * 0.1); // Top 10%
    const isHighTier = rank <= Math.ceil(totalCustomers * 0.25); // Top 25%

    // Only show rating for top 25% customers
    if (!isTopTier && !isHighTier) {
        return null;
    }

    const getRatingColor = () => {
        if (isTopTier) return '#10b981'; // Green for top 10%
        if (isHighTier) return '#3b82f6'; // Blue for top 25%
        return '#ccc'; // Gray for others
    };

    // const getRatingIcon = () => {
    //     if (isTopTier) return <Icons.PremiumFilled size="14px" />;
    //     if (isHighTier) return <Icons.PremiumFilled size="14px" />;
    //     return <Icons.User size="14px" />;
    // };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency === '€' ? 'EUR' : 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const tooltipContent = type === 'spending' && totalSpent
        ? `This customer ranks #${rank} out of ${totalCustomers} customers by total spending ${formatCurrency(totalSpent)}`
        : `This customer ranks #${rank} out of ${totalCustomers} customers by order count ${orderCount} orders`;

    return (
        <Tooltip content={tooltipContent} placement="top">
            <Box
                direction="horizontal"
                verticalAlign="middle"
                gap="6px"
                style={{
                    padding: '4px 8px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'help'
                }}
            >
                {/* <span style={{ color: getRatingColor() }}>
                    {getRatingIcon()}
                </span> */}
                {isTopTier && (
                    <Badge uppercase={false} skin="premium" size="tiny" type="outlined">
                        TOP 10%
                    </Badge>
                )}
                {isHighTier && !isTopTier && (
                    <Badge uppercase={false} skin="standard" size="tiny" type="outlined">
                        TOP 25%
                    </Badge>
                )}
                {/* <Box style={{ fontSize: '10px', color: getRatingColor() }}>
                    #{rank} of {totalCustomers}
                </Box> */}
            </Box>
        </Tooltip>
    );
};
