import { PricingConfig, PricingItem } from "@/hooks/usePricingConfig";

type Plan = 'Basic' | 'Standard' | 'Luxe';

interface ItemQuantity {
    [itemId: string]: number;
}

interface RoomConfig {
    items: ItemQuantity;
}

export interface EstimateInput {
    segment: 'Residential' | 'Commercial';
    selectedPlan: Plan;
    carpetArea: number;
    livingAreaItems: ItemQuantity;
    kitchenItems: ItemQuantity;
    bedrooms: RoomConfig[];
    bathrooms: RoomConfig[];
    cabins: RoomConfig[];
}

export interface BreakdownItem {
    category: string;
    item: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface EstimateResult {
    total: number;
    breakdown: BreakdownItem[];
}

export function calculateEstimate(config: PricingConfig | null, input: EstimateInput): EstimateResult {
    if (!config?.categories) return { total: 0, breakdown: [] };

    const { segment, selectedPlan, carpetArea, livingAreaItems, kitchenItems, bedrooms, bathrooms, cabins } = input;
    const area = carpetArea || 0;
    let total = 0;
    const breakdown: BreakdownItem[] = [];

    const priceKey = selectedPlan === 'Basic' ? 'basicPrice' : selectedPlan === 'Standard' ? 'standardPrice' : 'luxePrice';

    const calculateItemCost = (item: PricingItem, quantity: number) => {
        if (item.type === 'fixed') {
            return item[priceKey];
        } else if (item.type === 'perUnit') {
            return quantity * item[priceKey];
        } else if (item.type === 'perSqft') {
            return area * quantity * item[priceKey];
        }
        return 0;
    };

    const allCategories = config.categories;
    const categories = allCategories.filter(c => {
        if (segment === 'Residential') return !c.type || c.type === 'residential';
        return c.type === 'commercial';
    });

    categories.forEach(category => {
        const isKitchen = category.id === 'kitchen' || category.name.toLowerCase() === 'kitchen';
        const isBedroom = category.id === 'bedroom' || category.name.toLowerCase() === 'bedroom';
        const isBathroom = category.id === 'bathroom' || category.name.toLowerCase() === 'bathroom';

        if (!isKitchen && !isBedroom && !isBathroom) {
            // Living Area + All Other Custom Categories
            Object.entries(livingAreaItems).forEach(([itemId, quantity]) => {
                if (quantity > 0) {
                    const item = category.items.find(i => i.id === itemId);
                    if (item && item.enabled) {
                        const cost = calculateItemCost(item, quantity);
                        total += cost;
                        breakdown.push({
                            category: category.name,
                            item: item.name,
                            quantity,
                            unitPrice: item[priceKey],
                            total: cost
                        });
                    }
                }
            });
        } else if (isKitchen) {
            Object.entries(kitchenItems).forEach(([itemId, quantity]) => {
                if (quantity > 0) {
                    const item = category.items.find(i => i.id === itemId);
                    if (item && item.enabled) {
                        const cost = calculateItemCost(item, quantity);
                        total += cost;
                        breakdown.push({
                            category: category.name,
                            item: item.name,
                            quantity,
                            unitPrice: item[priceKey],
                            total: cost
                        });
                    }
                }
            });
        } else if (isBedroom) {
            bedrooms.forEach((bedroom, index) => {
                Object.entries(bedroom.items).forEach(([itemId, quantity]) => {
                    if (quantity > 0) {
                        const item = category.items.find(i => i.id === itemId);
                        if (item && item.enabled) {
                            const cost = calculateItemCost(item, quantity);
                            total += cost;
                            breakdown.push({
                                category: `Bedroom ${index + 1}`,
                                item: item.name,
                                quantity,
                                unitPrice: item[priceKey],
                                total: cost
                            });
                        }
                    }
                });
            });
        } else if (isBathroom) {
            bathrooms.forEach((bathroom, index) => {
                Object.entries(bathroom.items).forEach(([itemId, quantity]) => {
                    if (quantity > 0) {
                        const item = category.items.find(i => i.id === itemId);
                        if (item && item.enabled) {
                            const cost = calculateItemCost(item, quantity);
                            total += cost;
                            breakdown.push({
                                category: `Bathroom ${index + 1}`,
                                item: item.name,
                                quantity,
                                unitPrice: item[priceKey],
                                total: cost
                            });
                        }
                    }
                });
            });
        } else if (category.id === 'cabin' || category.name.toLowerCase() === 'cabin') {
            cabins.forEach((cabin, index) => {
                Object.entries(cabin.items).forEach(([itemId, quantity]) => {
                    if (quantity > 0) {
                        const item = category.items.find(i => i.id === itemId);
                        if (item && item.enabled) {
                            const cost = calculateItemCost(item, quantity);
                            total += cost;
                            breakdown.push({
                                category: `Cabin ${index + 1}`,
                                item: item.name,
                                quantity,
                                unitPrice: item[priceKey],
                                total: cost
                            });
                        }
                    }
                });
            });
        }
    });

    return { total, breakdown };
}
