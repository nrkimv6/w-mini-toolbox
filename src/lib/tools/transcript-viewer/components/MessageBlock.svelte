<script lang="ts">
	import { User, Bot, Terminal, GitBranch } from 'lucide-svelte';
	import TextContent from './TextContent.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import ToolCall from './ToolCall.svelte';
	import type { ContentBlock, RenderMessage, TextBlock, ThinkingBlock as ThinkingBlockType, ToolUseBlock } from '../types.js';

	interface Props {
		message: RenderMessage;
		showTool?: boolean;
		showThinking?: boolean;
		expandSignal?: number;
		expandValue?: boolean;
		/** true면 발화자 메타 헤더(아이콘/라벨/model/timestamp)를 렌더하지 않는다 (연속 발화자 병합용) */
		hideHeader?: boolean;
	}

	let { message, showTool = true, showThinking = true, expandSignal, expandValue, hideHeader = false }: Props = $props();

	// content를 순서를 보존하며 세그먼트로 묶는다.
	// - bubble: 연속된 text/기타 블록 → 하나의 말풍선으로 표시
	// - card:   thinking/tool_use → 말풍선 없이 독립 카드로 표시 (이중 테두리 방지)
	type Segment = { kind: 'bubble'; blocks: ContentBlock[] } | { kind: 'card'; block: ContentBlock };

	const segments = $derived.by(() => {
		const segs: Segment[] = [];
		let cur: { kind: 'bubble'; blocks: ContentBlock[] } | null = null;
		for (const block of message.content) {
			// tool_result는 매칭된 tool_use 카드 내부에서 함께 표시되므로 여기서는 건너뛴다
			if (block.type === 'tool_result') continue;
			if (block.type === 'thinking' || block.type === 'tool_use') {
				cur = null;
				segs.push({ kind: 'card', block });
			} else {
				if (!cur) {
					cur = { kind: 'bubble', blocks: [] };
					segs.push(cur);
				}
				cur.blocks.push(block);
			}
		}
		return segs;
	});

	const roleMeta = $derived.by(() => {
		switch (message.role) {
			case 'user':
				return { label: '사용자', icon: User, align: 'items-end', bubble: 'bg-purple-600 text-white' };
			case 'assistant':
				return { label: 'Claude', icon: Bot, align: 'items-start', bubble: 'bg-white border border-gray-200 text-gray-800' };
			case 'system':
				return { label: '시스템', icon: Terminal, align: 'items-start', bubble: 'bg-gray-100 border border-gray-200 text-gray-600' };
			default:
				return {
					label: message.role || message.lineType,
					icon: Terminal,
					align: 'items-start',
					bubble: 'bg-gray-100 border border-gray-200 text-gray-600'
				};
		}
	});

	const RoleIcon = $derived(roleMeta.icon);

	function formatTimestamp(ts?: string): string {
		if (!ts) return '';
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return ts;
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div id="transcript-msg-{message.lineIndex}" class="flex flex-col {roleMeta.align} gap-1">
	{#if !hideHeader}
		<div class="flex items-center gap-2 text-[11px] text-gray-400">
			<RoleIcon size={12} />
			<span class="font-medium text-gray-500">{roleMeta.label}</span>
			{#if message.model}
				<span class="rounded bg-gray-100 px-1.5 py-0.5">{message.model}</span>
			{/if}
			{#if message.isSidechain}
				<span class="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
					<GitBranch size={10} />
					sub-agent
				</span>
			{/if}
			{#if message.timestamp}
				<span>{formatTimestamp(message.timestamp)}</span>
			{/if}
		</div>
	{/if}

	<div class="flex w-full flex-col gap-1.5 {roleMeta.align}">
		{#each segments as seg (seg)}
			{#if seg.kind === 'bubble'}
				<div class="max-w-[85%] rounded-2xl px-4 py-3 {roleMeta.bubble}">
					{#each seg.blocks as block (block)}
						{#if block.type === 'text'}
							<TextContent text={(block as TextBlock).text} />
						{:else}
							<div class="text-xs italic opacity-50">(알 수 없는 블록: {block.type})</div>
						{/if}
					{/each}
				</div>
			{:else if seg.block.type === 'thinking'}
				{#if showThinking}
					<div class="w-full max-w-[85%]">
						<ThinkingBlock thinking={(seg.block as ThinkingBlockType).thinking} {expandSignal} {expandValue} />
					</div>
				{/if}
			{:else if seg.block.type === 'tool_use'}
				{#if showTool}
					<div class="w-full max-w-[85%]">
						<ToolCall block={seg.block as ToolUseBlock} {expandSignal} {expandValue} />
					</div>
				{/if}
			{/if}
		{/each}
	</div>
</div>
