// src/dashboard/pages/page.tsx
import React, { useEffect } from 'react';
import '@wix/design-system/styles.global.css';
import { StoreProvider, rootStore, useStores } from '../hooks/useStores';
import { OrderFulfillmentPage } from './OrderFulfillmentPage';
import { OrderController } from '../controllers/OrderController';
import { OrderControllerProvider } from '../contexts/OrderControllerContext';
import { OrderService } from '../services/OrderService';

const AppWithStores: React.FC = () => {
  const { orderStore, uiStore } = useStores();

  // Initialize OrderController with required dependencies
  const orderController = React.useMemo(() => {
    const orderService = new OrderService();
    return new OrderController(orderStore, uiStore, orderService);
  }, [orderStore, uiStore]);

  // Initialize real-time updates when component mounts
  useEffect(() => {
    // The OrderController initializes real-time updates in its constructor
    // via the initializeRealtimeUpdates() method

    // Clean up on unmount
    return () => {
      orderController.destroy();
    };
  }, [orderController]);

  return (
    <OrderControllerProvider orderController={orderController}>
      <OrderFulfillmentPage />
    </OrderControllerProvider>
  );
};

const Page: React.FC = () => {
  return (
    <StoreProvider value={rootStore}>
      <AppWithStores />
    </StoreProvider>
  );
};

export default Page;