<script lang="ts">
	/**
	 * 세션 진단 요약 패널.
	 *
	 * - 도구 사용 분포 / 실패율, 모델 전환, 응답 지연 상위, compact 발생 횟수를
	 *   접이식 패널로 보여준다. 기본 접힘.
	 * - 각 항목 클릭 시 `transcript-msg-{lineIndex}` DOM id로 스크롤 이동한다
	 *   (TokenTimeline이 쓰는 것과 동일한 점프 패턴).
	 * - 도구를 전혀 쓰지 않은 세션에서는 도구 관련 섹션에 빈 상태 문구를 보여준다.
	 */
	import { ChevronDown, ChevronRight, Wrench, AlertTriangle, Cpu, Clock, Combine } from 'lucide-svelte';
	import type { DiagnosticsSummary } from '../diagnostics.js';

	interface Props {
		diagnostics: DiagnosticsSummary;
	}

	let { diagnostics }: Props = $props();

	let expanded = $state(false);

	function jumpTo(lineIndex: number) {
		const el = document.getElementById(`transcript-msg-${lineIndex}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function formatGap(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		const seconds = ms / 1000;
		if (seconds < 60) return `${seconds.toFixed(1)}초`;
		const minutes = seconds / 60;
		if (minutes < 60) return `${minutes.toFixed(1)}분`;
		return `${(minutes / 60).toFixed(1)}시간`;
	}
</script>

<div class="rounded-xl border border-gray-200 bg-white">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-600"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
	>
		{#if expanded}
			<ChevronDown size={14} class="shrink-0 text-gray-400" />
		{:else}
			<ChevronRight size={14} class="shrink-0 text-gray-400" />
		{/if}
		<span>세션 진단 요약</span>
		{#if !diagnostics.hasToolUsage && diagnostics.modelSwitches.length === 0 && diagnostics.latencies.length === 0 && diagnostics.compactCount === 0}
			<span class="font-normal text-gray-300">표시할 항목 없음</span>
		{/if}
	</button>

	{#if expanded}
		<div class="space-y-4 border-t border-gray-100 px-3 py-3 text-xs text-gray-600">
			<!-- 도구 사용 분포 -->
			<div>
				<div class="mb-1.5 flex items-center gap-1.5 font-medium text-gray-500">
					<Wrench size={13} class="text-blue-500" />
					<span>도구 사용 분포</span>
				</div>
				{#if diagnostics.toolUsage.length === 0}
					<p class="pl-5 text-gray-300">이 세션에서는 도구를 사용하지 않았습니다.</p>
				{:else}
					<ul class="space-y-1 pl-5">
						{#each diagnostics.toolUsage as entry (entry.name)}
							<li>
								<button
									type="button"
									class="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-gray-50"
									onclick={() => jumpTo(entry.firstLineIndex)}
								>
									<span class="font-mono text-gray-700">{entry.name}</span>
									<span class="text-gray-400">{entry.count}회</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- 도구 실패율 -->
			<div>
				<div class="mb-1.5 flex items-center gap-1.5 font-medium text-gray-500">
					<AlertTriangle size={13} class="text-amber-500" />
					<span>도구 실패</span>
				</div>
				{#if diagnostics.toolFailures.length === 0}
					<p class="pl-5 text-gray-300">이 세션에서는 도구를 사용하지 않았습니다.</p>
				{:else if diagnostics.toolFailures.every((f) => f.failed === 0)}
					<p class="pl-5 text-gray-300">실패한 도구 호출이 없습니다.</p>
				{:else}
					<ul class="space-y-1 pl-5">
						{#each diagnostics.toolFailures.filter((f) => f.failed > 0) as entry (entry.name)}
							<li class="flex flex-wrap items-center gap-2">
								<span class="font-mono text-gray-700">{entry.name}</span>
								{#if entry.rate !== null}
									<span class="text-amber-600">{(entry.rate * 100).toFixed(0)}% 실패 ({entry.failed}/{entry.total})</span>
								{:else}
									<span class="text-amber-600">{entry.failed}건 실패 (표본 {entry.total}건 — 비율 미산출)</span>
								{/if}
								<span class="flex flex-wrap gap-1">
									{#each entry.failedLineIndexes as lineIndex (lineIndex)}
										<button
											type="button"
											class="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 hover:bg-amber-100"
											onclick={() => jumpTo(lineIndex)}
										>
											{lineIndex}
										</button>
									{/each}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- 모델 전환 지점 -->
			<div>
				<div class="mb-1.5 flex items-center gap-1.5 font-medium text-gray-500">
					<Cpu size={13} class="text-purple-500" />
					<span>모델 전환</span>
				</div>
				{#if diagnostics.modelSwitches.length === 0}
					<p class="pl-5 text-gray-300">모델 전환이 없습니다.</p>
				{:else}
					<ul class="space-y-1 pl-5">
						{#each diagnostics.modelSwitches as sw (sw.lineIndex)}
							<li>
								<button
									type="button"
									class="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-gray-50"
									onclick={() => jumpTo(sw.lineIndex)}
								>
									<span class="font-mono text-gray-500">{sw.fromModel}</span>
									<span class="text-gray-300">→</span>
									<span class="font-mono text-gray-700">{sw.toModel}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- 응답 지연 상위 -->
			<div>
				<div class="mb-1.5 flex items-center gap-1.5 font-medium text-gray-500">
					<Clock size={13} class="text-teal-500" />
					<span>응답 지연 상위</span>
				</div>
				{#if diagnostics.latencies.length === 0}
					<p class="pl-5 text-gray-300">측정 가능한 타임스탬프 간격이 없습니다.</p>
				{:else}
					<ul class="space-y-1 pl-5">
						{#each diagnostics.latencies as gap (gap.afterLineIndex)}
							<li>
								<button
									type="button"
									class="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-gray-50"
									onclick={() => jumpTo(gap.afterLineIndex)}
								>
									<span class="text-gray-700">{formatGap(gap.gapMs)}</span>
									<span class="text-gray-300">· {gap.beforeLineIndex}번 → {gap.afterLineIndex}번</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- compact 발생 횟수 -->
			<div class="flex items-center gap-1.5">
				<Combine size={13} class="text-gray-400" />
				<span class="font-medium text-gray-500">compact 발생</span>
				<span class="text-gray-600">{diagnostics.compactCount}회</span>
			</div>
		</div>
	{/if}
</div>
