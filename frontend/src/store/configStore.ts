import { create } from 'zustand';
import { StoreConfig } from '../types';

interface ConfigState {
  config: Partial<StoreConfig> | null;
  isLoading: boolean;
  setConfig: (config: Partial<StoreConfig>) => void;
  setLoading: (loading: boolean) => void;
  applyTheme: () => void;
}

// Función para convertir hex a RGB
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
  }
  return '59 130 246'; // fallback blue
}

// Función para generar paleta de colores
function generateColorPalette(baseHex: string): Record<string, string> {
  const rgb = hexToRgb(baseHex);
  const [r, g, b] = rgb.split(' ').map(Number);

  return {
    '50': `${Math.min(255, r + 180)} ${Math.min(255, g + 180)} ${Math.min(255, b + 180)}`,
    '100': `${Math.min(255, r + 150)} ${Math.min(255, g + 150)} ${Math.min(255, b + 150)}`,
    '200': `${Math.min(255, r + 120)} ${Math.min(255, g + 120)} ${Math.min(255, b + 120)}`,
    '300': `${Math.min(255, r + 80)} ${Math.min(255, g + 80)} ${Math.min(255, b + 80)}`,
    '400': `${Math.min(255, r + 40)} ${Math.min(255, g + 40)} ${Math.min(255, b + 40)}`,
    '500': rgb,
    '600': `${Math.max(0, r - 20)} ${Math.max(0, g - 20)} ${Math.max(0, b - 20)}`,
    '700': `${Math.max(0, r - 50)} ${Math.max(0, g - 50)} ${Math.max(0, b - 50)}`,
    '800': `${Math.max(0, r - 80)} ${Math.max(0, g - 80)} ${Math.max(0, b - 80)}`,
    '900': `${Math.max(0, r - 110)} ${Math.max(0, g - 110)} ${Math.max(0, b - 110)}`,
  };
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoading: true,

  setConfig: (config) => {
    set({ config });
    get().applyTheme();
  },

  setLoading: (isLoading) => set({ isLoading }),

  applyTheme: () => {
    const { config } = get();
    if (!config) return;

    const root = document.documentElement;

    // Aplicar modo oscuro
    if (config.dark_mode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Aplicar colores
    if (config.primary_color) {
      const palette = generateColorPalette(config.primary_color);
      root.style.setProperty('--color-primary', hexToRgb(config.primary_color));
      Object.entries(palette).forEach(([key, value]) => {
        root.style.setProperty(`--color-primary-${key}`, value);
      });
    }

    if (config.accent_color) {
      root.style.setProperty('--color-accent', hexToRgb(config.accent_color));
    }

    if (config.secondary_color) {
      root.style.setProperty('--color-secondary', hexToRgb(config.secondary_color));
    }

    // Actualizar título de la página
    if (config.store_name) {
      document.title = `${config.store_name} - Sistema POS`;
    }
  },
}));
