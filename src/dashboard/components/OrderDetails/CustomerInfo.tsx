// components/OrderDetails/CustomerInfo.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, TextButton, Avatar, Tooltip } from '@wix/design-system';
import { useOrderController } from '../../hooks/useOrderController';
import { settingsStore } from '../../stores/SettingsStore';
import { dashboard } from '@wix/dashboard';
import { contacts } from '@wix/crm';
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

    // Function to fetch contact's profile picture
    const fetchContactAvatar = async (contactId: string) => {
        if (!contactId) return;

        try {
            setLoadingAvatar(true);

            const contact = await contacts.getContact(contactId, {
                fields: ['info.picture'] // Specify the fields to retrieve
            });

            if (contact.info?.picture?.image) {
                // ContactPicture has an 'image' property containing the URL or Wix Media GUID
                const imageUrl = contact.info.picture.image;
                setContactImageUrl(imageUrl);
            } else {
                setContactImageUrl(null);
            }
        } catch (error) {
            setContactImageUrl(null);
        } finally {
            setLoadingAvatar(false);
        }
    };

    // Fetch contact avatar when component mounts or order changes
    React.useEffect(() => {
        const contactId = order.rawOrder?.buyerInfo?.contactId;
        if (contactId) {
            fetchContactAvatar(contactId);
        } else {
            setContactImageUrl(null);
        }
    }, [order._id, order.rawOrder?.buyerInfo?.contactId]);

    const handleContactPageNavigation = async () => {
        if (!email || email === 'No email provided') {
            console.warn('No email available to search for contact');
            return;
        }

        try {
            setIsNavigating(true);

            const queryResult = await contacts.queryContacts()
                .eq('primaryInfo.email', email)
                .limit(1)
                .find();

            if (queryResult.items && queryResult.items.length > 0) {
                const contactId = queryResult.items[0]._id;
                console.log(`Found contact ID: ${contactId}`);


                dashboard.navigate({
                    pageId: "bdd09dca-7cc9-4524-81d7-c9336071b33e",
                    relativeUrl: `/view/${contactId}`
                },
                );

            }

        } catch (error) {
            console.error('Failed to find contact or navigate:', error);
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

                <Tooltip content="View Contact">
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
                        {isNavigating ? 'Opening contact...' : fullName}
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