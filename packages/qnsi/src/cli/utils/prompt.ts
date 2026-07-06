import { createInterface } from "node:readline";

export async function promptForSecret(promptText = "Service secret: "): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.question(promptText, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

export async function promptForInput(promptText: string): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.question(promptText, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

export async function promptForConfirmation(promptText: string): Promise<boolean> {
	const answer = await promptForInput(`${promptText} (y/N): `);
	return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}
