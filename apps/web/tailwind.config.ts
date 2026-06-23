import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#17202a',
        muted: '#667085',
        line: '#d9dee7',
        panel: '#f7f9fb',
        brand: '#0f766e',
        accent: '#1d4ed8',
      },
    },
  },
  plugins: [],
};

export default config;
