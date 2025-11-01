// stores/RootStore.ts
import { OrderStore } from './OrderStore';
import { UIStore } from './UIStore';
import { PromoBannerStore } from './PromoBannerStore';

export class RootStore {
    orderStore: OrderStore;
    uiStore: UIStore;
    promoBannerStore: PromoBannerStore;

    constructor() {
        this.orderStore = new OrderStore();
        this.uiStore = new UIStore();
        this.promoBannerStore = new PromoBannerStore();
    }
}

// Create singleton instance
export const rootStore = new RootStore();