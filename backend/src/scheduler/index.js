const cron = require("node-cron");

/**
 * Centralized Scheduler for all cron jobs
 *
 * This module initializes and manages all scheduled background jobs.
 * Jobs are defined in the jobs configuration and can be enabled/disabled
 * via environment variables or configuration.
 */

class Scheduler {
    constructor() {
        this.jobs = [];
        this.isEnabled = process.env.ENABLE_CRON_JOBS !== "false";
    }

    /**
     * Register a cron job
     * @param {Object} jobConfig - Job configuration
     * @param {string} jobConfig.name - Job name (for logging)
     * @param {string} jobConfig.schedule - Cron schedule expression
     * @param {Function} jobConfig.task - Async function to execute
     * @param {boolean} jobConfig.enabled - Whether job is enabled (default: true)
     * @param {string} jobConfig.envKey - Environment variable key to check for enablement (optional)
     */
    registerJob({name, schedule, task, enabled = true, envKey = null}) {
        // Check if job is enabled via environment variable
        if (envKey && process.env[envKey] === "false") {
            console.log(`[Scheduler] Job "${name}" disabled via ${envKey}=false`);
            return;
        }

        // Check if job is explicitly disabled
        if (enabled === false) {
            console.log(`[Scheduler] Job "${name}" is disabled`);
            return;
        }

        // Validate cron schedule
        if (!cron.validate(schedule)) {
            console.error(`[Scheduler] Invalid cron schedule for job "${name}": ${schedule}`);
            return;
        }

        // Register the job
        const cronJob = cron.schedule(schedule, async () => {
            const startTime = Date.now();
            try {
                console.log(`[${new Date().toISOString()}] [Scheduler] Starting job: ${name}`);
                await task();
                const duration = Date.now() - startTime;
                console.log(`[${new Date().toISOString()}] [Scheduler] Completed job: ${name} (${duration}ms)`);
            } catch (error) {
                const duration = Date.now() - startTime;
                console.error(`[${new Date().toISOString()}] [Scheduler] Error in job "${name}" (${duration}ms):`, error);
            }
        }, {
            scheduled: false, // Don't start immediately
            timezone: process.env.TZ || "UTC"
        });

        this.jobs.push({
            name,
            schedule,
            cronJob,
            enabled: true
        });

        console.log(`[Scheduler] Registered job: ${name} (schedule: ${schedule})`);
    }

    /**
     * Start all registered jobs
     */
    start() {
        if (!this.isEnabled) {
            console.log("[Scheduler] Cron jobs are disabled (set ENABLE_CRON_JOBS=true to enable)");
            return;
        }

        this.jobs.forEach(({name, cronJob}) => {
            cronJob.start();
            console.log(`[Scheduler] Started job: ${name}`);
        });

        console.log(`[Scheduler] All jobs started (${this.jobs.length} active jobs)`);
    }

    /**
     * Stop all jobs
     */
    stop() {
        this.jobs.forEach(({name, cronJob}) => {
            cronJob.stop();
            console.log(`[Scheduler] Stopped job: ${name}`);
        });
    }

    /**
     * Get status of all jobs
     */
    getStatus() {
        return this.jobs.map(({name, schedule, enabled, cronJob}) => ({
            name,
            schedule,
            enabled,
            running: cronJob.running || false
        }));
    }
}

// Create singleton instance
const scheduler = new Scheduler();

/**
 * Initialize all scheduled jobs
 * This should be called once when the application starts
 */
function initializeScheduler() {
    // Import job definitions
    const jobDefinitions = require("./jobs");

    // Register all jobs
    jobDefinitions.forEach(jobConfig => {
        scheduler.registerJob(jobConfig);
    });

    // Start all registered jobs
    scheduler.start();
}

module.exports = {
    scheduler,
    initializeScheduler
};

