<script lang="ts">
	import { User, Bot, Terminal, GitBranch } from 'lucide-svelte';
	import TextContent from './TextContent.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import ToolCall from './ToolCall.svelte';
	import type { RenderMessage, TextBlock, ThinkingBlock as ThinkingBlockType, ToolUseBlock } from '../types.js';

	interface Props {
		message: RenderMessage;
		showTool?: boolean;
		showThinking?: boolean;
		expandSignal?: number;
		expandValue?: boolean;
	}

	let { message, showTool = true, showThinking = true, expandSignal, expandValue }: Props = $props();

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
		return d.toLocaleString();
	}

	// text 블록만 이어붙여 표시할지, 아니면 blocks 순서 그대로 렌더할지는 순서 보존이 중요하므로
	// content 배열을 순서대로 순회한다.
</script>

<div class="flex flex-col {roleMeta.align} gap-1">
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

	<div class="max-w-[85%] rounded-2xl px-4 py-3 {roleMeta.bubble}">
		{#if message.content.length === 0}
			<span class="text-xs italic opacity-60">(빈 메시지)</span>
		{/if}
		{#each message.content as block (block)}
			{#if block.type === 'text'}
				<TextContent text={(block as TextBlock).text} />
			{:else if block.type === 'thinking'}
				{#if showThinking}
					<ThinkingBlock thinking={(block as ThinkingBlockType).thinking} {expandSignal} {expandValue} />
				{/if}
			{:else if block.type === 'tool_use'}
				{#if showTool}
					<ToolCall block={block as ToolUseBlock} {expandSignal} {expandValue} />
				{/if}
			{:else if block.type === 'tool_result'}
				<!-- tool_result는 매칭된 tool_use 카드 내부에서 함께 표시되므로 별도 렌더 생략 -->
			{:else}
				<div class="text-xs italic opacity-50">(알 수 없는 블록: {block.type})</div>
			{/if}
		{/each}
	</div>
</div>
