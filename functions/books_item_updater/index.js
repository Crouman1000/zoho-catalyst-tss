/**
 *
 * @param {import("./types/job").JobRequest} jobRequest
 * @param {import("./types/job").Context} context
 */
const { zohoHttpReq } = require('./zohoAPI.js');

module.exports = async (jobRequest, context) => {
	try {
		console.log('Starting books_item_updater job');

		// Get job parameters
		const allJobParams = jobRequest.getAllJobParams();
		console.log('Job parameters:', JSON.stringify(allJobParams));

		const productBatch = jobRequest.getJobParam('productBatch');

		if (!productBatch || !Array.isArray(productBatch)) {
			throw new Error(`Missing or invalid productBatch parameter: ${JSON.stringify(productBatch)}`);
		}

		const ZOHO_ORG_ARI_ID = process.env.ZOHO_ORG_ARI_ID;
		const ZOHO_ORG_NYC_ID = process.env.ZOHO_ORG_NYC_ID;
		const ZOHO_ORG_CAL_ID = process.env.ZOHO_ORG_CAL_ID;
		if (!ZOHO_ORG_ARI_ID) {
			throw new Error('ZOHO_ORG_ARI_ID environment variable not set');
		}
		if (!ZOHO_ORG_NYC_ID) {
			throw new Error('ZOHO_ORG_NYC_ID environment variable not set');
		}
		if (!ZOHO_ORG_CAL_ID) {
			throw new Error('ZOHO_ORG_CAL_ID environment variable not set');
		}

		console.log(`Processing batch of ${productBatch.length} products`);

		const results = [];


		for (const organizationId of [ZOHO_ORG_ARI_ID, ZOHO_ORG_NYC_ID, ZOHO_ORG_CAL_ID]) {
				
			// Process each product in the batch
			for (const product of productBatch) {
				try {
					const productCode = product.Product_Code;
					const avalaraTaxCode = product.Avalara_Tax_code;
					const productId = product.id;

					if (!productCode || !avalaraTaxCode) {
						console.error(`Skipping product ${productId}: missing Product_Code or Avalara_Tax_code`);
						results.push({
							productId,
							productCode,
							organizationId,
							status: 'skipped',
							error: 'Missing required fields'
						});
						continue;
					}

					console.log(`Searching for item with SKU: ${productCode}`);

					// Search for item by SKU
					const searchUrl = `https://www.zohoapis.com/books/v3/items?organization_id=${organizationId}&sku=${encodeURIComponent(productCode)}`;
					const searchResponse = await zohoHttpReq(searchUrl, 'GET');

					if (!searchResponse.items || searchResponse.items.length === 0) {
						console.log(`No item found with SKU: ${productCode}`);
						results.push({
							productId,
							productCode,
							organizationId,
							status: 'not_found'
						});
						continue;
					}

					const item = searchResponse.items[0]; // Take the first match
					console.log(`Found item: ${item.name} (ID: ${item.item_id})`);

					// Update the item with avatax_code
					const updateUrl = `https://www.zohoapis.com/books/v3/items/${item.item_id}?organization_id=${organizationId}`;
					const updateData = {
						avatax_tax_code: avalaraTaxCode
					};

					const updateResponse = await zohoHttpReq(updateUrl, 'PUT', updateData);
					console.log(`Update response for item ${item.item_id}:`, JSON.stringify(updateResponse));

					results.push({
						productId,
						productCode,
						itemId: item.item_id,
						status: 'updated'
					});

				} catch (productError) {
					console.error(`Error processing product ${product.id}:`, productError);
					results.push({
						productId: product.id,
						productCode: product.Product_Code,
						status: 'error',
						error: productError.message
					});
				}
			}

		}


		console.log(`Batch processing complete. Results:`, JSON.stringify(results));

		// Check if any products failed
		const failedCount = results.filter(r => r.status === 'error').length;
		if (failedCount > 0) {
			console.warn(`${failedCount} products failed to update`);
			// Still close with success since some may have succeeded
		}

		context.closeWithSuccess();

	} catch (error) {
		console.error('Error in books_item_updater:', error);
		context.closeWithFailure();
	}
};
