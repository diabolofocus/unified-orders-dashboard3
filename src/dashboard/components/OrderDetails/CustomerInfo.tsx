// components/OrderDetails/CustomerInfo.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, TextButton, Avatar, Tooltip } from '@wix/design-system';
import { useOrderController } from '../../hooks/useOrderController';
import { settingsStore } from '../../stores/SettingsStore';
import { dashboard } from '@wix/dashboard';
import type { Order } from '../../types/Order';

interface CustomerInfoProps {
    order: Order;
}

export const CustomerInfo: React.FC<CustomerInfoProps> = ({ order }) => {
    const orderController = useOrderController();
    const [isNavigating, setIsNavigating] = useState(false);
    const [contactImageUrl, setContactImageUrl] = useState<string | null>(null);
    const [loadingAvatar, setLoadingAvatar] = useState(false);

    // Safely extract contact details with fallbacks
    const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
    const billingContact = order.rawOrder?.billingInfo?.contactDetails;

    // Get customer name - use fallback from order.customer if rawOrder data is missing
    const formatName = (name: string) => name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : '';
    const firstName = formatName(recipientContact?.firstName || billingContact?.firstName || order.customer.firstName || 'Unknown');
    const lastName = formatName(recipientContact?.lastName || billingContact?.lastName || order.customer.lastName || 'Customer');
    const fullName = `${firstName} ${lastName}`;

    // Get phone - try multiple sources, only if it exists
    const phone = recipientContact?.phone || billingContact?.phone || order.customer.phone;

    // Get company - try multiple sources, only if it exists
    const company = recipientContact?.company || billingContact?.company || order.customer.company;

    // Email should be available from order.customer
    const email = order.customer.email || 'No email provided';

    // Simplified avatar handling - no backend calls to avoid 403 errors
    const fetchContactAvatar = async (contactId: string) => {
        if (!contactId) return;
        
        // For now, we'll not fetch contact avatars to avoid permission issues
        // This can be re-enabled when proper CRM permissions are configured
        console.log('Contact avatar fetching disabled to prevent 403 errors');
        setContactImageUrl(null);
        setLoadingAvatar(false);
    };

    // Simplified: No contact avatar fetching to avoid permission issues
    React.useEffect(() => {
        // Avatar functionality disabled to prevent 403 errors
        // Can be re-enabled when proper CRM permissions are configured
        setContactImageUrl(null);
        setLoadingAvatar(false);
    }, [order._id]);

    const handleContactPageNavigation = async () => {
        if (!email || email === 'No email provided') {
            console.warn('No email available to search for contact');
            return;
        }

        try {
            setIsNavigating(true);

            // For now, navigate to the contacts list page instead of specific contact
            // This avoids the need for backend API calls that cause 403 errors
            dashboard.navigate({
                pageId: "bdd09dca-7cc9-4524-81d7-c9336071b33e",
                relativeUrl: `/`
            });

        } catch (error) {
            console.error('Failed to navigate to contacts:', error);
        } finally {
            setIsNavigating(false);
        }
    };

    return (
        <Box gap="6px" direction="vertical">

            <Box direction="horizontal" align="left" verticalAlign="middle" gap="8px">
                <Avatar
                    size="size30"
                    name={fullName}
                    imgProps={contactImageUrl ? { src: contactImageUrl } : undefined}
                />

                <Tooltip content="View Contacts">
                    <TextButton
                        size="medium"
                        underline="onHover"
                        onClick={handleContactPageNavigation}
                        disabled={isNavigating || !email || email === 'No email provided'}
                        ellipsis
                        style={{
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            padding: 0,
                            minHeight: 'auto',
                            fontWeight: 'normal',
                            maxWidth: '200px'
                        }}
                    >
                        {isNavigating ? 'Opening contacts...' : fullName}
                    </TextButton>
                </Tooltip>
            </Box>

            <Text
                size="small"
                className={settingsStore.clickToCopyEnabled ? "clickable-info" : ""}
                onClick={() => orderController.copyToClipboard(email, 'Email', false)}
            >
                {email}
            </Text>

            {/* Only render phone if it exists and is not empty */}
            {phone && phone.trim() && (
                <Text
                    size="small"
                    className={settingsStore.clickToCopyEnabled ? "clickable-info" : ""}
                    onClick={() => orderController.copyToClipboard(phone, 'Phone', false)}
                >
                    {phone}
                </Text>
            )}

            {/* Only render company if it exists and is not empty */}
            {company && company.trim() && (
                <Text
                    size="small"
                    className={settingsStore.clickToCopyEnabled ? "clickable-info" : ""}
                    onClick={() => orderController.copyToClipboard(company, 'Company', false)}
                >
                    {company}
                </Text>
            )}
        </Box>
    );
};