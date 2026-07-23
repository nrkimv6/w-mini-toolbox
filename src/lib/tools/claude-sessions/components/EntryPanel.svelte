<script lang="ts">
	// Phase 2 — 진입 화면 드롭존 + 단일 파일 선택.
	// 실제 파싱(parseTranscript 호출)과 `view` 상태 전환은 Phase 4가 페이지 레벨에서 구현한다.
	// 이 컴포넌트는 파일 읽기 "이벤트"만 상위로 전달한다.
	//
	// Phase 4가 참조할 인터페이스 계약:
	//   - onFilePicked(file: File): 확장자 검증(.jsonl)을 통과한 File을 상위로 전달하는 콜백.
	//     드래그앤드롭 / <input type=file> 선택 두 경로 모두 이 콜백 하나로 수렴한다.
	//     Phase 4는 이 콜백에서 File.text() → parseTranscript(text) → view 전환을 수행하면 된다.
	//   - readError?: { fileName: string; reason: string } | null
	//     Phase 4가 File.text()/parseTranscript 단계에서 "파일 전체를 읽지 못함"(design prompt 86행)을
	//     겪으면 이 prop으로 내려준다. destructive 배너(다시 시도/다른 파일 열기 포함)로 렌더한다.
	//     "다시 시도"는 이 컴포넌트가 내부에 기억해 둔 마지막 File을 다시 onFilePicked로 넘기는 방식이라
	//     Phase 4는 File 참조를 별도로 들고 있을 필요가 없다.
	//   - 확장자 불일치(item 7)는 이 컴포넌트 내부에서만 처리하고 상위로 알리지 않는다 — 로컬 검증이며
	//     Phase 4의 파싱/view 전환과 무관하다.
	//
	// 폴더 선택 버튼은 배치하지 않는다(계획서 item 7·미승인 제안 표) — 스캐너가 없어 동작 없는 버튼이 되므로.
	// 같은 이유로 zip 원본의 "폴더 스캔 지원 여부" 안내 문구(hasDirPicker 분기)도 이식하지 않았다 —
	// 폴더 기능 자체가 이 child에 없으므로 그 기능의 지원 여부를 안내하는 문구도 대상이 아니다(편차 기록).
	import { FolderOpen, FileText } from 'lucide-svelte';
	import EntryAside from './EntryAside.svelte';

	let {
		onFilePicked,
		readError = null
	}: {
		onFilePicked: (file: File) => void;
		readError?: { fileName: string; reason: string } | null;
	} = $props();

	let dragOver = $state(false);
	let extensionError = $state<string | null>(null);
	let lastFile = $state<File | null>(null);
	let fileInputEl: HTMLInputElement | null = $state(null);

	function isJsonl(file: File): boolean {
		return file.name.toLowerCase().endsWith('.jsonl');
	}

	function handleFile(file: File) {
		if (!isJsonl(file)) {
			extensionError = `${file.name}: .jsonl 파일만 열 수 있습니다.`;
			return;
		}
		extensionError = null;
		lastFile = file;
		onFilePicked(file);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) handleFile(file);
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function onInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) handleFile(file);
		target.value = '';
	}

	function openPicker() {
		fileInputEl?.click();
	}

	function retryRead() {
		if (lastFile) onFilePicked(lastFile);
	}
</script>

<section class="grid gap-6 lg:grid-cols-[1fr_320px]">
	<div
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		role="region"
		aria-label="세션 파일 드롭 영역"
		class={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 text-center transition-colors ${
			dragOver ? 'border-primary bg-secondary' : 'border-border bg-surface'
		}`}
	>
		<div
			class="mb-5 flex size-12 items-center justify-center rounded-lg bg-secondary ring-1 ring-border"
		>
			<FolderOpen class="size-5 text-muted-foreground" aria-hidden="true" />
		</div>
		<h2 class="text-xl font-semibold tracking-tight">세션 로그 열기</h2>
		<p class="mt-2 max-w-[52ch] text-sm text-muted-foreground">
			<code class="font-mono text-xs">.jsonl</code> 파일 1개를 이 영역에 끌어 놓아 세션을 엽니다.
		</p>

		<div class="mt-6 flex flex-wrap justify-center gap-2">
			<button
				type="button"
				onclick={openPicker}
				class="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<FileText class="size-4" aria-hidden="true" />
				단일 파일 선택
			</button>
		</div>

		{#if extensionError}
			<div
				role="alert"
				class="mt-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs text-destructive"
			>
				{extensionError}
			</div>
		{/if}

		{#if readError}
			<div
				role="alert"
				class="mt-6 flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive"
			>
				<p>
					<span class="font-mono">{readError.fileName}</span> 파일을 읽지 못했습니다: {readError.reason}
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={retryRead}
						class="rounded-md border border-destructive/40 bg-background px-3 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring/40"
					>
						다시 시도
					</button>
					<button
						type="button"
						onclick={openPicker}
						class="rounded-md border border-destructive/40 bg-background px-3 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring/40"
					>
						다른 파일 열기
					</button>
				</div>
			</div>
		{/if}

		<input
			bind:this={fileInputEl}
			type="file"
			accept=".jsonl"
			class="hidden"
			onchange={onInputChange}
		/>
	</div>

	<EntryAside />
</section>
