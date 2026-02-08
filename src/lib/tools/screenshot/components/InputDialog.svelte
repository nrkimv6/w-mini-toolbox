<script lang="ts">
	import { X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title: string;
		placeholder?: string;
		onConfirm: (value: string) => void;
		onCancel: () => void;
	}

	let { open = $bindable(false), title, placeholder = '', onConfirm, onCancel }: Props = $props();

	let inputValue = $state('');

	function handleConfirm() {
		if (inputValue.trim()) {
			onConfirm(inputValue.trim());
			inputValue = '';
			open = false;
		}
	}

	function handleCancel() {
		inputValue = '';
		onCancel();
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleConfirm();
		} else if (e.key === 'Escape') {
			handleCancel();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
		onclick={handleCancel}
		onkeydown={handleKeydown}
		role="presentation"
	>
		<div
			class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
		>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 id="dialog-title" class="font-semibold text-lg">{title}</h2>
				<button
					onclick={handleCancel}
					class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					aria-label="Close"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="p-6">
				<input
					type="text"
					bind:value={inputValue}
					{placeholder}
					class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
					autofocus
					onkeydown={handleKeydown}
				/>
			</div>

			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
				<button
					onclick={handleCancel}
					class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
				>
					취소
				</button>
				<button
					onclick={handleConfirm}
					disabled={!inputValue.trim()}
					class="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					확인
				</button>
			</div>
		</div>
	</div>
{/if}
