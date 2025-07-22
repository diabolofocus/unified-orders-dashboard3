// stores/RootStore.ts
import { OrderStore } from './OrderStore';
import { UIStore } from './UIStore';

export class RootStore {
    orderStore: OrderStore;
    uiStore: UIStore;

    constructor() {
        this.orderStore = new OrderStore();
        this.uiStore = new UIStore();
    }
}

// Create singleton instance
export const rootStore = new RootStore();