<script lang="ts">
	// Phase 3 (item 17) — 역할별 메시지 블록 (design prompt 14·78행)
	// 시각 근거: zip 배지 5종 스타일 `rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] uppercase
	// tracking-wider`(725~748) + 그룹 헤더(696~706), 오류 배너 색(277~284), 빈 상태 `EmptyList`(769~785)
	//
	// 합성 관계(이 Phase가 설계): MessageBlock이 TextContent(text 블록)/ThinkingCard(thinking 블록)/
	// ToolCard(tool_use 블록)를 role/블록 타입에 따라 내부에서 분기 렌더한다. tool_result 블록은
	// parser.ts가 이미 매칭된 tool_use.result로 붙여줬으므로 여기서는 건너뛴다.
	//
	// 설계 결정 — `message: RenderMessage | null`:
	// design prompt 78행(조건 불일치 빈 상태 + 해제 조작, 시각: zip EmptyList 769~785)이 계획서
	// item 17에 귀속돼 있다. MessageBlock은 메시지 1개당 1인스턴스로 쓰이는 컴포넌트라 그 자체로
	// "목록이 비었다"는 상태를 가질 수 없으므로, `message`가 null이면 이 컴포넌트가 EmptyList 카드를
	// 렌더하는 것으로 계약을 정했다(신규 8번째 파일을 만들지 않기 위한 결정). Phase 4는 필터링된
	// 메시지 배열이 비었을 때 `<MessageBlock message={null} onClearAll={...} />` 하나만 렌더하고,
	// 그 외에는 배열을 순회하며 `<MessageBlock {message} ... />`를 반복 렌더하면 된다.
	//
	// 배지 5종(design prompt 14행 "상태와 의미"): ①역할(사용자/Claude/시스템) ②압축 이력
	// (subtype==='compact_boundary' || isCompactSummary) ③시스템 메타(isMeta) ④모델(message.model)
	// ⑤오류 포함(하위 tool_use 중 result.is_error===true 존재) — 서브에이전트 탐색/그룹 표시는
	// design prompt P1(162~168행, 미승인 제안)이라 이 배지 구성에서 제외했다.
	//
	// 필터 파이프라인(Phase 4 소유, 참고용 권장 알고리즘 — 이 컴포넌트가 강제하지 않음):
	// 메시지는 (a) 압축 이력이면 showCompactHistory가 false일 때 전체 숨김, (b) 그 외에는
	// 텍스트 블록이 있는데 showMessages가 false, tool_use만 있는데 showToolCalls가 false,
	// thinking만 있는데 showThinking이 false인 경우처럼 "이 메시지가 가진 모든 콘텐츠 카테고리가
	// 전부 숨김 처리됨"일 때만 메시지 자체를 숨긴다. 블록 단위 숨김(도구/사고 카드만 안 보이고
	// 텍스트는 남는 경우)은 이 컴포넌트의 `showToolCalls`/`showThinking` prop으로 처리한다.
	import { AlertTriangle, Bot, History, Info, RotateCcw, Terminal, User } from 'lucide-svelte';
	import type {
		ContentBlock,
		RenderMessage,
		TextBlock,
		ThinkingBlock as ThinkingBlockData,
		ToolUseBlock
	} from '$lib/tools/transcript-viewer/types.js';
	import TextContent from './TextContent.svelte';
	import ThinkingCard from './ThinkingCard.svelte';
	import ToolCard from './ToolCard.svelte';

	let {
		message,
		showToolCalls = true,
		showThinking = true,
		expandSignal,
		expandValue,
		onClearAll
	}: {
		message: RenderMessage | null;
		showToolCalls?: boolean;
		showThinking?: boolean;
		expandSignal?: number;
		expandValue?: boolean;
		/** message === null(빈 상태)일 때만 사용되는 "조건 해제" 콜백 (design prompt 78행) */
		onClearAll?: () => void;
	} = $props();

	const badgeClass = 'rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground';
	const warningBadgeClass =
		'inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warning-foreground';

	const roleMeta = $derived.by(() => {
		if (!message) return { label: '', icon: User };
		switch (message.role) {
			case 'user':
				return { label: '사용자', icon: User };
			case 'assistant':
				return { label: 'Claude', icon: Bot };
			case 'system':
				return { label: '시스템', icon: Terminal };
			default:
				return { label: message.role || message.lineType, icon: Terminal };
		}
	});
	const RoleIcon = $derived(roleMeta.icon);

	const isCompactHistory = $derived(
		!!message && (message.subtype === 'compact_boundary' || message.isCompactSummary === true)
	);

	const hasToolError = $derived(
		!!message &&
			message.content.some(
				(b): b is ToolUseBlock => b.type === 'tool_use' && (b as ToolUseBlock).result?.is_error === true
			)
	);

	function formatTimestamp(ts?: string): string {
		if (!ts) return '';
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return ts;
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// content를 순서를 보존하며 렌더용 세그먼트로 정리한다. tool_result는 매칭된 tool_use 카드
	// 내부에서 함께 표시되므로 건너뛴다.
	const visibleBlocks = $derived.by(() => {
		if (!message) return [] as ContentBlock[];
		return message.content.filter((b) => b.type !== 'tool_result');
	});
</script>

{#if message === null}
	<!-- 조건 불일치 빈 상태 (design prompt 78행) — 시각: zip EmptyList (769~785) -->
	<div class="rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
		<p class="text-sm font-medium text-foreground">적용 중인 조건에 맞는 메시지가 없습니다.</p>
		<p class="mt-1 text-xs text-muted-foreground">필터를 해제하면 숨겨진 메시지를 다시 볼 수 있습니다.</p>
		{#if onClearAll}
			<button
				type="button"
				onclick={onClearAll}
				class="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<RotateCcw class="size-3" aria-hidden="true" />
				필터 해제
			</button>
		{/if}
	</div>
{:else}
	<div id="cse-msg-{message.lineIndex}" class="rounded-xl border border-border bg-surface p-4">
		<!-- 메타/배지 헤더 — zip 그룹 헤더(696~706) + 배지 스타일(725~748) -->
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<div class="flex flex-wrap items-center gap-2">
				<span class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
					<RoleIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
					{roleMeta.label}
				</span>
				{#if isCompactHistory}
					<span class={badgeClass}>
						<History class="mr-1 inline size-2.5" aria-hidden="true" />압축 이력
					</span>
				{/if}
				{#if message.isMeta}
					<span class={badgeClass}>
						<Info class="mr-1 inline size-2.5" aria-hidden="true" />시스템 메타
					</span>
				{/if}
				{#if message.model}
					<span class={badgeClass}>{message.model}</span>
				{/if}
				{#if hasToolError}
					<span class={warningBadgeClass}>
						<AlertTriangle class="size-2.5" aria-hidden="true" />
						오류 포함
					</span>
				{/if}
			</div>
			{#if message.timestamp}
				<span class="font-mono text-[10px] text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
			{/if}
		</div>

		<!-- 본문 세그먼트: 블록 타입에 따라 TextContent/ThinkingCard/ToolCard로 분기 -->
		<div class="flex flex-col gap-2">
			{#each visibleBlocks as block (block)}
				{#if block.type === 'text'}
					<TextContent text={(block as TextBlock).text} />
				{:else if block.type === 'thinking'}
					{#if showThinking}
						<ThinkingCard block={block as ThinkingBlockData} {expandSignal} {expandValue} />
					{/if}
				{:else if block.type === 'tool_use'}
					{#if showToolCalls}
						<ToolCard block={block as ToolUseBlock} {expandSignal} {expandValue} />
					{/if}
				{:else}
					<div class="text-xs italic text-muted-foreground">(알 수 없는 블록: {block.type})</div>
				{/if}
			{/each}
		</div>
	</div>
{/if}
