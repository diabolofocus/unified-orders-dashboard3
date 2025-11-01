import React from 'react';
import { observer } from 'mobx-react-lite';
import { settingsStore } from '../../stores/SettingsStore';
import {
    Card,
    Box,
    Text,
    Heading,
    ToggleSwitch,
    Divider
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';


export const ComponentsVisibility: React.FC = observer(() => {

    const renderListItem = ({
        title,
        subtitle,
        padding,
        toggleChecked,
        onToggleChange,
        disabled = false
    }: {
        title: string;
        subtitle: string;
        padding: string;
        toggleChecked: boolean;
        onToggleChange?: (checked: boolean) => void;
        disabled?: boolean;
    }) => {
        return (
            <Box verticalAlign="middle" align="space-between" padding={padding}>
                <Box direction="vertical">
                    <Text weight="normal">{title}</Text>
                    <Text secondary size="small">
                        {subtitle}
                    </Text>
                </Box>
                <ToggleSwitch
                    checked={toggleChecked}
                    onChange={(e) => onToggleChange?.(e.target.checked)}
                    disabled={disabled}
                />
            </Box>
        );
    };

    return (
        <Card stretchVertically >
            <Card.Header
                title={
                    <Box direction="horizontal" align="left" gap="8px">
                        <Icons.Visible />
                        <Heading size="medium">Components Visibility</Heading>
                    </Box>
                }
                subtitle="Manage the visibility of components in your dashboard"
            />

            <Card.Divider />
            <Card.Content>
                <Box direction="vertical" width="100%" height="100%" padding="0px">
                    {renderListItem({
                        title: 'Item Weight',
                        subtitle: 'Show the weight of each individual item in the order',
                        padding: '0px 0px 18px',
                        toggleChecked: settingsStore.showIndividualWeights,
                        onToggleChange: (checked: boolean) => settingsStore.setShowIndividualWeights(checked)
                    })}
                    <Divider />

                    {renderListItem({
                        title: 'Total Items Weight',
                        subtitle: 'Show the total weight of all items in the order',
                        padding: '18px 0px 18px',
                        toggleChecked: settingsStore.showTotalWeight,
                        onToggleChange: (checked: boolean) => settingsStore.setShowTotalWeight(checked),
                        disabled: false
                    })}
                    <Divider />

                    {renderListItem({
                        title: 'Item SKU',
                        subtitle: 'Show the SKU in all data if you use them',
                        padding: '18px 0px 18px',
                        toggleChecked: settingsStore.showSKU,
                        onToggleChange: (checked: boolean) => settingsStore.setShowSKU(checked),
                        disabled: false
                    })}
                    <Divider />

                    {renderListItem({
                        title: 'Channel Information',
                        subtitle: 'Show the sales channel information (e.g., Amazon, eBay) for each order',
                        padding: '18px 0px 18px',
                        toggleChecked: settingsStore.showChannelInfo,
                        onToggleChange: (checked: boolean) => settingsStore.setShowChannelInfo(checked),
                        disabled: false
                    })}
                    <Divider />

                    {renderListItem({
                        title: 'Time in Dates',
                        subtitle: 'Show time alongside dates in the orders table',
                        padding: '18px 0px 18px',
                        toggleChecked: settingsStore.showTimeInDates,
                        onToggleChange: (checked: boolean) => settingsStore.setShowTimeInDates(checked),
                        disabled: false
                    })}
                    <Divider />

                    {renderListItem({
                        title: 'Packing List as Primary Tab',
                        subtitle: 'Show the packing list as the first tab instead of the orders table',
                        padding: '18px 0px 18px',
                        toggleChecked: settingsStore.packingListFirst,
                        onToggleChange: (checked: boolean) => settingsStore.setPackingListFirst(checked),
                        disabled: false
                    })}
                    <Divider />

                    <Box direction="vertical" padding="24px 0px" gap="24px">
                        <Text size="medium" weight="bold">Analytics</Text>
                        <Box padding="0 0px 0 0px" direction="vertical" gap="24px">
                            {renderListItem({
                                title: 'Full Card',
                                subtitle: 'Show the analytics card at the top of the orders page',
                                padding: '0px',
                                toggleChecked: settingsStore.showAnalyticsCard,
                                onToggleChange: (checked: boolean) => {
                                    settingsStore.setShowAnalyticsCard(checked);
                                    if (!checked) {
                                        settingsStore.setShowTinyAnalytics(false);
                                        settingsStore.setShowTopSellingItems(false);
                                    }
                                }
                            })}
                            {renderListItem({
                                title: 'Tiny values',
                                subtitle: 'Show today\'s and yesterday\'s values in the analytics card',
                                padding: '0px',
                                toggleChecked: settingsStore.showTinyAnalytics,
                                onToggleChange: (checked: boolean) => settingsStore.setShowTinyAnalytics(checked),
                                disabled: !settingsStore.showAnalyticsCard
                            })}
                            {renderListItem({
                                title: 'Top Selling Items',
                                subtitle: 'Show the top selling items section in the dashboard',
                                padding: '0px',
                                toggleChecked: settingsStore.settings.showTopSellingItems,
                                onToggleChange: (checked: boolean) => settingsStore.setShowTopSellingItems(checked),
                                disabled: !settingsStore.showAnalyticsCard
                            })}
                            {renderListItem({
                                title: 'Low Inventory Items',
                                subtitle: 'Show the low inventory items section in the dashboard',
                                padding: '0px',
                                toggleChecked: settingsStore.settings.showLowInventoryItems,
                                onToggleChange: (checked: boolean) => settingsStore.setShowLowInventoryItems(checked),
                                disabled: !settingsStore.showAnalyticsCard
                            })}
                        </Box>
                    </Box>

                </Box>
            </Card.Content>
        </Card>
    );
});