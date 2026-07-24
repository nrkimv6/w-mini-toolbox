<script lang="ts">
	// Phase 2 (item 7, `_todo-2` 재타겟) — 메모·태그 CRUD UI. 실제 로컬 저장소 IO는
	// +page.svelte가 소유한다(SessionList.svelte의 즐겨찾기 토글과 동일한 위임 패턴 —
	// 이 컴포넌트는 입력값을 만들고 콜백을 호출할 뿐 IndexedDB를 직접 건드리지 않는다).
	// `annotation`이 undefined면 아직 메모·태그가 없는 세션이다(신규 작성 폼과 동일하게 렌더).
	import { Plus, RotateCcw, Save, Tag, Trash2, X } from 'lucide-svelte';
	import type { LocalRepositoryError, SessionAnnotation, UpsertAnnotationInput } from '$lib/tools/transcript-viewer/localRepository.js';

	let {
		annotation,
		saveError = null,
		onSave,
		onDelete,
		onClearAll
	}: {
		annotation: SessionAnnotation | undefined;
		saveError?: LocalRepositoryError | null;
		onSave: (input: UpsertAnnotationInput) => void;
		onDelete: () => void;
		onClearAll: () => void;
	} = $props();

	let noteDraft = $state(annotation?.note ?? '');
	let tagsDraft = $state<string[]>(annotation?.tags ?? []);
	let tagInput = $state('');
	let confirmingClearAll = $state(false);

	// annotation이 바뀌면(다른 세션으로 전환) 편집 초안을 그 세션 값으로 다시 맞춘다.
	let lastSyncedKey = $state<string | undefined>(annotation?.sessionKey);
	$effect(() => {
		if (annotation?.sessionKey !== lastSyncedKey) {
			noteDraft = annotation?.note ?? '';
			tagsDraft = annotation?.tags ?? [];
			lastSyncedKey = annotation?.sessionKey;
		}
	});

	const dirty = $derived(
		noteDraft !== (annotation?.note ?? '') || JSON.stringify(tagsDraft) !== JSON.stringify(annotation?.tags ?? [])
	);

	function addTag() {
		const tag = tagInput.trim().toLowerCase();
		tagInput = '';
		if (!tag || tagsDraft.includes(tag)) return;
		tagsDraft = [...tagsDraft, tag];
	}

	function removeTag(tag: string) {
		tagsDraft = tagsDraft.filter((t) => t !== tag);
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag();
		}
	}

	function save() {
		onSave({ note: noteDraft, tags: tagsDraft });
	}

	function discard() {
		noteDraft = annotation?.note ?? '';
		tagsDraft = annotation?.tags ?? [];
	}

	function fmtTimestamp(ts: string | undefined): string {
		if (!ts) return '정보 없음';
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return ts;
		return d.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	function requestClearAll() {
		confirmingClearAll = true;
	}

	function confirmClearAll() {
		confirmingClearAll = false;
		onClearAll();
	}

	function cancelClearAll() {
		confirmingClearAll = false;
	}
</script>

<div class="rounded-xl border border-border bg-surface p-5">
	<div class="mb-4 flex items-center justify-between gap-2">
		<div>
			<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">메모·태그</p>
			<h3 class="mt-1 text-lg font-semibold tracking-tight">
				{annotation ? '수정' : '새로 작성'}
			</h3>
		</div>
		<button
			type="button"
			onclick={requestClearAll}
			class="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring/40"
		>
			<Trash2 class="size-3" aria-hidden="true" />
			전체 메모·태그 삭제
		</button>
	</div>

	{#if confirmingClearAll}
		<div role="alert" class="mb-4 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
			<span>모든 세션의 메모·태그를 삭제합니다. 되돌릴 수 없습니다.</span>
			<div class="flex shrink-0 items-center gap-2">
				<button
					type="button"
					onclick={confirmClearAll}
					class="rounded-md border border-destructive/40 bg-background px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					전체 삭제
				</button>
				<button
					type="button"
					onclick={cancelClearAll}
					class="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					취소
				</button>
			</div>
		</div>
	{/if}

	{#if saveError}
		<div role="alert" class="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
			{#if saveError.kind === 'quota-exceeded'}
				저장 공간이 부족해 저장하지 못했습니다: {saveError.message}
			{:else if saveError.kind === 'permission-expired'}
				로컬 저장소 권한이 만료되어 저장하지 못했습니다: {saveError.message}
			{:else}
				저장 중 오류가 발생했습니다: {saveError.message}
			{/if}
		</div>
	{/if}

	<label class="block text-[11px] font-medium text-muted-foreground" for="cse-annotation-note">메모</label>
	<textarea
		id="cse-annotation-note"
		bind:value={noteDraft}
		rows="3"
		placeholder="이 세션에 대한 메모를 남기세요…"
		class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
	></textarea>

	<div class="mt-3">
		<span class="text-[11px] font-medium text-muted-foreground">태그</span>
		<div class="mt-1 flex flex-wrap items-center gap-1.5">
			{#each tagsDraft as tag (tag)}
				<span class="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground">
					<Tag class="size-3 text-muted-foreground" aria-hidden="true" />
					{tag}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						aria-label={`${tag} 태그 제거`}
						class="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
					>
						<X class="size-3" aria-hidden="true" />
					</button>
				</span>
			{/each}
			<div class="flex items-center gap-1">
				<input
					type="text"
					bind:value={tagInput}
					onkeydown={handleTagKeydown}
					aria-label="태그 추가"
					placeholder="태그 입력 후 Enter"
					class="w-32 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
				/>
				<button
					type="button"
					onclick={addTag}
					aria-label="태그 추가"
					class="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					<Plus class="size-3.5" aria-hidden="true" />
				</button>
			</div>
		</div>
	</div>

	{#if annotation}
		<p class="mt-3 text-[10px] text-muted-foreground">
			작성 {fmtTimestamp(annotation.createdAt)} · 수정 {fmtTimestamp(annotation.updatedAt)}
		</p>
	{/if}

	<div class="mt-4 flex flex-wrap items-center gap-2">
		<button
			type="button"
			onclick={save}
			disabled={!dirty}
			class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Save class="size-3.5" aria-hidden="true" />
			저장
		</button>
		{#if dirty}
			<button
				type="button"
				onclick={discard}
				class="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<RotateCcw class="size-3" aria-hidden="true" />
				변경 취소
			</button>
		{/if}
		{#if annotation}
			<button
				type="button"
				onclick={onDelete}
				class="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<Trash2 class="size-3" aria-hidden="true" />
				이 세션의 메모·태그 삭제
			</button>
		{/if}
	</div>
</div>
