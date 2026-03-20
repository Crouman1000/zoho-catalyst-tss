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

		const organizationId = process.env.ZOHO_ORGANIZATION_ID;
		if (!organizationId) {
			throw new Error('ZOHO_ORGANIZATION_ID environment variable not set');
		}

		console.log(`Processing batch of ${productBatch.length} products`);

		const results = [];

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
