<script lang="ts">
	// Phase 2 (item 7, `_todo-2` 재타겟) — 내보내기 UI. `buildSessionExport`(순수 함수)로
	// 미리보기/실제 파일을 만들고 `downloadSessionExport`(브라우저 전용)로 다운로드를 트리거한다.
	// 두 함수 모두 exportSession.ts 소유 — 이 컴포넌트는 옵션 UI와 결과 표시만 담당한다.
	// 민감 필드(본문/사고 내용/전체 경로)는 전부 opt-in 기본 false를 그대로 반영하고, 하나라도
	// 켜지면 privacy warning을 노출한다(계획서 "민감 정보 opt-in" 요구).
	import { Download, ShieldAlert } from 'lucide-svelte';
	import { buildSessionExport, downloadSessionExport, type ExportFormat, type ExportSelection } from '$lib/tools/transcript-viewer/exportSession.js';

	let { selection }: { selection: ExportSelection } = $props();

	let format = $state<ExportFormat>('markdown');
	let includeBody = $state(false);
	let includeThinking = $state(false);
	let includeFullPaths = $state(false);
	let filename = $state('');

	let resultMessage = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	const sensitiveSelected = $derived(includeBody || includeThinking || includeFullPaths);

	function buildResult() {
		return buildSessionExport(selection, {
			format,
			includeBody,
			includeThinking: includeBody ? includeThinking : false,
			includeFullPaths,
			filename: filename.trim() || undefined
		});
	}

	function download() {
		const result = buildResult();
		if (!result.ok) {
			resultMessage = { kind: 'error', text: result.error };
			return;
		}
		const outcome = downloadSessionExport(result);
		resultMessage = outcome.ok
			? { kind: 'success', text: `${result.filename} 다운로드를 시작했습니다.` }
			: { kind: 'error', text: outcome.error };
	}

	const previewResult = $derived(buildResult());
</script>

<div class="rounded-xl border border-border bg-surface p-5">
	<div class="mb-4">
		<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">내보내기</p>
		<h3 class="mt-1 text-lg font-semibold tracking-tight">Markdown / JSON</h3>
	</div>

	<div class="flex flex-wrap items-center gap-4">
		<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
			형식
			<select
				bind:value={format}
				class="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<option value="markdown">Markdown (.md)</option>
				<option value="json">JSON (.json)</option>
			</select>
		</label>

		<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
			파일명
			<input
				type="text"
				bind:value={filename}
				placeholder="자동 생성"
				class="w-40 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
		</label>
	</div>

	<div class="mt-3 space-y-1">
		<label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
			<input
				type="checkbox"
				bind:checked={includeBody}
				class="rounded border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			메시지 본문 포함 (opt-in)
		</label>
		<label
			class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs {includeBody
				? 'cursor-pointer hover:bg-secondary/60'
				: 'cursor-not-allowed opacity-50'}"
		>
			<input
				type="checkbox"
				bind:checked={includeThinking}
				disabled={!includeBody}
				class="rounded border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			사고 내용 포함 (opt-in, 본문 포함 시에만 적용)
		</label>
		<label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
			<input
				type="checkbox"
				bind:checked={includeFullPaths}
				class="rounded border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			로컬 전체 경로 포함 (opt-in)
		</label>
	</div>

	{#if sensitiveSelected}
		<div class="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
			<ShieldAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<span>
				민감할 수 있는 정보를 포함하도록 선택했습니다. 내보낸 파일을 공유하기 전에 내용을 확인하세요 — 이 정보는
				로컬 다운로드로만 처리되며 서버에 전송되지 않습니다.
			</span>
		</div>
	{:else}
		<p class="mt-3 text-[11px] text-muted-foreground">
			기본값은 메타 요약만 포함합니다(메시지 본문·사고 내용·전체 경로 제외).
		</p>
	{/if}

	{#if previewResult.ok}
		<div class="mt-4">
			<p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				미리보기 — {previewResult.filename}
			</p>
			<pre class="max-h-48 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] text-foreground">{previewResult.content}</pre>
		</div>
	{:else}
		<p class="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
			{previewResult.error}
		</p>
	{/if}

	<button
		type="button"
		onclick={download}
		disabled={!previewResult.ok}
		class="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<Download class="size-3.5" aria-hidden="true" />
		다운로드
	</button>

	{#if resultMessage}
		<p
			role="status"
			aria-live="polite"
			class="mt-2 text-xs {resultMessage.kind === 'success' ? 'text-success-foreground' : 'text-destructive'}"
		>
			{resultMessage.text}
		</p>
	{/if}
</div>
