/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Digital Midnight Theme - Core Palette
        midnight: {
          900: '#0a0e27', // Deep space blue (Command Deck)
          800: '#1a1f3a', // Workshop background
          700: '#2a2f4a', // Showcase/lighter areas
          600: '#3a3f5a', // Card backgrounds
          500: '#4a4f6a', // Borders and dividers
        },
        
        // Professional Accent Colors
        electric: '#3b82f6',     // Professional blue (replaces neon cyan)
        amber: '#f59e0b',        // Refined orange for notifications
        success: '#10b981',      // Professional green for success states  
        coral: '#ef4444',        // Professional red for errors
        
        // Team Member Colors (for agent tracking)
        team: {
          purple: '#8b5cf6',
          teal: '#14b8a6',
          orange: '#f97316', 
          pink: '#ec4899',
          indigo: '#6366f1',
          emerald: '#10b981',
        },
        
        // Professional primary colors
        primary: {
          50: '#eff6ff',
          500: '#3b82f6', // Professional blue
          600: '#2563eb',
          700: '#1d4ed8',
        },
        secondary: {
          50: '#f8fafc',
          500: '#4a4f6a',
          600: '#3a3f5a',
          700: '#2a2f4a',
        }
      },
      
      // Typography Scale (Mobile-First)
      fontSize: {
        'xs': '12px',    // Micro text
        'sm': '14px',    // Small text/metadata
        'base': '16px',  // Body text (optimal mobile)
        'lg': '18px',    // Large body
        'xl': '20px',    // H3 subsections
        '2xl': '24px',   // H2 section headers
        '3xl': '28px',   // H1 main actions
        '4xl': '32px',   // Brand/hero text
      },
      
      // Animation and transitions
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 2s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.3s ease-out',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'shrink': 'shrink linear forwards',
      },

      // Custom keyframes
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        breathe: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(1.05)', opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-200%)' },
          '50%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-200%)' }
        },
        shrink: {
          '0%': { width: '100%' },
          '100%': { width: '0%' }
        }
      },
      
      // Professional shadows and depth
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.15)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'professional': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'professional-hover': '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  
  // Dark mode configuration
  darkMode: 'class',
}