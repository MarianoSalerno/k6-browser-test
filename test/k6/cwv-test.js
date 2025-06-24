/* eslint-disable no-undef */
import { browser } from 'k6/browser';

import { htmlReport } from './vendor/k6-reporter.js';
import { textSummary } from './vendor/k6-summary.js';

// Safe URL parsing with fallback
let URLS = [];
try {
  const rawUrls = __ENV.URLS;
  if (!rawUrls) {
    console.warn('⚠️ No URLS env var found, using default: https://www.groupon.com');
    URLS = ['https://www.groupon.com'];
  } else {
    URLS = rawUrls
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
  }
} catch (e) {
  console.error('❌ Failed to parse URLS env var. Falling back to default. Error:', e.message);
  URLS = ['https://www.groupon.com'];
}

if (URLS.length === 0) {
  throw new Error('No valid URLs to navigate to.');
}

// Safe CITY parsing
const CITY = __ENV.CITY ? __ENV.CITY.trim() : null;
const environmentDisplay = CITY ? CITY.toUpperCase() : 'Production';

// Safe headers setup
const ENV_HEADERS = {
  'g-hb-upstream-next-pwa-app': 'true',
};

if (CITY) {
  ENV_HEADERS[`cloud-override-traffic--${CITY.toLowerCase()}`] = 'true';
}

// Safe threshold parsing with fallback defaults
function safeParseInt(envVar, fallback) {
  const val = parseInt(__ENV[envVar]);
  return isNaN(val) ? fallback : val;
}

function safeParseFloat(envVar, fallback) {
  const val = parseFloat(__ENV[envVar]);
  return isNaN(val) ? fallback : val;
}

const THRESHOLDS = {
  fcp: safeParseInt('FCP_THRESHOLD', 1800),
  lcp: safeParseInt('LCP_THRESHOLD', 2500),
  cls: safeParseFloat('CLS_THRESHOLD', 0.1),
  ttfb: safeParseInt('TTFB_THRESHOLD', 800),
  inp: safeParseInt('INP_THRESHOLD', 200),
};

export const options = {
  scenarios: {
    default: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: parseInt(__ENV.ITERATIONS) || URLS.length,
      options: {
        browser: {
          type: 'chromium',
          headless: __ENV.HEADLESS !== 'false',
          args: [
            '--disable-popup-blocking',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--hide-scrollbars',
            '--enable-logging',
            '--v=1',
          ],
        },
      },
    },
  },
  thresholds: {
    browser_web_vital_inp: [`p(75) < ${THRESHOLDS.inp}`],
    browser_web_vital_fcp: [`p(75) < ${THRESHOLDS.fcp}`],
    browser_web_vital_lcp: [`p(75) < ${THRESHOLDS.lcp}`],
    browser_web_vital_cls: [`p(75) < ${THRESHOLDS.cls}`],
    browser_web_vital_ttfb: [`p(75) < ${THRESHOLDS.ttfb}`],
  },
};

export default async function () {
  console.log(`\n---\n▶️  Running test on environment: ${environmentDisplay}\n---`);
  console.log(
    `🔧 Environment variables: HEADLESS=${__ENV.HEADLESS}, K6_BROWSER_DEBUG=${__ENV.K6_BROWSER_DEBUG}`
  );

  const url = URLS[__ITER % URLS.length];
  let page;

  try {
    console.log('🚀 Creating new browser page...');
    page = await browser.newPage();

    // Set viewport and user agent for consistency
    console.log('🔧 Setting viewport and headers...');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    console.log(`🚀 Navigating to ${url}`);
    // Pass headers directly to page.goto()
    await page.goto(url, {
      waitUntil: 'load',
      headers: ENV_HEADERS,
      timeout: 30000,
    });

    console.log('Looking for search input...');

    const searchInput = page.locator('input#ls-search');
    try {
      await searchInput.waitFor({ timeout: 10000 });
      console.log('Clicking #ls-search...');
      await searchInput.click();
      console.log("Typing 'pizza' into #ls-search...");
      await searchInput.type('pizza');
      await page.waitForTimeout(2000);
      console.log('✅ Search interaction completed successfully');
    } catch (error) {
      console.warn(`⚠️ Search interaction failed INP cannot be properly measured ${error.message}`);
    }
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(`❌ Error stack: ${error.stack}`);
    throw error;
  } finally {
    if (page) {
      try {
        console.log('🧹 Closing browser page...');
        await page.close();
      } catch (closeError) {
        console.warn(`⚠️ Failed to close page: ${closeError.message}`);
      }
    }
  }
}

export function handleSummary(data) {
  delete data.metrics.browser_web_vital_fid;

  const summaryTitle = `CWV Test Report - ${environmentDisplay}`;
  const stdoutSummary = textSummary(data, { indent: ' ', enableColors: true });
  const customStdout = `${summaryTitle}\n${'='.repeat(summaryTitle.length)}\n${stdoutSummary}`;

  return {
    'test/k6/summary.html': htmlReport(data, { title: summaryTitle }),
    'test/k6/summary.txt': textSummary(data, { indent: ' ', enableColors: false }),
    'test/k6/summary.json': JSON.stringify(data, null, 2),
    stdout: customStdout,
  };
}
