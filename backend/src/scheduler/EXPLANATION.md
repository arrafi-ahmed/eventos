# Scheduler Class - Detailed Explanation

## 🎯 Why Do We Need a Scheduler Class?

### Simple Function Approach (What We Had Before):

```javascript
// In app.js - scattered and hard to manage
if (enableAbandonedCartCron) {
    cron.schedule("0 */6 * * *", async () => {
        try {
            await abandonedCartJob.processAbandonedCarts();
        } catch (error) {
            console.error("Error:", error);
        }
    });
}

// If we add more jobs, app.js becomes messy:
if (enableDailyReport) {
    cron.schedule("0 9 * * *", async () => { ... });
}
if (enableCleanup) {
    cron.schedule("0 0 * * *", async () => { ... });
}
// ... more and more code in app.js
```

**Problems:**

- ❌ All cron logic mixed with Express setup in `app.js`
- ❌ No centralized management - jobs scattered everywhere
- ❌ Hard to add/remove jobs
- ❌ No way to check status of all jobs
- ❌ No validation or error handling consistency
- ❌ Can't easily start/stop all jobs

### Class-Based Approach (What We Have Now):

```javascript
// Clean separation - app.js just calls one function
initializeScheduler(); // That's it!

// All jobs defined in one place (jobs.js)
// All management in one class (Scheduler)
```

**Benefits:**

- ✅ Clean separation of concerns
- ✅ Centralized management
- ✅ Easy to add/remove jobs
- ✅ Can check status, start/stop jobs
- ✅ Consistent error handling
- ✅ Validation built-in

---

## 📦 Breaking Down the Scheduler Class

### **Block 1: Class Declaration & Constructor**

```javascript
class Scheduler {
    constructor() {
        this.jobs = [];
        this.isEnabled = process.env.ENABLE_CRON_JOBS !== "false";
    }
}
```

**What it does:**

- Creates a `Scheduler` class (a blueprint for creating scheduler objects)
- `constructor()` runs automatically when you create a new Scheduler instance

**Inside constructor:**

- `this.jobs = []` - Creates an empty array to store all registered jobs
    - Think of it as a "registry" or "list" of all jobs
    - Each job will be an object with name, schedule, cronJob, etc.

- `this.isEnabled = ...` - Checks if cron jobs are globally enabled
    - Reads `ENABLE_CRON_JOBS` from environment variables
    - Defaults to `true` (enabled) if not set to "false"
    - This is a master switch for all jobs

**Why we need it:**

- The constructor sets up the initial state
- `this.jobs` array lets us track all jobs in one place
- `this.isEnabled` gives us a master on/off switch

---

### **Block 2: registerJob() Method**

```javascript
registerJob({ name, schedule, task, enabled = true, envKey = null }) {
    // ... validation and registration logic
}
```

**What it does:**

- This is a method (function inside a class) that registers a new job
- Takes a configuration object with job details

**Step-by-step breakdown:**

#### Step 1: Check Environment Variable

```javascript
if (envKey && process.env[envKey] === "false") {
    console.log(`[Scheduler] Job "${name}" disabled via ${envKey}=false`);
    return; // Exit early - don't register this job
}
```

- If job has an `envKey` (like `ENABLE_ABANDONED_CART_CRON`)
- And that env var is set to "false"
- Skip registering this job (it's disabled)

**Example:**

- Job has `envKey: "ENABLE_ABANDONED_CART_CRON"`
- If `.env` has `ENABLE_ABANDONED_CART_CRON=false`
- This job won't be registered

#### Step 2: Check Enabled Flag

```javascript
if (enabled === false) {
    console.log(`[Scheduler] Job "${name}" is disabled`);
    return; // Exit early
}
```

- If job config has `enabled: false`
- Skip registering it

#### Step 3: Validate Cron Schedule

```javascript
if (!cron.validate(schedule)) {
    console.error(`[Scheduler] Invalid cron schedule for job "${name}": ${schedule}`);
    return; // Exit early - invalid schedule
}
```

- Validates the cron expression (like `"0 */6 * * *"`)
- If invalid, logs error and skips registration
- Prevents crashes from bad schedules

#### Step 4: Create and Register the Cron Job

```javascript
const cronJob = cron.schedule(schedule, async () => {
    const startTime = Date.now();
    try {
        console.log(`[${new Date().toISOString()}] [Scheduler] Starting job: ${name}`);
        await task(); // Execute the actual job function
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
```

**What's happening:**

- `cron.schedule()` creates a cron job from node-cron library
- Wraps the `task` function with:
    - **Timing**: Records start time
    - **Logging**: Logs when job starts
    - **Execution**: Runs the actual task
    - **Error handling**: Catches any errors
    - **Performance tracking**: Calculates how long job took
- `scheduled: false` means "don't start yet" - we'll start all jobs together later
- `timezone` uses UTC by default

#### Step 5: Store Job in Registry

```javascript
this.jobs.push({
    name,
    schedule,
    cronJob,
    enabled: true
});

console.log(`[Scheduler] Registered job: ${name} (schedule: ${schedule})`);
```

- Adds job info to the `this.jobs` array
- Now we can track it, start it, stop it, check its status
- Logs confirmation

**Why this method is powerful:**

- ✅ Validates before registering (prevents errors)
- ✅ Consistent error handling for all jobs
- ✅ Tracks execution time
- ✅ Centralized logging
- ✅ Can enable/disable per job

---

### **Block 3: start() Method**

```javascript
start() {
    if (!this.isEnabled) {
        console.log("[Scheduler] Cron jobs are disabled (set ENABLE_CRON_JOBS=true to enable)");
        return;
    }

    this.jobs.forEach(({ name, cronJob }) => {
        cronJob.start();
        console.log(`[Scheduler] Started job: ${name}`);
    });

    console.log(`[Scheduler] All jobs started (${this.jobs.length} active jobs)`);
}
```

**What it does:**

- Starts all registered jobs

**Step-by-step:**

1. **Check Master Switch:**
   ```javascript
   if (!this.isEnabled) { return; }
   ```
    - If `ENABLE_CRON_JOBS=false`, don't start anything
    - Master kill switch

2. **Start Each Job:**
   ```javascript
   this.jobs.forEach(({ name, cronJob }) => {
       cronJob.start();
   });
   ```
    - Loops through all jobs in `this.jobs` array
    - Calls `.start()` on each cron job
    - This actually activates the cron schedule

3. **Log Summary:**
    - Logs how many jobs were started

**Why we need it:**

- Jobs are registered with `scheduled: false` (not started yet)
- This gives us control: register all jobs first, then start them all together
- Can start/stop all jobs as a group

---

### **Block 4: stop() Method**

```javascript
stop() {
    this.jobs.forEach(({ name, cronJob }) => {
        cronJob.stop();
        console.log(`[Scheduler] Stopped job: ${name}`);
    });
}
```

**What it does:**

- Stops all running jobs

**Why we need it:**

- Useful for graceful shutdown
- Can pause all jobs temporarily
- Can restart jobs by stopping and starting again

**Example use case:**

```javascript
// During server shutdown
process.on('SIGTERM', () => {
    scheduler.stop(); // Stop all jobs gracefully
    server.close();   // Then close server
});
```

---

### **Block 5: getStatus() Method**

```javascript
getStatus() {
    return this.jobs.map(({ name, schedule, enabled, cronJob }) => ({
        name,
        schedule,
        enabled,
        running: cronJob.running || false
    }));
}
```

**What it does:**

- Returns information about all jobs

**What it returns:**

```javascript
[
    {
        name: "Abandoned Cart Reminder",
        schedule: "0 */6 * * *",
        enabled: true,
        running: true  // Is it currently running?
    },
    // ... more jobs
]
```

**Why we need it:**

- Monitoring: Check which jobs are running
- Debugging: See if a job is enabled but not running
- API endpoint: `/scheduler/status` uses this
- Health checks: Verify jobs are active

---

### **Block 6: Singleton Instance**

```javascript
// Create singleton instance
const scheduler = new Scheduler();
```

**What it does:**

- Creates ONE instance of the Scheduler class
- Stores it in a constant called `scheduler`

**Why "singleton"?**

- We only need ONE scheduler for the entire app
- All jobs go into this one scheduler instance
- If we created multiple schedulers, jobs would be split across them (bad!)

**How it's used:**

```javascript
// In app.js or other files:
const { scheduler } = require("./src/scheduler");

scheduler.getStatus();  // Use the same instance
scheduler.stop();      // Same instance
```

---

### **Block 7: initializeScheduler() Function**

```javascript
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
```

**What it does:**

- This is the "setup function" called when app starts

**Step-by-step:**

1. **Import Job Definitions:**
   ```javascript
   const jobDefinitions = require("./jobs");
   ```
    - Loads the array from `jobs.js`
    - Gets all job configurations

2. **Register All Jobs:**
   ```javascript
   jobDefinitions.forEach(jobConfig => {
       scheduler.registerJob(jobConfig);
   });
   ```
    - Loops through each job config
    - Registers each one with the scheduler
    - Now all jobs are in `scheduler.jobs` array

3. **Start All Jobs:**
   ```javascript
   scheduler.start();
   ```
    - Activates all registered jobs
    - They start running on their schedules

**Where it's called:**

```javascript
// In app.js, after server starts:
app.listen(port, (err) => {
    // ...
    initializeScheduler(); // ← Called here
});
```

---

### **Block 8: Module Exports**

```javascript
module.exports = {
    scheduler,
    initializeScheduler
};
```

**What it does:**

- Exports two things:
    1. `scheduler` - The singleton instance (for status, stop, etc.)
    2. `initializeScheduler` - The setup function (for app.js)

**Why export both:**

- `initializeScheduler` - Used once at startup (in app.js)
- `scheduler` - Used for monitoring/control (in controller, tests, etc.)

---

## 🔄 How It All Works Together

### Flow Diagram:

```
1. Server starts (app.js)
   ↓
2. initializeScheduler() called
   ↓
3. Loads jobs from jobs.js
   ↓
4. For each job:
   - scheduler.registerJob() validates and registers
   - Job added to scheduler.jobs array
   ↓
5. scheduler.start() activates all jobs
   ↓
6. Jobs run on their schedules automatically
   ↓
7. When job runs:
   - Logs start time
   - Executes task
   - Catches errors
   - Logs completion/time
```

### Example: Adding a New Job

**Before (Simple Function):**

```javascript
// In app.js - messy!
if (process.env.ENABLE_NEW_JOB !== "false") {
    cron.schedule("0 9 * * *", async () => {
        try {
            await newJob.run();
        } catch (error) {
            console.error("Error:", error);
        }
    });
}
```

**After (Class-Based):**

```javascript
// In jobs.js - clean!
{
    name: "New Job",
    schedule: "0 9 * * *",
    task: async () => await newJob.run(),
    enabled: true,
    envKey: "ENABLE_NEW_JOB_CRON"
}
```

That's it! The scheduler handles everything else automatically.

---

## 🎁 Key Benefits Summary

| Feature            | Simple Function     | Scheduler Class              |
|--------------------|---------------------|------------------------------|
| **Organization**   | Scattered in app.js | Centralized in scheduler/    |
| **Adding Jobs**    | Edit app.js         | Add to jobs.js               |
| **Error Handling** | Manual per job      | Automatic for all            |
| **Validation**     | None                | Built-in                     |
| **Status Check**   | Not possible        | `getStatus()` method         |
| **Start/Stop**     | Not possible        | `start()` / `stop()` methods |
| **Monitoring**     | Manual logs         | Structured logging           |
| **Testing**        | Hard                | Easy (mock scheduler)        |

---

## 💡 Real-World Analogy

Think of the Scheduler class like a **smart alarm clock system**:

- **Simple function approach**: You have multiple alarm clocks scattered around your house, each set individually. Hard
  to manage!

- **Scheduler class**: You have ONE control panel that:
    - Registers all alarms (registerJob)
    - Validates alarm times (validation)
    - Can start/stop all alarms (start/stop)
    - Shows status of all alarms (getStatus)
    - Handles errors if alarm fails (error handling)
    - Logs when alarms go off (logging)

Much better organized and easier to manage! 🎯

