<script lang="ts">
	/**
	 * 대화 목차(TOC) 사이드바.
	 *
	 * - 원본 user 메시지 기준 목차 항목을 렌더한다 (필터로 숨겨진 항목은 흐리게).
	 * - 클릭 시 해당 메시지(`MessageBlock`의 `id="transcript-msg-{lineIndex}"`)로 스크롤 점프한다.
	 * - IntersectionObserver로 뷰포트 내 메시지에 대응하는 항목을 활성 표시한다.
	 */

	export interface TocEntry {
		lineIndex: number;
		summary: string;
		timestamp?: string;
		/** 현재 필터 기준으로 화면에 실제 표시되는 메시지인지 (숨김이면 흐리게) */
		visible: boolean;
	}

	interface Props {
		entries: TocEntry[];
		/** 항목 클릭(점프) 이후 호출 — 모바일 드로어 닫기 등에 사용 */
		onJump?: () => void;
	}

	let { entries, onJump }: Props = $props();

	let activeLineIndex = $state<number | null>(null);

	function elementId(lineIndex: number): string {
		return `transcript-msg-${lineIndex}`;
	}

	function jump(lineIndex: number) {
		const el = document.getElementById(elementId(lineIndex));
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		onJump?.();
	}

	function formatTimestamp(ts?: string): string {
		if (!ts) return '';
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleTimeString();
	}

	// entries가 바뀔 때마다(파일 재로딩, 필터 변경 등) 대상 DOM 요소를 다시 찾아 옵저버를 재구성한다.
	// 언마운트/재실행 시 반드시 disconnect한다.
	$effect(() => {
		const targets = entries
			.map((e) => document.getElementById(elementId(e.lineIndex)))
			.filter((el): el is HTMLElement => el !== null);

		if (targets.length === 0) {
			activeLineIndex = null;
			return;
		}

		const intersecting = new Set<string>();

		const observer = new IntersectionObserver(
			(observerEntries) => {
				for (const oe of observerEntries) {
					if (oe.isIntersecting) intersecting.add(oe.target.id);
					else intersecting.delete(oe.target.id);
				}
				// DOM(문서) 순서상 가장 먼저 나오는 교차 요소를 "현재 위치"로 본다.
				const firstVisible = targets.find((el) => intersecting.has(el.id));
				if (firstVisible) {
					activeLineIndex = Number(firstVisible.id.replace('transcript-msg-', ''));
				}
			},
			{ root: null, rootMargin: '-10% 0px -70% 0px', threshold: 0 }
		);

		for (const el of targets) observer.observe(el);

		return () => observer.disconnect();
	});
</script>

<nav class="flex flex-col gap-0.5 text-xs" aria-label="대화 목차">
	{#if entries.length === 0}
		<p class="px-2 py-1.5 text-gray-400">사용자 발언이 없습니다.</p>
	{:else}
		{#each entries as entry (entry.lineIndex)}
			<button
				type="button"
				class="rounded-md px-2 py-1.5 text-left transition-colors {activeLineIndex === entry.lineIndex
					? 'bg-purple-100 font-medium text-purple-700'
					: 'text-gray-500 hover:bg-gray-50'} {entry.visible ? '' : 'opacity-40'}"
				onclick={() => jump(entry.lineIndex)}
			>
				<div class="truncate">{entry.summary}</div>
				{#if entry.timestamp}
					<div class="text-[10px] text-gray-400">{formatTimestamp(entry.timestamp)}</div>
				{/if}
			</button>
		{/each}
	{/if}
</nav>
