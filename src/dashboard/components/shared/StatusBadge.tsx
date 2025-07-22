// components/shared/StatusBadge.tsx
import React from 'react';
import { Badge } from '@wix/design-system';
import type { OrderStatus, PaymentStatus } from '../../types/Order';

interface StatusBadgeProps {
    status: OrderStatus | PaymentStatus;
    type: 'order' | 'payment';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type }) => {
    const getStatusConfig = (status: string, type: string) => {
        if (type === 'order') {
            switch (status) {
                case 'FULFILLED':
                    return { skin: 'neutralSuccess' as const, text: 'Fulfilled' };
                case 'PARTIALLY_FULFILLED':
                    return { skin: 'warningLight' as const, text: 'Partially Fulfilled' };
                case 'CANCELED':
                    return { skin: 'neutralLight' as const, type: 'outlined' as const, text: 'Canceled' };
                default:
                    return { skin: 'neutralDanger' as const, text: 'Unfulfilled' };
            }
        } else {
            switch (status) {
                case 'PAID':
                    return { skin: 'neutralSuccess' as const, text: 'Paid' };
                case 'FULLY_REFUNDED':
                    return { skin: 'neutralLight' as const, type: 'outlined' as const, text: 'Refunded' };
                case 'PARTIALLY_REFUNDED':
                    return { skin: 'neutralLight' as const, type: 'outlined' as const, text: 'Part. Refund' };
                default:
                    return { skin: 'neutralDanger' as const, text: 'Unpaid' };
            }
        }
    };

    const config = getStatusConfig(status, type);

    return (
        <Badge
            skin={config.skin}
            size="small"
            type={config.type || 'solid'}
        >
            {config.text}
        </Badge>
    );
};