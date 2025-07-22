import { useEffect, useRef } from 'react';
import { soundService } from '../services/SoundService';
import type { Order } from '../types/Order';

interface UseOrderUpdatesOptions {
  playSound?: boolean;
}

export function useOrderUpdates(orders: Order[], options: UseOrderUpdatesOptions = { playSound: true }) {
  const prevOrdersRef = useRef<Order[]>([]);
  const lastSoundPlayedRef = useRef<number>(0);

  useEffect(() => {
    // Initialize sound service when component mounts (only if sound is enabled)
    if (options.playSound) {
      soundService.initialize();
    }

    // Cleanup on unmount
    return () => {
      // Any cleanup if needed
    };
  }, [options.playSound]);

  useEffect(() => {
    if (prevOrdersRef.current.length === 0) {
      prevOrdersRef.current = orders;
      return;
    }

    // Check for new orders by comparing order IDs
    const currentOrderIds = new Set(orders.map(order => order._id));
    const previousOrderIds = new Set(prevOrdersRef.current.map(order => order._id));

    // Find truly new orders that aren't in the previous list
    const newOrders = orders.filter(order => !previousOrderIds.has(order._id));

    // Only play sound for very recent orders (within last 5 minutes) and limit frequency
    if (newOrders.length > 0 && options.playSound) {
      const now = Date.now();
      const recentNewOrders = newOrders.filter(order => {
        const orderTime = new Date(order._createdDate).getTime();
        const timeDiff = now - orderTime;
        return timeDiff <= 5 * 60 * 1000; // 5 minutes
      });

      // Only play sound if we have recent orders and haven't played sound recently
      if (recentNewOrders.length > 0 && (now - lastSoundPlayedRef.current) > 3000) {
        soundService.play();
        lastSoundPlayedRef.current = now;
      }
    }

    prevOrdersRef.current = orders;
  }, [orders, options.playSound]);
}