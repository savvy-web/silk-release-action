export {};

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/** Commit SHA the workflow is running against, when the caller exports one. */
			SHA: string;
		}
	}
}
