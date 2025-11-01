# Free Trial and Pricing Setup Guide

This guide explains how to configure the 14-day free trial and premium pricing for the Unified Orders Dashboard app.

## Overview

The app now supports:
- **14-day free trial** for new users
- **Automatic detection** of premium vs free plans
- **Smart banner display** that shows/hides based on user's plan status
- **Free trial countdown** for users in trial period
- **One-click upgrade** to premium plans

## Architecture

### Backend Components

#### 1. App Instance Web Method (`src/backend/app-instance.web.ts`)
- `getAppInstanceInfo()`: Retrieves current app instance and checks premium status
- `getUpgradeUrl()`: Generates the Wix checkout URL for upgrading

### Frontend Components

#### 1. PromoBannerStore (`src/dashboard/stores/PromoBannerStore.ts`)
MobX store that manages:
- App instance information
- Premium plan status
- Free trial status and countdown
- Upgrade URL generation
- Banner visibility logic

#### 2. FreeTrialBanner Component (`src/dashboard/components/PromoBanner/FreeTrialBanner.tsx`)
React component that:
- Displays only when user doesn't have premium plan OR is in free trial
- Shows different messages based on trial status
- Provides one-click upgrade button
- Lists premium features

## Setting Up Pricing Plans in Wix Dashboard

### Step 1: Access Pricing Settings

1. Go to [Wix Developers Center](https://dev.wix.com/)
2. Select your app: "Unified Orders Dashboard"
3. Navigate to **Pricing** section

### Step 2: Choose Business Model

Select **Premium** or **Freemium** business model:
- **Premium**: All plans are paid (recommended if offering only premium features)
- **Freemium**: Mix of free and paid plans (recommended if you want a limited free version)

### Step 3: Enable Free Trial

1. In the Pricing page, enable **Free Trial**
2. Set trial duration: **14 days**
3. This allows users to try all premium features before paying

### Step 4: Create Pricing Plans

Example pricing structure:

#### Plan 1: Starter (Recommended)
- **Billing Model**: Recurring (Monthly)
- **Price**: $19.99/month
- **Benefits**:
  - Advanced order analytics
  - Real-time notifications
  - Per-item fulfillment
  - Email support

#### Plan 2: Professional
- **Billing Model**: Recurring (Monthly or Yearly)
- **Price**: $39.99/month or $399.99/year (save 17%)
- **Benefits**:
  - Everything in Starter
  - Priority support
  - Custom integrations
  - Advanced reporting

#### Plan 3: Enterprise
- **Billing Model**: Recurring (Yearly)
- **Price**: $799.99/year
- **Benefits**:
  - Everything in Professional
  - Dedicated account manager
  - Custom development
  - White-label options

### Step 5: Configure Wix Pricing Page

1. Go to **Pricing Page** section
2. Select **Wix pricing page**
3. Click **Customize Pricing Page**
4. Choose **Recommended plan** (e.g., "Starter")
5. Add features and comparison details

### Step 6: Set Plan IDs

After creating plans, Wix assigns each plan a unique **Product ID** (also called `vendorProductId` or `packageName`).

You can find these IDs in the Pricing section of your app dashboard. The app automatically detects these IDs through the `getAppInstanceInfo()` method.

## How the Free Trial Works

### User Flow

1. **Installation**: User installs the app (free)
   - Free trial banner appears
   - Shows "Start your 14-day free trial"

2. **User clicks "Start Free Trial"**
   - Redirects to Wix pricing page
   - User selects a plan and enters payment info
   - Trial starts (no charge yet)

3. **During Trial** (Days 1-14)
   - Banner shows: "X days left in your free trial"
   - User has full access to premium features
   - `isInFreeTrial` = true
   - `hasPremiumPlan` = true (Wix considers trial users as paid)

4. **Trial End** (Day 14)
   - User is automatically charged
   - Becomes regular premium user
   - Banner disappears

5. **If User Cancels**
   - Access continues until trial end
   - Then reverts to free plan
   - Banner reappears

### Detection Logic

The app checks premium status using these fields from Wix's `getAppInstance()` API:

```typescript
interface AppInstanceInfo {
  instanceId: string;           // Unique app instance ID
  isFree: boolean;              // true = free plan, false = paid plan
  hasPremiumPlan: boolean;      // Combined check (paid OR in trial)
  isInFreeTrial: boolean;       // Currently in free trial period
  freeTrialDaysRemaining?: number;  // Days left in trial
  packageName?: string;         // Plan ID (only if paid/trial)
}
```

Premium status determination:
```typescript
const hasPremiumPlan = !isFree || isInFreeTrial;
```

### Banner Visibility Logic

The banner is shown when:
- User is on free plan (`!hasPremiumPlan`)
- OR user is in free trial (`isInFreeTrial`)

The banner is hidden when:
- User has paid plan and is NOT in trial

## Testing the Implementation

### Test Scenario 1: Free User
1. Install app on test site
2. Banner should appear with "Start Free Trial" CTA
3. Click upgrade button
4. Should redirect to Wix pricing page

### Test Scenario 2: Free Trial User
1. Sign up for free trial
2. Banner should show countdown: "X days left in your free trial"
3. CTA should say "Upgrade to Premium"
4. Verify full access to premium features

### Test Scenario 3: Paid User
1. Complete purchase (use test coupon for testing)
2. Banner should disappear completely
3. All premium features remain accessible

### Testing with Test Site

Wix provides test sites for app development:

1. In your app dashboard, click **Test Your App**
2. Select **App Market**
3. Click **Add to Site** on a test site
4. Use test credit card for free trial (will be refunded)

For published apps, create a test coupon:
1. Go to **Pricing** > **Coupons**
2. Create 100% discount coupon
3. Use during checkout for testing

## Code Integration Points

### Where to Use FreeTrialBanner

The banner is currently shown in:
- Settings page (`src/dashboard/pages/settings/page.tsx`)

You can add it to other pages by:

```tsx
import { FreeTrialBanner } from '../../components/PromoBanner/FreeTrialBanner';

// In your component
<FreeTrialBanner />
```

### Restricting Features Based on Plan

To restrict features to premium users only:

```tsx
import { observer } from 'mobx-react-lite';
import { rootStore } from '../stores/RootStore';

const MyComponent = observer(() => {
  const { promoBannerStore } = rootStore;
  const { appInstanceInfo } = promoBannerStore;

  useEffect(() => {
    promoBannerStore.initialize();
  }, []);

  if (!appInstanceInfo?.hasPremiumPlan) {
    return <div>This feature requires a premium plan</div>;
  }

  return <div>Premium feature content</div>;
});
```

### Checking Plan Status in Backend

```typescript
import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';

export const myWebMethod = webMethod(Permissions.Anyone, async () => {
  const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
  const response = await elevatedGetAppInstance();

  const isFree = response.instance?.isFree;
  const isInTrial = response.instance?.billing?.freeTrialInfo?.status === 'IN_PROGRESS';
  const hasPremium = !isFree || isInTrial;

  if (!hasPremium) {
    throw new Error('Premium plan required');
  }

  // Premium-only logic here
});
```

## Webhooks for Plan Changes

Subscribe to these webhooks to handle plan changes:

1. **Paid Plan Purchased** - User starts trial or purchases plan
2. **Paid Plan Changed** - User upgrades/downgrades
3. **Paid Plan Auto Renewal Cancelled** - User cancels subscription

Configure webhooks in your app dashboard under **Webhooks** section.

## Important Notes

- **Free trial users are considered premium users** by Wix
- The `Paid Plan Purchased` webhook fires when trial starts (not when charged)
- Banner state updates automatically when plan changes
- Always check `hasPremiumPlan` (not just `isFree`) for feature access
- Upgrade URL is dynamically generated per app instance
- Testing requires a real payment method (immediately refunded for trials)

## Support and Resources

- [Wix App Pricing Documentation](https://dev.wix.com/docs/build-apps/launch-your-app/pricing-and-billing/about-pricing-plans-and-business-models)
- [Free Trial Setup Guide](https://dev.wix.com/docs/build-apps/launch-your-app/pricing-and-billing/set-up-and-manage-free-trials)
- [App Instance API](https://dev.wix.com/docs/sdk/backend-modules/app-management/app-instances/get-app-instance)

## Troubleshooting

### Banner not disappearing for paid users
- Check browser console for errors in `getAppInstanceInfo()`
- Verify premium plan is properly configured in Wix dashboard
- Check that `packageName` is being returned from API

### Upgrade button not working
- Verify `appDefId` and `instanceId` are correct
- Check console for errors in `getUpgradeUrl()`
- Ensure pricing page is configured in app dashboard

### Free trial not starting
- Verify free trial is enabled in Pricing settings
- Check payment method is valid
- Review app permissions and OAuth setup

### Banner showing for premium users
- Check `hasPremiumPlan` logic in PromoBannerStore
- Verify billing information is being returned from API
- Clear browser cache and reload
