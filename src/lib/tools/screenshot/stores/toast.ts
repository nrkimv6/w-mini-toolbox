import { toast as sonnerToast } from 'svelte-sonner';

// svelte-sonner wrapper to match screenshot-generator's toast API
export const toast = {
	success: (message: string) => sonnerToast.success(message),
	error: (message: string) => sonnerToast.error(message),
	info: (message: string) => sonnerToast.info(message),
	warning: (message: string) => sonnerToast.warning(message)
};
