const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

// =========================
// CONFIG
// =========================
const CONCURRENCY = 2;
let running = 0;
const queue = [];

// =========================
// 429 RETRY LOGIC
// =========================
async function axiosGetWithRetry(url, options, maxRetries = 100) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            return await axios.get(url, options);

        } catch (err) {
            const status = err.response?.status;

            if (status === 429) {
                attempt++;

                const base = 500 * Math.pow(1.5, attempt);
                const jitter = Math.floor(Math.random() * 200);
                const delay = Math.min(base + jitter, 20000);

                console.log(`[429] RETRY ${attempt} delay=${delay}ms`);
                await new Promise(res => setTimeout(res, delay));
                continue;
            }

            throw err;
        }
    }

    throw new Error("Exceeded 100 retries (429)");
}

// =========================
// PROCESS A SINGLE JOB
// =========================
async function runJob(job) {
    const { phone, token, userid } = job;

    const dashboardURL =
        "https://store.atom.com.mm/mytmapi/v1/my/dashboard?isFirstTime=1&isFirstInstall=1&ednpart";

    const couponURL =
        `https://store.atom.com.mm/mytmapi/v1/my/tohtohunited/get-coupon-balance?msisdn=${phone}&userid=${userid}&v=4.13.0`;

    const headers = {
        "User-Agent": "MyTM/4.13.0/Android/25",
        "Authorization": `Bearer ${token}`,
        "Accept-Encoding": "gzip"
    };

    // Both requests with retry logic
    const dashRes = await axiosGetWithRetry(dashboardURL, { headers });
    const coupRes = await axiosGetWithRetry(couponURL, { headers });

    return {
        success: true,
        dashboard: dashRes.status,
        coupon: coupRes.status
    };
}

// =========================
// INTERNAL WORKER LOOP
// =========================
async function processQueue() {
    if (running >= CONCURRENCY) return;
    if (queue.length === 0) return;

    const { req, res } = queue.shift();
    running++;

    try {
        const result = await runJob(req.body);
        res.json(result);
    } catch (err) {
        res.json({ success: false, error: err.message });
    }

    running--;

    // Continue with next job
    processQueue();
}

// =========================
// API ENDPOINT
// =========================
app.post("/run-job", (req, res) => {
    queue.push({ req, res });
    processQueue();
});

app.listen(4000, () => console.log("Worker running with 2 concurrency"));