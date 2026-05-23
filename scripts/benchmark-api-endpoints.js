/**
 * API Endpoint Performance Benchmark
 * Measures canonical endpoint performance.
 */

const ITERATIONS = 10;
const BASE_URL = 'http://localhost:3000';

async function measureEndpoint(path, method = 'GET', body = null) {
  const times = [];
  
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      await response.json();
      const end = performance.now();
      times.push(end - start);
    } catch (error) {
      console.error(`Error benchmarking ${path}:`, error.message);
      return null;
    }
  }
  
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
  };
}

async function runBenchmarks() {
  console.log('🚀 API Endpoint Performance Benchmark\n');
  console.log(`Running ${ITERATIONS} iterations per endpoint...\n`);
  
  const benchmarks = [
    {
      name: 'List Pages',
      path: '/api/content/pages?limit=10',
    },
    {
      name: 'List Component Types',
      path: '/api/components/types?limit=10',
    },
    {
      name: 'List Shared Components',
      path: '/api/components/shared?limit=10',
    },
  ];
  
  const results = [];
  
  for (const benchmark of benchmarks) {
    console.log(`📊 Benchmarking: ${benchmark.name}`);
    
    const result = await measureEndpoint(benchmark.path);
    
    if (result) {
      results.push({
        name: benchmark.name,
        path: benchmark.path,
        result,
      });
      
      console.log(`  Endpoint: ${benchmark.path}`);
      console.log(`  Average: ${result.avg.toFixed(2)}ms\n`);
    }
  }
  
  // Summary
  console.log('\n📈 Performance Summary\n');
  console.log('| Endpoint | Path | Avg (ms) |');
  console.log('|----------|------|----------|');
  
  results.forEach(r => {
    console.log(
      `| ${r.name.padEnd(8)} | ${r.path} | ${r.result.avg.toFixed(2).padEnd(8)} |`
    );
  });
  
  const avgLatency = results.reduce((sum, r) => sum + r.result.avg, 0) / results.length;
  console.log(`\nAverage latency: ${avgLatency.toFixed(2)}ms`);
  
  // Performance thresholds
  console.log('\n✅ Performance Validation:');
  if (avgLatency < 250) {
    console.log('  ✓ Canonical endpoint latency is within target (<250ms)');
  } else if (avgLatency < 500) {
    console.log('  ⚠ Canonical endpoint latency is moderate (250-500ms)');
  } else {
    console.log('  ✗ Canonical endpoint latency exceeds target (>500ms)');
  }
  
  // Save results to file
  const report = {
    date: new Date().toISOString(),
    iterations: ITERATIONS,
    results,
    avgLatency,
    conclusion: avgLatency < 250 ? 'PASS' : avgLatency < 500 ? 'WARNING' : 'FAIL',
  };
  
  require('fs').writeFileSync(
    './performance-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n💾 Full report saved to performance-report.json');
}

// Check if server is running
fetch(`${BASE_URL}/api/health`)
  .then(() => runBenchmarks())
  .catch(() => {
    console.error('❌ Server is not running. Please start the dev server first.');
    console.error('   Run: npm run dev');
    process.exit(1);
  });
