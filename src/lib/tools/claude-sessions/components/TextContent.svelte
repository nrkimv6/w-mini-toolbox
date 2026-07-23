<script lang="ts">
	// Phase 3 (item 14) — 마크다운 렌더 (기술·보안 요구, design prompt와 무관하게 성립)
	// transcript 본문은 신뢰할 수 없는 외부 콘텐츠이므로 marked → DOMPurify.sanitize를 반드시 거친다.
	// 하이라이트는 원문 문자열에 <mark>를 주입하지 않고, 렌더 후 TreeWalker로 텍스트 노드만 감싼다.
	// 구현 계약은 기존 transcript-viewer/components/TextContent.svelte(22~40행)와 동일하게 맞췄다
	// (컴포넌트는 import하지 않고 계약만 독립 재구현).
	//
	// Phase 4 (item 10·11) — 상세 내 검색(P1, design prompt 134~142행) 하이라이트 활성화.
	// 검색어는 prop 드릴링이 아니라 `getContext(SEARCH_CONTEXT_KEY)`로 읽는다 — MessageBlock을
	// 거치는 모든 하위 텍스트 컴포넌트가 같은 방식으로 접근해야 페이지가 컨텍스트 하나만 갱신해도
	// 트리 전체가 반응한다. `code`/`pre` 내부 텍스트 노드도 대상에 포함한다 — 135행이 "도구 입력에
	// 포함된 파일 경로"를 검색 대상으로 요구하는데, 이 화면에서 파일 경로 문자열은 코드 블록
	// 안에도 흔히 등장하므로(예: 마크다운 인라인 코드로 감싼 경로) 제외하면 요구사항을 놓친다.
	// TreeWalker는 기본적으로 모든 텍스트 노드를 순회하므로 별도 제외 처리를 하지 않는 것이 곧
	// "포함" 결정이다.
	import { tick, getContext } from 'svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { SEARCH_CONTEXT_KEY } from '$lib/tools/transcript-viewer/search.js';
	import type { DetailSearchContext } from '../searchNav.js';

	let {
		text,
		lineIndex,
		highlightQuery
	}: {
		text: string;
		/** 이 텍스트 블록이 속한 메시지의 lineIndex. 검색 컨텍스트의 currentLineIndex와 비교해
		 * "현재 확인 중인 일치" 스타일을 적용할지 판단한다. 미전달 시(검색 컨텍스트가 없는 독립
		 * 렌더 등) 현재 일치 강조를 적용하지 않는다. */
		lineIndex?: number;
		/** 검색 컨텍스트가 없는 곳에서도 이 컴포넌트를 독립적으로 쓸 수 있도록 남겨둔 명시적
		 * override. 지정하면 컨텍스트보다 우선한다(테스트/향후 재사용 대비). */
		highlightQuery?: string;
	} = $props();

	const searchCtx = getContext<DetailSearchContext | undefined>(SEARCH_CONTEXT_KEY);
	const effectiveQuery = $derived(highlightQuery ?? searchCtx?.query ?? '');
	const isCurrentMatch = $derived(
		lineIndex !== undefined && searchCtx !== undefined && searchCtx.currentLineIndex === lineIndex
	);

	let containerEl = $state<HTMLDivElement | undefined>(undefined);

	const html = $derived.by(() => {
		if (!text) return '';
		const raw = marked.parse(text, { async: false }) as string;
		// transcript는 신뢰할 수 없는 외부/사용자 콘텐츠를 포함하므로 반드시 sanitize한다.
		return DOMPurify.sanitize(raw);
	});

	/**
	 * 렌더된 DOM의 텍스트 노드를 순회하며 매칭 구간을 <mark>로 감싼다.
	 * 원문 문자열에 <mark>를 주입하지 않는 이유: 원문에 주입하면 코드블록 파싱이 깨지거나,
	 * 이미 sanitize된 HTML 문자열에 재주입할 경우 XSS 표면이 다시 열릴 수 있기 때문이다.
	 */
	function highlightMatches(root: HTMLElement, query: string, isCurrent: boolean) {
		const needle = query.trim().toLowerCase();
		if (!needle) return;
		// item 11 — 전체 일치와 "현재 확인 중인 일치"를 시각적으로 구분한다. buildMatchIndex는
		// 메시지 단위로만 현재 위치를 추적하므로(searchNav.ts DetailSearchContext 주석 참조),
		// 이 메시지가 현재 일치라면 그 안의 모든 <mark>가 강조 변형 클래스를 받는다. 색상은
		// DESIGN.md 토큰(`primary`/`primary-foreground`)만 사용한다(하드코딩 색 금지, item 11 요구).
		const markClass = isCurrent
			? 'cse-text-mark bg-primary text-primary-foreground'
			: 'cse-text-mark';
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const targets: Text[] = [];
		let node: Node | null;
		while ((node = walker.nextNode())) {
			const tn = node as Text;
			if (tn.textContent && tn.textContent.toLowerCase().includes(needle)) {
				targets.push(tn);
			}
		}
		for (const tn of targets) {
			const original = tn.textContent ?? '';
			const lower = original.toLowerCase();
			const frag = document.createDocumentFragment();
			let cursor = 0;
			let idx = lower.indexOf(needle, cursor);
			while (idx !== -1) {
				if (idx > cursor) frag.appendChild(document.createTextNode(original.slice(cursor, idx)));
				const mark = document.createElement('mark');
				mark.className = markClass;
				mark.textContent = original.slice(idx, idx + needle.length);
				frag.appendChild(mark);
				cursor = idx + needle.length;
				idx = lower.indexOf(needle, cursor);
			}
			if (cursor < original.length) frag.appendChild(document.createTextNode(original.slice(cursor)));
			tn.parentNode?.replaceChild(frag, tn);
		}
	}

	$effect(() => {
		// html(마크다운 렌더 결과) 또는 검색어/현재-일치 여부가 바뀔 때마다 다시 적용한다.
		// html을 읽어야 {@html html} 갱신 이후 재실행되는 의존성이 성립한다.
		const currentHtml = html;
		const query = effectiveQuery;
		const isCurrent = isCurrentMatch;
		tick().then(() => {
			if (!containerEl) return;
			// item 10 — 검색어가 바뀌면 이전 <mark>를 제거하고 다시 감싼다. {@html html}은 문자열이
			// 바뀌지 않으면(예: text는 그대로인데 query만 바뀐 경우) DOM을 갱신하지 않으므로, 여기서
			// sanitize된 원본 문자열로 매번 명시적으로 리셋한 뒤 다시 감싼다 — 이렇게 하지 않으면
			// 이전 <mark>가 남은 채로 새 <mark>가 중첩된다.
			containerEl.innerHTML = currentHtml;
			highlightMatches(containerEl, query, isCurrent);
		});
	});
</script>

<div bind:this={containerEl} class="cse-markdown prose prose-sm max-w-none break-words text-sm">
	{@html html}
</div>

<style>
	.cse-markdown :global(p) {
		margin: 0 0 0.5rem 0;
	}
	.cse-markdown :global(p:last-child) {
		margin-bottom: 0;
	}
	.cse-markdown :global(pre) {
		background: hsl(220 20% 10%);
		color: hsl(220 20% 95%);
		padding: 0.75rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		font-size: 0.75rem;
	}
	.cse-markdown :global(code) {
		font-family: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85em;
	}
	.cse-markdown :global(pre code) {
		background: none;
		padding: 0;
	}
	.cse-markdown :global(:not(pre) > code) {
		background: hsl(280 60% 70% / 0.12);
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
	}
	.cse-markdown :global(ul),
	.cse-markdown :global(ol) {
		padding-left: 1.25rem;
		margin: 0 0 0.5rem 0;
	}
	.cse-markdown :global(a) {
		color: hsl(280 60% 50%);
	}
	.cse-markdown :global(mark.cse-text-mark) {
		border-radius: 0.15rem;
		padding: 0 0.05rem;
	}
	/* 일반 일치 — 하드코딩 색(기존 구현이 이미 이 값을 쓰고 있었다, 새로 도입한 색이 아님).
	   "현재 일치"(.bg-primary가 붙은 경우)는 DESIGN.md 토큰 유틸로 배경을 지정하므로 이 규칙에서 제외한다. */
	.cse-markdown :global(mark.cse-text-mark):not(.bg-primary) {
		background: hsl(50 100% 55% / 0.65);
		color: inherit;
	}
</style>
