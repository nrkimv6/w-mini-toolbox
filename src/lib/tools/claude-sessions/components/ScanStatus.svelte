<script lang="ts">
	// _todo-2 Phase 1/4 — 폴더 스캔 진행/취소/부분실패 복구 상태.
	// 색상에만 의존하지 않는다: 모든 상태는 role="status"/aria-live="polite" 텍스트로
	// 먼저 전달되고, 취소·재시도·다른 폴더 action은 label이 있는 <button>(키보드 Tab/Enter로
	// 도달 가능)으로만 제공한다.
	import { X, RotateCcw, FolderOpen } from 'lucide-svelte';
	import type { ScanFailure } from '$lib/tools/transcript-viewer/types.js';

	let {
		scanning,
		scanned,
		currentPath,
		cancelled = false,
		failures = [],
		onCancel,
		onRetry,
		onChooseAnotherFolder
	}: {
		/** 아직 스캔이 진행 중인지 여부 — true면 진행 상태 + 취소 버튼을 보여준다 */
		scanning: boolean;
		/** 지금까지 스캔한 파일 수 */
		scanned: number;
		/** 현재 처리 중인 파일 경로(있으면 진행 텍스트에 포함) */
		currentPath?: string;
		/** 마지막 스캔이 취소로 끝났는지 여부 */
		cancelled?: boolean;
		/** 개별 파일 read/parse 실패 목록 — 스캔 완료 후에도 남아 있으면 복구 action을 노출한다 */
		failures?: ScanFailure[];
		/** 스캔 중 취소 버튼 클릭 시 호출. 미지정이면 취소 버튼을 렌더하지 않는다 */
		onCancel?: () => void;
		/** "다시 시도" 클릭 시 같은 폴더를 재스캔 */
		onRetry?: () => void;
		/** "다른 폴더 선택" 클릭 시 폴더 선택 다이얼로그를 다시 연다 */
		onChooseAnotherFolder?: () => void;
	} = $props();
</script>

{#if scanning}
	<div
		role="status"
		aria-live="polite"
		class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm"
	>
		<span class="text-muted-foreground">
			{scanned}개 파일을 스캔했습니다{#if currentPath}
				<span class="ml-1 font-mono text-[11px]">({currentPath})</span>
			{/if}…
		</span>
		{#if onCancel}
			<button
				type="button"
				onclick={onCancel}
				class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<X class="size-3" aria-hidden="true" />
				스캔 취소
			</button>
		{/if}
	</div>
{:else if cancelled}
	<div
		role="status"
		aria-live="polite"
		class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-warning/40 bg-warning-soft px-4 py-3 text-sm"
	>
		<span class="text-foreground">스캔을 취소했습니다. 지금까지 찾은 {scanned}개 세션을 표시합니다.</span>
		{#if onRetry}
			<button
				type="button"
				onclick={onRetry}
				class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<RotateCcw class="size-3" aria-hidden="true" />
				다시 스캔
			</button>
		{/if}
	</div>
{/if}

{#if !scanning && failures.length > 0}
	<div
		role="status"
		aria-live="polite"
		class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-warning/40 bg-warning-soft px-4 py-3 text-sm"
	>
		<span class="text-foreground">{failures.length}개 파일을 읽지 못했습니다. 나머지 세션은 계속 표시됩니다.</span>
		<div class="flex items-center gap-2">
			{#if onRetry}
				<button
					type="button"
					onclick={onRetry}
					class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					<RotateCcw class="size-3" aria-hidden="true" />
					다시 시도
				</button>
			{/if}
			{#if onChooseAnotherFolder}
				<button
					type="button"
					onclick={onChooseAnotherFolder}
					class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					<FolderOpen class="size-3" aria-hidden="true" />
					다른 폴더 선택
				</button>
			{/if}
		</div>
	</div>
{/if}
