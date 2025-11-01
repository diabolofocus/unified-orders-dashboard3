import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Text, Button, Loader } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { rootStore } from '../../stores/RootStore';

export const FreeTrialBanner: React.FC = observer(() => {
  const { promoBannerStore } = rootStore;

  useEffect(() => {
    // Initialize the store when component mounts
    promoBannerStore.initialize();
  }, [promoBannerStore]);

  // Don't render anything while loading
  if (promoBannerStore.isLoading) {
    return (
      <Box
        padding="12px 24px"
        align="center"
        backgroundColor="#ffffff"
        borderRadius="8px"
        style={{ width: '100%' }}
      >
        <Loader size="tiny" />
      </Box>
    );
  }

  // Don't render banner if user has premium plan (and not in trial)
  if (!promoBannerStore.shouldShowFreeTrialBanner) {
    return null;
  }

  const handleUpgrade = () => {
    promoBannerStore.openUpgradePage();
  };

  const isInTrial = promoBannerStore.appInstanceInfo?.isInFreeTrial;

  return (
    <Box
      direction="horizontal"
      padding="16px 24px"
      gap="16px"
      backgroundColor="#ffffff"
      borderRadius="8px"
      align="center"
      style={{
        width: '100%',
        border: isInTrial ? '1px solid #ff9800' : '1px solid #3b82f6'
      }}
    >
      {/* Icon */}
      <Box
        width="40px"
        height="40px"
        borderRadius="50%"
        backgroundColor={isInTrial ? "#fff3cd" : "#e3f2fd"}
        align="center"
        verticalAlign="middle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {isInTrial ? (
          <Icons.StatusAlertFilled style={{ color: '#ff9800', fontSize: '24px' }} />
        ) : (
          <Icons.StarFilled style={{ color: '#3b82f6', fontSize: '24px' }} />
        )}
      </Box>

      {/* Message */}
      <Box direction="vertical" gap="4px" align="left" style={{ flex: 1 }}>
        <Text size="medium" weight="bold" style={{ color: '#000000' }}>
          {isInTrial ? 'Free Trial Active' : '14-Day Free Trial Available'}
        </Text>
        <Text size="small" style={{ color: '#666666' }}>
          {promoBannerStore.bannerMessage}
        </Text>
      </Box>

      {/* CTA Button */}
      <Button
        size="small"
        priority="primary"
        onClick={handleUpgrade}
      >
        {promoBannerStore.ctaButtonText}
      </Button>
    </Box>
  );
});
