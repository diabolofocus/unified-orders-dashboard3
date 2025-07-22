// hooks/useStores.ts
import { createContext, useContext } from 'react';
import { OrderStore } from '../stores/OrderStore';
import { UIStore } from '../stores/UIStore';
import { SettingsStore } from '../stores/SettingsStore';

export class RootStore {
    orderStore: OrderStore;
    uiStore: UIStore;
    settingsStore: SettingsStore;

    constructor() {
        this.orderStore = new OrderStore();
        this.uiStore = new UIStore();
        this.settingsStore = new SettingsStore();
    }
}

// Create singleton instance
export const rootStore = new RootStore();

// Export settingsStore for direct imports when needed
export const { settingsStore } = rootStore;

const StoreContext = createContext<RootStore>(rootStore);

export const useStores = () => {
    return useContext(StoreContext);
};

export const StoreProvider = StoreContext.Provider;