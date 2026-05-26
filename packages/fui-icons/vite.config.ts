import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FUIIcons',
      fileName: (format) => `fui-icons.${format}.js`,
    },
    rollupOptions: {
      external: (id) => {
        if (/^react(\/.*)?$/.test(id) || /^react-dom(\/.*)?$/.test(id))
          return true;
        if (id === 'simple-icons') return true;
        return false;
      },
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'simple-icons': 'SimpleIcons',
        },
      },
    },
  },
});
