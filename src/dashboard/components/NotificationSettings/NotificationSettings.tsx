// components/NotificationSettings/NotificationSettings.tsx - UPDATED WITH WIX DESIGN SYSTEM
import React, { useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { dashboard } from '@wix/dashboard';
import {
    Card,
    Box,
    Text,
    Button,
    Heading,
    ToggleSwitch,
    Divider,
    Loader
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { useOrderController } from '../../contexts/OrderControllerContext';
import { settingsStore } from '../../stores/SettingsStore';

interface ListItemProps {
    title: string;
    subtitle: string;
    padding: string;
    toggleChecked: boolean;
    onToggleChange: (checked: boolean) => void;
    disabled?: boolean;
}

const NotificationSettings: React.FC = observer(() => {
    const { testNotifications } = useOrderController();
    const [isTestingSound, setIsTestingSound] = useState(false);

    // Access settings directly from the store - it will be reactive
    const { automaticDetection, soundAlert, isReady } = settingsStore;

    const handleTestSound = useCallback(async () => {
        if (isTestingSound) return;

        console.log('[NotificationSettings] Testing sound...');
        setIsTestingSound(true);

        try {
            // Test the notification sound
            await testNotifications();
            console.log('[NotificationSettings] Test sound played successfully');
            dashboard.showToast({
                message: ' played successfully',
                type: 'success'
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to play test sound';
            console.error('[NotificationSettings] Test sound failed:', error);
            dashboard.showToast({
                message: `Test sound failed: ${errorMessage}`,
                type: 'error'
            });
        } finally {
            setIsTestingSound(false);
        }
    }, [isTestingSound, testNotifications]);

    const handleAutomaticDetectionChange = useCallback(async (checked: boolean) => {
        console.log(`[NotificationSettings] Automatic detection toggled: ${checked}`);
        settingsStore.setAutomaticDetection(checked);

        // If enabling automatic detection, also enable sound alerts by default
        if (checked && !settingsStore.soundAlert) {
            console.log('[NotificationSettings] Enabling sound alerts by default');
            settingsStore.setSoundAlert(true);

            // Play a test sound to ensure audio is working
            try {
                await testNotifications();
                dashboard.showToast({
                    message: 'Automatic detection and sound alerts enabled',
                    type: 'success'
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('[NotificationSettings] Failed to play test sound:', error);
                dashboard.showToast({
                    message: `Enabled but sound test failed: ${errorMessage}`,
                    type: 'warning'
                });
            }
        }
    }, [testNotifications]);

    const handleSoundAlertChange = useCallback(async (checked: boolean) => {
        console.log(`[NotificationSettings] Sound alert toggled: ${checked}`);

        // Don't allow enabling sound alerts if automatic detection is disabled
        if (checked && !settingsStore.automaticDetection) {
            console.warn('[NotificationSettings] Cannot enable sound alerts when automatic detection is disabled');
            dashboard.showToast({
                message: 'Enable automatic detection first',
                type: 'warning'
            });
            return;
        }

        settingsStore.setSoundAlert(checked);

        // If enabling sound alert, initialize audio and play a test sound
        if (checked) {
            try {
                console.log('[NotificationSettings] Playing test sound after enabling sound alert');
                await testNotifications();
                dashboard.showToast({
                    message: 'Sound alerts enabled',
                    type: 'success'
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('[NotificationSettings] Failed to play test sound:', error);
                dashboard.showToast({
                    message: `Failed to enable sound: ${errorMessage}`,
                    type: 'error'
                });
                // Revert the toggle if sound test fails
                settingsStore.setSoundAlert(false);
            }
        } else {
            dashboard.showToast({
                message: 'Sound alerts disabled',
                type: 'success'
            });
        }
    }, [testNotifications, settingsStore.automaticDetection]);

    const renderListItem = ({
        title,
        subtitle,
        padding,
        toggleChecked,
        onToggleChange,
        disabled = false
    }: ListItemProps) => (
        <Box verticalAlign="middle" align="space-between" padding={padding}>
            <Box direction="vertical">
                <Text weight="normal">{title}</Text>
                <Text secondary size="small">
                    {subtitle}
                </Text>
            </Box>
            <ToggleSwitch
                checked={toggleChecked}
                onChange={() => onToggleChange(!toggleChecked)}
                disabled={disabled}
            />
        </Box>
    );

    // Show loading state if settings aren't ready yet
    if (!isReady) {
        return (
            <Card>
                <Card.Content>
                    <Box align="center" padding="24px">
                        <Loader size="medium" />
                        <Text>Loading notifications settings...</Text>
                    </Box>
                </Card.Content>
            </Card>
        );
    }

    return (
        <Card stretchVertically>
            <Card.Header
                title={
                    <Box direction="horizontal" align="left" gap="8px">
                        <Icons.Notification />
                        <Heading size="medium">Notification Settings</Heading>
                    </Box>
                }
                subtitle="Configure how you receive order notifications"
            />
            <Card.Divider />
            <Card.Content>
                <Box direction="vertical" width="100%" height="100%">
                    {renderListItem({
                        title: 'Automatic Order Detection',
                        subtitle: 'Automatically update the orders list every 60 seconds',
                        padding: '0px 0px 18px',
                        toggleChecked: automaticDetection,
                        onToggleChange: handleAutomaticDetectionChange,
                    })}
                    <Divider />

                    {renderListItem({
                        title: 'Sound Alert',
                        subtitle: 'Play sound when a new order is received',
                        padding: '18px 0px 18px',
                        toggleChecked: soundAlert,
                        onToggleChange: handleSoundAlertChange,
                    })}

                    {/* Test Sound Section */}
                    <Box padding="0px 0px 0px">
                        <Box direction="vertical" gap="12px">
                            {/* <Box direction="vertical" gap="4px">
                                <Text weight="normal">Test Sound</Text>
                                <Text secondary size="small">
                                    {soundAlert
                                        ? 'Click to test the notification sound'
                                        : 'Enable sound alerts to test the notification sound'}
                                </Text>
                            </Box> */}

                            <Box direction="vertical" gap="8px">
                                <Button
                                    onClick={handleTestSound}
                                    disabled={!soundAlert || isTestingSound}
                                    size="small"
                                    priority={soundAlert ? "primary" : "secondary"}
                                    prefixIcon={isTestingSound ? <Loader size="tiny" /> : <Icons.Volume />}
                                >
                                    {isTestingSound ? 'Testing...' : 'Play Sound'}
                                </Button>
                                <Text secondary size="tiny">
                                    {soundAlert
                                        ? 'Click to test the notification sound'
                                        : 'Enable sound alerts to test the notification sound'}
                                </Text>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Card.Content>
        </Card>
    );
});

export { NotificationSettings };