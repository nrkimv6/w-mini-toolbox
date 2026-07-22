<script lang="ts">
	import { parseTranscript } from '$lib/tools/transcript-viewer/parser.js';
	import type { ParseResult, RenderMessage } from '$lib/tools/transcript-viewer/types.js';
	import MessageBlock from '$lib/tools/transcript-viewer/components/MessageBlock.svelte';
	import StatsBar from '$lib/tools/transcript-viewer/components/StatsBar.svelte';
	import { UploadCloud, ShieldCheck, FileWarning, ChevronsDown, ChevronsUp, FileJson } from 'lucide-svelte';

	let result = $state<ParseResult | null>(null);
	let fileName = $state('');
	let isDragging = $state(false);
	let loading = $state(false);

	// role/type 필터
	let showUser = $state(true);
	let showAssistant = $state(true);
	let showSystem = $state(true);
	let showTool = $state(true);
	let showThinking = $state(true);
	// compact 흔적(경계 알림 + 이어받기 요약)은 기본 숨김
	let showCompact = $state(false);

	// 전체 펼치기/접기 (ToolCall/ThinkingBlock에 신호 전달)
	let expandSignal = $state(0);
	let expandValue = $state(true);

	/** compact 흔적 여부 — 구조화 필드(subtype/isCompactSummary)만으로 판정 */
	function isCompactTrace(m: RenderMessage): boolean {
		return m.subtype === 'compact_boundary' || m.isCompactSummary === true;
	}

	/**
	 * 현재 필터 기준으로 실제 화면에 그려질 내용이 있는지.
	 * 빈 메타 라인(attachment/mode/last-prompt 등)과 tool_result만 담은
	 * 빈 사용자 발언을 숨기기 위한 판정.
	 */
	function hasVisibleContent(m: RenderMessage): boolean {
		for (const b of m.content) {
			if (b.type === 'text') {
				if (typeof (b as { text?: string }).text === 'string' && (b as { text: string }).text.trim())
					return true;
			} else if (b.type === 'thinking') {
				if (showThinking && typeof (b as { thinking?: string }).thinking === 'string' && (b as { thinking: string }).thinking.trim())
					return true;
			} else if (b.type === 'tool_use') {
				if (showTool) return true; // 도구 이름 노출은 허용
			} else if (b.type === 'tool_result') {
				continue; // 매칭된 tool_use 카드 내부에서만 표시
			} else {
				return true; // 알 수 없는 블록은 보존
			}
		}
		return false;
	}

	const filteredMessages = $derived.by(() => {
		if (!result) return [];
		return result.messages.filter((m) => {
			if (!showCompact && isCompactTrace(m)) return false;
			if (m.role === 'user' && !showUser) return false;
			if (m.role === 'assistant' && !showAssistant) return false;
			if (m.role === 'system' && !showSystem) return false;
			if (!hasVisibleContent(m)) return false;
			return true;
		});
	});

	async function loadFile(file: File) {
		if (!file) return;
		loading = true;
		fileName = file.name;
		try {
			const text = await file.text();
			result = parseTranscript(text);
		} finally {
			loading = false;
		}
	}

	function handleFileInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) loadFile(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) loadFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function reset() {
		result = null;
		fileName = '';
	}

	function triggerExpandAll(value: boolean) {
		expandValue = value;
		expandSignal += 1;
	}
</script>

<svelte:head>
	<title>Transcript Viewer — Mini Toolbox</title>
</svelte:head>

<div class="min-h-screen bg-background pb-20">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<div class="mb-6 text-center">
			<h1 class="mb-2 text-2xl font-bold tracking-tight lg:text-3xl">Transcript Viewer</h1>
			<p class="text-sm text-muted-foreground">Claude Code 세션(.jsonl) 파일을 브라우저에서 바로 읽어봅니다</p>
		</div>

		<div class="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
			<ShieldCheck size={16} class="mt-0.5 shrink-0" />
			<span>파일은 브라우저에서만 처리됩니다. 서버로 업로드되지 않으며, 어디에도 저장되지 않습니다.</span>
		</div>

		{#if !result}
			<div
				role="button"
				tabindex="0"
				class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors {isDragging
					? 'border-purple-400 bg-purple-50'
					: 'border-gray-300 bg-white'}"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
			>
				<UploadCloud size={40} class="text-gray-400" />
				<div>
					<p class="font-medium text-gray-700">.jsonl 파일을 여기로 드래그하거나</p>
					<label class="mt-2 inline-block cursor-pointer rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
						파일 선택
						<input type="file" accept=".jsonl" class="hidden" onchange={handleFileInput} />
					</label>
				</div>
				<p class="text-xs text-gray-400">~/.claude/projects/&lt;project&gt;/&lt;session&gt;.jsonl</p>
				{#if loading}
					<p class="text-xs text-purple-500">파싱 중...</p>
				{/if}
			</div>
		{:else}
			<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2 text-sm text-gray-600">
					<FileJson size={16} />
					<span class="font-medium">{fileName}</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
						onclick={() => triggerExpandAll(true)}
					>
						<ChevronsDown size={14} />
						모두 펼치기
					</button>
					<button
						type="button"
						class="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
						onclick={() => triggerExpandAll(false)}
					>
						<ChevronsUp size={14} />
						모두 접기
					</button>
					<button
						type="button"
						class="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
						onclick={reset}
					>
						다른 파일 열기
					</button>
				</div>
			</div>

			<div class="mb-4">
				<StatsBar meta={result.meta} />
			</div>

			{#if result.errors.length > 0}
				<div class="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
					<FileWarning size={16} class="mt-0.5 shrink-0" />
					<span>파싱에 실패한 라인 {result.errors.length}개는 건너뛰었습니다.</span>
				</div>
			{/if}

			<div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
				<span class="text-gray-400">필터:</span>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showUser ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showUser = !showUser)}
				>
					user
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showAssistant ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showAssistant = !showAssistant)}
				>
					assistant
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showSystem ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showSystem = !showSystem)}
				>
					system
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showTool ? 'border-blue-400 bg-blue-100 text-blue-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showTool = !showTool)}
				>
					tool
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showThinking ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showThinking = !showThinking)}
				>
					thinking
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showCompact ? 'border-gray-400 bg-gray-200 text-gray-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showCompact = !showCompact)}
				>
					compact
				</button>
			</div>

			{#if filteredMessages.length === 0}
				<p class="py-12 text-center text-sm text-gray-400">필터 조건에 맞는 메시지가 없습니다.</p>
			{:else}
				<div class="flex flex-col gap-4">
					{#each filteredMessages as message (message.lineIndex)}
						<MessageBlock {message} {showTool} {showThinking} {expandSignal} {expandValue} />
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
