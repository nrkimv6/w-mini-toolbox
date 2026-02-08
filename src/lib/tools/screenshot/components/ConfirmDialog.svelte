<script lang="ts">
	import { AlertTriangle, X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title?: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(false),
		title = '확인',
		message = '',
		confirmText = '확인',
		cancelText = '취소',
		onConfirm,
		onCancel
	}: Props = $props();

	function handleConfirm() {
		onConfirm();
		open = false;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="bg-card rounded-lg shadow-lg max-w-md w-full border border-border">
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-border">
				<h2 class="text-lg font-semibold">{title}</h2>
				<button
					onclick={handleCancel}
					class="p-1 rounded-lg hover:bg-muted transition-colors"
					aria-label="닫기"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="p-6 flex flex-col items-center text-center">
				<div class="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
					<AlertTriangle class="w-6 h-6 text-destructive" />
				</div>
				<p class="text-foreground mb-2">{message}</p>
				<p class="text-sm text-muted-foreground">이 작업은 되돌릴 수 없습니다.</p>
			</div>

			<!-- Footer -->
			<div class="flex gap-2 p-4 border-t border-border justify-end">
				<button
					onclick={handleCancel}
					class="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
				>
					{cancelText}
				</button>
				<button
					onclick={handleConfirm}
					class="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
				>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}
