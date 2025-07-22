// components/BulkFulfillmentModal/BulkFulfillmentModal.tsx

import React, { useState, useEffect } from 'react';
import {
    Modal,
    Box,
    Button,
    Loader,
    Heading,
    IconButton
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { SHIPPING_CARRIERS } from '../../utils/constants';
import { settingsStore } from '../../stores/SettingsStore';


interface BulkFulfillmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderIds: string[];
    orderCount: number;
    onConfirm: (params: {
        trackingNumber?: string;
        shippingProvider?: string;
        sendShippingEmail: boolean;
    }) => Promise<void>;
    isProcessing?: boolean;
}

export const BulkFulfillmentModal: React.FC<BulkFulfillmentModalProps> = ({
    isOpen,
    onClose,
    orderIds,
    orderCount,
    onConfirm,
    isProcessing = false
}) => {
    const [trackingNumber, setTrackingNumber] = useState('');
    const [selectedCarrier, setSelectedCarrier] = useState<string>('');
    const [sendShippingEmail, setSendShippingEmail] = useState(true);
    const [useTracking, setUseTracking] = useState(false);

    // Initialize default carrier
    useEffect(() => {
        if (isOpen && !selectedCarrier && SHIPPING_CARRIERS.length > 0) {
            const defaultCarrier = settingsStore.defaultShippingCarrier || SHIPPING_CARRIERS[0].id as string;
            setSelectedCarrier(defaultCarrier);
        }
    }, [isOpen, selectedCarrier]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setTrackingNumber('');
            setUseTracking(false);
            setSendShippingEmail(true);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        try {
            await onConfirm({
                trackingNumber: useTracking ? trackingNumber : undefined,
                shippingProvider: useTracking ? selectedCarrier : undefined,
                sendShippingEmail
            });
            onClose();
        } catch (error) {
            // Error handling is done in the parent component
            console.error('Bulk fulfillment confirmation failed:', error);
        }
    };

    const isFormValid = !useTracking || (trackingNumber.trim() !== '' && selectedCarrier !== '');

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            shouldCloseOnOverlayClick={!isProcessing}
        >
            <Box direction="vertical" gap="24px" padding="32px" width="500px" background="white" borderRadius="8px" boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)">
                {/* Header */}
                <Box direction="horizontal" align="space-between" verticalAlign="top">
                    <Box direction="vertical" gap="8px" style={{ flex: 1 }}>
                        <Heading size="medium" weight="bold" level="2">
                            Mark {orderCount} Order{orderCount !== 1 ? 's' : ''} as Fulfilled?
                        </Heading>
                    </Box>
                    <IconButton
                        priority="tertiary"
                        skin="dark"
                        size="tiny"
                        onClick={onClose}
                        disabled={isProcessing}
                        suffixIcon={<Icons.X />}
                        style={{
                            minWidth: 'auto',
                            padding: '8px',
                            marginLeft: '16px'
                        }}
                    />
                </Box>

                {/* Footer */}
                <Box direction="horizontal" gap="12px" align="right">
                    <Button
                        priority="secondary"
                        onClick={onClose}
                        disabled={isProcessing}
                        size="small"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!isFormValid || isProcessing}
                        suffixIcon={isProcessing ? <Loader size="tiny" /> : undefined}
                        size="small"
                    >
                        {isProcessing
                            ? 'Processing...'
                            : `Mark as Fulfilled`
                        }
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};