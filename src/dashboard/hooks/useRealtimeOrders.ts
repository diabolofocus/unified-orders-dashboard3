// services/RealtimeOrderService.ts - FIXED VERSION with Order ID Tracking
import { orders } from '@wix/ecom';
import type { Order } from '../types/Order';

export class RealtimeOrderService {
    private isPolling: boolean = false;
    private pollingInterval: any = null;
    private lastOrderCheck: Date = new Date();

    private processedOrderIds: Set<string> = new Set();

    private audioContext: AudioContext | null = null;
    private soundBuffer: AudioBuffer | null = null;

    private onNewOrderCallbacks: Array<(order: Order) => void> = [];

    constructor() {
        this.initializeAudio();
        this.lastOrderCheck = new Date(Date.now() - 60 * 1000);

        this.startPolling();
    }

    /**
     * Initialize simple beep sound
     */
    private async initializeAudio() {
        try {
            if (!window.AudioContext && !(window as any).webkitAudioContext) return;

            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            await this.createBeepSound();
        } catch (error) {
            // Audio init failed
        }
    }

    private async createBeepSound() {
        if (!this.audioContext) return;

        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.3;
        const frequency = 800;
        const numSamples = Math.floor(sampleRate * duration);

        this.soundBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = this.soundBuffer.getChannelData(0);

        for (let i = 0; i < numSamples; i++) {
            channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        }
    }

    /**
     * Register callback for new orders only
     */
    onNewOrder(callback: (order: Order) => void) {
        this.onNewOrderCallbacks.push(callback);
    }

    /**
     * Start polling for new orders - AUTO-START
     */
    async startPolling(): Promise<boolean> {
        if (this.isPolling) return true;

        this.isPolling = true;

        this.pollingInterval = setInterval(async () => {
            await this.checkForNewOrders();
        }, 10000); // Every 10 seconds

        return true;
    }

    /**
     * Check for new orders with duplicate prevention
     */
    private async checkForNewOrders() {
        try {
            const response = await orders.searchOrders({
                sort: [{ fieldName: '_createdDate', order: 'DESC' }],
                cursorPaging: { limit: 5 } // Keep small to reduce load
            });

            if (!response.orders || response.orders.length === 0) return;

            const newOrders = response.orders.filter(order => {
                const orderDate = new Date(order._createdDate!);
                const orderId = order._id!;

                return orderDate > this.lastOrderCheck && !this.processedOrderIds.has(orderId);
            });

            if (newOrders.length > 0) {
                for (const rawOrder of newOrders) {
                    const orderId = rawOrder._id!;

                    this.processedOrderIds.add(orderId);

                    const transformedOrder = this.transformOrder(rawOrder);

                    // Don't play sound here - let OrderController handle it
                    // to prevent duplicate sounds

                    this.onNewOrderCallbacks.forEach(callback => {
                        try {
                            callback(transformedOrder);
                        } catch (error) {
                            // Callback error
                        }
                    });
                }
            }

            this.lastOrderCheck = new Date();

        } catch (error) {
            // New order check failed
        }
    }

    /**
     * Simple order transformation
     */
    private transformOrder(rawOrder: any): Order {
        return {
            _id: rawOrder._id!,
            number: rawOrder.number!,
            _createdDate: rawOrder._createdDate!,
            status: rawOrder.fulfillmentStatus || 'NOT_FULFILLED',
            paymentStatus: rawOrder.paymentStatus || 'NOT_PAID',
            total: rawOrder.priceSummary?.total?.formattedConvertedAmount ||
                rawOrder.priceSummary?.total?.formattedAmount || '€0.00',
            customer: {
                firstName: rawOrder.billingInfo?.contactDetails?.firstName ||
                    rawOrder.recipientInfo?.contactDetails?.firstName || 'Unknown',
                lastName: rawOrder.billingInfo?.contactDetails?.lastName ||
                    rawOrder.recipientInfo?.contactDetails?.lastName || 'Customer',
                email: rawOrder.billingInfo?.contactDetails?.email ||
                    rawOrder.recipientInfo?.contactDetails?.email || '',
                company: rawOrder.billingInfo?.contactDetails?.company ||
                    rawOrder.recipientInfo?.contactDetails?.company || '',
                phone: rawOrder.billingInfo?.contactDetails?.phone ||
                    rawOrder.recipientInfo?.contactDetails?.phone || ''
            },
            items: rawOrder.lineItems || [],
            totalWeight: rawOrder.totalWeight || 0,
            shippingInfo: rawOrder.shippingInfo || {},
            weightUnit: rawOrder.weightUnit || 'kg',
            rawOrder: rawOrder
        };
    }

    /**
     * Play notification sound
     */
    private playSound() {
        if (!this.audioContext || !this.soundBuffer) return;

        try {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => this.doPlaySound());
            } else {
                this.doPlaySound();
            }
        } catch (error) {
            // Sound play failed
        }
    }

    private doPlaySound() {
        if (!this.audioContext || !this.soundBuffer) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundBuffer;
        source.connect(this.audioContext.destination);
        source.start();
    }

    /**
     * Simple status
     */
    getStatus() {
        return {
            isListening: this.isPolling,
            audioReady: !!(this.audioContext && this.soundBuffer),
            processedOrdersCount: this.processedOrderIds.size // ✅ NEW: Debug info
        };
    }

    /**
     * Test sound
     */
    testSound() {
        this.playSound();
    }

    /**
     * Clear processed orders (useful for testing)
     */
    clearProcessedOrders() {
        this.processedOrderIds.clear();
    }
}