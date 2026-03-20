/**
 * 
 * @param {import('./types/basicio').Context} context 
 * @param {import('./types/basicio').BasicIO} basicIO 
 */
const catalyst = require('zcatalyst-sdk-node');
const concurrency = require("./concurrency.js");


module.exports = async (context, basicIO) => {

	const catalystApp = catalyst.initialize(context);
		
	const jobScheduling = catalystApp.jobScheduling();
	const delayMS = 60000;
	const simulatedThreadQty = 1;
	const today = new Date();
	const day = today.getDate();
	const month = today.getMonth() + 1; 
	const year = today.getFullYear();

		
	/*
	basicIO will receive something like:


	{
		"data": [
			{"Product_Code":"BE0202DNFR15002000102623330U","Avalara_Tax_code":"TAX123","id":"4973537000031634015"},
			{"Product_Code":"BE0202DNFR15002000102623330B","Avalara_Tax_code":"TAX456","id":"4973537000031634014"},
			{"Product_Code":"BE0202DNFR15002000102623330A","Avalara_Tax_code":"TAX789","id":"4973537000031634013"},
			...
		] 
	}


	*/
	let dataList = basicIO.getArgument("data");
	console.log(`Received data array with ${Array.isArray(dataList) ? dataList.length : 'unknown'} items`);

	if (typeof dataList === "string") {
		
		try {
			dataList = JSON.parse(dataList);
		} catch {
			throw new Error("data must be a valid JSON array");
		}
	}

	if (!Array.isArray(dataList) || dataList.length === 0) {
		throw new Error("Expected non-empty array in data key");
	}

	// Validate that each item has required fields
	for (let i = 0; i < dataList.length; i++) {
		if (
			!dataList[i] 
			|| typeof dataList[i] !== 'object' 
			|| !dataList[i].Product_Code || !dataList[i].id 
			|| !dataList[i].Avalara_Tax_code
		) {

			throw new Error(`Invalid item at index ${i}: must be object with Product_Code, id, and Avalara_Tax_code`);
		}
	}

	const productBatchSubLists = [];
	const batchSize = 25;

	for (let i = 0; i < dataList.length; i += batchSize) {
		productBatchSubLists.push(dataList.slice(i, i + batchSize));
	}

	console.log(`Created ${productBatchSubLists.length} batches of up to ${batchSize} products each`);


	const results = [];

	
	await concurrency.limitConcurrency(productBatchSubLists, simulatedThreadQty, delayMS , async (productBatch,i) => {

		const jobName = `${year}_${month}_${day}_${i}`;
		
		try{
			const jobPoolResp = await jobScheduling.submitJob({
				job_name: jobName,
				jobpool_name: "itembatchUpdatePool",
				target_type: "Function",
				target_name: "books_item_updater",
				params: {
					productBatch: productBatch,		
				},
				job_config: {
					number_of_retries: 3,
					retry_interval: 15 * 60
				}
			})

			results.push({
				jobName : jobName,
				jobStatus : "submitted",
				jobId : jobPoolResp.job_id   
			})
		}
		catch(err){           
			results.push({
				jobName : jobName,  
				jobStatus : "Submit_failed",
				error : err.message || String(err)
			})
		}
		
	});

	basicIO.write(JSON.stringify(results));

	context.close();
}
