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

    // Debug: Log app instance info after initialization
    setTimeout(() => {
      console.log('=== FREE TRIAL BANNER DEBUG ===');
      console.log('App Instance Info:', JSON.stringify(promoBannerStore.appInstanceInfo, null, 2));
      console.log('App Def ID:', promoBannerStore.appInstanceInfo?.appDefId);
      console.log('Instance ID:', promoBannerStore.appInstanceInfo?.instanceId);
      console.log('Upgrade URL:', promoBannerStore.upgradeUrl);
      console.log('Should Show Banner:', promoBannerStore.shouldShowFreeTrialBanner);
      console.log('Is Free:', promoBannerStore.appInstanceInfo?.isFree);
      console.log('Has Premium Plan:', promoBannerStore.appInstanceInfo?.hasPremiumPlan);
      console.log('Is In Free Trial:', promoBannerStore.appInstanceInfo?.isInFreeTrial);

      // Check if URL construction is working
      if (!promoBannerStore.upgradeUrl && promoBannerStore.appInstanceInfo?.appDefId && promoBannerStore.appInstanceInfo?.instanceId) {
        console.warn('⚠️ appDefId and instanceId exist but upgrade URL was not generated!');
        console.log('Expected URL format: https://www.wix.com/apps/upgrade/' + promoBannerStore.appInstanceInfo.appDefId + '?appInstanceId=' + promoBannerStore.appInstanceInfo.instanceId);
      } else if (!promoBannerStore.upgradeUrl) {
        console.warn('⚠️ Upgrade URL not available. This is expected for unpublished apps.');
        console.log('Missing fields:');
        console.log('  - appDefId:', promoBannerStore.appInstanceInfo?.appDefId || 'MISSING');
        console.log('  - instanceId:', promoBannerStore.appInstanceInfo?.instanceId || 'MISSING');
      }
      console.log('==============================');
    }, 2000);
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
        <Text size="medium" weight="normal" style={{ color: '#000000' }}>
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
