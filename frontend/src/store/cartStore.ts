import { create } from 'zustand';
import { CartItem, Product } from '../types';

interface CartState {
  items: CartItem[];
  globalDiscountPercent: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateDiscount: (productId: string, discountPercent: number) => void;
  setGlobalDiscount: (discountPercent: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getDiscountAmount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  globalDiscountPercent: 0,

  addItem: (product, quantity = 1) => {
    set((state) => {
      const existingItem = state.items.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }

      return {
        items: [
          ...state.items,
          { product, quantity, discount_percent: 0 },
        ],
      };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      ),
    }));
  },

  updateDiscount: (productId, discountPercent) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId
          ? { ...item, discount_percent: Math.min(100, Math.max(0, discountPercent)) }
          : item
      ),
    }));
  },

  setGlobalDiscount: (discountPercent) => {
    set({ globalDiscountPercent: Math.min(100, Math.max(0, discountPercent)) });
  },

  clearCart: () => {
    set({ items: [], globalDiscountPercent: 0 });
  },

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((total, item) => {
      const price = parseFloat(item.product.sale_price);
      const quantity = item.quantity;
      const lineSubtotal = price * quantity;
      const lineDiscount = lineSubtotal * (item.discount_percent / 100);
      return total + (lineSubtotal - lineDiscount);
    }, 0);
  },

  getTaxAmount: () => {
    const { items, globalDiscountPercent } = get();
    const subtotal = get().getSubtotal();
    const subtotalAfterGlobalDiscount = subtotal * (1 - globalDiscountPercent / 100);

    return items.reduce((total, item) => {
      const price = parseFloat(item.product.sale_price);
      const taxRate = parseFloat(item.product.tax_rate);
      const quantity = item.quantity;
      const lineSubtotal = price * quantity;
      const lineDiscount = lineSubtotal * (item.discount_percent / 100);
      const lineSubtotalAfterDiscount = lineSubtotal - lineDiscount;

      // Proporción del descuento global
      const proportion = lineSubtotalAfterDiscount / subtotal;
      const globalDiscountForItem = subtotalAfterGlobalDiscount * proportion;
      const lineAfterAllDiscounts =
        lineSubtotalAfterDiscount -
        (lineSubtotalAfterDiscount - globalDiscountForItem * (globalDiscountPercent / 100));

      return total + lineAfterAllDiscounts * taxRate;
    }, 0);
  },

  getDiscountAmount: () => {
    const { items, globalDiscountPercent } = get();
    const itemsDiscount = items.reduce((total, item) => {
      const price = parseFloat(item.product.sale_price);
      const lineSubtotal = price * item.quantity;
      return total + lineSubtotal * (item.discount_percent / 100);
    }, 0);

    const subtotal = get().getSubtotal();
    const globalDiscount = subtotal * (globalDiscountPercent / 100);

    return itemsDiscount + globalDiscount;
  },

  getTotal: () => {
    const { globalDiscountPercent } = get();
    const subtotal = get().getSubtotal();
    const taxAmount = get().getTaxAmount();
    const subtotalAfterGlobalDiscount = subtotal * (1 - globalDiscountPercent / 100);
    return subtotalAfterGlobalDiscount + taxAmount;
  },

  getItemCount: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },
}));
