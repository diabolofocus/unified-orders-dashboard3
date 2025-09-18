import React, { createContext, useContext } from 'react';
import { OrderController } from '../controllers/OrderController';

interface OrderControllerContextType {
    orderController: OrderController | null;
    testNotifications: () => Promise<void>;
}

export const OrderControllerContext = createContext<OrderControllerContextType>({
    orderController: null,
    testNotifications: async () => {
    }
});

export const useOrderController = () => {
    const context = useContext(OrderControllerContext);
    if (!context.orderController) {
        throw new Error('useOrderController must be used within an OrderControllerProvider');
    }
    return context;
};

interface OrderControllerProviderProps {
    orderController: OrderController;
    children: React.ReactNode;
}

export const OrderControllerProvider: React.FC<OrderControllerProviderProps> = ({
    orderController,
    children,
}) => {
    const contextValue = {
        orderController,
        testNotifications: () => orderController.testNotifications()
    };

    return (
        <OrderControllerContext.Provider value={contextValue}>
            {children}
        </OrderControllerContext.Provider>
    );
};
