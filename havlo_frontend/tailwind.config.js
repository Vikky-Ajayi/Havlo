/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        havlo: {
          purple: '#A409D2',
          'purple-dark': '#871EA6',
          pink: '#FFB0E8',
          teal: '#9FD4E3',
          lavender: '#CDC5F3',
          'footer-bg': '#040504',
          'footer-inner': '#050505',
          'card-bg': '#F9F9F8',
          'section-bg': '#F9F9F8',
          'marquee-dot': '#602FD3',
          'hero-bg': '#FEFEFE',
        },
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        tight: ['Inter Tight', 'sans-serif'],
      },
      borderRadius: {
        pill: '48px',
        card: '20px',
        'card-lg': '24px',
      },
      fontSize: {
        'hero': ['88px', { lineHeight: '100%', letterSpacing: '-1.76px' }],
        'display-lg': ['80px', { lineHeight: '100%', letterSpacing: '-1.6px' }],
        'display': ['56px', { lineHeight: '110%' }],
        'display-sm': ['40px', { lineHeight: '110%', letterSpacing: '-0.8px' }],
        'marquee': ['40px', { lineHeight: '100%' }],
        'card-title': ['24px', { lineHeight: '100%', letterSpacing: '-0.48px' }],
        'body-lg': ['18px', { lineHeight: '170%', letterSpacing: '-0.054px' }],
        'body-md': ['16px', { lineHeight: '120%' }],
        'nav': ['16px', { lineHeight: '150%', letterSpacing: '-0.32px' }],
      },
      height: {
        navbar: '80px',
        'btn-nav': '48px',
        'btn-hero': '56px',
      },
      backdropBlur: {
        navbar: '5px',
      },
    },
  },
  plugins: [],
}
