# Scheduler Module

This module provides a centralized, modular system for managing all cron jobs in the application.

## Structure

```
src/scheduler/
├── index.js      # Main scheduler class and initialization
├── jobs.js       # Job definitions and configurations
└── README.md     # This file
```

## Architecture

### `index.js` - Scheduler Core

- **Scheduler Class**: Manages job registration, starting, stopping, and status
- **Singleton Pattern**: One scheduler instance for the entire application
- **Error Handling**: Automatic error catching and logging for each job
- **Job Validation**: Validates cron schedules before registration

### `jobs.js` - Job Definitions

- Centralized configuration for all scheduled jobs
- Easy to add, remove, or modify jobs
- Environment variable support for enable/disable

## Adding a New Job

1. Create your job function in `src/jobs/yourJob.js`:

```javascript
exports.runYourJob = async () => {
    // Your job logic here
    console.log("Running your job...");
};
```

2. Add job definition to `src/scheduler/jobs.js`:

```javascript
const yourJob = require("../jobs/yourJob");

const jobs = [
    // ... existing jobs
    {
        name: "Your Job Name",
        schedule: "0 9 * * *", // Every day at 9:00 AM UTC
        task: async () => {
            await yourJob.runYourJob();
        },
        enabled: true,
        envKey: "ENABLE_YOUR_JOB_CRON" // Optional: set to "false" to disable
    },
];
```

3. That's it! The job will be automatically registered and started when the server starts.

## Cron Schedule Format

Uses standard cron syntax: `minute hour day month weekday`

Examples:

- `"0 */6 * * *"` - Every 6 hours at minute 0
- `"0 9 * * *"` - Every day at 9:00 AM UTC
- `"0 0 * * 0"` - Every Sunday at midnight
- `"*/30 * * * *"` - Every 30 minutes
- `"0 0 1 * *"` - First day of every month at midnight

Use [crontab.guru](https://crontab.guru/) to help create schedules.

## Environment Variables

### Global Control

- `ENABLE_CRON_JOBS` - Set to `"false"` to disable all cron jobs (default: enabled)

### Per-Job Control

Each job can have its own environment variable (specified in `envKey`):

- `ENABLE_ABANDONED_CART_CRON` - Set to `"false"` to disable abandoned cart reminders

## Monitoring

### Get Job Status

```bash
GET /scheduler/status
Authorization: Bearer <admin_token>
```

Returns:

```json
{
  "success": true,
  "payload": {
    "jobs": [
      {
        "name": "Abandoned Cart Reminder",
        "schedule": "0 */6 * * *",
        "enabled": true,
        "running": true
      }
    ],
    "totalJobs": 1,
    "enabledJobs": 1
  }
}
```

## Best Practices

1. **Error Handling**: Jobs should handle their own errors gracefully. The scheduler will catch and log any unhandled
   errors.

2. **Idempotency**: Jobs should be idempotent (safe to run multiple times).

3. **Logging**: Use structured logging with timestamps for debugging.

4. **Performance**: Long-running jobs should process in batches to avoid timeouts.

5. **Testing**: Test jobs manually before adding to scheduler:
   ```javascript
   // In your job file
   if (require.main === module) {
       exports.runYourJob()
           .then(() => process.exit(0))
           .catch(err => { console.error(err); process.exit(1); });
   }
   ```

6. **Timezones**: All schedules use UTC by default (set via `process.env.TZ`).

## Example: Complete Job Implementation

```javascript
// src/jobs/dailyReport.js
const reportService = require("../service/report");

exports.generateDailyReport = async () => {
    try {
        console.log("Generating daily report...");
        const report = await reportService.generateDailyReport();
        console.log(`Report generated: ${report.id}`);
        return report;
    } catch (error) {
        console.error("Error generating daily report:", error);
        throw error;
    }
};

// If running directly for testing
if (require.main === module) {
    exports.generateDailyReport()
        .then(() => {
            console.log("Daily report job completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Daily report job failed:", error);
            process.exit(1);
        });
}
```

```javascript
// src/scheduler/jobs.js
const dailyReportJob = require("../jobs/dailyReport");

const jobs = [
    // ... existing jobs
    {
        name: "Daily Report Generator",
        schedule: "0 9 * * *", // 9 AM UTC daily
        task: async () => {
            await dailyReportJob.generateDailyReport();
        },
        enabled: true,
        envKey: "ENABLE_DAILY_REPORT_CRON"
    },
];
```

## Troubleshooting

### Job not running?

1. Check `ENABLE_CRON_JOBS` is not set to `"false"`
2. Check job-specific environment variable (if set)
3. Verify cron schedule is valid
4. Check server logs for errors

### Job running but errors?

- Check the job's error handling
- Review logs for specific error messages
- Test the job function directly

### Need to stop/start jobs?

- Stop: Set `ENABLE_CRON_JOBS=false` and restart server
- Start: Set `ENABLE_CRON_JOBS=true` (or remove it) and restart server

