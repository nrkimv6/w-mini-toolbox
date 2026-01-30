import { inputHtml, outputMarkdown, userOptions } from '$lib/stores.js';
import { get } from 'svelte/store';

/**
 * Auto-clear functionality with smooth animation
 */
export async function autoClearAfterCopy(): Promise<void> {
	const options = get(userOptions);
	
	if (options.autoClearAfterCopy) {
		// Add a small delay for user feedback
		await new Promise(resolve => setTimeout(resolve, 500));
		
		// Clear both inputs
		inputHtml.set('');
		outputMarkdown.set('');
	}
}

export async function autoClearAfterDownload(): Promise<void> {
	const options = get(userOptions);
	
	if (options.autoClearAfterDownload) {
		// Add a small delay for user feedback
		await new Promise(resolve => setTimeout(resolve, 800));
		
		// Clear both inputs
		inputHtml.set('');
		outputMarkdown.set('');
	}
}

/**
 * Show temporary notification when auto-clear happens
 */
export function showAutoClearNotification(action: 'copy' | 'download'): void {
	const notification = document.createElement('div');
	notification.textContent = action === 'copy' 
		? '📋 복사 완료 - 자동 초기화됨' 
		: '💾 다운로드 완료 - 자동 초기화됨';
	
	notification.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
		font-weight: 600;
		z-index: 1000;
		opacity: 0;
		transform: translateY(-10px) scale(0.9);
		transition: all 0.3s ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	`;
	
	document.body.appendChild(notification);
	
	// Animate in
	setTimeout(() => {
		notification.style.opacity = '1';
		notification.style.transform = 'translateY(0) scale(1)';
	}, 10);
	
	// Animate out and remove
	setTimeout(() => {
		notification.style.opacity = '0';
		notification.style.transform = 'translateY(-10px) scale(0.9)';
		setTimeout(() => document.body.removeChild(notification), 300);
	}, 2000);
}