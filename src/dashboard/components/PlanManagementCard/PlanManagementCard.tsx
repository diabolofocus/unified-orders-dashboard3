import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Card,
    Box,
    Text,
    Button,
    Heading,
    Badge,
    Collapse,
    Divider,
    IconButton
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { settingsStore } from '../../stores/SettingsStore';

export const PlanManagementCard: React.FC = observer(() => {
    const { planType, trialDaysLeft } = settingsStore;
    const isPremium = planType === 'premium';

    // If premium, collapse by default. If trial, expand by default.
    const [isExpanded, setIsExpanded] = useState(!isPremium);

    const handleToggleCollapse = () => {
        setIsExpanded(!isExpanded);
    };

    const handleUpgradePlan = () => {
        // Get the instance ID from URL params
        const instanceId = new URLSearchParams(window.location.search).get('instance');

        // App ID from wix.config.json
        const appId = 'aeb5e016-2505-4705-b39f-7724f4845fbd';

        // Construct the upgrade URL
        const upgradeUrl = `https://www.wix.com/apps/upgrade/${appId}${instanceId ? `?appInstanceId=${instanceId}` : ''}`;

        window.open(upgradeUrl, '_blank');
    };

    const handleManagePlan = () => {
        // Navigate to plan management page
        window.open('https://www.wix.com/my-account/premium/', '_blank');
    };

    return (
        <Card stretchVertically>
            <Card.Header
                title={
                    <Box direction="horizontal" gap="8px" verticalAlign="middle">
                        <Icons.PaidPlans />
                        <Heading size="medium">Plan Management</Heading>
                        <Badge
                            skin={isPremium ? 'success' : 'neutralStandard'}
                            size="small"
                        >
                            {isPremium ? 'PREMIUM' : 'TRIAL'}
                        </Badge>
                        {!isPremium && trialDaysLeft !== null && (
                            <Text size="small" secondary>
                                {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left
                            </Text>
                        )}
                    </Box>
                }
                subtitle={isPremium
                    ? "You're on the Premium plan with full access to all features"
                    : `Your trial includes all premium features. ${trialDaysLeft !== null ? `Upgrade before it expires in ${trialDaysLeft} days.` : 'Upgrade to continue using premium features.'}`
                }
                suffix={
                    <IconButton
                        size="small"
                        priority="secondary"
                        onClick={handleToggleCollapse}
                    >
                        {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    </IconButton>
                }
            />
            <Collapse open={isExpanded}>
                <Card.Divider />
                <Card.Content>
                    <Box direction="vertical" gap="16px" width="100%">
                        {isPremium ? (
                            <>
                                <Box direction="vertical" gap="12px" width="100%">
                                    <Text weight="bold">Premium Features Included:</Text>
                                    <Box direction="vertical" gap="8px" width="100%">
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Centralized Modular Orders Dashboard</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Add Tracking to Custom Items</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Packing list and Order History</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Modular Analytics</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Priority Support</Text>
                                        </Box>
                                    </Box>
                                </Box>

                                <Divider />

                                <Box direction="horizontal" gap="12px" width="100%">
                                    <Button
                                        priority="secondary"
                                        size="small"
                                        prefixIcon={<Icons.Settings />}
                                        onClick={handleManagePlan}
                                    >
                                        Manage Plan
                                    </Button>
                                </Box>
                            </>
                        ) : (
                            <>
                                <Box direction="vertical" gap="12px" width="100%">
                                    <Text weight="bold">Trial Features (Full Access):</Text>
                                    <Box direction="vertical" gap="8px" width="100%">
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Centralized Modular Orders Dashboard</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Add Tracking to Custom Items</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Packing list and Order History</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Modular Analytics</Text>
                                        </Box>
                                    </Box>
                                </Box>

                                {trialDaysLeft !== null && trialDaysLeft <= 7 && (
                                    <Box
                                        width="100%"
                                        padding="12px"
                                        backgroundColor="#fff4e6"
                                        borderRadius="4px"
                                    >
                                        <Text size="small" weight="bold" style={{ color: '#f57c00' }}>
                                            Your trial expires in {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'}. Upgrade now to keep all premium features!
                                        </Text>
                                    </Box>
                                )}

                                <Divider />

                                <Box direction="horizontal" gap="12px" width="100%">
                                    <Button
                                        skin="premium"
                                        size="small"
                                        onClick={handleUpgradePlan}
                                    >
                                        Upgrade to Premium
                                    </Button>
                                </Box>
                            </>
                        )}
                    </Box>
                </Card.Content>
            </Collapse>
        </Card>
    );
});
