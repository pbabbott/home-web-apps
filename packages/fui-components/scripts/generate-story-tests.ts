/* eslint-disable @typescript-eslint/no-unused-vars */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { chromium } from '@playwright/test';
import ejs from 'ejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestCase {
  name: string;
  storyId: string;
  screenshotName: string;
}

interface ComponentTests {
  componentName: string;
  componentPath: string;
  tests: TestCase[];
}

/**
 * Parse a story ID to extract component information
 * e.g., "components-button--color-primary" -> { category: "components", component: "Button", story: "color-primary" }
 */
function parseStoryId(storyId: string) {
  const parts = storyId.split('--');
  if (parts.length < 2) {
    return null;
  }

  const [categoryPath, storyName] = parts;
  const pathParts = categoryPath.split('-');

  // Skip non-component stories (like "configure-your-project--docs")
  if (
    pathParts[0] !== 'components' &&
    pathParts[0] !== 'showcase' &&
    pathParts[0] !== 'diagrams'
  ) {
    return null;
  }

  // Convert kebab-case to PascalCase for component name
  // e.g., "button" -> "Button", "nav-item" -> "NavItem"
  const componentKebab = pathParts.slice(1).join('-');
  const componentName = componentKebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return {
    category: pathParts[0],
    componentName,
    componentKebab,
    storyName,
  };
}

/**
 * Find the component directory path and actual name (case-insensitive)
 */
function findComponent(
  componentName: string,
  category: string,
): { path: string; name: string } | null {
  const basePath = category === 'showcase' ? 'src/stories' : 'src/components';

  // For showcase stories, check if there's a subdirectory for the showcase
  if (category === 'showcase') {
    const showcaseName = `${componentName}Showcase`;

    // Try exact match for the showcase directory
    const exactPath = path.join(basePath, showcaseName);
    if (fs.existsSync(exactPath)) {
      return { path: exactPath, name: showcaseName };
    }

    // Try case-insensitive match
    if (fs.existsSync(basePath)) {
      const dirs = fs.readdirSync(basePath);
      const match = dirs.find(
        (dir) =>
          dir.toLowerCase() === showcaseName.toLowerCase() &&
          fs.statSync(path.join(basePath, dir)).isDirectory(),
      );

      if (match) {
        return { path: path.join(basePath, match), name: match };
      }
    }

    // Fallback to basePath if no subdirectory found
    return { path: basePath, name: showcaseName };
  }

  // For components, try exact match first
  const exactPath = path.join(basePath, componentName);
  if (fs.existsSync(exactPath)) {
    return { path: exactPath, name: componentName };
  }

  // Try case-insensitive match
  if (fs.existsSync(basePath)) {
    const dirs = fs.readdirSync(basePath);
    const match = dirs.find(
      (dir) => dir.toLowerCase() === componentName.toLowerCase(),
    );

    if (match) {
      return { path: path.join(basePath, match), name: match };
    }
  }

  return null;
}

/**
 * Group stories by component
 */
function groupStoriesByComponent(
  storyIds: string[],
): Map<string, ComponentTests> {
  const componentMap = new Map<string, ComponentTests>();

  for (const storyId of storyIds) {
    const parsed = parseStoryId(storyId);
    if (!parsed) {
      continue;
    }

    const { componentName, category, storyName } = parsed;
    const component = findComponent(componentName, category);

    if (!component) {
      console.warn(`⚠️  Could not find component path for: ${componentName}`);
      continue;
    }

    const key = `${category}/${component.name}`;

    if (!componentMap.has(key)) {
      componentMap.set(key, {
        componentName: component.name,
        componentPath: component.path,
        tests: [],
      });
    }

    const testCase: TestCase = {
      name: storyName,
      storyId: storyId,
      screenshotName: `${storyId}.png`,
    };

    componentMap.get(key)!.tests.push(testCase);
  }

  return componentMap;
}

/**
 * Generate a test file for a component using EJS template
 */
async function generateTestFile(componentTests: ComponentTests): Promise<void> {
  const { componentName, componentPath, tests } = componentTests;

  try {
    // Read the template
    const templatePath = path.join(__dirname, 'component-test.template.ejs');
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Calculate relative path from component to tests/playwright-helpers.ts
    const outputPath = path.join(
      componentPath,
      `${componentName}.playwright.spec.ts`,
    );
    const helpersPath = path
      .relative(path.dirname(outputPath), 'tests/playwright-helpers')
      .replace(/\\/g, '/'); // Normalize to forward slashes

    // Render the template with component data
    const rendered = ejs.render(template, {
      componentName,
      tests,
      helpersPath,
    });

    // Write the test file co-located with the component
    fs.writeFileSync(outputPath, rendered);

    console.log(`✅ Generated ${outputPath}`);
  } catch (error) {
    console.error(`❌ Failed to generate test for ${componentName}:`, error);
  }
}

async function generateTests() {
  console.log('🚀 Starting test generation...\n');
  console.log('📡 Fetching stories from Storybook...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:6006', { waitUntil: 'networkidle' });
    await page.waitForSelector('#storybook-preview-iframe');

    // Wait a bit more for Storybook to fully initialize
    await page.waitForTimeout(2000);

    // Try to get stories from the index.json endpoint (Storybook v7+)
    let storyIds: string[];

    try {
      const response = await page.request.get(
        'http://localhost:6006/index.json',
      );
      const data = await response.json();
      storyIds = Object.keys(data.entries || {});
      console.log(`✓ Found ${storyIds.length} stories\n`);
    } catch {
      console.log('⚠️  Could not fetch from index.json, trying legacy API...');

      // Fallback to legacy API
      storyIds = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;

        // Try different APIs
        if (win.__STORYBOOK_PREVIEW__?.storyStore) {
          return Object.keys(win.__STORYBOOK_PREVIEW__.storyStore.extract());
        } else if (win.__STORYBOOK_STORY_STORE__) {
          return Object.keys(win.__STORYBOOK_STORY_STORE__.extract());
        } else {
          throw new Error('Could not find Storybook API');
        }
      });
      console.log(`✓ Found ${storyIds.length} stories\n`);
    }

    // Group stories by component
    console.log('📦 Grouping stories by component...');
    const componentTests = groupStoriesByComponent(storyIds);
    console.log(`✓ Found ${componentTests.size} components\n`);

    // Generate test files for each component
    console.log('✨ Generating co-located test files...\n');
    for (const [key, tests] of componentTests) {
      await generateTestFile(tests);
    }

    console.log('\n🎉 Test generation complete!');

    console.log('\n🎨 Running formatter...');
    execSync('pnpm -w format:fix', { stdio: 'inherit' });
    console.log('✅ Format complete!');
  } catch (error) {
    console.error('❌ Error generating tests:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generateTests();
