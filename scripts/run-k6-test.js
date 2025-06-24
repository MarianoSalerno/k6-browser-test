const { execSync } = require('child_process');

function getArg(argName) {
  const arg = process.argv.find(a => a.startsWith(`--${argName}=`));
  if (!arg) return null;
  return arg.split('=')[1];
}

console.log('▶️  Preparing k6 test...');

const city = getArg('city');
const urls = getArg('urls');
const iterations = getArg('iterations'); // This line is required

// URL Validation Section
if (urls) {
  console.log('   Validating provided URLs...');
  const urlArray = urls.split(',');
  const allUrlsAreValid = urlArray.every(url => {
    const trimmedUrl = url.trim();
    return trimmedUrl.startsWith('http') && trimmedUrl.includes('groupon');
  });
  if (!allUrlsAreValid) {
    console.error('\n❌ Error: One or more provided URLs are invalid.');
    process.exit(1);
  }
  console.log('   ✅ URLs are valid.');
}

// Build the k6 command dynamically
let k6Command = 'k6 run test/k6/cwv-test.js';

if (city) {
  k6Command += ` --env CITY=${city}`;
  console.log(`   Targeting city: ${city}`);
}
if (urls) {
  k6Command += ` --env URLS='${urls}'`;
} else {
  console.log('   Using default URL for Production test.');
}

// This block is required to add the iterations flag
if (iterations) {
  k6Command += ` --env ITERATIONS=${iterations}`;
  console.log(`   Running for: ${iterations} iterations`);
}

// Execute the final k6 command
try {
  console.log(`\nExecuting: ${k6Command}\n`);
  execSync(k6Command, { stdio: 'inherit' });
} catch (error) {
  console.error('\n❌ k6 test failed to execute.');
  process.exit(1);
}