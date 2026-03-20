let lastStart = 0;

async function throttle(minIntervalMs) {
    const now = Date.now();
    const wait = Math.max(0, minIntervalMs - (now - lastStart));
    if (wait > 0) {
        await new Promise(res => setTimeout(res, wait));
    }
    lastStart = Date.now();
}


async function limitConcurrency(items, limit, minIntervalMs, worker) {
    let index = 0;

    async function next() {
        if (index >= items.length) return;
        const current = index++;

        if (minIntervalMs) {
            await throttle(minIntervalMs);
        }

        await worker(items[current],current);
        await next();
    }

    const workers = [];
    for (let i = 0; i < Math.min(limit, items.length); i++) {
        workers.push(next());
    }

    await Promise.all(workers);
}

module.exports = {limitConcurrency};