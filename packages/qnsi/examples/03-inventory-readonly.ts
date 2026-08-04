import { qnsiClient, reportFailure } from "./common.js";

async function main(): Promise<void> {
	const qnsi = qnsiClient();
	const [assets, readiness, recommendations, cbom] = await Promise.all([
		qnsi.cryptoInventory.listAssets({ limit: 25 }),
		qnsi.cryptoInventory.getPqcReadinessScore(),
		qnsi.cryptoInventory.getPqcReadinessRecommendations(),
		qnsi.cryptoInventory.getCbom(),
	]);

	console.log(JSON.stringify({ assets, readiness, recommendations, cbom }, null, 2));
}

main().catch(reportFailure);
