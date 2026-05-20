/**
 * API Endpoint Performance Benchmark
 * Compares old vs new endpoint performance
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
      old: '/api/content-items?limit=10',
      new: '/api/content/pages?limit=10',
    },
    {
      name: 'List Component Types',
      old: '/api/cms-components?limit=10',
      new: '/api/components/types?limit=10',
    },
    {
      name: 'List Shared Components',
      old: '/api/global-components?limit=10',
      new: '/api/components/shared?limit=10',
    },
  ];
  
  const results = [];
  
  for (const benchmark of benchmarks) {
    console.log(`📊 Benchmarking: ${benchmark.name}`);
    
    const oldResult = await measureEndpoint(benchmark.old);
    const newResult = await measureEndpoint(benchmark.new);
    
    if (oldResult && newResult) {
      const overhead = ((newResult.avg - oldResult.avg) / oldResult.avg) * 100;
      
      results.push({
        name: benchmark.name,
        old: oldResult,
        new: newResult,
        overhead,
      });
      
      console.log(`  Old endpoint: ${oldResult.avg.toFixed(2)}ms (avg)`);
      console.log(`  New endpoint: ${newResult.avg.toFixed(2)}ms (avg)`);
      console.log(`  Overhead: ${overhead > 0 ? '+' : ''}${overhead.toFixed(2)}%\n`);
    }
  }
  
  // Summary
  console.log('\n📈 Performance Summary\n');
  console.log('| Endpoint | Old (ms) | New (ms) | Overhead |');
  console.log('|----------|----------|----------|----------|');
  
  results.forEach(r => {
    console.log(
      `| ${r.name.padEnd(8)} | ${r.old.avg.toFixed(2).padEnd(8)} | ${r.new.avg.toFixed(2).padEnd(8)} | ${
        r.overhead > 0 ? '+' : ''
      }${r.overhead.toFixed(2)}% |`
    );
  });
  
  const avgOverhead = results.reduce((sum, r) => sum + r.overhead, 0) / results.length;
  console.log(`\nAverage overhead: ${avgOverhead > 0 ? '+' : ''}${avgOverhead.toFixed(2)}%`);
  
  // Performance thresholds
  console.log('\n✅ Performance Validation:');
  if (avgOverhead < 5) {
    console.log('  ✓ Service layer overhead is within acceptable limits (<5%)');
  } else if (avgOverhead < 10) {
    console.log('  ⚠ Service layer overhead is moderate (5-10%)');
  } else {
    console.log('  ✗ Service layer overhead exceeds threshold (>10%)');
  }
  
  // Save results to file
  const report = {
    date: new Date().toISOString(),
    iterations: ITERATIONS,
    results,
    avgOverhead,
    conclusion: avgOverhead < 5 ? 'PASS' : avgOverhead < 10 ? 'WARNING' : 'FAIL',
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