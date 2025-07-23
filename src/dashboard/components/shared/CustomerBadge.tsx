import React from 'react';
import { Badge, Tooltip } from '@wix/design-system';

import { useStores } from '../../hooks/useStores';

interface CustomerBadgeProps {
    orderCount: number;
}

export const CustomerBadge: React.FC<CustomerBadgeProps> = ({ orderCount }) => {
    const { settingsStore } = useStores();

    // Use configurable tier thresholds from settings
    const getCustomerTier = (count: number) => {
        const tiers = settingsStore.settings.customerTiers;

        if (count >= tiers.vipCustomer.threshold) {
            return {
                name: tiers.vipCustomer.name,
                skin: tiers.vipCustomer.skin,
            };
        }
        if (count >= tiers.loyalCustomer.threshold) {
            return {
                name: tiers.loyalCustomer.name,
                skin: tiers.loyalCustomer.skin,
            };
        }
        if (count >= tiers.returningCustomer.threshold) {
            return {
                name: tiers.returningCustomer.name,
                skin: tiers.returningCustomer.skin,
            };
        }
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
            >
                {tier.name}
            </Badge>
        </Tooltip>
    );
};

// Keep the old component for backward compatibility but mark as deprecated
export const CustomerRating = CustomerBadge;