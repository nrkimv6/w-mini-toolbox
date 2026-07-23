<script lang="ts">
	/**
	 * 메시지 순서 × 출력 토큰량 막대 스트립.
	 *
	 * - 세션 전체(필터 무관) 메시지 순서를 기준으로 `usage.output_tokens`가 있는
	 *   메시지만 막대로 그린다. 클릭하면 `MessageBlock`이 부여하는
	 *   `transcript-msg-{lineIndex}` DOM id로 스크롤 이동한다.
	 * - 이상치(중앙값 3배 초과) 막대는 강조색으로 표시한다.
	 */
	import type { RenderMessage } from '../types.js';

	interface Props {
		messages: RenderMessage[];
		/** 이상치 판정 임계값(세션 전체 출력 토큰 중앙값의 3배). 없으면 강조하지 않는다. */
		outlierThreshold?: number;
	}

	let { messages, outlierThreshold = Infinity }: Props = $props();

	interface Bar {
		lineIndex: number;
		tokens: number;
		isOutlier: boolean;
	}

	const bars = $derived.by((): Bar[] => {
		const result: Bar[] = [];
		for (const m of messages) {
			const tokens = m.usage?.output_tokens;
			if (typeof tokens === 'number' && Number.isFinite(tokens) && tokens > 0) {
				result.push({ lineIndex: m.lineIndex, tokens, isOutlier: tokens > outlierThreshold });
			}
		}
		return result;
	});

	const maxTokens = $derived(bars.reduce((max, b) => Math.max(max, b.tokens), 0));

	function heightPct(tokens: number): number {
		if (maxTokens <= 0) return 0;
		// 값이 있는 막대는 최소 4%로 바닥에 붙지 않게 한다.
		return Math.max(4, Math.round((tokens / maxTokens) * 100));
	}

	function jumpTo(lineIndex: number) {
		const el = document.getElementById(`transcript-msg-${lineIndex}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

{#if bars.length > 0}
	<div class="rounded-xl border border-gray-200 bg-white px-3 py-2">
		<div class="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-gray-400">
			<span>출력 토큰 타임라인</span>
			<span class="font-normal text-gray-300">클릭 시 해당 메시지로 이동</span>
		</div>
		<div class="flex h-12 items-end gap-px overflow-x-auto pb-0.5">
			{#each bars as bar (bar.lineIndex)}
				<button
					type="button"
					class="w-1 shrink-0 rounded-t transition-colors {bar.isOutlier
						? 'bg-amber-400 hover:bg-amber-500'
						: 'bg-purple-300 hover:bg-purple-500'}"
					style="height: {heightPct(bar.tokens)}%"
					title="{bar.tokens.toLocaleString()} 토큰"
					aria-label="메시지 {bar.lineIndex}로 이동 (출력 토큰 {bar.tokens.toLocaleString()}개)"
					onclick={() => jumpTo(bar.lineIndex)}
				></button>
			{/each}
		</div>
	</div>
{/if}
