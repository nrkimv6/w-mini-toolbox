<script lang="ts">
	/**
	 * sub-agent(sidechain) 연속 구간을 접힌 카드로 표시한다.
	 *
	 * - 기본 접힘. 라벨은 "sub-agent 작업 N개" + 첫/마지막 타임스탬프 차이(소요 시간).
	 * - 펼치면 그룹 내 메시지를 기존 MessageBlock 렌더 방식 그대로 보여준다
	 *   (연속 발화자 헤더 병합 포함).
	 */
	import { ChevronDown, ChevronRight, GitBranch } from 'lucide-svelte';
	import MessageBlock from './MessageBlock.svelte';
	import { shouldShowHeader } from '../speakerGrouping.js';
	import type { RenderMessage } from '../types.js';

	interface Props {
		messages: RenderMessage[];
		showTool?: boolean;
		showThinking?: boolean;
		expandSignal?: number;
		expandValue?: boolean;
	}

	let { messages, showTool = true, showThinking = true, expandSignal, expandValue }: Props = $props();

	let open = $state(false);

	/** 첫/마지막 타임스탬프 차이를 "N분 M초" 형태로 포맷. 파싱 불가하면 null. */
	const duration = $derived.by((): string | null => {
		const first = messages[0]?.timestamp;
		const last = messages[messages.length - 1]?.timestamp;
		if (!first || !last) return null;
		const start = new Date(first).getTime();
		const end = new Date(last).getTime();
		if (Number.isNaN(start) || Number.isNaN(end)) return null;
		const diffMs = Math.max(0, end - start);
		const totalSeconds = Math.round(diffMs / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		if (minutes === 0) return `${seconds}초`;
		return `${minutes}분 ${seconds}초`;
	});
</script>

<div class="w-full rounded-lg border border-amber-200 bg-amber-50/60">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100/60"
		onclick={() => (open = !open)}
		aria-expanded={open}
	>
		{#if open}
			<ChevronDown size={14} class="shrink-0" />
		{:else}
			<ChevronRight size={14} class="shrink-0" />
		{/if}
		<GitBranch size={12} class="shrink-0" />
		<span class="font-medium">sub-agent 작업 {messages.length}개</span>
		{#if duration}
			<span class="text-amber-600">· {duration}</span>
		{/if}
	</button>

	{#if open}
		<div class="flex flex-col gap-1.5 border-t border-amber-200 px-3 py-3">
			{#each messages as message, i (message.lineIndex)}
				{@const hideHeader = !shouldShowHeader(messages[i - 1], message)}
				<div class={i === 0 ? '' : hideHeader ? 'mt-1.5' : 'mt-4'}>
					<MessageBlock {message} {showTool} {showThinking} {expandSignal} {expandValue} {hideHeader} />
				</div>
			{/each}
		</div>
	{/if}
</div>
