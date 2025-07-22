// components/shared/ActionsBar.tsx
import React from 'react';
import { observer } from 'mobx-react-lite';
import {
    Box,
    Button,
    PopoverMenu,
    IconButton,
    Tooltip
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { dashboard } from '@wix/dashboard';
import { pages } from '@wix/ecom/dashboard';
import { useStores } from '../../hooks/useStores';
import { useOrderController } from '../../hooks/useOrderController';

export const ActionsBar: React.FC = observer(() => {
    const { orderStore, uiStore } = useStores();
    const orderController = useOrderController();

    const handleRefresh = async () => {
        try {
            await orderController.refreshOrders();
        } catch (error) {
            // Refresh error already handled in controller
        }
    };

    const handleAddNewOrder = () => {
        // Navigate to Wix's ecommerce new order page using the proper dashboard method
        dashboard.navigate(pages.newOrder());
    };

    const handleOpenSettings = () => {
        try {
            // Navigate to settings dashboard page
            dashboard.navigate({
                pageId: '58613115-8f7e-40f4-bf0c-89a59a0aeb94',
                relativeUrl: '/settings'
            });
        } catch (error) {
            console.error('Failed to navigate to settings:', error);
            dashboard.showToast({
                message: 'Settings page temporarily unavailable',
                type: 'warning'
            });
        }
    };

    const handleOpenSupport = () => {
        try {
            // For now, navigate to settings as well or implement support page later
            dashboard.navigate({
                pageId: 'ad6c9a26-e543-4546-9065-76ae53911cd5',
                relativeUrl: '/support'
            });
        } catch (error) {
            console.error('Failed to navigate to support:', error);
            dashboard.showToast({
                message: 'Support page temporarily unavailable',
                type: 'warning'
            });
        }
    };

    // More Actions menu items
    const moreActionsMenuItems = [
        {
            text: 'Settings',
            prefixIcon: <Icons.Settings />,
            onClick: handleOpenSettings
        },
        {
            text: 'Support',
            prefixIcon: <Icons.Help />,
            onClick: handleOpenSupport
        }
    ];

    return (
        <Box
            direction="horizontal"
            align="center"
            width="100%"
            gap="12px"
            style={{ justifyContent: 'space-between' }}
        >
            {/* Left side - Refresh icon button */}
            <Box direction="horizontal" align="center">
            <Tooltip content="Refresh">
                <IconButton
                    onClick={handleRefresh}
                    disabled={uiStore.refreshing}
                    size="medium"
                    skin="standard"
                    priority="secondary"
                >
                    <Icons.Refresh />
                </IconButton>
            </Tooltip>
            </Box>

            {/* Center - More Actions PopoverMenu */}
            <Box direction="horizontal" align="center">
                <PopoverMenu
                    triggerElement={
                        <Button
                            suffixIcon={<Icons.ChevronDown />}
                            size="medium"
                            skin="standard"
                            priority="secondary"
                        >
                            More Actions
                        </Button>
                    }
                    placement="bottom"
                >
                    {moreActionsMenuItems.map((item, index) => (
                        <PopoverMenu.MenuItem
                            key={index}
                            onClick={item.onClick}
                            prefixIcon={item.prefixIcon}
                            text={item.text}
                        />
                    ))}
                </PopoverMenu>
            </Box>

            {/* Right side - Add New Order button (Blue/Premium) */}
            <Box direction="horizontal" align="center">
                <Button
                    onClick={handleAddNewOrder}
                    prefixIcon={<Icons.Add />}
                    size="medium"
                    skin="standard"
                >
                    Add New Order
                </Button>
            </Box>
        </Box>
    );
});