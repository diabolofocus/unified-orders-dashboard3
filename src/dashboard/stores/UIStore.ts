// stores/UIStore.ts - UPDATED with Search State
import { makeAutoObservable } from 'mobx';

export class UIStore {
    // Form state
    trackingNumber: string = '';
    selectedCarrier: string = '';
    trackingUrl: string = '';
    submitting: boolean = false;

    // Loading states
    loading: boolean = false;
    refreshing: boolean = false;
    loadingMore: boolean = false;

    // NEW: Search states
    searching: boolean = false;
    searchDebounceMs: number = 300;

    // Modal/dialog states
    showSettings: boolean = false;
    showHelp: boolean = false;

    // Error states
    lastError: string | null = null;
    errorCount: number = 0;

    // UI preferences
    sidebarCollapsed: boolean = false;
    theme: 'light' | 'dark' | 'auto' = 'auto';
    compactMode: boolean = false;
    
    // Item selection for fulfillment
    applyToAllItems: boolean = true;
    selectedItems: Record<string, boolean> = {}; // itemId -> boolean
    itemQuantities: Record<string, number> = {}; // itemId -> quantity

    constructor() {
        makeAutoObservable(this);
    }

    // Form actions
    setTrackingNumber(value: string) {
        this.trackingNumber = value;
    }

    setSelectedCarrier(value: string) {
        this.selectedCarrier = value;
    }

    setTrackingUrl(value: string) {
        this.trackingUrl = value;
    }

    setSubmitting(value: boolean) {
        this.submitting = value;
    }

    resetForm() {
        this.trackingNumber = '';
        this.selectedCarrier = '';
        this.trackingUrl = '';
        this.submitting = false;
    }

    // Loading actions
    setLoading(value: boolean) {
        this.loading = value;
    }

    setRefreshing(value: boolean) {
        this.refreshing = value;
    }

    setLoadingMore(value: boolean) {
        this.loadingMore = value;
    }

    // NEW: Search actions
    setSearching(value: boolean) {
        this.searching = value;
    }

    setSearchDebounceMs(value: number) {
        this.searchDebounceMs = Math.max(100, Math.min(1000, value)); // Clamp between 100-1000ms
    }

    // Modal/dialog actions
    setShowSettings(value: boolean) {
        this.showSettings = value;
    }

    setShowHelp(value: boolean) {
        this.showHelp = value;
    }

    // Error handling
    setLastError(error: string | null) {
        this.lastError = error;
        if (error) {
            this.errorCount++;
        }
    }

    // Toggle 'Apply to all' setting
    toggleApplyToAllItems() {
        this.applyToAllItems = !this.applyToAllItems;
    }

    // Toggle selection of a specific item
    toggleItemSelection(itemId: string) {
        this.selectedItems = {
            ...this.selectedItems,
            [itemId]: !this.selectedItems[itemId]
        };
        
        // If deselecting, remove quantity
        if (!this.selectedItems[itemId]) {
            const { [itemId]: _, ...rest } = this.itemQuantities;
            this.itemQuantities = rest;
        }
    }

    // Clear all selected items
    clearSelectedItems() {
        this.selectedItems = {};
        this.itemQuantities = {};
    }

    // Set all items as selected
    selectAllItems(itemIds: string[]) {
        const allSelected = itemIds.reduce((acc, id) => ({
            ...acc,
            [id]: true
        }), {});
        this.selectedItems = allSelected;
    }
    
    // Set quantity for an item
    setItemQuantity(itemId: string, quantity: number) {
        if (quantity <= 0) {
            const { [itemId]: _, ...rest } = this.itemQuantities;
            this.itemQuantities = rest;
            this.selectedItems = { ...this.selectedItems, [itemId]: false };
        } else {
            this.itemQuantities = {
                ...this.itemQuantities,
                [itemId]: quantity
            };
            this.selectedItems = { ...this.selectedItems, [itemId]: true };
        }
    }
    
    // Get quantity for an item, defaulting to remaining quantity if not set
    getItemQuantity(itemId: string, remainingQuantity: number): number {
        return this.itemQuantities[itemId] !== undefined 
            ? this.itemQuantities[itemId] 
            : remainingQuantity;
    }

    clearError() {
        this.lastError = null;
    }

    resetErrorCount() {
        this.errorCount = 0;
    }

    // UI preference actions
    setSidebarCollapsed(value: boolean) {
        this.sidebarCollapsed = value;
    }

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
    }

    setTheme(theme: 'light' | 'dark' | 'auto') {
        this.theme = theme;
    }

    setCompactMode(value: boolean) {
        this.compactMode = value;
    }

    toggleCompactMode() {
        this.compactMode = !this.compactMode;
    }

    // Computed properties
    get isFormValid() {
        return this.trackingNumber.trim() !== '' && this.selectedCarrier !== '';
    }

    get isFormBusy() {
        return this.submitting || this.loading;
    }

    get isAnyLoading() {
        return this.loading || this.refreshing || this.loadingMore || this.searching;
    }

    get hasError() {
        return this.lastError !== null;
    }

    get isRetryRecommended() {
        return this.errorCount >= 3;
    }

    // NEW: Search computed properties
    get isSearchActive() {
        return this.searching;
    }

    get searchConfig() {
        return {
            debounceMs: this.searchDebounceMs,
            isActive: this.searching
        };
    }

    // Utility actions
    reset() {
        this.resetForm();
        this.setLoading(false);
        this.setRefreshing(false);
        this.setLoadingMore(false);
        this.setSearching(false);
        this.clearError();
        this.setShowSettings(false);
        this.setShowHelp(false);
    }

    // Bulk state updates for common scenarios
    startOperation(operationType: 'loading' | 'refreshing' | 'loadingMore' | 'searching' | 'submitting') {
        this.clearError();

        switch (operationType) {
            case 'loading':
                this.setLoading(true);
                break;
            case 'refreshing':
                this.setRefreshing(true);
                break;
            case 'loadingMore':
                this.setLoadingMore(true);
                break;
            case 'searching':
                this.setSearching(true);
                break;
            case 'submitting':
                this.setSubmitting(true);
                break;
        }
    }

    stopOperation(operationType: 'loading' | 'refreshing' | 'loadingMore' | 'searching' | 'submitting') {
        switch (operationType) {
            case 'loading':
                this.setLoading(false);
                break;
            case 'refreshing':
                this.setRefreshing(false);
                break;
            case 'loadingMore':
                this.setLoadingMore(false);
                break;
            case 'searching':
                this.setSearching(false);
                break;
            case 'submitting':
                this.setSubmitting(false);
                break;
        }
    }

    stopAllOperations() {
        this.setLoading(false);
        this.setRefreshing(false);
        this.setLoadingMore(false);
        this.setSearching(false);
        this.setSubmitting(false);
    }

    // Debug helper
    logCurrentState() {
        console.log('UIStore State:', {
            form: {
                trackingNumber: this.trackingNumber,
                selectedCarrier: this.selectedCarrier,
                trackingUrl: this.trackingUrl,
                submitting: this.submitting,
                isFormValid: this.isFormValid,
                isFormBusy: this.isFormBusy
            },
            loading: {
                loading: this.loading,
                refreshing: this.refreshing,
                loadingMore: this.loadingMore,
                searching: this.searching,
                isAnyLoading: this.isAnyLoading
            },
            search: {
                searching: this.searching,
                debounceMs: this.searchDebounceMs,
                isSearchActive: this.isSearchActive,
                searchConfig: this.searchConfig
            },
            ui: {
                showSettings: this.showSettings,
                showHelp: this.showHelp,
                sidebarCollapsed: this.sidebarCollapsed,
                theme: this.theme,
                compactMode: this.compactMode
            },
            errors: {
                lastError: this.lastError,
                errorCount: this.errorCount,
                hasError: this.hasError,
                isRetryRecommended: this.isRetryRecommended
            }
        });
    }
}