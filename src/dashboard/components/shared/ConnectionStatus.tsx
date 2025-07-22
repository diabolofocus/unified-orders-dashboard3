// components/shared/ConnectionStatus.tsx
import React from 'react';
import { observer } from 'mobx-react-lite';
import { Button } from '@wix/design-system';
import { useStores } from '../../hooks/useStores';
import { useOrderController } from '../../hooks/useOrderController';
import { CompactAnalytics } from '../Analytics/CompactAnalytics';

export const ConnectionStatus: React.FC = observer(() => {
    const { orderStore } = useStores();
    const orderController = useOrderController();

    // Don't show anything if disconnected or no orders
    if (orderStore.connectionStatus === 'disconnected' || orderStore.orders.length === 0) {
        return null;
    }

    return (
        <div>
            <CompactAnalytics />
            {orderStore.connectionStatus === 'error' && (
                <div style={{ marginTop: '20px', textAlign: 'left' }}>
                    <Button
                        size="tiny"
                        border="outlined"
                        onClick={() => orderController.refreshOrders()}
                    >
                        Try Again
                    </Button>
                </div>
            )}
        </div>
    );
});