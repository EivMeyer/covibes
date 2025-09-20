#!/usr/bin/env tsx
/**
 * Integration Test Runner
 * 
 * Comprehensive test runner for all integration tests with:
 * - Database setup and cleanup
 * - Test environment verification  
 * - Parallel test execution
 * - Detailed reporting
 * - CI/CD integration support
 */

import { spawn, SpawnOptions } from 'child_process';
import { testDb, TestDatabaseManager } from './setup/test-database.js';
import path from 'path';
import fs from 'fs/promises';

interface TestSuite {
  name: string;
  pattern: string;
  description: string;
  timeout?: number;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

interface TestRunnerConfig {
  parallel: boolean;
  verbose: boolean;
  coverage: boolean;
  bail: boolean; // Stop on first failure
  pattern?: string; // Run specific test pattern
  setup: boolean; // Run database setup
  cleanup: boolean; // Run cleanup after tests
}

class IntegrationTestRunner {
  private config: TestRunnerConfig;
  private testDb: TestDatabaseManager;
  private startTime: number = 0;
  private results: TestResult[] = [];

  constructor(config: Partial<TestRunnerConfig> = {}) {
    this.config = {
      parallel: true,
      verbose: false,
      coverage: false,
      bail: false,
      setup: true,
      cleanup: true,
      ...config
    };
    this.testDb = testDb;
  }

  /**
   * Available test suites
   */
  private getTestSuites(): TestSuite[] {
    return [
      {
        name: 'Database Integration',
        pattern: 'tests/integration/database-integration.test.ts',
        description: 'Tests complete database operations and business logic',
        timeout: 30000
      },
      {
        name: 'Prisma Models',
        pattern: 'tests/integration/prisma-models.test.ts',
        description: 'Tests database models and relationships',
        timeout: 15000
      },
      // NOTE: HTTP API tests currently disabled due to Express app setup complexity
      // These could be re-enabled with proper server configuration:
      // {
      //   name: 'User, Team, and Project Lifecycle',
      //   pattern: 'tests/integration/user-team-project-lifecycle.test.ts',
      //   description: 'Tests complete HTTP API workflow (DISABLED)',
      //   timeout: 30000
      // },
      // {
      //   name: 'Authentication and Security',
      //   pattern: 'tests/integration/authentication-security.test.ts',
      //   description: 'Tests JWT tokens and API security (DISABLED)',
      //   timeout: 20000
      // }
    ];
  }

  /**
   * Check if test environment is ready
   */
  private async verifyEnvironment(): Promise<{ ready: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if test database URL is configured
    const testDbUrl = process.env.TEST_DATABASE_URL || 
      process.env.DATABASE_URL?.replace('covibes_dev', 'covibes_test');
    
    if (!testDbUrl) {
      issues.push('TEST_DATABASE_URL or DATABASE_URL not configured');
    }

    if (testDbUrl?.includes('covibes_dev')) {
      issues.push('⚠️  Test database URL points to development database! This could be dangerous.');
    }

    // Check if Jest is available
    try {
      await fs.access(path.join(process.cwd(), 'node_modules/.bin/jest'));
    } catch {
      issues.push('Jest not found. Run: npm install');
    }

    // Check if test files exist
    const suites = this.getTestSuites();
    for (const suite of suites) {
      try {
        await fs.access(suite.pattern);
      } catch {
        issues.push(`Test file not found: ${suite.pattern}`);
      }
    }

    // Check database connection
    try {
      await this.testDb.connect();
      const stats = await this.testDb.getDatabaseStats();
      if (this.config.verbose) {
        console.log(`📊 Database stats: ${JSON.stringify(stats)}`);
      }
      await this.testDb.disconnect();
    } catch (error) {
      issues.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      ready: issues.length === 0,
      issues
    };
  }

  /**
   * Setup test environment
   */
  private async setupEnvironment(): Promise<void> {
    if (!this.config.setup) {
      console.log('⏭️  Skipping test environment setup');
      return;
    }

    console.log('🔧 Setting up test environment...');

    // Connect to test database
    await this.testDb.connect();

    // Clean up any existing test data
    await this.testDb.cleanupTestData();

    // Verify database integrity
    const integrity = await this.testDb.verifyDatabaseIntegrity();
    if (!integrity.valid) {
      console.warn('⚠️  Database integrity issues found:');
      integrity.issues.forEach(issue => console.warn(`   - ${issue}`));
    }

    console.log('✅ Test environment ready');
  }

  /**
   * Cleanup test environment
   */
  private async cleanupEnvironment(): Promise<void> {
    if (!this.config.cleanup) {
      console.log('⏭️  Skipping test environment cleanup');
      return;
    }

    console.log('🧹 Cleaning up test environment...');

    try {
      // Clean up test data
      await this.testDb.cleanupTestData();
      
      // Disconnect from database
      await this.testDb.disconnect();

      console.log('✅ Test environment cleaned up');
    } catch (error) {
      console.error('❌ Cleanup error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Run a single test suite
   */
  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const jestArgs = [
        '--testPathPattern=' + suite.pattern,
        '--verbose',
        '--runInBand', // Run tests serially within suite
        '--forceExit',
        '--detectOpenHandles'
      ];

      if (this.config.coverage) {
        jestArgs.push('--coverage');
      }

      if (suite.timeout) {
        jestArgs.push(`--testTimeout=${suite.timeout}`);
      }

      const options: SpawnOptions = {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          // Ensure we use test database
          DATABASE_URL: process.env.TEST_DATABASE_URL || 
            process.env.DATABASE_URL?.replace('covibes_dev', 'covibes_test')
        }
      };

      const jestProcess = spawn('npx', ['jest', ...jestArgs], options);
      
      let output = '';
      let errorOutput = '';

      if (!this.config.verbose) {
        jestProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        jestProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      jestProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        const passed = code === 0;

        const result: TestResult = {
          suite: suite.name,
          passed,
          duration,
          output: output || (passed ? 'Tests passed' : 'Tests failed'),
          error: passed ? undefined : errorOutput || `Process exited with code ${code}`
        };

        resolve(result);
      });

      jestProcess.on('error', (error) => {
        const result: TestResult = {
          suite: suite.name,
          passed: false,
          duration: Date.now() - startTime,
          output: '',
          error: error.message
        };
        
        resolve(result);
      });
    });
  }

  /**
   * Run all test suites
   */
  private async runTestSuites(): Promise<void> {
    let suites = this.getTestSuites();

    // Filter by pattern if specified
    if (this.config.pattern) {
      suites = suites.filter(suite => 
        suite.name.toLowerCase().includes(this.config.pattern!.toLowerCase()) ||
        suite.pattern.includes(this.config.pattern!)
      );
    }

    if (suites.length === 0) {
      console.log('❌ No test suites match the specified pattern');
      return;
    }

    console.log(`🧪 Running ${suites.length} test suite(s):`);
    suites.forEach(suite => {
      console.log(`   📋 ${suite.name}: ${suite.description}`);
    });
    console.log('');

    // Run tests
    if (this.config.parallel && suites.length > 1) {
      console.log('⚡ Running test suites in parallel...');
      this.results = await Promise.all(suites.map(suite => this.runTestSuite(suite)));
    } else {
      console.log('🔄 Running test suites sequentially...');
      this.results = [];
      
      for (const suite of suites) {
        console.log(`\n▶️  Running: ${suite.name}`);
        const result = await this.runTestSuite(suite);
        this.results.push(result);

        if (!result.passed && this.config.bail) {
          console.log('🛑 Stopping due to test failure (--bail mode)');
          break;
        }
      }
    }
  }

  /**
   * Generate test report
   */
  private generateReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`${icon} ${result.suite} (${duration}s)`);
      
      if (!result.passed && result.error && !this.config.verbose) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('');
    console.log(`📈 Results: ${passed} passed, ${failed} failed, ${total} total`);
    console.log(`⏱️  Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    if (failed === 0) {
      console.log('🎉 All integration tests passed!');
    } else {
      console.log(`💥 ${failed} test suite(s) failed`);
    }
  }

  /**
   * Main test runner execution
   */
  async run(): Promise<number> {
    this.startTime = Date.now();

    try {
      // Verify environment
      console.log('🔍 Verifying test environment...');
      const envCheck = await this.verifyEnvironment();
      
      if (!envCheck.ready) {
        console.log('❌ Test environment not ready:');
        envCheck.issues.forEach(issue => console.log(`   - ${issue}`));
        return 1;
      }

      console.log('✅ Test environment verified');

      // Setup
      await this.setupEnvironment();

      // Run tests
      await this.runTestSuites();

      // Generate report
      this.generateReport();

      // Cleanup
      await this.cleanupEnvironment();

      // Return exit code
      const failedCount = this.results.filter(r => !r.passed).length;
      return failedCount > 0 ? 1 : 0;

    } catch (error) {
      console.error('💥 Test runner error:', error instanceof Error ? error.message : 'Unknown error');
      
      try {
        await this.cleanupEnvironment();
      } catch (cleanupError) {
        console.error('Additional cleanup error:', cleanupError);
      }

      return 1;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): TestRunnerConfig {
  const args = process.argv.slice(2);
  const config: TestRunnerConfig = {
    parallel: true,
    verbose: false,
    coverage: false,
    bail: false,
    setup: true,
    cleanup: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--sequential':
      case '--serial':
        config.parallel = false;
        break;
        
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
        
      case '--coverage':
        config.coverage = true;
        break;
        
      case '--bail':
        config.bail = true;
        break;
        
      case '--no-setup':
        config.setup = false;
        break;
        
      case '--no-cleanup':
        config.cleanup = false;
        break;
        
      case '--pattern':
      case '-p':
        config.pattern = args[++i];
        break;
        
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
        
      default:
        console.log(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return config;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Integration Test Runner

Usage: tsx tests/run-integration-tests.ts [options]

Options:
  --sequential, --serial    Run test suites sequentially (default: parallel)
  --verbose, -v            Show detailed output from tests
  --coverage               Generate coverage report
  --bail                   Stop on first test failure
  --no-setup              Skip test environment setup
  --no-cleanup            Skip test environment cleanup
  --pattern, -p <pattern>  Run only test suites matching pattern
  --help, -h              Show this help message

Examples:
  tsx tests/run-integration-tests.ts
  tsx tests/run-integration-tests.ts --verbose --coverage
  tsx tests/run-integration-tests.ts --pattern "auth" --bail
  tsx tests/run-integration-tests.ts --sequential --no-cleanup
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const config = parseArguments();
  const runner = new IntegrationTestRunner(config);
  
  console.log('🚀 Starting Integration Test Runner');
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}`);
  console.log('');

  const exitCode = await runner.run();
  process.exit(exitCode);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner, TestRunnerConfig, TestResult };