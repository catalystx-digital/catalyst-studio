const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  /**
   * Sort tests to optimize execution time
   * - Run faster unit tests first
   * - Run database-dependent tests after setup
   * - Group similar test types together
   */
  sort(tests) {
    // Clone the tests array to avoid mutating the original
    const testsCopy = Array.from(tests);

    return testsCopy.sort((testA, testB) => {
      const testPathA = testA.path;
      const testPathB = testB.path;

      // Priority order (lower number = higher priority)
      const priorities = {
        // Fast unit tests first
        'utils': 1,
        'hooks': 2,
        'components': 3,
        'lib/studio/components/cms': 3, // Studio CMS components
        'lib': 4,
        
        // Integration tests
        'integration': 5,
        'api': 6,
        
        // Database tests last
        'database': 7,
        'epic': 8,
      };

      const getPriority = (path) => {
        for (const [key, priority] of Object.entries(priorities)) {
          if (path.includes(key)) {
            return priority;
          }
        }
        return 5; // Default priority
      };

      const priorityA = getPriority(testPathA);
      const priorityB = getPriority(testPathB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort alphabetically for consistency
      return testPathA.localeCompare(testPathB);
    });
  }
}

module.exports = CustomSequencer;