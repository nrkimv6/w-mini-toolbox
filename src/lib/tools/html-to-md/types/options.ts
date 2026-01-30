export interface UserOptions {
	autoClearAfterCopy: boolean;
	autoClearAfterDownload: boolean;
	autoSaveInput: boolean;
}

export const DEFAULT_OPTIONS: UserOptions = {
	autoClearAfterCopy: false,
	autoClearAfterDownload: true,
	autoSaveInput: false
};