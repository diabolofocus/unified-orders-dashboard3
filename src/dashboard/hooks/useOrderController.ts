// hooks/useOrderController.ts - FIXED with Real-time Support
import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useStores } from './useStores';
import { OrderController } from '../controllers/OrderController';
import { OrderService } from '../services/OrderService';
import type { Order } from '../types/Order';

// Real-time hook state interface
export interface RealtimeHookState {
    isConnected: boolean;
    audioReady: boolean;
    notificationPermission: string;
    lastUpdate: Date | null;
    updateCount: number;
}

// Sound configuration interface
export interface SoundConfig {
    enabled: boolean;
    url: string;
    volume: number;
}

// Main hook for OrderController
export const useOrderController = () => {
    const { orderStore, uiStore } = useStores();
    const orderService = useMemo(() => new OrderService(), []);

    const orderController = useMemo(
        () => new OrderController(orderStore, uiStore, orderService),
        [orderStore, uiStore, orderService]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            orderController.destroy();
        };
    }, [orderController]);

    return orderController;
};

// Real-time orders hook
export const useRealtimeOrdersHook = () => {
    const orderController = useOrderController();
    const [state, setState] = useState<RealtimeHookState>({
        isConnected: false,
        audioReady: false,
        notificationPermission: 'default',
        lastUpdate: null,
        updateCount: 0
    });

    // Update state from real-time service
    const updateState = useCallback(() => {
        try {
            const status = orderController.getRealtimeStatus();
            setState(prev => ({
                ...prev,
                isConnected: status.isListening,
                lastUpdate: new Date()
            }));
        } catch (error) {
            console.warn('Failed to get realtime status:', error);
        }
    }, [orderController]);

    // Track order updates
    const incrementUpdateCount = useCallback(() => {
        setState(prev => ({
            ...prev,
            updateCount: prev.updateCount + 1,
            lastUpdate: new Date()
        }));
    }, []);

    useEffect(() => {
        // Initial state update
        updateState();

        // Update state periodically
        const interval = setInterval(updateState, 5000);

        return () => clearInterval(interval);
    }, [updateState]);

    return {
        state,
        testNotifications: () => orderController.testNotifications(),
        updateSettings: (settings: any) => orderController.updateNotificationSettings(settings),
        refreshStatus: updateState,
        onOrderUpdate: incrementUpdateCount
    };
};

// Notification sound hook
export const useNotificationSoundHook = (config: SoundConfig) => {
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);

    // Initialize audio system
    useEffect(() => {
        const initAudio = async () => {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

                if (config.url && config.enabled) {
                    const response = await fetch(config.url);
                    const arrayBuffer = await response.arrayBuffer();
                    audioBufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer);
                    setIsReady(true);
                }
            } catch (error) {
                console.warn('Failed to initialize audio:', error);
                setIsReady(false);
            }
        };

        initAudio();

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [config.url, config.enabled]);

    const playSound = useCallback(async () => {
        if (!isReady || !config.enabled || !audioContextRef.current || !audioBufferRef.current) {
            return false;
        }

        try {
            setIsPlaying(true);

            const source = audioContextRef.current.createBufferSource();
            const gainNode = audioContextRef.current.createGain();

            source.buffer = audioBufferRef.current;
            gainNode.gain.value = config.volume;

            source.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);

            source.onended = () => setIsPlaying(false);
            source.start();

            return true;
        } catch (error) {
            console.error('Failed to play sound:', error);
            setIsPlaying(false);
            return false;
        }
    }, [isReady, config.enabled, config.volume]);

    return {
        isReady,
        isPlaying,
        playSound
    };
};

// Notification preferences interface
export interface NotificationPreferences {
    soundEnabled: boolean;
    soundUrl: string;
    soundVolume: number;
    browserNotifications: boolean;
    newOrderPriority: 'normal' | 'high';
    updateOrderPriority: 'normal' | 'high';
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    soundEnabled: true,
    soundUrl: '/assets/notification-sound.mp3',
    soundVolume: 0.8,
    browserNotifications: true,
    newOrderPriority: 'high',
    updateOrderPriority: 'normal'
};

// Complete notification management hook
export const useOrderNotificationsHook = () => {
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
    const realtime = useRealtimeOrdersHook();

    const sound = useNotificationSoundHook({
        enabled: preferences.soundEnabled,
        url: preferences.soundUrl,
        volume: preferences.soundVolume
    });

    // Load preferences from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('order-notification-preferences');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setPreferences(prev => ({ ...prev, ...parsed }));
            } catch (error) {
                console.warn('Failed to load notification preferences:', error);
            }
        }
    }, []);

    // Save preferences to localStorage
    const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
        const newPreferences = { ...preferences, ...updates };
        setPreferences(newPreferences);
        localStorage.setItem('order-notification-preferences', JSON.stringify(newPreferences));

        // Update the real-time service
        realtime.updateSettings({
            soundEnabled: newPreferences.soundEnabled,
            visualNotifications: newPreferences.browserNotifications,
            soundUrl: newPreferences.soundUrl
        });
    }, [preferences, realtime]);

    // Show browser notification
    const showBrowserNotification = useCallback((title: string, body: string, priority: 'normal' | 'high' = 'normal') => {
        if (!preferences.browserNotifications || !('Notification' in window)) {
            return;
        }

        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/favicon.ico',
                requireInteraction: priority === 'high',
                tag: `order-notification-${Date.now()}`
            });
        }
    }, [preferences.browserNotifications]);

    // Handle order notifications
    const notifyOrderUpdate = useCallback((order: Order, type: 'created' | 'updated') => {
        const priority = type === 'created' ? preferences.newOrderPriority : preferences.updateOrderPriority;

        // Play sound
        if (preferences.soundEnabled) {
            sound.playSound();
        }

        // Show browser notification
        const title = type === 'created' ? 'New Order Received!' : 'Order Updated';
        const body = type === 'created'
            ? `Order #${order.number} from ${order.customer.firstName} ${order.customer.lastName}`
            : `Order #${order.number} has been updated`;

        showBrowserNotification(title, body, priority);

        // Track the update
        realtime.onOrderUpdate();
    }, [preferences, sound, showBrowserNotification, realtime]);

    return {
        preferences,
        updatePreferences,
        notifyOrderUpdate,
        showBrowserNotification,
        sound,
        realtime,
        testNotification: () => {
            sound.playSound();
            showBrowserNotification('Test Notification', 'Notification system is working!', 'normal');
        }
    };
};