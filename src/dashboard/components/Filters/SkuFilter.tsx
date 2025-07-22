import React, { useState, useEffect } from 'react';
import { Box, Text, Checkbox, Loader, Search } from '@wix/design-system';

interface SkuFilterProps {
  /**
   * Array of available SKUs to display as checkboxes
   */
  skus: Array<{
    id: string;
    sku: string;
    name: string;
  }>;

  /**
   * Callback function called when selected SKUs change
   * @param selectedSkus Array of selected SKU IDs
   */
  onChange: (selectedSkus: string[]) => void;

  /**
   * Whether the SKUs are currently being loaded
   */
  isLoading?: boolean;

  /**
   * Error message if SKU loading fails
   */
  error?: string | null;

  /**
   * Maximum number of SKUs to display before showing "Show more"
   * @default 10
   */
  maxVisibleItems?: number;
}

/**
 * A filter component that displays SKUs as checkboxes with search functionality
 */
export const SkuFilter: React.FC<SkuFilterProps> = ({
  skus = [],
  onChange,
  isLoading = false,
  error = null,
  maxVisibleItems = 10,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

  // Filter SKUs based on search term
  const filteredSkus = skus.filter(sku =>
    sku.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sku.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Determine which SKUs to display (with pagination)
  const visibleSkus = showAll ? filteredSkus : filteredSkus.slice(0, maxVisibleItems);
  const hasMore = filteredSkus.length > maxVisibleItems && !showAll;

  // Update parent when selected SKUs change
  useEffect(() => {
    onChange(selectedSkus);
  }, [selectedSkus, onChange]);

  const handleSkuToggle = (skuId: string) => {
    setSelectedSkus(prev =>
      prev.includes(skuId)
        ? prev.filter(id => id !== skuId)
        : [...prev, skuId]
    );
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedSkus(filteredSkus.map(sku => sku.id));
    } else {
      setSelectedSkus([]);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Box direction="vertical" gap="8px" padding="8px">
        <Loader size="small" />
        <Text size="small" secondary>Loading SKUs...</Text>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box direction="vertical" gap="8px" padding="8px">
        <Text size="small" skin="error">Error loading SKUs: {error}</Text>
      </Box>
    );
  }

  // Show empty state
  if (skus.length === 0) {
    return (
      <Box direction="vertical" gap="8px" padding="8px">
        <Text size="small" secondary>No SKUs available</Text>
      </Box>
    );
  }

  return (
    <Box direction="vertical" gap="8px">
      {/* Search input */}
      <Box padding="8px">
        <Search
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Search SKUs..."
          size="small"
        />
      </Box>

      {/* Select all/none */}
      {filteredSkus.length > 0 && (
        <Box padding="8px">
          <Checkbox
            checked={selectedSkus.length > 0}
            indeterminate={selectedSkus.length > 0 && selectedSkus.length < filteredSkus.length}
            onChange={() => handleSelectAll(selectedSkus.length < filteredSkus.length)}
            size="small"
          >
            <Text size="small" weight="normal">
              {selectedSkus.length === filteredSkus.length
                ? 'Deselect all'
                : `Select all (${filteredSkus.length})`}
            </Text>
          </Checkbox>
        </Box>
      )}

      {/* SKU checkboxes */}
      <Box direction="vertical" gap="4px">
        {visibleSkus.map(sku => (
          <Box key={sku.id} padding="8px">
            <Checkbox
              checked={selectedSkus.includes(sku.id)}
              onChange={() => handleSkuToggle(sku.id)}
              size="small"
            >
              <Box direction="vertical" gap="2px">
                <Text size="small">{sku.sku}</Text>
                {sku.name && sku.name !== sku.sku && (
                  <Text size="tiny" secondary>{sku.name}</Text>
                )}
              </Box>
            </Checkbox>
          </Box>
        ))}

        {/* Show more/less toggle */}
        {hasMore && (
          <Box padding="8px">
            <Text
              size="small"
              weight="normal"
              onClick={() => setShowAll(true)}
              style={{ cursor: 'pointer', color: '#3899ec' }}
            >
              + {filteredSkus.length - maxVisibleItems} more SKUs
            </Text>
          </Box>
        )}
        {showAll && filteredSkus.length > maxVisibleItems && (
          <Box padding="8px">
            <Text
              size="small"
              weight="normal"
              onClick={() => setShowAll(false)}
              style={{ cursor: 'pointer', color: '#3899ec' }}
            >
              Show less
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SkuFilter;
