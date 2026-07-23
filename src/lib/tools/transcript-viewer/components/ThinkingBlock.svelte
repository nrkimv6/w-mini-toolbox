<script lang="ts">
	import { ChevronDown, ChevronRight, Brain } from 'lucide-svelte';

	interface Props {
		thinking: string;
		/** 상위(페이지)에서 "전체 펼치기/접기"를 트리거하기 위한 신호. 값이 바뀔 때마다 expandValue를 적용한다. */
		expandSignal?: number;
		expandValue?: boolean;
	}

	let { thinking, expandSignal, expandValue }: Props = $props();
	let expanded = $state(false);
	let lastSignal = 0;

	$effect(() => {
		if (expandSignal !== undefined && expandSignal !== lastSignal) {
			lastSignal = expandSignal;
			expanded = expandValue ?? expanded;
		}
	});
</script>

<div class="my-2 rounded-lg border border-purple-200 bg-purple-50/60">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-purple-700 hover:bg-purple-100/60"
		onclick={() => (expanded = !expanded)}
	>
		{#if expanded}
			<ChevronDown size={14} />
		{:else}
			<ChevronRight size={14} />
		{/if}
		<Brain size={14} />
		<span>Thinking</span>
	</button>
	{#if expanded}
		<div class="whitespace-pre-wrap break-words border-t border-purple-200 px-3 py-2 text-xs text-purple-900/80">
			{thinking}
		</div>
	{/if}
</div>
