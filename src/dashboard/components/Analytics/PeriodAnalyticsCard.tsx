import React from 'react';
import { observer } from 'mobx-react-lite';
import { Card, Text, Box } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';

interface PeriodAnalyticsCardProps {
  /** Main value for the 30-day period */
  thirtyDaysValue: number | string;
  /** Today's value */
  todayValue: number | string;
  /** Yesterday's value */
  yesterdayValue: number | string;
  /** Percentage change from previous period */
  percentageChange?: number;
  /** Optional title for the card */
  title?: string;
  /** Optional flag to format values as currency */
  isCurrency?: boolean;
  /** Optional currency symbol (defaults to '€') */
  currencySymbol?: string;
}

export const PeriodAnalyticsCard = observer(({
  thirtyDaysValue,
  todayValue,
  yesterdayValue,
  percentageChange = 0,
  title = 'Amount paid',
  isCurrency = true,
  currencySymbol = '€',
}: PeriodAnalyticsCardProps) => {
  const { settingsStore } = useStores();
  const formatPercentageChange = (change: number): { text: string; color: string; icon: React.ReactNode } => {
    if (change === 0) return { text: '0%', color: '#6b7280', icon: null };
    const color = change > 0 ? '#15803d' : '#6b7280';
    const rotation = change > 0 ? '-90deg' : '90deg'; // Up = -90deg, Down = 90deg
    const icon = <Icons.LineEndArrowSmall style={{ transform: `rotate(${rotation})` }} />;
    return {
      text: `${Math.abs(change)}%`,
      color: color,
      icon: icon
    };
  };

  const percentageData = formatPercentageChange(percentageChange);
  const formatValue = (value: number | string) => {
    if (typeof value === 'number') {
      return isCurrency
        ? `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : value.toLocaleString();
    }
    return isCurrency ? `${currencySymbol}${value}` : value;
  };

  return (
    <Box padding="4px 4px">
      <Box direction="vertical" gap="0px">
        {/* Title */}
        <Text size="medium" secondary>
          {title}
        </Text>

        {/* 30-day total with percentage change */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Text size="medium" weight="normal" style={{ fontSize: '24px', lineHeight: 1 }}>
            {formatValue(thirtyDaysValue)}
          </Text>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            marginLeft: '8px',
            paddingBottom: '4px'
          }}>
            {percentageData.icon && (
              <span style={{
                color: percentageData.color,
                display: 'flex',
                alignItems: 'center',
                lineHeight: '1.8'
              }}>
                {React.cloneElement(percentageData.icon as React.ReactElement, {
                  size: "14px",
                  style: {
                    color: percentageData.color,
                    ...((percentageData.icon as React.ReactElement).props.style || {})
                  }
                })}
              </span>
            )}
            <span
              style={{
                color: percentageData.color,
                fontWeight: '900',
                fontSize: '10px',
                lineHeight: '1.8',
                fontFamily: 'HelveticaNeueW01-45Ligh, HelveticaNeueW02-45Ligh, HelveticaNeueW10-45Ligh, Helvetica Neue, Helvetica, Arial, sans-serif',
                letterSpacing: '1.3px'
              }}
            >
              {percentageData.text}
            </span>
          </div>
        </div>

        {/* Today's and yesterday's sales - only show if enabled in settings */}
        {settingsStore.showTinyAnalytics && (
          <Box
            direction="horizontal"
            gap="4px"
            align="center"
            paddingTop="4px"
          >
            <Text size="tiny" secondary>
              {formatValue(todayValue)} today
            </Text>
            <Text size="tiny" secondary>
              •
            </Text>
            <Text size="tiny" secondary>
              {formatValue(yesterdayValue)} yesterday
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

export default PeriodAnalyticsCard;