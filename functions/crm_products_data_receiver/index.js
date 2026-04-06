/**
 * @param {import('./types/basicio').Context} context 
 * @param {import('./types/basicio').BasicIO} basicIO 
 */


module.exports = async (context, basicIO) => {
  const catalystApp = require('zcatalyst-sdk-node').initialize(context);
  const jobScheduling = catalystApp.jobScheduling();

  let dataList = basicIO.getArgument("data");

  if (typeof dataList === "string") {
    try { dataList = JSON.parse(dataList); }
    catch { throw new Error("data must be a valid JSON array"); }
  }

  if (!Array.isArray(dataList) || dataList.length === 0) {
    throw new Error("Expected a non-empty array");
  }

  const batchSize = 25;
  const batches = [];
  for (let i = 0; i < dataList.length; i += batchSize) {
    batches.push(dataList.slice(i, i + batchSize));
  }

  const results = [];

  const now = new Date();
  const uniqueCode = 
    String(now.getUTCMonth() + 1).padStart(2, '0') +  // month
    String(now.getUTCDate()).padStart(2, '0') +       // day
    String(now.getUTCHours()).padStart(2, '0') +      // hour
    String(now.getUTCMinutes()).padStart(2, '0');     // minute


  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    // Build cron name

    const cronName = `ib${uniqueCode}_${i}`; // e.g., "ib03201432_0"
    const jobName = `jb${uniqueCode}_${i}`;  // e.g., "jb03201432_0"


    ///const buffer = 2 * 60_000; // 2 minutes
    //const runAt = new Date(now + buffer + i * 60_000); // i minutes apart
    //const cronExpression = `${runAt.getUTCMinutes()} ${runAt.getUTCHours()} ${runAt.getUTCDate()} ${runAt.getUTCMonth()+1} *`;
      // Schedule this cron to run i minutes in the future
    const oneTimeCron = {
      cron_name: cronName,             // ≤20 chars
      cron_status: true,
      cron_type: 'OneTime',
      cron_detail: {
        time_of_execution: Math.floor(Date.now()/1000) + (i+1) * 60 // i minutes after 1-minute buffer
      },
      job_meta: {
        job_name: jobName,
        target_type: 'Function',
        target_name: 'books_item_updater',
        jobpool_name: 'itembatchUpdatePool',
        job_config: { number_of_retries: 3, retry_interval: 60*60 },
        params: { productBatch: batch }
      }
    };

      try {
        const cronResp = await jobScheduling.CRON.createCron(oneTimeCron);
        results.push({ cronName, status: "scheduled", cronId: cronResp.cron_id });
      } catch (err) {
        results.push({ cronName, status: "failed", error: err.message || String(err) });
      }
    }

  basicIO.write(JSON.stringify(results));
  context.close();
};